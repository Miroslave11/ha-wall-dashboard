/**
 * Konfigurace dashboardu. Načítá se za běhu z `/config.json`
 * (nebo `/config.local.json`, pokud existuje), takže změna entit
 * nevyžaduje nový build – na Synology stačí přepsat soubor a obnovit stránku.
 */

export type AuthMode = "oauth" | "token";

export interface HassConnectionConfig {
  /** URL Home Assistantu, např. "http://192.168.1.10:8123". Prázdné = demo režim. */
  url: string;
  /**
   * "oauth"  – přihlášení přes přihlašovací stránku HA (tokeny v localStorage tabletu). Doporučeno.
   * "token"  – long-lived access token přímo v konfiguraci (jednodušší, ale méně bezpečné).
   */
  auth: AuthMode;
  token?: string;
}

export interface RoomConfig {
  /** Unikátní ID místnosti (jen pro aplikaci). */
  id: string;
  name: string;
  /** Poloha a velikost v souřadnicích půdorysu (viz floorplan.width/height). */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Entity světel (light.* nebo switch.*). Klepnutí na místnost nic nedělá; světla se ovládají klepnutím
   * na svá svítidla v půdorysu (`fixtures`), a když žádné nejsou, ikonou žárovky v rohu (přepne všechna).
   */
  lights: string[];
  temperature?: string;
  humidity?: string;
  /** binary_sensor pohybu – "on" = pulzující indikátor. */
  motion?: string;
  /**
   * ID oblasti (area) v Home Assistantu, např. "pracovna". Nepovinné – v Nastavení podle ní
   * aplikace nabízí entity této místnosti jako první a umí je doplnit automaticky.
   */
  area?: string;
  /** Odkud v místnosti září světlo, CSS pozice "40% 30%". Ignoruje se, když jsou vyplněna `fixtures`. */
  glow?: string;
  /**
   * Kde je název místnosti spolu s teplotou a vlhkostí. Výchozí "top-left" (vlevo nahoře v dlaždici).
   * "top-right", "bottom-left", "bottom-right" a "center" jsou polohy uvnitř dlaždice (ikona žárovky
   * se přesune do protilehlého rohu, u "center" se nekreslí); "above" / "below" dá popisek
   * mimo dlaždici nad / pod místnost, takže se v ní uvolní místo.
   */
  labelPos?: LabelPos;
  /** Skryje název místnosti na půdorysu (teplota a vlhkost zůstanou). Čtečka obrazovky ho dál čte. */
  hideName?: boolean;
  /**
   * Svítidla zakreslená v půdorysu. Každé září ze své polohy podle stavu své entity
   * a klepnutím se přepne samostatně; dlouhý stisk otevře panel světla (jas, barva). Když je vyplněno,
   * zmizí ikona žárovky v rohu místnosti.
   */
  fixtures?: FixtureConfig[];
}

/** Poloha popisku místnosti (název + teplota + vlhkost), viz `RoomConfig.labelPos`. */
export type LabelPos = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "above" | "below";

/** Svítidlo v půdorysu – žárovka (bod) nebo LED pásek (úsečka). */
export interface FixtureConfig {
  /** Entita světla (light.* nebo switch.*). Musí být uvedena i v `lights` místnosti. */
  entity: string;
  /** "bulb" = žárovka (výchozí), "strip" = LED pásek. */
  type?: "bulb" | "strip";
  /** Název pro čtečku obrazovky, např. "LED pásek nad postelí". */
  name?: string;
  /**
   * Poloha v souřadnicích půdorysu (stejných jako x/y místnosti).
   * Žárovka: střed. Pásek: levý (u svislého horní) konec osy pásku.
   */
  x: number;
  y: number;
  /** Jen pásek: délka v souřadnicích půdorysu. */
  length?: number;
  /** Jen pásek: svislý místo vodorovného. */
  vertical?: boolean;
}

/**
 * Průchod (dveře, otvor) ve zdi mezi dvěma místnostmi, viz `floorplan.passages`.
 * Svislá zeď (výchozí): `x` = poloha zdi, otvor vede od `y` o `length` dolů.
 * Vodorovná zeď (`horizontal: true`): `y` = poloha zdi, otvor vede od `x` o `length` doprava.
 * Souřadnice zdi jsou hrana místnosti (např. x = 300 mezi místnostmi 0–300 a 300–640).
 */
