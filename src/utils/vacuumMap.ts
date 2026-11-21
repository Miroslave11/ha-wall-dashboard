import type { HassEntity } from "home-assistant-js-websocket";
import type { RoomConfig } from "../config/types";

/**
 * Převod skutečné polohy vysavače (souřadnice z mapy vysavače, Xiaomi Cloud Map Extractor v3)
 * na souřadnice půdorysu dashboardu.
 *
 * Mapa vysavače a půdorys mají jiné měřítko, posunutí a často i otočení. Spárování
 * „číslo místnosti vysavače → místnost v půdorysu“ (`vacuum.roomMap`) stačí k tomu, aby se
 * z obdélníků místností vysavače odvodila orientace (otočení / zrcadlení). Tečka se pak
 * kreslí uvnitř místnosti, kde vysavač je, podle relativní polohy v jejím obdélníku –
 * půdorys je schematický, takže přesný globální převod by tečku stejně posouval přes zdi.
 */

export interface VacuumPoint {
  x: number;
  y: number;
}

/** Obdélník místnosti v souřadnicích vysavače (x0 < x1, y0 < y1). */
export interface VacuumBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Afinní převod: px = a·x + b·y + c, py = d·x + e·y + f. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Jak osy vysavače odpovídají osám půdorysu. */
export interface Orientation {
  /** true = osa x půdorysu odpovídá ose y vysavače (mapa je otočená o 90° / 270°). */
  swap: boolean;
  /** Roste souřadnice x půdorysu s příslušnou osou vysavače? */
  flipX: boolean;
  /** Roste souřadnice y půdorysu s příslušnou osou vysavače? */
  flipY: boolean;
}

/** Výchozí orientace bez dostatku dat: osa y vysavače míří nahoru, půdorysu dolů. */
export const DEFAULT_ORIENTATION: Orientation = { swap: false, flipX: false, flipY: true };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Poloha ze senzoru polohy: atributy x, y, případně JSON ve stavu (`{"x": 25626, "y": 25389, "a": -83}`). */
export function parseVacuumPosition(e: HassEntity | undefined): VacuumPoint | null {
  if (!e) return null;
  const ax = num(e.attributes?.x);
  const ay = num(e.attributes?.y);
  if (ax !== null && ay !== null) return { x: ax, y: ay };
  try {
    const s = JSON.parse(e.state) as Record<string, unknown>;
    const x = num(s?.x);
    const y = num(s?.y);
    return x !== null && y !== null ? { x, y } : null;
  } catch {
    return null;
  }
}

/** Obdélníky místností ze senzoru místností (atributy `"1": {x0, y0, x1, y1, number}`). */
export function parseVacuumRooms(e: HassEntity | undefined): Record<string, VacuumBox> {
  const out: Record<string, VacuumBox> = {};
  for (const [key, v] of Object.entries(e?.attributes ?? {})) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const x0 = num(o.x0), y0 = num(o.y0), x1 = num(o.x1), y1 = num(o.y1);
    if (x0 === null || y0 === null || x1 === null || y1 === null) continue;
    out[key] = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
  }
  return out;
}

/** Afinní převod metodou nejmenších čtverců. Potřebuje aspoň 3 body, které neleží na přímce. */
export function fitAffine(pairs: { from: VacuumPoint; to: VacuumPoint }[]): Affine | null {
  if (pairs.length < 3) return null;
  // normální rovnice pro [x y 1] → px a py zvlášť; kvůli přesnosti se počítá vůči těžišti
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p.from.x, 0) / n;
  const my = pairs.reduce((s, p) => s + p.from.y, 0) / n;
  const tx = pairs.reduce((s, p) => s + p.to.x, 0) / n;
  const ty = pairs.reduce((s, p) => s + p.to.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0, sxu = 0, syu = 0, sxv = 0, syv = 0;
  for (const p of pairs) {
    const x = p.from.x - mx, y = p.from.y - my, u = p.to.x - tx, v = p.to.y - ty;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sxu += x * u;
    syu += y * u;
    sxv += x * v;
    syv += y * v;
  }
  const det = sxx * syy - sxy * sxy;
  // body na přímce (nebo všechny stejné) – orientaci nejde určit
  if (Math.abs(det) <= 1e-9 * Math.max(1, sxx * syy)) return null;
  const a = (sxu * syy - syu * sxy) / det;
  const b = (syu * sxx - sxu * sxy) / det;
  const d = (sxv * syy - syv * sxy) / det;
  const e = (syv * sxx - sxv * sxy) / det;
  return { a, b, c: tx - a * mx - b * my, d, e, f: ty - d * mx - e * my };
}

