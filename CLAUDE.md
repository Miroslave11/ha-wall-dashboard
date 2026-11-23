# CLAUDE.md – HA Wall Dashboard

Kontext pro Claude Code. Čti před každou změnou.

## O projektu

Nástěnný dashboard pro Home Assistant, který běží trvale na tabletu na zdi (Fully Kiosk Browser) a ovládá dům.
Je to **samostatná webová aplikace** (ne Lovelace karta). Hostuje se na Synology NAS (Docker + nginx) a s HA komunikuje přes **WebSocket API** knihovnou `home-assistant-js-websocket`.

- Vzhled: tmavý, „vzdušný“ glassmorphism. Dynamické prvky: místnost se při rozsvícení rozzáří, celé pozadí se oteplí podle počtu světel, pulzující pohyb, animovaný vysavač.
- Fotorámeček: po nečinnosti prezentace fotek z NASu s hodinami a počasím, noční černá obrazovka.
- Návrhová plocha 1280×800 se škáluje na displej (`Stage`).
- Veškeré UI texty jsou **česky**. Komentáře v kódu také česky.

Výchozí design vznikl jako interaktivní návrh. Současná implementace mu odpovídá 1:1 (barvy, rozměry, animace).

## Příkazy

```bash
npm run dev         # vývoj, demo režim (public/config.json má demo: true), http://localhost:5173
npm test            # Vitest (jsdom)
npm run typecheck   # tsc -b
npm run build       # produkční build → dist/
docker compose up -d --build   # nasazení (na NASu)
```

**Před dokončením každé změny spusť `npm run typecheck && npm test && npm run build`.**

**Dokumentace se udržuje s každou změnou (ve stejném commitu):**
- `docs/NAVOD-UZIVATEL.md` – návod k použití pro uživatele: vše, co je vidět nebo se ovládá (stránky, gesta, Nastavení, potíže).
- `docs/NAVOD-VYVOJAR.md` – technický popis: architektura, moduly (tabulka *Funkční moduly*), HA API, build, vydání, bezpečnost.
- `docs/KONFIGURACE.md` – konfigurační klíče; `deploy/synology/NAVOD.md` – nasazení na NAS.
- Při vydání nové verze přepsat číslo verze v hlavičce obou návodů.
- Návody jsou veřejné: žádné osobní údaje (viz Nasazení).

## Stack

- React 19 + TypeScript (strict) + Vite 8, Vitest
- `home-assistant-js-websocket` – připojení, auth, entity, služby
- Fonty lokálně přes `@fontsource` (Inter, Space Grotesk), bez CDN (kiosk může být offline)
- Žádná UI knihovna ani Tailwind. Celý vzhled je v `src/styles/global.css`.

## Architektura

