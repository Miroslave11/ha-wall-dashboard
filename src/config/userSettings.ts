import type { DashboardConfig, RoomConfig, UserSettings } from "./types";

/** Klíč, pod kterým se nastavení ukládá v HA (frontend/set_user_data) a v demu v localStorage. */
export const USER_SETTINGS_KEY = "ha-wall-dashboard";

/** Hluboká kopie přes JSON – nastavení obsahuje jen JSON hodnoty. */
function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** Vytáhne z konfigurace část upravitelnou v aplikaci (výchozí hodnota pro formulář Nastavení). */
export function extractUserSettings(cfg: DashboardConfig): UserSettings {
  return clone({
    version: 1,
    rooms: cfg.floorplan.rooms,
    header: cfg.header,
    scenes: cfg.scenes,
    weather: cfg.weather,
    temperatures: cfg.temperatures,
    vacuum: cfg.vacuum,
    blinds: cfg.blinds,
    webcams: cfg.webcams ?? [],
    photoFrame: {
      enabled: cfg.photoFrame.enabled,
      idleSeconds: cfg.photoFrame.idleSeconds,
      slideSeconds: cfg.photoFrame.slideSeconds,
      shuffle: !!cfg.photoFrame.shuffle,
      webcams: !!cfg.photoFrame.webcams,
      webcamEvery: cfg.photoFrame.webcamEvery ?? 4,
      webcamsSkipEuropeAtNight: !!cfg.photoFrame.webcamsSkipEuropeAtNight,
      webcamsOnly: !!cfg.photoFrame.webcamsOnly,
      portrait: cfg.photoFrame.portrait ?? "blur",
      landscape: cfg.photoFrame.landscape ?? "crop",
      kenBurns: cfg.photoFrame.kenBurns ?? "on",
      blackout: cfg.photoFrame.blackout,
    },
  });
}

/** Místnost z nastavení, ale s x, y, w, h z konfigurace v souboru (když tam stejné id je). */
function withFileGeometry(r: RoomConfig, cfg: DashboardConfig): RoomConfig {
  const f = cfg.floorplan.rooms.find((x) => x.id === r.id);
  return f ? { ...r, x: f.x, y: f.y, w: f.w, h: f.h } : r;
}

/** Volby mapy vysavače (skutečná poloha), které starší uložené nastavení ještě neznalo. */
const VACUUM_MAP_KEYS = ["positionEntity", "roomsEntity", "roomEntity", "mapEntity", "roomMap"] as const;

/**
 * Vysavač z nastavení. Když uložené nastavení (starší verze) žádnou volbu mapy nemá a jde o stejný
 * vysavač jako v souboru, převezme je ze souboru. Smazání v aplikaci ukládá prázdnou hodnotu, takže se
 * smazaná volba ze souboru nevrátí.
 */
function mergeVacuum(file: DashboardConfig["vacuum"], saved: DashboardConfig["vacuum"]): DashboardConfig["vacuum"] {
  if (!saved || !file || saved.entity !== file.entity) return saved;
  if (VACUUM_MAP_KEYS.some((k) => k in saved)) return saved;
  const fromFile = Object.fromEntries(VACUUM_MAP_KEYS.filter((k) => file[k] !== undefined).map((k) => [k, file[k]]));
  return { ...saved, ...fromFile };
}

/** Výsledná konfigurace: soubor + nastavení z aplikace (to má přednost). */
export function applyUserSettings(cfg: DashboardConfig, s: UserSettings | null): DashboardConfig {
  if (!s) return cfg;
  return {
    ...cfg,
    // poloha a velikost místností jsou vždy ze souboru (v aplikaci se neupravují), jinak by uložené
    // nastavení přebilo opravu půdorysu v configu
    floorplan: { ...cfg.floorplan, rooms: s.rooms.map((r) => withFileGeometry(r, cfg)) },
    header: s.header,
    scenes: s.scenes,
    weather: s.weather,
    temperatures: s.temperatures,
    vacuum: mergeVacuum(cfg.vacuum, s.vacuum),
    blinds: s.blinds,
    // chybí-li webkamery v (starším) uloženém nastavení, platí ty ze souboru
    webcams: s.webcams ?? cfg.webcams,
    // zdroj fotek (source) zůstává ze souboru; bez noční černé (blackout) v nastavení se noční okno vypne
    photoFrame: s.photoFrame ? { ...cfg.photoFrame, ...s.photoFrame, blackout: s.photoFrame.blackout } : cfg.photoFrame,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Kontrola tvaru dat uložených v HA. Neznámý formát → null (použije se konfigurace ze souboru). */
export function parseUserSettings(raw: unknown): UserSettings | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  if (!Array.isArray(raw.rooms) || !Array.isArray(raw.scenes) || !Array.isArray(raw.temperatures)) return null;
  if (!isObj(raw.header)) return null;
  if (!raw.rooms.every((r) => isObj(r) && typeof r.id === "string" && Array.isArray(r.lights))) return null;
  if (raw.webcams !== undefined && (!Array.isArray(raw.webcams) || !raw.webcams.every((w) => isObj(w) && typeof w.id === "string"))) return null;
  if (raw.photoFrame !== undefined) {
    const p = raw.photoFrame;
    if (!isObj(p) || typeof p.enabled !== "boolean" || typeof p.idleSeconds !== "number" || typeof p.slideSeconds !== "number") return null;
  }
  return raw as unknown as UserSettings;
}

/** Jsou dvě nastavení stejná? (pro tlačítko Uložit / indikaci neuložených změn) */
export function sameSettings(a: UserSettings, b: UserSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Nastavení s jiným režimem fotorámečku (přepínač „Fotky + kamery“ / „Jen kamery“ přímo na rámečku).
 * Vychází z uloženého nastavení, a když žádné není, z konfigurace; ostatní volby se nemění.
 */
export function withWebcamsOnly(saved: UserSettings | null, cfg: DashboardConfig, on: boolean): UserSettings {
  const base = saved ? clone(saved) : extractUserSettings(cfg);
  const pf = base.photoFrame ?? extractUserSettings(cfg).photoFrame!;
  return { ...base, photoFrame: { ...pf, webcamsOnly: on } };
}
