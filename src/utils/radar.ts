import type { RadarConfig } from "../config/types";

/** Jeden snímek radaru z RainViewer: čas (unix, s) a cesta k dlaždicím. */
export interface RadarFrame {
  time: number;
  path: string;
  /** Předpověď (nowcast) místo naměřeného snímku. */
  forecast: boolean;
}

export interface RadarMaps {
  host: string;
  frames: RadarFrame[];
}

/** Střed ČR, když v configu `radar` chybí. */
export const DEFAULT_RADAR = { lat: 49.8, lon: 15.5, zoom: 7 };

/** Radar z configu s doplněnými výchozími hodnotami. */
export function resolveRadar(cfg: RadarConfig | undefined): { lat: number; lon: number; zoom: number; name?: string } {
  return { lat: cfg?.lat ?? DEFAULT_RADAR.lat, lon: cfg?.lon ?? DEFAULT_RADAR.lon, zoom: cfg?.zoom ?? DEFAULT_RADAR.zoom, name: cfg?.name };
}

/** Nejvyšší zoom, který RainViewer dlaždice nabízí (výš se jen zvětšují). */
export const RADAR_MAX_NATIVE_ZOOM = 7;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseFrames(list: unknown, forecast: boolean): RadarFrame[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((f) => (isObj(f) && typeof f.time === "number" && typeof f.path === "string" ? [{ time: f.time, path: f.path, forecast }] : []));
}

/** Zpracuje odpověď `https://api.rainviewer.com/public/weather-maps.json`. Neznámý tvar → null. */
export function parseRadarMaps(raw: unknown): RadarMaps | null {
  if (!isObj(raw) || typeof raw.host !== "string" || !isObj(raw.radar)) return null;
  const frames = [...parseFrames(raw.radar.past, false), ...parseFrames(raw.radar.nowcast, true)].sort((a, b) => a.time - b.time);
  return frames.length ? { host: raw.host, frames } : null;
}

/** Šablona URL dlaždic Leafletu pro jeden snímek: 256 px, barevné schéma 2 (Universal Blue), vyhlazeno, sníh zvlášť. */
export function radarTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** Stáří snímku česky: „nyní“, „před 20 min“, u předpovědi „za 10 min“. */
export function frameAge(time: number, nowMs: number): string {
  const min = Math.round((nowMs / 1000 - time) / 60);
  if (Math.abs(min) < 3) return "nyní";
  if (min < 0) return `za ${-min} min`;
  if (min < 90) return `před ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `před ${h} h ${m} min` : `před ${h} h`;
}
