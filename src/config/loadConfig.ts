import { validateWebcams } from "../utils/webcams";
import type { DashboardConfig } from "./types";

export const DEFAULT_CONFIG: DashboardConfig = {
  hass: { url: "", auth: "oauth" },
  demo: false,
  stage: { width: 1280, height: 800 },
  theme: { accent: "#5EE0FF", light: "#FFB45C" },
  header: {},
  floorplan: { title: "Domov", width: 640, height: 460, furniture: true, rooms: [] },
  scenes: [],
  temperatures: [],
  historyHours: 24,
  webcams: [],
  photoFrame: {
    enabled: true,
    idleSeconds: 180,
    slideSeconds: 12,
    shuffle: true,
    portrait: "blur",
    landscape: "crop",
    kenBurns: "on",
    webcams: false,
    webcamEvery: 4,
    source: { type: "list", urls: [] },
  },
};

type Plain = Record<string, unknown>;

function isPlain(v: unknown): v is Plain {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Hluboké sloučení – pole se nahrazují celá, objekty se slučují. */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlain(base) || !isPlain(override)) {
    return (override === undefined ? base : override) as T;
  }
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k.startsWith("_")) continue; // klíče "_comment" apod. ignorujeme
    out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/** Základní kontrola konfigurace – vrací seznam chyb (prázdný = OK). */
