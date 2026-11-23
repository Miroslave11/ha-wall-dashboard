# Technický návod pro vývojáře

Jak aplikace funguje uvnitř, jak ji spustit, rozšířit a vydat. Ovládání z pohledu uživatele je v
[NAVOD-UZIVATEL.md](NAVOD-UZIVATEL.md), všechny konfigurační klíče v [KONFIGURACE.md](KONFIGURACE.md),
nasazení na NAS v [deploy/synology/NAVOD.md](../deploy/synology/NAVOD.md).

> Návod odpovídá verzi **1.3.0**.

## Obsah

1. [Přehled](#přehled)
2. [Vývojové prostředí](#vývojové-prostředí)
3. [Struktura projektu](#struktura-projektu)
4. [Start aplikace a konfigurace](#start-aplikace-a-konfigurace)
5. [Komunikace s Home Assistantem](#komunikace-s-home-assistantem)
6. [Demo režim](#demo-režim)
7. [UI: plocha, styly, komponenty](#ui-plocha-styly-komponenty)
8. [Funkční moduly](#funkční-moduly)
9. [Testy](#testy)
10. [Build, Docker a nginx](#build-docker-a-nginx)
11. [Vydání a automatická aktualizace](#vydání-a-automatická-aktualizace)
12. [Bezpečnost a soukromá data](#bezpečnost-a-soukromá-data)
13. [Postup při přidání funkce](#postup-při-přidání-funkce)
14. [Údržba dokumentace](#údržba-dokumentace)

## Přehled

Samostatná single-page aplikace (ne Lovelace karta). Prohlížeč na tabletu stáhne statické soubory z nginx
na NASu a pak mluví **přímo s Home Assistantem** přes WebSocket API (knihovna `home-assistant-js-websocket`).
NAS tedy neslouží jako backend, jen jako webový server. Výjimkou je proxy pro Immich, která drží API klíč.

```
 Tablet (Fully Kiosk)                 NAS (Docker: nginx)                Home Assistant
┌──────────────────────┐   HTTP   ┌──────────────────────────┐
│ React aplikace       │◄────────►│ index.html, assets/      │
│                      │          │ config(.local).json      │
│                      │          │ version.txt, /photos/    │
│                      │          │ /immich/* ──proxy+klíč──►│──► Immich
│                      │          └──────────────────────────┘
│                      │◄═══════════ WebSocket + OAuth ═══════════════► HA :8123
│                      │──────────► internet: RainViewer, Esri, webkamery, YouTube, Open-Meteo
└──────────────────────┘
```

| vrstva | technologie |
|---|---|
| UI | React 19, TypeScript (strict), žádná UI knihovna, vlastní CSS (`src/styles/global.css`) |
| build | Vite 8, výstup statické soubory v `dist/` |
| testy | Vitest + jsdom, Testing Library |
| HA | `home-assistant-js-websocket` (OAuth, WebSocket, služby) |
| mapa | Leaflet (jen stránka Radar, načítá se líně) |
| fonty | `@fontsource` lokálně (kiosk může být offline) |
| běh | nginx (`nginx:stable-alpine`) v Dockeru na Synology |

## Vývojové prostředí

Node.js podle `.nvmrc` (22).

```bash
npm install
npm run dev         # http://localhost:5173, poslouchá i v LAN (tablet: http://<IP-PC>:5173)
npm test            # Vitest
npm run typecheck   # tsc -b
npm run build       # produkční build → dist/
```

Bez `public/config.local.json` běží demo (`public/config.json` má `"demo": true`). Pro práci se skutečným HA
zkopírujte `config.example.json` do `public/config.local.json` (je v `.gitignore`), nebo zadejte adresu v
Nastavení → Připojení. Proxy na Immich čte `.env` (šablona `.env.example`).

**Před každým commitem:** `npm run typecheck && npm test && npm run build` (totéž hlídá CI).

## Struktura projektu

```
src/
  main.tsx                 načte config → adresa HA z localStorage → validace → <App>
  App.tsx                  Dashboard: Stage, NavRail, TopBar, stránky, PhotoFrame, idle timer, kontrola verze
  config/
    types.ts               DashboardConfig + UserSettings – jediný zdroj pravdy o konfiguraci (s JSDoc)
    loadConfig.ts          DEFAULT_CONFIG, načtení souboru, deepMerge, validateConfig
    userSettings.ts        nastavení z aplikace: extract / apply / parse
    connection.ts          adresa HA zadaná v aplikaci (localStorage), normalizace, test dostupnosti
  ha/
    types.ts               rozhraní HassClient (společné pro skutečného i demo klienta)
    realClient.ts          OAuth / long-lived token, WebSocket, historie, předpověď, registry, user data
    mockClient.ts          demo: simulace entit podle configu, reaguje na volání služeb
    HassContext.tsx        React kontext: client, entities, status, výsledná konfigurace, saveUserSettings
    actions.ts             doménová logika (světla, místnosti, scény, vysavač, žaluzie, topení)
  hooks/                   useClock, useIdle, useHistory, useForecast, useStageScale, useLongPress,
                           useRadarFrames, useWebcamSnapshot, useAppUpdate
  components/              UI, každá karta / stránka / modální okno = jedna komponenta
  utils/                   čistá logika bez DOM (formátování, grafy, barvy, topení, radar, fotky, …) + testy
  styles/global.css        celý vzhled
public/
  config.json              demo konfigurace
  photos/                  demo fotky (v Dockeru výchozí obsah /photos)
deploy/synology/           nasazení na NAS: compose s image z GHCR, aktualizace.sh, NAVOD.md
.github/workflows/         ci.yml (kontrola), release.yml (Docker image + vydání)
docs/                      KONFIGURACE.md, NAVOD-UZIVATEL.md, NAVOD-VYVOJAR.md
```

## Start aplikace a konfigurace

Konfigurace se skládá ve vrstvách, každá další přepisuje předchozí:

```
DEFAULT_CONFIG (loadConfig.ts)
  ← config.local.json, pokud existuje, jinak config.json      (deepMerge, loadConfig)
  ← adresa HA z localStorage (Nastavení → Připojení)           (applyStoredConnection, vynutí OAuth)
  → validateConfig – při chybě obrazovka „Dashboard se nespustil“
  ← UserSettings z HA (frontend/get_user_data)                  (applyUserSettings v HassProvider)
  = useConfig()
```

1. `main.tsx` zavolá `loadConfig()`. Soubor se stahuje při každém startu (nginx ho necachuje), takže úprava
   konfigurace na NASu = obnovit stránku.
2. `applyStoredConnection` dosadí adresu HA zadanou v aplikaci. Před přesměrováním na přihlášení
   `checkHassReachable` ověří, že HA odpovídá (jinak by kiosk uvízl na chybové stránce prohlížeče).
3. `HassProvider` vytvoří klienta a **před vykreslením dashboardu** načte `UserSettings` (s časovým limitem),
   aby na tabletu neproblikly entity ze šablony. Neplatná nebo nenačtená data → varování, platí soubor.
4. `useConfig()` vrací výslednou konfiguraci, `useHass().fileConfig` tu ze souboru (pro Nastavení).

`UserSettings` (v `config/types.ts`) je podmnožina konfigurace upravitelná v aplikaci (místnosti, horní lišta,
scény, počasí, teploty, vysavač, žaluzie, webkamery, fotorámeček). Ukládá se do HA k přihlášenému uživateli
pod klíčem `ha-wall-dashboard`. Nová volba upravitelná v aplikaci = přidat do `UserSettings`,
`extractUserSettings` / `applyUserSettings` a do formuláře v `Settings*`.

## Komunikace s Home Assistantem

### Rozhraní `HassClient` (`ha/types.ts`)

Komponenty nikdy nevolají knihovnu přímo, jen rozhraní `HassClient`. Implementují ho `realClient.ts` a
`mockClient.ts`, takže demo i skutečný provoz jdou stejnou cestou.

| metoda | HA WebSocket API |
|---|---|
| `subscribeEntities(cb)` | `subscribeEntities` – všechny stavy, průběžně |
| `onStatus(cb)` | události spojení (`connecting`, `connected`, `reconnecting`, `error`) |
| `callService(domain, service, data, target)` | `callService` |
| `fetchHistory(ids, hours)` | `history/history_during_period` (`minimal_response`, `no_attributes`) → `parseHistoryResponse` |
| `subscribeForecast(id, cb, type)` | `weather/subscribe_forecast` (`daily` / `hourly`) |
| `fetchRegistry()` | `config/area_registry/list`, `config/device_registry/list`, `config/entity_registry/list` → `buildRegistry` |
| `loadUserData` / `saveUserData` | `frontend/get_user_data` / `frontend/set_user_data` |
| `logout()` | smaže tokeny z localStorage |

### Přihlášení

- `hass.auth: "oauth"` (výchozí, adresa z aplikace ho vynutí): `getAuth` z knihovny, tokeny v localStorage
  (`ha-wall-dashboard:tokens`). Výměna kódu za token je chráněná proti dvojímu volání ve StrictMode
  (jinak smyčka přihlašování). HA musí mít adresu dashboardu v `http.cors_allowed_origins`.
- `hass.auth: "token"`: long-lived token z konfigurace. Jednodušší, ale nginx vydá `config.local.json` komukoli v LAN.

### Tok dat

1. `subscribeEntities` → stav `entities` v kontextu. Komponenty čtou `useEntity(id)` nebo `useHass().entities`.
2. Akce volají funkce z `ha/actions.ts`, které volají `client.callService(...)`.
3. **Žádný optimistický update.** UI se změní až z nového stavu entity. HA je jediný zdroj pravdy.
4. Výjimka: posuvníky (`LightSlider`, `HeaterDial`) drží lokální hodnotu během tažení a službu volají
   s omezenou frekvencí (asi 150 ms), resp. až po puštění.

## Demo režim

`MockHassClient` se použije, když `demo: true` nebo je prázdné `hass.url`.

- `seed()` vytvoří entity podle konfigurace (světla, čidla, počasí, topení, vysavač s mapou místností, …).
- `callService` obsluhuje služby, které aplikace volá, a mění stav entit, jako by to dělal HA.
- Historie a předpověď se generují. User data se ukládají do localStorage prohlížeče.

**Pravidlo:** každá nová funkce, která čte entitu nebo volá službu, musí mít podporu v `mockClient.ts`.
Demo je hlavní vývojový nástroj a ukázka pro nové uživatele.

## UI: plocha, styly, komponenty

- **Stage**: vše se kreslí na pevnou plochu 1280×800 (`stage` v konfiguraci) a `useStageScale` ji škáluje
  CSS transformací na displej. Rozměry v komponentách jsou tedy v pixelech návrhové plochy. Jiný poměr stran = okraje.
- **Styly** jsou jen v `global.css`, třídy BEM-like (`.room`, `.room--on`, `.room-glow`). Dynamické hodnoty přes
  CSS proměnné (`--glow-op`, `--glow-pos`). Barvy motivu `var(--accent)`, `var(--light)`, `rgba(var(--light-rgb), α)`,
  nastavuje je `App.tsx` z `theme`.
- **Sklo** = třída `.glass` (`backdrop-filter`). Je drahé: nedávat ho na animované nebo často překreslované prvky.
  `?lowpower` v URL přidá `html.low-power` a rozostření vypne.
- **Ambient**: `App.tsx` sečte jas místností (`roomBrightness`) a podle něj otepluje pozadí.
- **Přístupnost a dotyk**: cíle ≥ 44 px, ovládací prvky jsou `<button>`, bez textu s `aria-label`.
- **Dlouhý stisk**: `hooks/useLongPress` (550 ms). Klepnutí po dlouhém stisku se ignoruje.
- **Čeština**: všechny texty i komentáře česky, čísla `formatNumber` (desetinná čárka), skloňování `czPlural`.
- **Nečinnost**: `useIdle` spouští fotorámeček, v Nastavení je vypnutý.
- **Kontrola verze**: `useAppUpdate` čte `/version.txt` á 10 min a při změně stránku obnoví (ne v Nastavení).

## Funkční moduly

| modul | komponenty | logika | konfigurace |
|---|---|---|---|
| Půdorys | `FloorplanCard`, `RoomTile`, `FixtureControl`, `FloorplanFurniture`, `PassageLines`, `Projector`, `RoomClimate` | `utils/fixtures.ts` (geometrie, `newFixture` pro přidání v Nastavení), `utils/passages.ts`, `utils/projector.ts`, `ha/actions.ts` | `floorplan` |
| Detail světel | `LightDetailModal`, `LightSlider` | `utils/lightColor.ts` (`lightCaps` z `supported_color_modes`), `setLight*` v `actions.ts` | `fixtures`, `lights` |
| Vysavač v půdorysu | `VacuumDot` | `utils/vacuumMap.ts` (orientace ze spárovaných místností, poloha relativně v místnosti) | `vacuum` |
| Horní lišta | `TopBar` | | `header` |
| Počasí | `WeatherCard`, `WeatherDetailModal` | `utils/weather.ts`, `hooks/useForecast` | `weather` |
| Grafy | `TempCard`, `HistoryModal` | `utils/history.ts`, `utils/chart.ts`, `hooks/useHistory` | `temperatures`, `historyHours` |
| Vysavač | `DevicesCard`, `VacuumRoomsModal` (výběr místností) | `vacuumToggle`, `vacuumCleanRooms` (`vacuum.send_command` + `app_segment_clean`, protože xiaomi_miio nemá `clean_area`), `vacuumLocate`; `utils/vacuumRooms.ts` (místnosti z `roomMap`), `VacuumMapPicker` (skutečná mapa z `vacuum.mapEntity`: image entita extractoru, `utils/vacuumMap.ts` → `parseVacuumImage`, `roomPixelRect`; záloha schematický půdorys; adresa obrázku z `HassClient.hassUrl`) | `vacuum` |
| Topení | `HeatingPage`, `HeaterCard`, `HeaterDial`, `HeaterScheduleModal` | `utils/heating.ts`, `setHeater*` | `heating` |
| Radar | `RadarPage` (líně načtená) | `utils/radar.ts`, `hooks/useRadarFrames` (RainViewer) | `radar` |
| Kamery | `CamerasPage`, `WebcamTile`, `WebcamViewer` | `utils/webcams.ts`, `hooks/useWebcamSnapshot`, `utils/placeWeather.ts` (teplota na místě kamery z Open-Meteo, mezipaměť 15 min; hledání místa) | `webcams` |
| Fotorámeček | `PhotoFrame`, `WebcamCaption` (nadpis kamery s teplotou) | `utils/photos.ts` (list, autoindex, Immich), `utils/photoLayout.ts` (noc a filtr evropských kamer: `isNightAfterSunset`, `frameWebcams` v `utils/webcams.ts`); přepínač Fotky + kamery / Jen kamery ukládá `photoFrame.webcamsOnly` přes `withWebcamsOnly` (`config/userSettings.ts`) a `saveUserSettings` | `photoFrame` |
| Nastavení | `SettingsPage`, `SettingsRooms`, `SettingsOther`, `SettingsWebcams` (+ `WebcamPlaceEditor`), `SettingsPhotoFrame`, `ConnectForm`, `EntityPicker` | `config/userSettings.ts`, `utils/entityOptions.ts`, `utils/registry.ts` | `UserSettings` |
| Aktualizace | (`App.tsx`) | `utils/appVersion.ts`, `hooks/useAppUpdate` | — |

Stránky Vysavač, Zahrádka a Žaluzie jsou zatím `PlaceholderPage`.

### Zdroje fotek

- `list`: pevný seznam URL (demo).
- `autoindex`: nginx vrací výpis `/photos/` jako JSON (`autoindex_format json`), aplikace prochází podsložky
  do `maxDepth` a přeskakuje `@eaDir`.
- `immich`: prohlížeč volá `/immich/api/...`, nginx propouští jen čtení alb, náhledů a vyhledávání a doplní
  hlavičku `x-api-key`. Ve vývoji totéž dělá proxy ve `vite.config.ts`.

## Testy

- Soubory `*.test.ts` vedle testovaného souboru, prostředí jsdom.
- Logiku, kterou jde testovat bez DOM, dávejte do `utils/` nebo `ha/actions.ts` a pokryjte testem.
- `mockClient.test.ts` hlídá, že demo reaguje na služby. `loadConfig.test.ts` hlídá validaci a výchozí hodnoty.

## Build, Docker a nginx

**Dockerfile** (multi-stage):

1. `node:22-alpine` na `$BUILDPLATFORM`: `npm ci`, `npm run build`, zapíše `APP_VERSION` do `dist/version.txt`.
   Statický výstup je stejný pro všechny CPU, proto se build neemuluje.
2. `nginx:stable-alpine`: `nginx.conf` jako šablona (`/etc/nginx/templates`, envsubst dosadí `IMMICH_URL`
   a `IMMICH_API_KEY` při startu), `dist/` do `/usr/share/nginx/html`, demo fotky do `/photos`.

**nginx.conf**: SPA fallback na `index.html`; `config(.local).json` a `version.txt` s `no-store`; `/assets/`
cachované napořád (hash v názvu); `/photos/` s JSON výpisem; `/immich/` proxy jen pro vybrané GET/POST cesty.

Soubory na NASu (`deploy/synology/docker-compose.yml`) se připojují jako volume: `config.local.json` do kořene
webu, složka fotek `PHOTOS_DIR` na `/photos`. Bez `PHOTOS_DIR` se na `/photos` připojí pojmenovaný svazek
`photos` (Synology Docker chybějící složku pro bind mount sám nevytvoří a kontejner by nenastartoval).
Proměnné z `.env`: `DASHBOARD_PORT`, `DASHBOARD_TAG`, `PHOTOS_DIR`, `IMMICH_URL`, `IMMICH_API_KEY`. Kořenový `docker-compose.yml` sestavuje image ze zdrojáků (bez aktualizací).

## Vydání a automatická aktualizace

```
npm version minor && git push --follow-tags
        │
        ▼
.github/workflows/release.yml (tag vX.Y.Z)
  typecheck + testy → buildx linux/amd64 + linux/arm64 → ghcr.io/miroslave11/ha-wall-dashboard:X.Y.Z a :latest
  → kontrola image (start, /version.txt, index, config.json) → zip deploy/synology k vydání na GitHubu
        │
        ▼
NAS: Plánovač úloh DSM → deploy/synology/aktualizace.sh
  docker compose pull → při novém image up -d + image prune, zápis do aktualizace.log
        │
        ▼
Tablet: useAppUpdate (á 10 min /version.txt) → location.reload()
```

- `ci.yml` spouští typecheck, testy a build na každý push do `main` a na pull requesty.
- Verze: `package.json` (sémantické verzování). Opravy `npm version patch`, nové funkce `minor`,
  nekompatibilní změny konfigurace `major`.
- Ruční spuštění `release.yml` (workflow_dispatch) vytvoří jen testovací tag `dev-<sha>`, `:latest` nemění.
- Návrat ke starší verzi na NASu: `DASHBOARD_TAG=X.Y.Z` v `.env`.
- Při změně formátu konfigurace musí nová verze umět načíst i starý `config.local.json` a uložené
  `UserSettings` (NAS se aktualizuje sám, konfiguraci nikdo nepřepíše).

## Bezpečnost a soukromá data

- Repozitář je **veřejný**. Do gitu nepatří: `config.local.json`, `.env`, skutečné IP adresy, místa, jména,
  entity z konkrétního domu, tokeny. V příkladech používejte `192.168.1.10`, Prahu a obecné entity.
- Chráněno v `.gitignore` a `.dockerignore`: `config.local.json`, `.env`, `nas-balicek/`, nástroje s tokeny.
- Tokeny HA jsou jen v localStorage tabletu. API klíč Immiche jen v `.env` na NASu (nginx ho doplňuje),
  nikdy v konfiguraci ani v prohlížeči.
- Dashboard nemá vlastní přihlášení. Kdo vidí NAS v LAN, otevře stránku, ale bez přihlášení do HA nic neovládá
  (pokud se nepoužívá `auth: "token"`).

## Postup při přidání funkce

1. Konfigurace: typ v `config/types.ts` (s JSDoc), výchozí hodnota v `DEFAULT_CONFIG`, kontrola v `validateConfig`,
   popis v `docs/KONFIGURACE.md`, ukázka v `public/config.json` i `config.example.json`.
2. Entity ID nikdy natvrdo v komponentách, vždy z konfigurace.
3. Logika do `utils/` nebo `ha/actions.ts` + test.
4. Podpora v `mockClient.ts` (seed entit a obsluha služeb).
5. Komponenta a styly v `global.css`.
6. Volba upravitelná v aplikaci: `UserSettings` + `extract/applyUserSettings` + formulář.
7. Aktualizovat dokumentaci (viz níže).
8. `npm run typecheck && npm test && npm run build`, ověřit v demu.

## Údržba dokumentace

Návody se mění společně s kódem, ve stejném commitu:

| změna | upravit |
|---|---|
| cokoli, co uživatel vidí nebo ovládá | `docs/NAVOD-UZIVATEL.md` |
| architektura, nový modul, API, build, nasazení | `docs/NAVOD-VYVOJAR.md` |
| nový nebo změněný konfigurační klíč | `docs/KONFIGURACE.md` |
| nasazení na NAS | `deploy/synology/NAVOD.md` |
| přehled funkcí | `README.md`, `CLAUDE.md` |
| nové vydání | číslo verze v hlavičce obou návodů |