```
src/main.tsx               načte config → adresa HA z aplikace (localStorage) → validace → <App>
src/App.tsx                Dashboard: Stage, NavRail, TopBar, stránky, PhotoFrame, idle timer, CSS proměnné motivu
src/config/
  types.ts                 DashboardConfig + UserSettings – jediný zdroj pravdy o konfiguraci
  loadConfig.ts            fetch config.local.json → config.json, deepMerge s DEFAULT_CONFIG, validateConfig
  userSettings.ts          nastavení z aplikace: extract/apply/parse (přepíše rooms, header, scenes, weather…)
  connection.ts            adresa HA zadaná v aplikaci (localStorage), normalizace, ověření dostupnosti
src/ha/
  types.ts                 rozhraní HassClient (společné pro real i demo)
  realClient.ts            OAuth (getAuth, tokeny v localStorage) nebo long-lived token, WS spojení, registry, user data
  mockClient.ts            demo simulace entit podle configu, reaguje na volání služeb; user data v localStorage
  HassContext.tsx          React kontext: client, entities, status, config (soubor + nastavení z HA), saveUserSettings
  actions.ts               doménová logika: roomBrightness, toggleRoom, toggleLight, activateScene, vacuum, cover
src/hooks/                 useClock, useIdle, useHistory, useForecast, useStageScale
src/components/            UI (každá karta = jedna komponenta)
src/utils/                 format (čeština, čas), history (parse/resample/sparkline), photos, weather, color,
                           fixtures (geometrie svítidel), registry (oblasti HA), entityOptions (výběr entit, návrh z oblasti)
src/components/HistoryModal  graf historie teploty/vlhkosti (klepnutí na kartu Obývák/Venku i na teplotu/vlhkost v místnosti), 6 h / 24 h / 7 dní, logika v utils/chart.ts
src/components/WeatherDetailModal  detailní předpověď (klepnutí na kartu počasí): po dnech a po hodinách (useForecast "daily"/"hourly")
src/components/LightDetailModal  panel světel místnosti (dlouhý stisk na svítidlo, např. LED pásek; u místnosti bez svítidel na ikonu žárovky; klepnutí na samotnou místnost nic nedělá): jas, rychlé barvy, odstín/sytost, teplota bílé, efekty. Nabízí jen to, co světlo umí (`lightCaps` z `supported_color_modes`); posuvník = LightSlider (lokální hodnota při tažení, volání služby ~150 ms), dlouhý stisk = hooks/useLongPress, logika barev v utils/lightColor.ts, služby v ha/actions.ts (`setLightPercent/Color/Kelvin/Effect`)
src/components/RadarPage  stránka Radar: Leaflet mapa (Esri World Dark Gray bez klíče; CARTO dlaždice vyžadují API klíč) + smyčka radaru RainViewer (`hooks/useRadarFrames`, `utils/radar.ts`, config `radar`); potřebuje internet, jinak hláška
src/components/HeatingPage  stránka Topení: `HeaterCard` (kruhový `HeaterDial`, režim, předvolby), `HeaterScheduleModal` (editor plánu z `text.*`), logika v `utils/heating.ts`, akce `setHeater*` v `ha/actions.ts`, config `heating`
src/components/CamerasPage  stránka Kamery: mřížka webkamer (`WebcamTile`, snímky se obnovují hookem `hooks/useWebcamSnapshot`), filtr podle skupin, celá obrazovka `WebcamViewer` (YouTube přehrávač nebo snímek); logika v `utils/webcams.ts`, config `webcams`, ve fotorámečku volitelně (`photoFrame.webcams`, `webcamEvery`)
src/components/VacuumDot  tečka vysavače v půdorysu: skutečná poloha ze senzorů Xiaomi Cloud Map Extractoru v3 (`vacuum.positionEntity`, `roomsEntity`, `roomEntity`, spárování `roomMap`), jinak animace během úklidu; klepnutí na řádek vysavače v `DevicesCard` otevře `VacuumRoomsModal` (úklid vybraných místností, výběr klepnutím na mapu `VacuumMapPicker`: obrázek `vacuum.mapEntity` + oblasti místností, bez něj schematický půdorys; `vacuumCleanRooms` → `vacuum.send_command` `app_segment_clean` s čísly segmentů z `roomMap`, logika v `utils/vacuumRooms.ts`); převod souřadnic (orientace ze spárovaných místností, poloha relativně v místnosti) v `utils/vacuumMap.ts`
src/components/Settings*   Nastavení: Připojení (ConnectForm), Místnosti, Ostatní entity, Webkamery (SettingsWebcams), Fotorámeček (SettingsPhotoFrame); EntityPicker = výběr entity
```

### Nastavení v aplikaci

- Adresa HA z aplikace (`connection.ts`) má přednost před `hass.url` ze souboru a vynutí OAuth. Před přesměrováním na přihlášení se ověří dostupnost (jinak by kiosk uvízl na chybové stránce).
- Entity z Nastavení = `UserSettings`, uložené v HA přes `frontend/set_user_data` (klíč `ha-wall-dashboard`) k přihlášenému uživateli. `HassProvider` je načte hned po připojení (dashboard se do té doby nevykreslí) a `useConfig()` vrací výslednou konfiguraci. Nová volba upravitelná v aplikaci = přidat do `UserSettings`, `extract/applyUserSettings` a formuláře.
- V Nastavení se fotorámeček sám nespouští (rozpracované změny).

### Tok dat

1. `HassProvider` vytvoří klienta: `MockHassClient` pokud `demo` nebo prázdné `hass.url`, jinak `connectHass()`.
2. `subscribeEntities` → `entities` v kontextu. Komponenty čtou stav přes `useEntity(id)`.
3. Akce volají `client.callService(domain, service, data, target)`. UI se aktualizuje až z nového stavu entity (žádný optimistický update, HA je zdroj pravdy).

### Použitá HA WebSocket API