export interface PassageConfig {
  x: number;
  y: number;
  length: number;
  horizontal?: boolean;
}

/** Radiátorová hlavice (termostatický ventil) na stránce Topení, viz `heating`. */
export interface HeaterConfig {
  /** Název karty, např. "Ložnice". */
  name: string;
  /** Entita `climate.*` hlavice (cílová teplota, režim, předvolba). */
  entity: string;
  /** Senzor otevření ventilu v % (např. sensor.topeni_ventil_loznice_position). */
  position?: string;
  /** Entita `text.*` s týdenním plánem ve tvaru "06:00/22°C 08:00/22°C …" (např. text.topeni_ventil_pracovna_workdays_schedule). */
  schedule?: string;
  /** binary_sensor slabé baterie hlavice ("on" = vyměnit baterie). */
  battery?: string;
  /** binary_sensor otevřeného okna zjištěného hlavicí ("on" = okno otevřeno). */
  window?: string;
  /** Předvolby, které se na kartě nabízejí (z těch, které hlavice umí). Výchozí: schedule, manual, boost, eco, away. */
  presets?: string[];
}

/** Poloha a přiblížení mapy na stránce Radar, viz `radar`. */
export interface RadarConfig {
  /** Střed mapy (zeměpisná šířka a délka), např. 50.0755, 14.4378 (Praha). */
  lat: number;
  lon: number;
  /** Počáteční přiblížení mapy, výchozí 7 (celá ČR). Radar sám má nejvyšší detail na úrovni 7, výš se jen zvětšuje. */
  zoom?: number;
  /** Popisek značky ve středu mapy, např. "Praha". Bez názvu se značka nekreslí s popiskem. */
  name?: string;
}

/**
 * Robotický vysavač. Skutečnou polohu v půdorysu dávají senzory z integrace
 * Xiaomi Cloud Map Extractor v3 (`positionEntity`, `roomsEntity`, `roomEntity`) a spárování místností
 * `roomMap`. Bez nich je tečka v půdorysu jen animace během úklidu.
 */
export interface VacuumConfig {
  entity: string;
  name?: string;
  /** Text v kartě vysavače během úklidu, např. "Obývák & kuchyň". */
  area?: string;
  /** Tečka vysavače v půdorysu (výchozí zapnuto). */
  showOnPlan?: boolean;
  /** Senzor polohy s atributy x, y v souřadnicích mapy vysavače, např. sensor.robot_vacuum_position. */
  positionEntity?: string;
  /** Senzor místností vysavače s obdélníky v atributech ("1": { x0, y0, x1, y1 }), např. sensor.robot_rooms. */
  roomsEntity?: string;
  /** Nepovinný senzor s číslem místnosti, kde vysavač je (sensor.robot_vacuum_room_id). Jinak se pozná z obdélníků. */
  roomEntity?: string;
  /**
   * Obrázek mapy vysavače (image.*, např. image.robot_live_map z Xiaomi Cloud Map Extractoru v3, má kalibraci a místnosti v atributech).
   * Okno vysavače na něm ukáže místnosti k vybrání; bez něj se použije schematický půdorys.
   */
  mapEntity?: string;
  /**
   * Číslo místnosti vysavače → id místnosti v půdorysu, např. { "2": "obyvak", "4": "loznice" }.
   * Víc čísel smí vést do jedné místnosti. Ze spárování (aspoň 3 místnosti) se pozná otočení mapy.
   */
  roomMap?: Record<string, string>;
}

/** Projektor domácího kina v půdorysu, viz `floorplan.projector`. */
export interface ProjectorConfig {
  /** Entita, která kino zapíná (switch.*, input_boolean.*…), např. "switch.zapni_kino". Stav "on" = promítá se. */
  entity: string;
  /** Název pro čtečku obrazovky, např. "Domácí kino". */
  name?: string;
  /** Poloha projektoru (střed ikony) v souřadnicích půdorysu. */
  x: number;
  y: number;
  /** Promítací plocha jako úsečka od (x1, y1) do (x2, y2) v souřadnicích půdorysu. */
  screen: { x1: number; y1: number; x2: number; y2: number };
}