export function applyAffine(t: Affine, p: VacuumPoint): VacuumPoint {
  return { x: t.a * p.x + t.b * p.y + t.c, y: t.d * p.x + t.e * p.y + t.f };
}

/** Orientace z afinního převodu: rozhoduje, která osa vysavače má na kterou osu půdorysu větší vliv. */
export function orientationOf(t: Affine): Orientation {
  const swap = Math.abs(t.b) + Math.abs(t.d) > Math.abs(t.a) + Math.abs(t.e);
  return swap ? { swap, flipX: t.b < 0, flipY: t.d < 0 } : { swap, flipX: t.a < 0, flipY: t.e < 0 };
}

const union = (a: VacuumBox, b: VacuumBox): VacuumBox => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

export interface VacuumPlanMapping {
  /** Id místnosti v půdorysu → obdélník (sjednocení místností vysavače, které do ní vedou). */
  boxes: Record<string, VacuumBox>;
  orientation: Orientation;
  /** Převod celé mapy (jen když jsou spárované aspoň 3 místnosti) – pro polohu mimo známé místnosti. */
  transform: Affine | null;
}

/**
 * Spáruje místnosti vysavače s půdorysem. Neznámá čísla místností a místnosti, které
 * v půdorysu nejsou, se přeskočí. Bez jediné spárované místnosti vrátí null.
 */