| účel | volání |
|---|---|
| entity | `subscribeEntities(conn, cb)` |
| služby | `callService(conn, domain, service, data, target)` |
| historie grafů | `history/history_during_period` (`minimal_response`, `no_attributes`) → `parseHistoryResponse` |
| předpověď | `weather/subscribe_forecast` (`forecast_type: "daily"`) |
| oblasti pro výběr entit | `config/area_registry/list`, `config/device_registry/list`, `config/entity_registry/list` → `buildRegistry` |
| nastavení z aplikace | `frontend/get_user_data` / `frontend/set_user_data` (klíč `ha-wall-dashboard`) |

## Pravidla a konvence

- **Demo režim musí vždy fungovat.** Každá nová funkce, která čte entitu nebo volá službu, musí mít podporu v `mockClient.ts` (seed entity v `seed()`, obsluha služby v `callService`). Demo je hlavní vývojový nástroj.
- Nové volby konfigurace: přidat do `types.ts` (s JSDoc komentářem), výchozí hodnotu do `DEFAULT_CONFIG`, případně kontrolu do `validateConfig`, popis do `docs/KONFIGURACE.md` a ukázku do `public/config.json` i `config.example.json`.
- Entity ID nikdy nenatvrdo v komponentách, vždy z configu.
- Styl: třídy v `global.css` (BEM-like: `.room`, `.room--on`, `.room-glow`). Dynamické hodnoty přes CSS proměnné (`--glow-op`, `--glow-pos`). Barvy motivu `var(--accent)`, `var(--light)`, `rgba(var(--light-rgb), α)`.
- Skleněná karta = třída `.glass`. `backdrop-filter` je drahý: nepřidávat ho do animovaných nebo často překreslovaných prvků. Režim `?lowpower` ho vypíná.
- Dotykové cíle ≥ 44 px. Ovládací prvky jsou skutečné `<button>` s `aria-label`, kde chybí text.
- Čeština: čísla přes `formatNumber` (desetinná čárka), skloňování přes `czPlural`.
- Logiku, kterou jde testovat bez DOM, dávat do `utils/` nebo `ha/actions.ts` a pokrýt testem (`*.test.ts` vedle souboru).
- `public/config.local.json` je v `.gitignore` a obsahuje skutečné entity (případně token). Nikdy ho necommitovat.

## Nasazení

- Veřejný repozitář na GitHubu (bez osobních údajů: žádné skutečné IP, místa, jména, entity z domu; příklady `192.168.1.10`, Praha). `nas-balicek/` (gitignore) je soukromá kopie nasazení se skutečnou konfigurací.
- `Dockerfile`: multi-stage (node build na `$BUILDPLATFORM` → nginx), `ARG APP_VERSION` → `dist/version.txt`. `nginx.conf`: SPA fallback, no-store pro config a `version.txt`, `/photos/` s `autoindex_format json`.
- Vydání: `npm version …` + `git push --follow-tags` → `.github/workflows/release.yml` (testy, image `ghcr.io/miroslave11/ha-wall-dashboard:X.Y.Z` + `:latest`, amd64 + arm64, zip `deploy/synology` k vydání). `ci.yml` = typecheck, test, build na každý push.
- NAS: `deploy/synology/` (`docker-compose.yml` s image z GHCR, `.env.example`, `aktualizace.sh` pro Plánovač úloh DSM, `NAVOD.md`). Tablet se po nasazení nové verze sám obnoví (`hooks/useAppUpdate`, `utils/appVersion.ts`, kontrola `/version.txt` á 10 min, ne v Nastavení).
- Kořenový `docker-compose.yml`: sestavení ze zdrojáků, port 8099, volume `config.local.json` a `PHOTOS_DIR` → `/photos`; env `IMMICH_URL`, `IMMICH_API_KEY` z `.env` (viz `.env.example`).
- Fotky z Immiche (`photoFrame.source.type: "immich"`, `utils/photos.ts` → `listImmichAlbum`): prohlížeč volá `/immich/api/...`, nginx (`nginx.conf` je šablona, envsubst při startu) proxy-uje jen GET alb a náhledů a doplňuje hlavičku `x-api-key`; ve vývoji totéž dělá proxy ve `vite.config.ts`. Klíč nikdy do configu. Demo režim zůstává na `type: "list"`.
- HA potřebuje `http.cors_allowed_origins` s adresou dashboardu (kvůli OAuth `/auth/token`).

