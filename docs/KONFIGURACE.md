# Konfigurace (`config.json` / `config.local.json`)

> **Většinu nastavení jde udělat přímo v aplikaci** (Nastavení v levém menu) – viz [Nastavení v aplikaci](#nastavení-v-aplikaci) na konci. Soubor je pak potřeba jen pro věci, které aplikace neumí (půdorys, nábytek, motiv, zdroj fotek).

Konfigurace se načítá **za běhu**. Aplikace nejdřív zkusí `config.local.json`, pak `config.json`. Chybějící klíče se doplní výchozími hodnotami (`src/config/loadConfig.ts`). Klíče začínající podtržítkem (`"_comment"`) se ignorují, dají se tedy použít jako poznámky. Typy jsou popsané v `src/config/types.ts`.

Kde najdeš entity ID: Home Assistant → Nastavení → Zařízení a služby → Entity (sloupec *ID entity*).

## `hass`

| klíč | popis |
|---|---|
| `url` | Adresa HA, např. `http://192.168.1.10:8123`. Prázdná = demo režim. |
| `auth` | `"oauth"` (přihlášení přes HA, doporučeno) nebo `"token"`. |
| `token` | Long-lived token, jen pro `auth: "token"`. |

`demo: true` vynutí simulaci i při vyplněné URL.

## `stage`, `theme`

- `stage` – návrhové rozlišení (výchozí 1280×800). Celá plocha se proporcionálně škáluje na displej. Když má tablet jiný poměr stran (např. 16:9), vzniknou po stranách tmavé okraje. Řešení je nastavit stage na stejný poměr a upravit rozložení.
- `theme.accent` – akcentová barva (aktivní prvky, venkovní teplota, vysavač).
- `theme.light` – barva světla v místnostech.

## `header` (horní lišta)

| klíč | příklad | zobrazí |
|---|---|---|
| `sun` | `sun.sun` | čas do dalšího východu/západu slunce |
| `blindsBattery` | `sensor.zaluzie_baterie` | baterie žaluzií (`unknown` → „Neznámá“) |
| `presence` | `zone.home` / `person.petr` | Doma / Pryč (u `zone.home` počet osob) |
| `alerts` | `["binary_sensor.okno_kuchyn", …]` | počet entit ve stavu `on`, po klepnutí jejich seznam |

## `floorplan` (půdorys)

```json
"floorplan": {
  "title": "Domov",
  "width": 640, "height": 460,
  "furniture": true,
  "background": null,
  "rooms": [
    { "id": "obyvak", "name": "Obývák & kuchyň",
      "x": 300, "y": 0, "w": 340, "h": 300,
      "lights": ["light.obyvak", "light.kuchyn"],
      "temperature": "sensor.obyvak_teplota",
      "humidity": "sensor.obyvak_vlhkost",
      "motion": "binary_sensor.obyvak_pohyb",
      "glow": "50% 45%" }
  ]
}
```

- Souřadnice jsou v soustavě `width × height` (výchozí 640×460) a půdorys se vejde do karty automaticky. Místnosti se mají dotýkat, mezera 4 px (stěna) se kreslí sama.
- `lights` – `light.*` i `switch.*`. **Klepnutí na samotnou místnost nic nedělá.** Světla se ovládají klepnutím na jejich svítidla v půdorysu (`fixtures`); u místnosti bez zakreslených svítidel je „svítidlem“ ikona žárovky v rohu, která přepne všechna světla místnosti (když cokoli svítí, zhasne se vše, jinak se vše rozsvítí). Jas místnosti = nejvyšší jas jejích světel.
  - **Panel světel (jas a barva):** otevře se dlouhým stiskem na zakreslené svítidlo, např. na LED pásek (rovnou se vybere ono), u místnosti bez svítidel dlouhým stiskem na ikonu žárovky. Pro každé `light.*` nabídne jen to, co umí podle `supported_color_modes` z HA: jas, rychlé barvy, posuvníky odstínu a sytosti, teplotu bílé a efekty (`effect_list`). Barevné světlo září v půdorysu svou skutečnou barvou. Nic se nenastavuje, vše plyne z entity. V demu umí barvu světla s „led“ v názvu.
- `area` – nepovinné ID oblasti v HA (např. `"pracovna"`). V Nastavení se pak entity této oblasti nabízejí jako první a tlačítko *Doplnit z oblasti* vyplní světla, teploměr, vlhkoměr a pohyb samo.
- `glow` – odkud v místnosti světlo září (CSS pozice). Nepoužije se, když má místnost `fixtures`.
- `labelPos` – poloha názvu místnosti spolu s teplotou a vlhkostí: `"top-left"` (výchozí), `"top-right"`, `"bottom-left"`, `"bottom-right"`, `"center"` (uvnitř dlaždice; ikona žárovky přejde do protilehlého rohu, u `"center"` se nekreslí) nebo `"above"` / `"below"` (mimo dlaždici nad / pod místností, takže se v ní uvolní místo). Nastavuje se i v Nastavení → Místnosti → Poloha názvu a teploty.
- `hideName` – `true` skryje název místnosti na půdorysu (teplota a vlhkost zůstanou, čtečka obrazovky název dál čte). Nastavuje se v Nastavení → Místnosti → *Skrýt název místnosti na půdorysu*.
- `fixtures` – svítidla zakreslená v půdorysu. Každé září ze svého místa podle stavu své entity (svítí-li jen jedno, září jen ono) a klepnutím na něj se přepne samostatně. Ikona žárovky v rohu místnosti pak zmizí. Entity svítidel musí být i v `lights`. V Nastavení → Místnosti se svítidla přidávají tlačítkem *Přidat světlo do půdorysu* a LED pásky tlačítkem *Přidat LED pásek* (u pásku i délka a volba *Svisle*; nový vznikne u horní stěny uprostřed místnosti). Polohu lze upravit. Zhasnutá místnost nemá žádný stavový text. Intenzitu (např. „53 %“) ukazují jen místnosti se svítícím LED páskem (`type: "strip"`), je to jas pásku a klepnutím na ni se otevře jeho panel (jas, barva). U žárovek se intenzita nezobrazuje.

  ```json
  "fixtures": [
    { "entity": "light.loznice_svetlo_1", "name": "Světlo u komody", "x": 130, "y": 112 },
    { "entity": "light.loznice_led", "type": "strip", "name": "LED pásek nad postelí",
      "x": 194, "y": 4, "length": 82 }
  ]
  ```

  - `type` – `"bulb"` (žárovka, výchozí) nebo `"strip"` (LED pásek; je silnější než ostatní prvky, vypnutý je vidět jako světlý pruh a zapnutý vrhá výraznou záři; uprostřed má kulatý odznak s ikonou LED pásku, který zapnutý svítí barvou pásku).
  - `x`, `y` – v souřadnicích půdorysu (stejných jako místnosti). Žárovka: střed. Pásek: levý konec (u svislého horní). Pásek na stěně dejte na hranu místnosti (např. `y` = horní okraj místnosti + 4, u dolní stěny dolní okraj − 4; v ukázce je tak pásek za postelí v pracovně: `"x": 15, "y": 456, "length": 100`).
  - `length` – délka pásku, `vertical: true` – svislý pásek.
- `furniture` – obrysová kresba nábytku z `src/components/FloorplanFurniture.tsx` (pro výchozí půdorys).
- `background` + `backgroundOpacity` – místo kresby vlastní obrázek půdorysu (PNG/SVG, stejné proporce), např. `/floorplan.png` v `public/`.

- `projector` – projektor domácího kina (na úrovni `floorplan`, ne v místnosti; není v Nastavení, upravuje se v souboru). Ikona projektoru v půdorysu se klepnutím přepne a zapnutý projektor promítá na plátno: světelný kužel s mihotáním, zářící plátno, zrnka prachu v paprsku a nápis „KINO“, barva se pomalu střídá jako při filmu. Vypnutý nemá žádný paprsek ani animaci.

  ```json
  "projector": { "entity": "switch.zapni_kino", "name": "Domácí kino",
    "x": 398, "y": 68, "screen": { "x1": 637, "y1": 10, "x2": 637, "y2": 128 } }
  ```

  - `entity` – `switch.*` (nebo `input_boolean.*`), jehož stav `on` znamená, že se promítá.
  - `x`, `y` – poloha projektoru (střed ikony) v souřadnicích půdorysu.
  - `screen` – promítací plocha jako úsečka `x1, y1` → `x2, y2` ve stejných souřadnicích.

- `passages` – průchody mezi místnostmi (dveře, otvory). Zeď (okraj dlaždic) se v nich přeruší a přes otvor vede jemná čárkovaná čára. Jako značka dveří s křídlem a obloukem by to ve floorplánu rušilo, proto jen tohle. Není v Nastavení, upravuje se v souboru.

  ```json
  "passages": [
    { "x": 300, "y": 195, "length": 40 },
    { "x": 313, "y": 300, "length": 80, "horizontal": true }
  ]
  ```

  - Svislá zeď (výchozí): `x` = poloha zdi, otvor vede od `y` o `length` dolů. Vodorovná (`horizontal: true`): `y` = poloha zdi, otvor vede od `x` o `length` doprava.
  - `x` / `y` zdi musí být hrana místností (např. `x: 300` mezi místnostmi 0–300 a 300–640), jinak se v dlaždicích nic nevystřihne.

Výchozí rozložení (640×460):

```
┌──────────────┬────────────────┐
│ Ložnice      │ Obývák &       │  y 0–300
│ 0,0 300×300  │ kuchyň         │
│              │ 300,0 340×300  │
├────────┬──┬──┴────┬───────────┤
│ Pokoj  │WC│Chodba │ Koupelna  │  y 300–460
│ 210    │76│ 134   │ 220       │
└────────┴──┴───────┴───────────┘
```

## `scenes`

```json
"scenes": [
  { "name": "Večer", "entity": "scene.vecer" },
  { "name": "Film", "lights": { "light.obyvak": 0.25, "light.kuchyn": 0 } }
]
```

Buď `entity` (scéna v HA, doporučeno), nebo `lights` (entita → jas 0–1, 0 = vypnout). V demo režimu se `lights` použijí i u scén s `entity`, aby simulace něco dělala.

## `weather`, `temperatures`, `historyHours`

- `weather.entity` – `weather.*`. Předpověď se odebírá přes WS `weather/subscribe_forecast` (denní).
- `temperatures` – max. 2 karty s grafem. `color`: `"warm"` (oranžová) / `"accent"`. První karta s barvou `warm` se ukazuje i ve fotorámečku jako „uvnitř“.
- `historyHours` – délka grafu (výchozí 24 h). Historie se obnovuje každých 10 minut.

## `vacuum`, `blinds`

```json
"vacuum": { "entity": "vacuum.robot", "name": "Robotický vysavač", "area": "Obývák & kuchyň", "showOnPlan": true },
"blinds": { "entity": "cover.zaluzie_obyvak", "name": "Žaluzie" }
```

- Vysavač: „Uklidit“ = `vacuum.start`, „Do doku“ = `vacuum.return_to_base`. `showOnPlan` (výchozí zapnuto) ukazuje tečku vysavače v půdorysu. Bez senzorů mapy je to jen animace během úklidu.

### Skutečná poloha vysavače

Polohu dávají senzory integrace **Xiaomi Cloud Map Extractor v3** (HACS / Marketplace, nastavuje se v UI, přihlášení QR kódem). Integrace je ve výchozím stavu vypnuté: v HA je zapněte (Nastavení → Zařízení → vysavač → entity).

```json
"vacuum": {
  "entity": "vacuum.robot",
  "positionEntity": "sensor.robot_vacuum_position",
  "roomsEntity": "sensor.robot_rooms",
  "roomEntity": "sensor.robot_vacuum_room_id",
  "mapEntity": "image.robot_live_map",
  "roomMap": { "1": "koupelna", "2": "obyvak", "3": "chodba", "4": "loznice", "5": "wc", "6": "pokoj", "7": "pokoj" }
}
```

| klíč | význam |
|---|---|
| `positionEntity` | senzor polohy, atributy `x`, `y` v souřadnicích mapy vysavače |
| `roomsEntity` | senzor místností vysavače, v atributech obdélníky `"1": { x0, y0, x1, y1 }` (povinný k `positionEntity`) |
| `roomEntity` | nepovinný senzor s číslem místnosti, kde vysavač je; bez něj se místnost pozná z obdélníků |
| `mapEntity` | nepovinný obrázek mapy vysavače (`image.…_live_map` z extractoru, má kalibraci a místnosti v atributech); okno vysavače na něm ukáže místnosti k vybrání, bez něj (nebo když se obrázek nenačte) se použije schematický půdorys |
| `roomMap` | číslo místnosti vysavače → `id` místnosti v půdorysu; víc čísel smí vést do jedné místnosti; stejná čísla se posílají vysavači jako segmenty při úklidu vybraných místností (okno po klepnutí na vysavač, příkaz `app_segment_clean`) |

Tečka se ukazuje mimo dok (úklid, návrat, pauza, chyba) a plynule se posouvá. Kreslí se vždy uvnitř místnosti, kde vysavač je, podle jeho relativní polohy v obdélníku té místnosti. Půdorys je schematický, takže přesný přepočet celé mapy by tečku posouval přes zdi. Otočení a zrcadlení mapy se pozná ze spárování samo, potřeba jsou aspoň 3 spárované místnosti (jinak se předpokládá mapa bez otočení). V aplikaci: Nastavení → Ostatní → Poloha vysavače v půdorysu (tlačítko *Najít senzory mapy* vyplní senzory podle jejich názvů).
- Žaluzie: `cover.open_cover` / `cover.set_cover_position` 50 / `cover.close_cover`. Poloha se čte z `current_position`.

## `heating` (stránka Topení)

Jedna karta na radiátorovou hlavici (termostatický ventil): kruhový ovladač cílové teploty, otevření ventilu, režim, předvolby a editor týdenního plánu.

```json
"heating": [
  { "name": "Pracovna",
    "entity": "climate.topeni_ventil_pracovna",
    "position": "sensor.topeni_ventil_pracovna_position",
    "schedule": "text.topeni_ventil_pracovna_workdays_schedule",
    "battery": "binary_sensor.topeni_ventil_pracovna_battery_low",
    "window": "binary_sensor.topeni_ventil_pracovna_window_open" }
]
```

- `entity` – `climate.*` hlavice (cílová teplota, režim Vypnuto / Auto / Topit, předvolba). Rozsah a krok teploty bere z hlavice (`min_temp`, `max_temp`, `target_temp_step`).
- `position` – senzor otevření ventilu v % (ukáže se jako proužek „Ventil“).
- `schedule` – entita `text.*` s plánem ve tvaru `06:00/22°C 08:00/22°C …` (Zigbee2MQTT hlavice, např. `…_workdays_schedule`). Tlačítko *Plán topení* otevře editor: časová osa dne a řádky s časem a teplotou (po 15 minutách a po kroku hlavice), počet bodů zůstává, jaký plán má hlavice. Uloží se jedním zápisem celého textu (`text.set_value`). Plán „workdays“ platí pro všechny dny, jen když je hlavice v týdenním programu „7 dní“ (`select.…_week`); jinak je pro víkend ještě `…_holidays_schedule`, ten dashboard neupravuje.
- `battery` / `window` – binary_sensory slabé baterie a otevřeného okna, ukážou se jako štítek na kartě (nepovinné).
- `presets` – předvolby, které se na kartě nabízejí (nepovinné, výchozí `schedule`, `manual`, `boost`, `eco`, `away`; jen ty, které hlavice umí).

Cílová teplota se po klepnutí na −/+ odešle s prodlevou 0,7 s (hlavice na baterii nedostane příkaz při každém klepnutí), při tažení po oblouku až po puštění. Karty a plán se upravují jen v souboru, v Nastavení v aplikaci nejsou.

## `radar` (stránka Radar)

Meteorologický radar srážek na mapě, animovaná smyčka posledních ~2 hodin ([RainViewer](https://www.rainviewer.com/api.html), bez klíče, jen pro osobní použití; dashboard ukazuje požadovanou atribuci). Podkladová mapa je Esri World Dark Gray (tmavá, bez klíče, s atribucí Esri, HERE, Garmin, © OpenStreetMap). Potřebuje internet; bez něj stránka ukáže hlášku a zbytek dashboardu funguje.

```json
"radar": { "lat": 50.0755, "lon": 14.4378, "zoom": 7, "name": "Praha" }
```

- `lat`, `lon` – střed mapy (zeměpisná šířka a délka). Bez bloku `radar` je střed ČR.
- `zoom` – počáteční přiblížení (3–10, výchozí 7 = celá ČR). Radar má nejvyšší detail na úrovni 7, výš se jen zvětšuje.
- `name` – popisek značky ve středu mapy (nepovinné).

Na stránce lze mapu posouvat a přibližovat, smyčku zastavit tlačítkem a snímek vybrat posuvníkem. Seznam snímků se obnovuje každých 10 minut.

## `webcams` (stránka Kamery)

```json
"webcams": [
  { "id": "snezka", "name": "Sněžka", "group": "Česko", "type": "image", "url": "https://…/kamera.jpg", "refreshSec": 60, "source": "provozovatel" },
  { "id": "etna", "name": "Etna", "group": "Itálie", "type": "youtube", "url": "https://www.youtube.com/watch?v=…", "inFrame": false }
]
```

- `type: "image"` – adresa snímku (JPEG), obnovuje se po `refreshSec` sekundách (výchozí 60, nejméně 10). K adrese se přidává parametr `_=<čas>`, aby prohlížeč nebral snímek z cache. Snímky se stahují přímo z tabletu (bez proxy), s hlavičkou `Referrer-Policy: no-referrer`; server kamery musí povolit zobrazení obrázku na cizí stránce.
- `type: "youtube"` – živý přenos, `url` je ID videa (11 znaků) nebo odkaz (`watch?v=`, `youtu.be/`, `/live/`). V mřížce je náhled (`i.ytimg.com/vi/<id>/maxresdefault_live.jpg`, obnovuje se po dvou minutách), po klepnutí se spustí přehrávač (bez zvuku). Náhled živého přenosu není oficiálně zdokumentovaný; když chybí, dlaždice ukáže „Kamera je nedostupná“, ale přehrávač funguje.
- `group` – skupina pro filtr nad mřížkou (Vše / Česko / …). `source` – kdo kameru provozuje, ukáže se na celé obrazovce. `inFrame: false` – kamera se nezařadí do fotorámečku. `region` – `"europe"` (výchozí) nebo `"other"` (kamera v jiném časovém pásmu, viz `webcamsSkipEuropeAtNight`).
- Nic z toho se neukládá na NAS ani do HA mimo Nastavení → Webkamery (tam se kamery přidávají, řadí a odebírají a ukládají se jako ostatní nastavení). Při neúspěšném načtení zůstane poslední snímek s označením „nedostupná“.
- Windy a podobné katalogy: snímky bezplatného Windy API mají odkazy s platností 10 minut a vyžadují odkaz na Windy, proto zatím nejsou podporované.

## `photoFrame`

```json
"photoFrame": {
  "enabled": true,
  "idleSeconds": 180,
  "slideSeconds": 12,
  "shuffle": true,
  "portrait": "blur",
  "landscape": "crop",
  "kenBurns": "on",
  "webcams": false,
  "webcamEvery": 4,
  "webcamsSkipEuropeAtNight": false,
  "webcamsOnly": false,
  "source": { "type": "immich", "albumName": "Fotky pro wall panel" },
  "blackout": { "from": "23:30", "to": "06:00", "screenOff": false }
}
```

- `portrait` – fotky na výšku (poznají se z rozměrů načtené fotky, funguje pro Immich i složku): `"blur"` (výchozí) celá fotka na rozostřeném pozadí, `"pair"` dvě fotky na výšku vedle sebe, `"black"` celá fotka na černém pozadí, `"crop"` ořez na celou obrazovku (dřívější chování). U `"pair"` se k fotce na výšku hledá druhá mezi následujícími šesti fotkami (a přesune se hned za ni); když žádná není, použije se `"blur"`. Rozostřené pozadí je zmenšená ztmavená kopie fotky (levné i na slabém tabletu); u fotky z cizí domény bez CORS se použije CSS rozostření (v `?lowpower` jen černá).
- `landscape` – fotky na šířku: `"crop"` (výchozí) vyplní obrazovku s malým ořezem, `"blur"` celé na rozostřeném pozadí, `"black"` celé na černém.
- `kenBurns` – pohyb fotek: `"on"` (výchozí) přiblížení a posun, `"subtle"` jemný, `"off"` žádný. Fotky zobrazené celé se hýbou nejvýš nepatrně (zvětšení 2,5 %), ať se okraje neořezávají.
- `webcams` – prokládat fotky záběry z webkamer (`webcams`, kromě těch s `inFrame: false`); `webcamEvery` – jedna kamera po tolika fotkách (výchozí 4), kamery se střídají dokola. Snímek kamery se nikdy neořezává (rozostřené pozadí) a má v rohu její název. Nedostupná kamera (do 8 s se nenačte) se přeskočí. `webcamsSkipEuropeAtNight` – po západu slunce + 30 min (podle `header.sun`, do východu) se ve fotorámečku vynechají kamery z Evropy (`region` jiný než `"other"`), protože tam je tma; kamery s `region: "other"` zůstávají. Výchozí vypnuto, bez entity slunce se nic nevynechává. `webcamsOnly` – jen webkamery bez fotek (platí jen se zapnutým `webcams`); když žádná kamera neodpoví nebo jsou v noci všechny vynechané, ukážou se fotky. Přepíná se i přímo na rámečku (dvě ikony v pravém horním rohu: fotka = „Fotky + kamery“, kamera = „Jen kamery“; ukládá se do nastavení z aplikace). Nastavuje se i v Nastavení → Fotorámeček.
- Všechny tři volby se nastavují i v Nastavení → Fotorámeček → Zobrazení fotek (přepíšou hodnoty ze souboru).
- **Listování:** vlevo a vpravo jsou vysoké lišty se šipkou (88 × 360 px) pro předchozí a další snímek. Zpět se dá vrátit až o 40 zobrazených snímků (u dvojice se vrací celá dvojice). Po ručním listování se prezentace na 60 s zastaví, aby šlo fotku prohlédnout; pak pokračuje, od místa, kde se skončilo (po návratu zpět nejdřív znovu projde už zobrazené snímky).

- `source.type: "immich"` – album v Immichi podle názvu (rozlišuje se jen velikost písmen mimo češtinu, okolní mezery se ignorují; najde i alba sdílená s uživatelem klíče). Volitelně `imageSize` (`"preview"` výchozí, ~1440 px, nebo `"fullsize"`) a `baseUrl` (výchozí `"/immich"`). Fotky se berou jako náhledy JPEG, takže funguje i HEIC; videa se přeskakují. Seznam se obnovuje každou hodinu. Nastavení Immiche viz README (proměnné `IMMICH_URL`, `IMMICH_API_KEY`).
- `source.type: "autoindex"` – výpis složky z nginx (Docker, volume `/photos`). Ve vývoji (`npm run dev`) autoindex není, použij `"list"`.
- `source.type: "list"` – pevný seznam URL: `{ "type": "list", "urls": ["/photos/a.jpg"] }`.
- `blackout` – v tomto okně je místo fotek černá obrazovka. Okno může přecházet přes půlnoc. `screenOff: true` navíc vypne displej ve Fully Kiosk.

## Nastavení v aplikaci

V levém menu **Nastavení** má pět záložek:

- **Připojení** – adresa Home Assistantu. Po zadání se ověří, že na ní HA odpovídá, a tablet se přesměruje na přihlášení (vždy OAuth, token se v aplikaci nezadává). Adresa se uloží v prohlížeči tabletu (localStorage) a má přednost před `hass.url` ze souboru. Tlačítko *Použít adresu ze souboru* ji zase smaže.
- **Místnosti** – název, oblast v HA, světla, svítidla v půdorysu, teploměr, vlhkoměr, pohybové čidlo; přidání a smazání místnosti. Poloha v půdorysu je v části *Pokročilé*.
- **Ostatní entity** – počasí, grafy teplot, vysavač, žaluzie, scény (i `script.*`) a horní lišta (slunce, přítomnost, baterie, upozornění).
- **Webkamery** – seznam kamer pro stránku Kamery (název, skupina, snímek nebo YouTube, obnova, zdroj, zda je dát do fotorámečku, zda jsou mimo Evropu), řazení a odebrání.
- **Fotorámeček** – zapnutí, po jaké nečinnosti se spustí, doba zobrazení jedné fotky, náhodné pořadí a noční černá obrazovka (od–do, volitelně vypnutí displeje). Zdroj fotek (`photoFrame.source`) se mění jen v souboru.

Entity se vybírají ze seznamu s hledáním (bez diakritiky – „prac“ najde „Pracovna“). Nahoře jsou entity z oblasti místnosti a se správným typem čidla. Skryté a konfigurační entity se ukážou jen při hledání.

**Kam se ukládá:** po *Uložit* do Home Assistantu k přihlášenému uživateli (WS `frontend/set_user_data`, klíč `ha-wall-dashboard`). Nastavení tedy nezmizí při smazání dat prohlížeče a dá se upravit i z počítače – stačí se přihlásit jako stejný uživatel (např. „Tablet“). Víc tabletů pod stejným uživatelem sdílí stejné nastavení. V demo režimu se ukládá do prohlížeče.

**Přednost:** uložené nastavení přepíše v konfiguraci ze souboru `floorplan.rooms`, `header`, `scenes`, `weather`, `temperatures`, `vacuum`, `blinds` a v `photoFrame` volby `enabled`, `idleSeconds`, `slideSeconds`, `shuffle`, `portrait`, `landscape`, `kenBurns` a `blackout`. Ostatní (rozměry půdorysu, nábytek, motiv, zdroj fotek) zůstává ze souboru. Tlačítko *Smazat nastavení z aplikace* (záložka Připojení) vrátí vše na soubor.

Před uložením proběhne stejná kontrola jako u souboru (`validateConfig`), chyby se ukážou dole na stránce.
