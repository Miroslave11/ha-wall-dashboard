# Návod k použití

Tento návod popisuje, jak dashboard ovládat na tabletu a jak ho nastavit. Instalace na NAS je v
[deploy/synology/NAVOD.md](../deploy/synology/NAVOD.md), technický popis pro programátory v
[NAVOD-VYVOJAR.md](NAVOD-VYVOJAR.md).

> Návod odpovídá verzi **1.1.0**. Nasazená verze je vidět na adrese `http://<IP-NASu>:8099/version.txt`.

## Obsah

1. [Co dashboard umí](#co-dashboard-umí)
2. [První spuštění](#první-spuštění)
3. [Rozložení obrazovky](#rozložení-obrazovky)
4. [Stránka Domů](#stránka-domů)
5. [Topení](#topení)
6. [Radar](#radar)
7. [Kamery](#kamery)
8. [Fotorámeček](#fotorámeček)
9. [Nastavení](#nastavení)
10. [Aktualizace](#aktualizace)
11. [Řešení potíží](#řešení-potíží)

## Co dashboard umí

Dashboard je ovládací panel domu na tabletu na zdi. Bere data z Home Assistantu (HA) a posílá do něj povely.
Všechno, co na dashboardu vidíte, je aktuální stav z HA. Když něco přepnete, změna se ukáže, až ji HA potvrdí
(obvykle hned).

- Půdorys bytu se světly, teplotou, vlhkostí a pohybem v místnostech.
- Ovládání světel včetně jasu, barvy a efektů.
- Počasí, předpověď a grafy teplot.
- Vysavač, žaluzie, topení, srážkový radar a webkamery.
- Fotorámeček: když na tablet nikdo nesahá, ukazuje fotky s hodinami a počasím.

## První spuštění

Při prvním otevření běží **demo** se smyšlenými světly a čidly (u půdorysu je nápis DEMO).
Demo se dá volně proklikat, nic se tím v domě nezmění.

Připojení ke skutečnému Home Assistantu:

1. Správce HA musí povolit adresu dashboardu (CORS, viz [návod pro NAS](../deploy/synology/NAVOD.md#2-povolit-dashboard-v-home-assistantu-cors)).
2. **Nastavení → Připojení** → zadejte adresu HA, např. `http://192.168.1.10:8123` → **Připojit a přihlásit**.
3. Tablet se přesměruje na přihlašovací stránku HA. Přihlaste se. Doporučujeme v HA založit zvláštního uživatele
   bez práv správce, např. „Tablet“.
4. Po přihlášení se vrátíte na dashboard. Přihlášení si tablet pamatuje a samo se obnovuje.
5. V **Nastavení → Místnosti** a **Ostatní entity** vyberte svoje světla a čidla a dejte **Uložit**.

## Rozložení obrazovky

```
┌──────┬───────────────────────────────────────────────┐
│ Menu │ Horní lišta: hodiny, slunce, upozornění, …     │
│      ├──────────────────────────────┬────────────────┤
│ Domů │                              │ Počasí         │
│ …    │   Půdorys                    │ Teploty        │
│      │                              │ Vysavač        │
│ Nast.│                              │                │
└──────┴──────────────────────────────┴────────────────┘
```

**Menu vlevo:** Domů, Vysavač, Zahrádka, Radar, Topení, Žaluzie, Kamery, Rámeček (spustí fotorámeček hned)
a dole Nastavení. Stránky Vysavač, Zahrádka a Žaluzie se teprve připravují.

**Horní lišta:**

| údaj | význam |
|---|---|
| Hodiny a datum | |
| Východ / západ slunce | ukazuje nejbližší z nich |
| Baterie žaluzií | stav baterie ovladače žaluzií |
| Upozornění | počet otevřených oken a dveří. Klepnutím se ukáže seznam. „Vše v pořádku“ = nic otevřeného |
| Přítomnost | Doma / Pryč, případně počet lidí doma |
| Home Assistant – Odpojeno | spojení s HA vypadlo. Dashboard se připojí sám, jakmile je HA zase dostupný |

## Stránka Domů

### Půdorys a světla

- **Klepnutí na svítidlo** (kroužek, LED pásek) ho zapne nebo vypne.
- **Dlouhý stisk na svítidlo** (podržet asi půl vteřiny) otevře panel světel místnosti.
- U místnosti bez nakreslených svítidel je v rohu **ikona žárovky**. Klepnutí přepne všechna světla
  místnosti najednou, dlouhý stisk otevře panel světel.
- Klepnutí na samotnou místnost nedělá nic. Je to záměr, aby se světla nepřepínala omylem.
- Místnost, ve které svítí světla, se rozzáří. Čím víc světel svítí, tím teplejší je pozadí celé obrazovky.
- **Pohyb**: v místnosti s pohybovým čidlem se při pohybu ukáže značka „Pohyb“.
- **Teplota a vlhkost** v místnosti: klepnutím se otevře graf historie.
- **Domácí kino**: klepnutím na projektor se zapne nebo vypne.
- **Vysavač**: při úklidu se po půdorysu pohybuje tečka. Se senzory polohy ukazuje, ve které části
  místnosti vysavač je. Bez nich je to jen animace.

### Panel světel místnosti

Nahoře je seznam světel místnosti, u každého vypínač. Pod ním se ukazuje jen to, co vybrané světlo umí:

- **Jas** – posuvník.
- **Rychlé barvy** – předvolené barvy jedním klepnutím.
- **Barva** – odstín a sytost.
- **Teplota bílé** – od teplé po studenou bílou.
- **Efekty** – např. blikání nebo duha, pokud je světlo podporuje.

Světlo, které umí jen zapnout a vypnout, ukáže větu „Toto světlo se dá jen zapnout a vypnout“.
Panel zavřete křížkem nebo klepnutím mimo něj.

### Pravý sloupec

- **Počasí**: teplota a předpověď na 5 dní. Klepnutím se otevře podrobná předpověď **po dnech** (rozpětí teplot,
  srážky, vítr) nebo **po hodinách**. Hodinovou předpověď neumí každá služba počasí.
- **Teploty** (např. Obývák a Venku): aktuální hodnota a křivka za posledních 24 hodin. Klepnutím se otevře
  graf s výběrem **6 h / 24 h / 7 dní** a s minimem, maximem a průměrem.
- **Vysavač**: stav (Uklízí, V doku, …) a tlačítko **Uklidit** / **Do doku**. Klepnutím na název vysavače se otevře okno s
  mapou a místnostmi: klepnutím na místnost na mapě vyberte jednu nebo víc a klepněte na **Uklidit vybrané**.
  Mapa je skutečná mapa vysavače (s tečkou, kde právě je); bez ní se ukáže schematický půdorys. Dál tam jsou **Uklidit vše**, **Do doku**
  (za běhu úklidu) a **Najít vysavač** (vysavač se ozve). Výběr místností funguje, jen když jsou místnosti vysavače
  spárované s půdorysem (`vacuum.roomMap`) a vysavač má uloženou mapu rozdělenou na místnosti.

## Topení

Pro každou termohlavici je jedna karta:

- **Kruhový ovladač**: velké číslo je nastavená (cílová) teplota, menší údaj aktuální teplota v místnosti.
  Teplotu změníte tažením prstu po kruhu nebo tlačítky − a +. Když hlavice topí, ovladač se barevně zvýrazní.
- **Ventil**: jak moc je ventil otevřený (0–100 %).
- **Režim**: Vypnuto / Auto (podle plánu) / Topit (ručně).
- **Předvolby**: Plán, Ručně, Boost, Eko, Pryč (jen ty, které hlavice umí).
- Upozornění **Okno otevřeno** a **Slabá baterie**.
- **Plán topení**: otevře editor plánu pracovních dnů. Každý řádek je čas a teplota od tohoto času.
  Čas se posouvá po 15 minutách, teplota po krocích hlavice. Graf nahoře ukazuje teploty během dne.
  **Uložit plán** ho pošle do hlavice, **Zrušit** změny zahodí.

## Radar

Mapa se srážkovým radarem (smyčka posledních snímků). Tlačítkem **Přehrát / Zastavit smyčku** se animace
spouští a zastavuje, posuvníkem se vybírá čas snímku. Mapou jde posouvat a přibližovat. Radar potřebuje
internet. Bez něj se ukáže hláška.

## Kamery

Mřížka webkamer z internetu (snímky nebo YouTube přenosy). Nahoře jsou **skupiny** (např. Hory, Česko),
klepnutím se zobrazí jen kamery dané skupiny. Klepnutí na kameru ji otevře na celou obrazovku, šipkami vlevo
a vpravo se přepíná na další. Snímky se samy obnovují. Když kamera nejde načíst, zobrazí se „Kamera je nedostupná“.

## Fotorámeček

- Spustí se sám po nastavené době, kdy na tablet nikdo nesáhne (výchozí 3 minuty), nebo hned tlačítkem
  **Rámeček** v menu.
- Ukazuje fotky z alba v Immichi nebo ze složky na NASu, k tomu hodiny, datum a počasí.
- **Klepnutí** fotorámeček ukončí a vrátí vás na stránku Domů.
- Šipky na okrajích listují fotkami **vpřed a zpět**. Po ručním listování se prezentace na minutu zastaví.
- Může prokládat fotky záběry z webkamer.
- **Noční režim**: v nastavené době (např. 23:30–6:00) je místo fotek černá obrazovka. S Fully Kiosk
  Browserem se displej může i úplně vypnout.
- V Nastavení se fotorámeček sám nespouští, aby se neztratily rozpracované změny.

## Nastavení

Nastavení má vlevo sekce. Změny v sekcích Místnosti, Ostatní entity, Webkamery a Fotorámeček se projeví
až po klepnutí na **Uložit** (dokud nejsou uložené, svítí „Neuložené změny“). Ukládají se přímo do Home
Assistantu k přihlášenému uživateli, takže je po přeinstalaci tabletu nenastavujete znovu. V demu se ukládají
jen do prohlížeče.

### Připojení

- Stav spojení, adresa HA, rozlišení displeje.
- **Připojit a přihlásit**: zadání nebo změna adresy HA.
- **Použít adresu ze souboru**: zapomene adresu zadanou v aplikaci.
- **Odhlásit tablet**: smaže přihlášení. Tablet se pak musí znovu přihlásit do HA.
- **Smazat nastavení z aplikace**: vrátí entity na hodnoty z konfiguračního souboru.

### Místnosti

Vlevo seznam místností, vpravo podrobnosti vybrané místnosti:

- **Název**, **Oblast v Home Assistantu**. Tlačítko **Doplnit z oblasti** samo najde světla a čidla z oblasti HA.
- **Světla** (ikona žárovky přepne všechna), **Další světla** (jen se započítají do jasu místnosti).
- **Teplota**, **Vlhkost**, **Pohybové čidlo**.
- Svítidla v půdorysu, poloha názvu a teploty, skrytí názvu.
- **Poloha v půdorysu (pokročilé)**: souřadnice a velikost místnosti.
- **Nová místnost**, **Smazat místnost**.

Entity se vybírají ze seznamu s vyhledáváním. Entity z vybrané oblasti jsou nahoře.

### Ostatní entity

Horní lišta (baterie žaluzií, upozornění, přítomnost), předpověď počasí, grafy teplot (na hlavní stránce
jsou první dva), vysavač včetně polohy v půdorysu a scény.

### Webkamery

Seznam kamer: název, skupina, typ (**Snímek** = obrázek z adresy, **YouTube** = přenos), adresa, jak často se
snímek obnovuje, zdroj (zobrazí se na celé obrazovce) a zda se kamera ukazuje ve fotorámečku a zda je **mimo Evropu** (jiné časové pásmo). Kamery jde
přesouvat šipkami a hledat. Pozor: provozovatel kamery musí povolit zobrazení jejího snímku na cizí stránce,
jinak se nenačte.

### Fotorámeček

Zapnutí po nečinnosti (sekundy), doba zobrazení fotky, náhodné pořadí, zobrazení fotek na výšku a na šířku
(rozostřené pozadí, dvě vedle sebe, černé pozadí, ořez), pohyb fotek (vypnutý, jemný, plný), webkamery
ve fotorámečku (volitelně bez evropských kamer po západu slunce, aby se nezobrazovala tma; kamery označené „Mimo EU“ zůstávají) a noční režim.

## Aktualizace

Nic dělat nemusíte. NAS si nové vydání stáhne sám (obvykle v noci) a tablet se do 10 minut sám obnoví.
Pokud jste zrovna v Nastavení, počká, až z něj odejdete. Nastavení i přihlášení zůstávají.

## Řešení potíží

| problém | co udělat |
|---|---|
| „Nepodařilo se připojit k Home Assistantu“ | Zkontrolujte, že HA běží. **Zkusit znovu**, případně zadejte adresu znovu v okně pod chybou. |
| Po přihlášení se tablet vrací na přihlášení pořád dokola | V HA chybí adresa dashboardu v `cors_allowed_origins`. |
| „Dashboard se nespustil“ s chybami v config.json | Chyba v konfiguračním souboru na NASu. Hláška říká, který klíč je špatně. |
| Světlo nebo čidlo nereaguje nebo nemá hodnotu | Entita v HA neexistuje nebo je nedostupná. Zkontrolujte výběr v Nastavení. |
| Tablet je pomalý, animace trhají | Přidejte na konec adresy `?lowpower` (vypne rozostření skla). |
| Fotky se nezobrazují | Fotorámeček neumí HEIC ani video. U Immiche zkontrolujte název alba v konfiguraci. |
| Radar nebo kamery nejdou | Potřebují internet. |

### Doporučené nastavení Fully Kiosk Browseru

- Start URL `http://<IP-NASu>:8099/`.
- Web Content Settings: zapnout JavaScript, vypnout zoom.
- Device Management: Keep Screen On.
- Spořič obrazovky ve Fully vypnout (fotorámeček řeší dashboard).
- Pro vypínání displeje v noci: Advanced Web Settings → Enable JavaScript Interface.