export interface SceneConfig {
  name: string;
  /** Scéna v HA (scene.*) – doporučeno. */
  entity?: string;
  /**
   * Alternativa bez scény v HA: mapa entita světla → jas 0–1 (0 = vypnout).
   * Použije se, když není vyplněno `entity`.
   */
  lights?: Record<string, number>;
}

export interface TemperatureCardConfig {
  name: string;
  entity: string;
  /** Barva grafu: "warm" (oranžová, typicky uvnitř) nebo "accent" (typicky venku). */
  color?: "warm" | "accent";
}

export type PhotoSource =
  /** Výpis adresáře z nginx (autoindex_format json) – viz nginx.conf, location /photos/. */
  | { type: "autoindex"; url: string; maxDepth?: number }
  /** Pevný seznam URL obrázků. */
  | { type: "list"; urls: string[] }
  /**
   * Album v Immichi. Prohlížeč volá Immich přes proxy v nginx (`baseUrl`, výchozí "/immich"),
   * která doplňuje API klíč – ten tedy není v konfiguraci ani v prohlížeči. Viz nginx.conf.
   */
  | { type: "immich"; albumName: string; baseUrl?: string; imageSize?: "preview" | "fullsize" };

/** Jak se ukáže fotka na výšku: "blur" = celá na rozostřeném pozadí, "pair" = dvě fotky na výšku vedle sebe, "black" = celá na černém pozadí, "crop" = ořez na celou obrazovku. */
export type PortraitMode = "blur" | "pair" | "black" | "crop";
/** Jak se ukáže fotka na šířku: "crop" = vyplní obrazovku (malý ořez), "blur" = celá na rozostřeném pozadí, "black" = celá na černém pozadí. */
export type LandscapeMode = "crop" | "blur" | "black";
/** Pohyb fotek (Ken Burns): "on" = přiblížení a posun, "subtle" = jemný, "off" = žádný. U fotek zobrazených celé je pohyb nejvýš jemný, ať se okraje neořezávají. */
export type KenBurnsMode = "on" | "subtle" | "off";

export interface PhotoFrameConfig {
  enabled: boolean;
  /** Po kolika sekundách nečinnosti se spustí fotorámeček. */
  idleSeconds: number;
  /** Jak dlouho zůstane jedna fotka. */
  slideSeconds: number;
  shuffle?: boolean;
  /** Fotky na výšku, výchozí "blur". */
  portrait?: PortraitMode;
  /** Fotky na šířku, výchozí "crop". */
  landscape?: LandscapeMode;
  /** Pohyb fotek, výchozí "on". */
  kenBurns?: KenBurnsMode;
  /** Prokládat fotky záběry z webkamer (`webcams`), výchozí ne. */
  webcams?: boolean;
  /** Jedna webkamera po kolika fotkách, výchozí 4. */
  webcamEvery?: number;
  /**
   * Po západu slunce (+ 30 min, podle `header.sun`) vynechat ve fotorámečku evropské kamery (`region` jiný než "other"),
   * protože tam je tma. Kamery mimo Evropu zůstávají. Výchozí ne.
   */
  webcamsSkipEuropeAtNight?: boolean;
  source: PhotoSource;
  /**
   * Noční okno, kdy se místo fotek zobrazí černá obrazovka, např. { "from": "23:00", "to": "06:00" }.
   * Ve Fully Kiosk Browseru (se zapnutým JavaScript Interface) se displej navíc vypne.
   */
  blackout?: { from: string; to: string; screenOff?: boolean };
}

/** Webkamera na stránce Kamery (a volitelně ve fotorámečku), viz `webcams`. */
export interface WebcamConfig {
  /** Unikátní ID (jen pro aplikaci). */
  id: string;
  /** Název, např. "Sněžka". */
  name: string;
  /** Skupina pro filtr na stránce Kamery, např. "Česko", "Evropa", "Asie". */
  group?: string;
  /**
   * "image"   – adresa snímku (JPEG), který se v pravidelných odstupech obnovuje (`refreshSec`).
   * "youtube" – živý přenos na YouTube (ID videa nebo odkaz); v mřížce se ukáže náhled, celé video po klepnutí.
   */
  type: "image" | "youtube";
  /** image: URL snímku. youtube: ID videa (11 znaků) nebo odkaz na video. */
  url: string;
  /** Jen image: jak často se snímek obnoví, výchozí 60 s. */
  refreshSec?: number;
  /** Zařadit kameru mezi snímky fotorámečku (výchozí ano; platí, jen když je zapnuto `photoFrame.webcams`). */
  inFrame?: boolean;
  /** Kde kamera je: "europe" (výchozí; podobný čas jako u nás) nebo "other" (jiné časové pásmo, ve fotorámečku se nevynechává v noci). */
  region?: "europe" | "other";
  /** Odkud kamera je (provozovatel nebo web), zobrazí se na celé obrazovce. */
  source?: string;
}