export function validateConfig(cfg: DashboardConfig): string[] {
  const errors: string[] = [];
  const isDemo = cfg.demo || !cfg.hass.url;
  if (!isDemo) {
    if (!/^https?:\/\//.test(cfg.hass.url)) errors.push("hass.url musí začínat http:// nebo https://");
    if (cfg.hass.auth === "token" && !cfg.hass.token) errors.push("hass.auth je \"token\", ale chybí hass.token");
  }
  const ids = new Set<string>();
  for (const r of cfg.floorplan.rooms) {
    if (ids.has(r.id)) errors.push(`Duplicitní id místnosti: ${r.id}`);
    ids.add(r.id);
    if (!r.name?.trim()) errors.push(`Místnost ${r.id}: chybí název`);
    if (!Array.isArray(r.lights)) errors.push(`Místnost ${r.id}: "lights" musí být pole`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > cfg.floorplan.width || r.y + r.h > cfg.floorplan.height) {
      errors.push(`Místnost ${r.id} přesahuje plochu půdorysu ${cfg.floorplan.width}×${cfg.floorplan.height}`);
    }
    for (const f of r.fixtures ?? []) {
      if (!f.entity) {
        errors.push(`Místnost ${r.name || r.id}: svítidlo ${f.name ?? ""} nemá vybranou entitu`);
        continue;
      }
      if (Array.isArray(r.lights) && !r.lights.includes(f.entity)) {
        errors.push(`Místnost ${r.id}: svítidlo ${f.entity} musí být uvedeno i v "lights"`);
      }
      if (f.type === "strip" && !(typeof f.length === "number" && f.length > 0)) {
        errors.push(`Místnost ${r.id}: LED pásek ${f.entity} potřebuje kladnou "length"`);
      }
      if (f.x < r.x || f.y < r.y || f.x > r.x + r.w || f.y > r.y + r.h) {
        errors.push(`Místnost ${r.id}: svítidlo ${f.entity} leží mimo místnost`);
      }
    }
  }
  const pj = cfg.floorplan.projector;
  if (pj) {
    const nums = pj.screen ? [pj.x, pj.y, pj.screen.x1, pj.screen.y1, pj.screen.x2, pj.screen.y2] : [];
    if (!pj.entity) errors.push("Projektor: chybí entita");
    else if (nums.length !== 6 || !nums.every((n) => typeof n === "number" && Number.isFinite(n))) {
      errors.push("Projektor: vyplňte čísla x, y a screen { x1, y1, x2, y2 }");
    }
  }
  const vac = cfg.vacuum;
  if (vac) {
    if (vac.positionEntity && !vac.roomsEntity) errors.push("Vysavač: k senzoru polohy vyberte i senzor místností (roomsEntity)");
    for (const [num, roomId] of Object.entries(vac.roomMap ?? {})) {
      if (roomId && !ids.has(roomId)) errors.push(`Vysavač: místnost ${num} je spárovaná s neexistující místností „${roomId}“`);
    }
  }
  for (const h of cfg.heating ?? []) {
    if (!h.name?.trim()) errors.push("Topení: hlavice bez názvu");
    if (!h.entity?.startsWith("climate.")) errors.push(`Topení ${h.name || ""}: "entity" musí být climate.*`);
    if (h.schedule && !h.schedule.startsWith("text.")) errors.push(`Topení ${h.name || ""}: "schedule" musí být text.*`);
  }
  const rd = cfg.radar;
  if (rd) {
    const okLat = typeof rd.lat === "number" && rd.lat >= -90 && rd.lat <= 90;
    const okLon = typeof rd.lon === "number" && rd.lon >= -180 && rd.lon <= 180;
    if (!okLat || !okLon) errors.push("Radar: lat musí být −90…90 a lon −180…180");
    if (rd.zoom !== undefined && !(rd.zoom >= 3 && rd.zoom <= 10)) errors.push("Radar: zoom musí být 3 až 10");
  }
  errors.push(...validateWebcams(cfg.webcams));
  const every = cfg.photoFrame.webcamEvery;
  if (every !== undefined && !(Number.isInteger(every) && every >= 1)) errors.push("Fotorámeček: webcamEvery musí být celé číslo od 1");
  for (const p of cfg.floorplan.passages ?? []) {
    if (![p.x, p.y, p.length].every((n) => typeof n === "number" && Number.isFinite(n)) || p.length <= 0) {
      errors.push("Průchod: vyplňte čísla x, y a kladnou délku length");
    }
  }
  for (const s of cfg.scenes) {
    if (!s.entity && !s.lights) errors.push(`Scéna "${s.name}" potřebuje "entity" nebo "lights"`);
    if (!s.name?.trim()) errors.push("Scéna bez názvu");
  }
  for (const t of cfg.temperatures) {
    if (!t.entity) errors.push(`Graf teploty "${t.name}" nemá vybranou entitu`);
  }
  if (!(cfg.photoFrame.idleSeconds >= 5)) errors.push("Fotorámeček: spuštění po nečinnosti musí být alespoň 5 s");
  if (!(cfg.photoFrame.slideSeconds >= 3)) errors.push("Fotorámeček: doba zobrazení fotky musí být alespoň 3 s");
  const pfc = cfg.photoFrame;
  if (pfc.portrait !== undefined && !["blur", "pair", "black", "crop"].includes(pfc.portrait)) errors.push('Fotorámeček: portrait musí být "blur", "pair", "black" nebo "crop"');
  if (pfc.landscape !== undefined && !["crop", "blur", "black"].includes(pfc.landscape)) errors.push('Fotorámeček: landscape musí být "crop", "blur" nebo "black"');
  if (pfc.kenBurns !== undefined && !["on", "subtle", "off"].includes(pfc.kenBurns)) errors.push('Fotorámeček: kenBurns musí být "on", "subtle" nebo "off"');
  const b = cfg.photoFrame.blackout;
  if (b && !(/^\d{1,2}:\d{2}$/.test(b.from) && /^\d{1,2}:\d{2}$/.test(b.to))) errors.push("Fotorámeček: noční okno musí mít čas ve tvaru HH:MM");
  return errors;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // Vite dev server vrací pro neexistující soubory index.html – to nechceme
    if (!type.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Načte konfiguraci: nejdřív `/config.local.json` (není v gitu, skutečné entity),
 * jinak `/config.json`. Výsledek se sloučí s výchozími hodnotami.
 */
export async function loadConfig(): Promise<DashboardConfig> {
  const base = import.meta.env.BASE_URL;
  const raw = (await fetchJson(`${base}config.local.json`)) ?? (await fetchJson(`${base}config.json`));
  if (!raw) throw new Error("Nepodařilo se načíst config.json");
  return deepMerge(DEFAULT_CONFIG, raw);
}