## Známá omezení

- Tečka vysavače ukazuje skutečnou polohu jen se senzory Xiaomi Cloud Map Extractoru v3 (alpha, cloud Xiaomi; senzory jsou v HA ve výchozím stavu vypnuté). Poloha je relativní v místnosti, ne v metrech: půdorys je schematický. Bez senzorů zůstává animace.
- Stránky Vysavač, Zahrádka, Žaluzie jsou zatím placeholdery (`PlaceholderPage`).
- Kamery (`CamerasPage`) jsou webkamery z internetu (snímek nebo YouTube). Domácí kamery z HA a živý stream HLS zatím nejsou. Snímky se stahují přímo z tabletu, takže server kamery musí povolit zobrazení na cizí stránce.
- Tlačítka scén (Ráno / Večer / Film / Noc) se na úvodní stránce nezobrazují (odebrána z půdorysu). Scény zůstávají v configu a v Nastavení, `activateScene` v `ha/actions.ts` je připravené pro případné nové místo.
- Klepnutí na místnost je záměrně vypnuté (světla se ovládají svítidly, `toggleRoom` zůstal pro ikonu žárovky u místností bez svítidel). Světla v `lights`, která nejsou `fixtures`, se tedy neovládají, jen se započítají do jasu.
- Fotorámeček neumí HEIC ani video. Zobrazení fotek (`photoFrame.portrait` / `landscape` / `kenBurns`, v Nastavení → Fotorámeček): fotky na výšku se neořezávají (rozostřené pozadí, dvojice, černé pozadí), orientace se pozná z načtené fotky (`utils/photos.ts` → `loadPhoto`, logika v `utils/photoLayout.ts`). Vysoké lišty se šipkami vlevo a vpravo listují vpřed a zpět (historie 40 snímků, po ručním listování 60 s pauza). Se zapnutými webkamerami je v pravém horním rohu přepínač Fotky + kamery / Jen kamery (jen ikony) (`photoFrame.webcamsOnly`, ukládá se do `UserSettings` přímo z rámečku).
- `Stage` má pevný poměr stran. Při jiném poměru displeje vzniknou okraje.

## Další kroky (backlog, seřazeno podle přínosu)

1. **Napojit skutečné entity.** V aplikaci: Nastavení → Připojení (adresa HA), pak Místnosti / Ostatní entity. Ověřit na tabletu. Další krok: editor půdorysu (tahání místností a svítidel myší).
2. ~~Detail místnosti~~ – hotovo (`LightDetailModal`: jas, barva, teplota bílé, efekty). Zbývá: ukládat barvu a jas do scén, ověřit na tabletu, co víc se osvědčí (ikona vs. dlouhý stisk).
3. **Probuzení pohybem.** Volba `photoFrame.wakeOnMotion: ["binary_sensor.chodba_pohyb"]`: když senzor přejde do `on`, fotorámeček se zavře (rozšířit `useIdle` o externí `wake`).
4. **Stránka Kamery – domácí kamery z HA.** (Webkamery z internetu jsou hotové.) Snímky přes `/api/camera_proxy/<entity_id>?token=<attributes.access_token>` (obnovovat každé 2 s), živý stream přes WS `camera/stream` (HLS) nebo MJPEG `/api/camera_proxy_stream/`. Klepnutí = celá obrazovka.
5. ~~Stránka Topení~~ – hotovo (kruhový ovladač, režim, předvolby, ventil, editor plánu). Zbývá: ověřit na tabletu a na skutečné hlavici (po změně cílové teploty v režimu Auto, zda hlavice přejde na předvolbu Ručně), případně víkendový plán (`…_holidays_schedule`).
6. **Stránka Žaluzie.** Všechny `cover.*` s pozicí a slidery.
7. **Fotorámeček – zdroje.** ~~Immich~~ – hotovo (album podle názvu). Zbývá: alba podle data („před rokem“), filtr na orientaci na šířku, více alb.
8. **Noční režim z HA.** Volitelná entita `input_boolean` místo pevného `blackout` okna, ztlumení jasu přes Fully Kiosk API (`fully.setScreenBrightness`).
9. **PWA / offline.** Service worker, aby se dashboard načetl i při krátkém výpadku NASu.
10. **ESLint + Prettier.** (GitHub Actions s typecheckem, testy a buildem hotové.)
