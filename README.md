# HA Wall Dashboard

Nástěnný dashboard pro Home Assistant ve skleněném (glassmorphism) stylu. Je to **samostatná webová aplikace**: běží na Synology NAS v Dockeru a s Home Assistantem mluví přes WebSocket API. Tablet na zdi jen otevře její adresu (ideálně ve Fully Kiosk Browseru).

**Funkce**

- Interaktivní půdorys. Světla se ovládají klepnutím na jednotlivá svítidla (klepnutí na samotnou místnost nic nedělá), dlouhý stisk na svítidlo, např. LED pásek, otevře jas a barvu. Místnost se rozzáří podle jasu.
- Tlačítko „Vše zhasnout“. Scény jsou v configu a v Nastavení, na úvodní stránce se zatím nezobrazují.
- Počasí s 5denní předpovědí, teploty s 24h grafem z historie HA.
- Robotický vysavač (start / do doku) a žaluzie (nahoru / napůl / dolů).
- Horní lišta: hodiny, východ/západ slunce, baterie žaluzií, upozornění (otevřená okna…), přítomnost.
- **Fotorámeček**: po nastavené době nečinnosti se spustí prezentace fotek z NASu s hodinami a počasím. V noci může být černá obrazovka.
- **Demo režim** se simulovanými entitami, takže vývoj jde i bez Home Assistantu.
- Plocha 1280×800 se automaticky škáluje na libovolné rozlišení tabletu.

---

## Rychlý start (vývoj)

Potřebuješ Node.js 22+.

```bash
npm install
npm run dev
```

Otevři `http://localhost:5173`. Poběží demo režim (`public/config.json` má `"demo": true`).
Server poslouchá i v LAN, takže dashboard jde zkusit rovnou na tabletu přes `http://<IP-počítače>:5173`.

```bash
npm test            # unit testy (Vitest)
npm run typecheck   # kontrola typů
npm run build       # produkční build do dist/
```

## Napojení na Home Assistant

**Nejjednodušší cesta – bez úprav souborů:**

1. Povol adresu dashboardu v HA (bod 2 níže – CORS). To je jediná věc, kterou je nutné udělat v souboru.
2. Otevři dashboard (běží demo) → **Nastavení → Připojení** → zadej adresu HA (např. `http://192.168.1.10:8123`) → *Připojit a přihlásit* → přihlas se do HA.
3. **Nastavení → Místnosti / Ostatní entity**: vyber entity ze seznamu (nebo *Doplnit z oblasti*) a dej *Uložit*. Nastavení se uloží přímo do Home Assistantu k přihlášenému uživateli.

