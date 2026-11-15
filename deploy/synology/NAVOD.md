# Nasazení na Synology NAS s automatickou aktualizací

Dashboard běží na NASu jako hotový Docker image z GitHubu (`ghcr.io/miroslave11/ha-wall-dashboard`).
Na NASu se nic nesestavuje. Nové verze si NAS stahuje sám skriptem `aktualizace.sh`
a tablet se po aktualizaci do 10 minut sám obnoví.

```
GitHub: vydání vX.Y.Z ──► GitHub Actions sestaví image ──► ghcr.io (:X.Y.Z a :latest)
                                                                │
NAS: Plánovač úloh každou noc ──► aktualizace.sh ──► docker compose pull + up -d
                                                                │
Tablet: každých 10 min čte /version.txt ──► nová verze ──► obnoví stránku
```

## Co potřebuješ

- Synology s DSM 7.2+ a balíčkem **Container Manager** (starší DSM: balíček *Docker*, postup je stejný).
- NAS s přístupem na internet (stahuje image z `ghcr.io`).

## Soubory ve složce na NASu

| soubor | odkud | co obsahuje |
|---|---|---|
| `docker-compose.yml` | tato složka | definice kontejneru, **neupravuje se** |
| `aktualizace.sh` | tato složka | skript automatické aktualizace |
| `.env` | `cp .env.example .env` | port, Immich (adresa a API klíč), případně cesta ke složce s fotkami |
| `photos/` | tato složka | prázdná složka (fotky ze složky na NASu se připojují jinak, viz `.env`) |
| `config.local.json` | `config.example.json` z kořene repozitáře | adresa HA, entity, půdorys, fotorámeček ([popis klíčů](../../docs/KONFIGURACE.md)) |

`.env` a `config.local.json` jsou tvoje soukromé soubory. Nepatří do gitu ani do vydání na GitHubu.

## 1. Složka na NASu

1. File Station → `docker` → nová složka `ha-wall-dashboard` (tedy `/volume1/docker/ha-wall-dashboard`).
2. Nahraj do ní soubory a složku `photos` z tabulky výše.
3. V `.env` vyplň Immich (`IMMICH_URL`, `IMMICH_API_KEY`). Album se vybírá v `config.local.json`
   (`"source": { "type": "immich", "albumName": "…" }`).
   Jen když fotky berete ze složky na NASu (`"type": "autoindex"`), odkomentuj `PHOTOS_DIR` s cestou
   k **existující** složce.

> Soubory upravuj v editoru, který zachová konce řádků LF (VS Code, Notepad++, Textový editor v DSM).
> Klasický Poznámkový blok ve Windows může skript `aktualizace.sh` rozbít.

## 2. Povolit dashboard v Home Assistantu (CORS)

Do `configuration.yaml` v HA přidej adresu dashboardu a HA restartuj:

```yaml
http:
  cors_allowed_origins:
    - http://192.168.1.20:8099   # IP NASu a port z .env
```

## 3. Spuštění v Container Manageru

1. Container Manager → **Projekt** → **Vytvořit**.
2. Název projektu `ha-wall-dashboard`, cesta `/docker/ha-wall-dashboard`.
3. Zdroj: **Použít existující docker-compose.yml** → Další → (Web Station nenastavovat) → **Hotovo**.
4. Container Manager stáhne image a spustí kontejner.
5. Otevři `http://<IP-NASu>:8099`. Nasazená verze je vidět na `http://<IP-NASu>:8099/version.txt`.

Přes SSH totéž: `cd /volume1/docker/ha-wall-dashboard && sudo docker compose up -d`.

## 4. Automatická aktualizace (Plánovač úloh)

1. Ovládací panel → **Plánovač úloh** → Vytvořit → **Naplánovaná úloha** → **Uživatelem definovaný skript**.
2. *Obecné*: název `HA Wall Dashboard – aktualizace`, uživatel **root**.
3. *Plán*: denně, např. 4:00.
4. *Nastavení úlohy* → Uživatelem definovaný skript:
   ```bash
   sh /volume1/docker/ha-wall-dashboard/aktualizace.sh
   ```
5. Ulož, označ úlohu a dej **Spustit** – vyzkoušej, že funguje. Výsledek je v souboru
   `aktualizace.log` ve složce projektu (`Bez změny…` nebo `Aktualizováno na verzi …`).

Skript stáhne image `:latest`. Když je novější než běžící, restartuje kontejner a smaže starou verzi.
Bez internetu nebo při chybě běží dál stávající verze. Konfigurace (`.env`, `config.local.json`)
zůstává beze změny.

## Návrat ke starší verzi

V `.env` nastav konkrétní verzi, např. `DASHBOARD_TAG=1.0.0`, a spusť úlohu ručně.
Dokud tam je konkrétní verze, automatická aktualizace nic nemění. Zpět na `latest` = znovu automaticky.
Seznam verzí: stránka *Releases* repozitáře na GitHubu.

## Změna konfigurace

- `config.local.json`: stačí obnovit stránku na tabletu (soubor se necachuje).
- `.env`: v Container Manageru projekt **Zastavit** → **Spustit** (nebo `sudo docker compose up -d`).

## Řešení potíží

| problém | řešení |
|---|---|
| `Bind mount failed: '/volume1/…' does not exist` | `PHOTOS_DIR` v `.env` ukazuje na složku, která neexistuje. Při fotkách z Immiche řádek zakomentuj (`# PHOTOS_DIR=…`), jinak složku vytvoř. Pak projekt znovu spusť. |
| `config.local.json` je na NASu složka | Kontejner se spustil dřív, než soubor existoval. Zastav projekt, smaž složku, nahraj soubor, spusť. |
| Stažení image hlásí `denied` / `unauthorized` | Balíček na GitHubu není veřejný: GitHub → Packages → ha-wall-dashboard → Package settings → Change visibility → Public. |
| Tablet ukazuje starou verzi | Počkej 10 minut, nebo obnov stránku ve Fully (*Reload*). Kontrola: `/version.txt`. |
| Fotky z Immiche nejdou | `IMMICH_URL` musí být IP NASu (ne `localhost`), bez lomítka na konci; po změně `.env` projekt restartovat. |