export interface DashboardConfig {
  hass: HassConnectionConfig;
  /** Vynutí demo režim se simulovanými entitami (vývoj bez HA). */
  demo?: boolean;
  /** Návrhové rozlišení – plocha se škáluje na velikost displeje. */
  stage: { width: number; height: number };
  theme: { accent: string; light: string };
  header: {
    sun?: string;
    blindsBattery?: string;
    /** zone.home (počet lidí doma), person.* nebo group – "Doma"/"Pryč". */
    presence?: string;
    /** Entity, jejichž stav "on" znamená upozornění (okna, dveře, úniky vody…). */
    alerts?: string[];
  };
  floorplan: {
    title: string;
    width: number;
    height: number;
    /** Kresba nábytku (src/components/FloorplanFurniture.tsx) – platí pro výchozí půdorys 640×460. */
    furniture: boolean;
    /** Volitelný podklad místo kresby nábytku – URL obrázku (PNG/SVG) ve stejných proporcích jako půdorys. */
    background?: string;
    backgroundOpacity?: number;
    rooms: RoomConfig[];
    /** Projektor domácího kina: ikona v půdorysu, klepnutím se přepne, zapnutý promítá paprsek na plátno. */
    projector?: ProjectorConfig;
    /** Průchody mezi místnostmi: zeď se v nich přeruší a otvor označí jemná čárkovaná čára. */
    passages?: PassageConfig[];
  };
  scenes: SceneConfig[];
  weather?: { entity: string; title?: string };
  temperatures: TemperatureCardConfig[];
  /** Kolik hodin historie ukazují grafy teplot. */
  historyHours: number;
  vacuum?: VacuumConfig;
  blinds?: { entity: string; name?: string };
  /** Stránka Radar: meteorologický radar RainViewer na mapě. Bez `radar` se mapa vystředí na střed ČR. */
  radar?: RadarConfig;
  /** Stránka Topení: hlavice (jedna karta na hlavici). */
  heating?: HeaterConfig[];
  /** Stránka Kamery: webkamery z internetu (hory, města, svět). */
  webcams?: WebcamConfig[];
  photoFrame: PhotoFrameConfig;
}

/**
 * Část konfigurace, kterou lze upravit přímo v aplikaci (Nastavení). Ukládá se do Home Assistantu
 * k přihlášenému uživateli (WS `frontend/set_user_data`, klíč USER_SETTINGS_KEY), v demo režimu
 * do localStorage. Při načtení přepíše odpovídající části config.json / config.local.json.
 */
/** Vlastnosti fotorámečku upravitelné v aplikaci (zdroj fotek `source` zůstává v config.json). */
export type PhotoFrameSettings = Pick<PhotoFrameConfig, "enabled" | "idleSeconds" | "slideSeconds" | "blackout" | "portrait" | "landscape" | "kenBurns" | "webcams" | "webcamEvery" | "webcamsSkipEuropeAtNight"> & {
  shuffle: boolean;
};

export interface UserSettings {
  version: 1;
  /** Chybí-li (starší uložené nastavení), platí fotorámeček ze souboru. */
  photoFrame?: PhotoFrameSettings;
  rooms: RoomConfig[];
  header: DashboardConfig["header"];
  scenes: SceneConfig[];
  weather?: DashboardConfig["weather"];
  temperatures: TemperatureCardConfig[];
  vacuum?: DashboardConfig["vacuum"];
  blinds?: DashboardConfig["blinds"];
  /** Chybí-li (starší uložené nastavení), platí webkamery ze souboru. */
  webcams?: WebcamConfig[];
}