export function buildVacuumMapping(vacRooms: Record<string, VacuumBox>, roomMap: Record<string, string> | undefined, planRooms: RoomConfig[]): VacuumPlanMapping | null {
  const boxes: Record<string, VacuumBox> = {};
  for (const [num, roomId] of Object.entries(roomMap ?? {})) {
    const box = vacRooms[num];
    if (!box || !planRooms.some((r) => r.id === roomId)) continue;
    boxes[roomId] = boxes[roomId] ? union(boxes[roomId], box) : box;
  }
  const ids = Object.keys(boxes);
  if (ids.length === 0) return null;
  const pairs = ids.map((id) => {
    const b = boxes[id];
    const r = planRooms.find((x) => x.id === id)!;
    return { from: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, to: { x: r.x + r.w / 2, y: r.y + r.h / 2 } };
  });
  const transform = fitAffine(pairs);
  return { boxes, orientation: transform ? orientationOf(transform) : DEFAULT_ORIENTATION, transform };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const inBox = (p: VacuumPoint, b: VacuumBox) => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;

/** Místnost půdorysu, kde vysavač je: podle senzoru místnosti, jinak podle obdélníku, ve kterém leží bod. */
export function currentPlanRoom(
  p: VacuumPoint,
  vacRooms: Record<string, VacuumBox>,
  roomMap: Record<string, string> | undefined,
  mapping: VacuumPlanMapping,
  vacRoomId?: string,
): string | null {
  const bySensor = vacRoomId !== undefined ? roomMap?.[vacRoomId] : undefined;
  if (bySensor && mapping.boxes[bySensor]) return bySensor;
  // nejmenší obdélník, který bod obsahuje (obdélníky se na hranách překrývají)
  let best: { id: string; area: number } | null = null;
  for (const [num, b] of Object.entries(vacRooms)) {
    const id = roomMap?.[num];
    if (!id || !mapping.boxes[id] || !inBox(p, b)) continue;
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (!best || area < best.area) best = { id, area };
  }
  return best?.id ?? null;
}

export interface PlanPosition {
  x: number;
  y: number;
  /** Místnost půdorysu, ve které tečka je (null = mimo spárované místnosti). */
  roomId: string | null;
}

/**
 * Poloha tečky v půdorysu. Uvnitř známé místnosti relativně k jejímu obdélníku (s okrajem `margin`),
 * jinak přes převod celé mapy oříznutý na plochu půdorysu. Když nejde ani jedno, vrátí null.
 */
export function vacuumPlanPosition(
  p: VacuumPoint,
  vacRooms: Record<string, VacuumBox>,
  roomMap: Record<string, string> | undefined,
  mapping: VacuumPlanMapping,
  plan: { width: number; height: number; rooms: RoomConfig[] },
  opts: { vacRoomId?: string; margin?: number } = {},
): PlanPosition | null {
  const m = opts.margin ?? 0;
  const roomId = currentPlanRoom(p, vacRooms, roomMap, mapping, opts.vacRoomId);
  const room = roomId ? plan.rooms.find((r) => r.id === roomId) : undefined;
  if (room && roomId) {
    const b = mapping.boxes[roomId];
    const u = clamp01((p.x - b.x0) / (b.x1 - b.x0));
    const v = clamp01((p.y - b.y0) / (b.y1 - b.y0));
    const { swap, flipX, flipY } = mapping.orientation;
    let fx = swap ? v : u;
    let fy = swap ? u : v;
    if (flipX) fx = 1 - fx;
    if (flipY) fy = 1 - fy;
    const mx = Math.min(m, room.w / 2);
    const my = Math.min(m, room.h / 2);
    return { x: room.x + mx + fx * (room.w - 2 * mx), y: room.y + my + fy * (room.h - 2 * my), roomId };
  }
  if (!mapping.transform) return null;
  const q = applyAffine(mapping.transform, p);
  return {
    x: Math.min(plan.width - m, Math.max(m, q.x)),
    y: Math.min(plan.height - m, Math.max(m, q.y)),
    roomId: null,
  };
}

/** Obdélník v pixelech obrázku mapy. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Obrázek mapy vysavače (image entita extractoru): adresa, převod souřadnic vysavače na pixely a místnosti. */
export interface VacuumMapImage {
  /** `entity_picture`: adresa relativní k HA (s tokenem), nebo úplná / data URL */
  picture: string;
  /** souřadnice vysavače → pixely obrázku (z `calibration_points`) */
  toPixels: Affine;
  /** místnosti (číslo segmentu → obdélník v souřadnicích vysavače) */
  rooms: Record<string, VacuumBox>;
}

/** Atributy image entity extractoru (`entity_picture`, `calibration_points`, `rooms`). Neúplná entita → null. */
export function parseVacuumImage(e: HassEntity | undefined): VacuumMapImage | null {
  const picture = e?.attributes?.entity_picture;
  const cal = e?.attributes?.calibration_points;
  if (typeof picture !== "string" || !picture || !Array.isArray(cal)) return null;
  const pairs: { from: VacuumPoint; to: VacuumPoint }[] = [];
  for (const c of cal) {
    const o = (typeof c === "object" && c !== null ? c : {}) as { vacuum?: Record<string, unknown>; map?: Record<string, unknown> };
    const vx = num(o.vacuum?.x), vy = num(o.vacuum?.y), mx = num(o.map?.x), my = num(o.map?.y);
    if (vx !== null && vy !== null && mx !== null && my !== null) pairs.push({ from: { x: vx, y: vy }, to: { x: mx, y: my } });
  }
  const toPixels = fitAffine(pairs);
  if (!toPixels) return null;
  // místnosti jsou u image entity vnořené v atributu `rooms`
  const rooms = parseVacuumRooms({ attributes: (e?.attributes?.rooms ?? {}) as Record<string, unknown> } as HassEntity);
  return Object.keys(rooms).length > 0 ? { picture, toPixels, rooms } : null;
}

/** Obdélník místnosti v pixelech obrázku (po otočení / zrcadlení mapy vzniká opět obdélník). */
export function roomPixelRect(t: Affine, box: VacuumBox): PixelRect {
  const a = applyAffine(t, { x: box.x0, y: box.y0 });
  const b = applyAffine(t, { x: box.x1, y: box.y1 });
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Najde senzory mapy vysavače z Xiaomi Cloud Map Extractoru v3 podle jejich entity_id
 * (`…_vacuum_position`, `…_rooms`, `…_vacuum_room_id`). Senzory se stejnou předponou mají přednost.
 */
export function suggestVacuumSensors(entities: Record<string, HassEntity>): { positionEntity?: string; roomsEntity?: string; roomEntity?: string; mapEntity?: string } {
  const ids = Object.keys(entities).filter((id) => id.startsWith("sensor.")).sort();
  const positions = ids.filter((id) => id.endsWith("_vacuum_position"));
  for (const pos of positions) {
    const prefix = pos.slice(0, -"_vacuum_position".length);
    const rooms = `${prefix}_rooms`;
    const room = `${prefix}_vacuum_room_id`;
    if (entities[rooms] && Object.keys(parseVacuumRooms(entities[rooms])).length > 0) {
      const map = `image.${prefix.slice("sensor.".length)}_live_map`;
      return { positionEntity: pos, roomsEntity: rooms, roomEntity: entities[room] ? room : undefined, mapEntity: entities[map] ? map : undefined };
    }
  }
  return positions[0] ? { positionEntity: positions[0] } : {};
}

/** Stavy, ve kterých má smysl ukazovat skutečnou polohu (v doku ne). */
export function showsLivePosition(state: string | undefined): boolean {
  return state === "cleaning" || state === "returning" || state === "paused" || state === "idle" || state === "error";
}