Podrobnosti v [docs/KONFIGURACE.md – Nastavení v aplikaci](docs/KONFIGURACE.md#nastavení-v-aplikaci). Postup přes soubor níže funguje dál – hodí se pro půdorys, svítidla v plánu, motiv a fotorámeček.

1. **Konfigurace.** Zkopíruj šablonu a vyplň URL Home Assistantu a svoje entity:
   ```bash
   cp config.example.json public/config.local.json
   ```
   `config.local.json` má přednost před `config.json` a není v gitu. Popis všech klíčů najdeš v [docs/KONFIGURACE.md](docs/KONFIGURACE.md).

2. **CORS v Home Assistantu.** Dashboard běží na jiné adrese než HA, takže ji musíš v HA povolit. Do `configuration.yaml` přidej a HA restartuj:
   ```yaml
   http:
     cors_allowed_origins:
       - http://192.168.1.20:8099   # adresa dashboardu na NASu
       - http://192.168.1.50:5173   # (volitelně) vývojový server
   ```

3. **Přihlášení.** Jsou dvě možnosti, `hass.auth` v konfiguraci:
   - `"oauth"` (doporučeno). Při prvním otevření se tablet přesměruje na přihlášení do HA a pak se vrátí. Tokeny se uloží v prohlížeči tabletu a obnovují se samy. Doporučuji v HA založit samostatného uživatele bez admin práv, např. „Tablet“.
   - `"token"`. Long-lived token (HA → Profil → Zabezpečení → Dlouhodobé přístupové tokeny) se vloží do `hass.token`. Je to jednodušší, ale **nginx soubor `config.local.json` vydá komukoli v síti** (`http://<NAS>:8099/config.local.json`), takže token by si mohl přečíst kdokoli v LAN. Doporučujeme OAuth.

> ⚠️ Pokud dashboard poběží přes **https** a HA přes **http**, prohlížeč spojení zablokuje (mixed content). Používej buď obojí http v LAN, nebo obojí https.

## Nasazení na Synology (Docker / Container Manager)

Doporučený způsob je hotový image z GitHubu s automatickou aktualizací. Všechny soubory a podrobný návod
jsou ve složce [deploy/synology](deploy/synology/NAVOD.md) (najdeš je i jako `ha-wall-dashboard-synology.zip` u každého vydání).

1. Na NASu vytvoř `/volume1/docker/ha-wall-dashboard` a nahraj do ní `docker-compose.yml`, `aktualizace.sh`,
   `.env` (z `.env.example`) a `config.local.json` (z `config.example.json`).
2. Container Manager → Projekt → Vytvořit → tato složka → použít existující `docker-compose.yml`.
3. Plánovač úloh DSM: denně jako root `sh /volume1/docker/ha-wall-dashboard/aktualizace.sh`.
4. Dashboard poběží na `http://<IP-NASu>:8099`. Nové vydání si NAS stáhne sám a tablet se do 10 minut obnoví.

Po změně `config.local.json` stačí na tabletu obnovit stránku.

### Vydání nové verze

```bash
npm version minor          # zvýší verzi v package.json a vytvoří tag vX.Y.Z
git push --follow-tags     # GitHub Actions otestuje, sestaví image (amd64 + arm64) a vydá ho na ghcr.io
```

### Sestavení přímo na NASu (bez GitHubu)

Kořenový `docker-compose.yml` sestaví image ze zdrojáků: zkopíruj celý projekt na NAS, vedle něj
`config.local.json` a `.env` a spusť `sudo docker compose up -d --build`. Automatická aktualizace pak nefunguje.

## Fotorámeček

- **Immich (doporučeno):** v `config.local.json` nastav `"source": { "type": "immich", "albumName": "Fotky pro wall panel" }`. Adresa a API klíč se zadávají mimo konfiguraci:
  1. V Immichi: Nastavení účtu → Klíče API → Nový klíč (oprávnění `album.read`, `asset.read` a `asset.view`). Album musí patřit uživateli klíče nebo mu být nasdílené.
  2. V `.env` (NAS: `deploy/synology/.env.example`, vývoj: `.env.example`) vyplň `IMMICH_URL` (IP NASu a port Immiche, např. `http://192.168.1.10:2283`, ne `localhost`) a `IMMICH_API_KEY`.
  3. Restartuj projekt v Container Manageru. Nginx v kontejneru přeposílá jen čtení alb a náhledů na `/immich/` a doplňuje klíč, takže klíč není v prohlížeči ani v `config.json`.
  4. Pro vývoj (`npm run dev`) stejný `.env` použije proxy ve `vite.config.ts`.
  Immich převádí HEIC i RAW na JPEG, takže zmenšování fotek ani výběr formátu není potřeba.
- **Složka na NASu:** fotky se berou ze složky připojené jako `/photos` (`"type": "autoindex"`). Nginx vrací její výpis v JSON a aplikace z něj vybírá obrázky (jpg, png, webp, avif), včetně podsložek do hloubky `maxDepth`. Systémové složky Synology (`@eaDir`) se přeskakují.
- Spustí se po `photoFrame.idleSeconds` bez dotyku, nebo hned tlačítkem **Rámeček** v menu. Klepnutím se vrátíš na hlavní stránku.
- `photoFrame.blackout` nastaví noční okno s černou obrazovkou. S `"screenOff": true` a Fully Kiosk Browserem (zapnutý *JavaScript Interface*) se displej i fyzicky vypne.
- **Tip na velikost:** pro tablet stačí fotky kolem 1920 px na delší straně. Originály z mobilu (4000+ px, HEIC) jsou zbytečně velké a HEIC prohlížeč nezobrazí. Na Synology se dá připravit složka se zmenšenými JPG (např. úlohou v Plánovači úloh).

## Tablet (Fully Kiosk Browser)

- **Start URL:** `http://<IP-NASu>:8099/`
- *Web Content Settings*: zapnout JavaScript, vypnout zoom.
- *Device Management*: Keep Screen On.
- Vlastní spořič obrazovky ve Fully **vypnout**, fotorámeček řeší dashboard sám.
- Pro `screenOff`: *Advanced Web Settings → Enable JavaScript Interface*.
- Slabší tablet: přidej do URL `?lowpower`. Vypne rozostření skla, které je na GPU nejnáročnější.

## Struktura projektu

```
src/
  config/        typy a načítání config.json (+ validace)
  ha/            připojení k HA (realClient), demo simulace (mockClient), akce, React kontext
  components/    UI komponenty (půdorys, karty, fotorámeček, stránky)
  hooks/         hodiny, nečinnost, historie, předpověď, škálování plochy
  utils/         formátování (čeština), historie → graf, fotky, počasí
  styles/        global.css – celý vzhled, barvy motivu přes CSS proměnné
public/
  config.json    demo konfigurace
  photos/        demo fotky
docs/KONFIGURACE.md   popis konfigurace
CLAUDE.md             kontext pro Claude Code (architektura, pravidla, další kroky)
```
