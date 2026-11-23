import type { FixtureConfig, RoomConfig } from "../config/types";

/** Průměr záře žárovky v souřadnicích půdorysu. */
export const BULB_GLOW = 300;
/** O kolik je záře pásku delší než pásek sám. */
const STRIP_GLOW_EXTRA = 150;
/** Šířka záře pásku napříč (u pásku na stěně je vidět jen polovina – do místnosti). */
const STRIP_GLOW_ACROSS = 330;

export interface FixtureGeometry {
  /** Střed svítidla v souřadnicích půdorysu. */
  cx: number;
  cy: number;
  /** Rozměr svítidla (žárovka 0×0, vodorovný pásek length×0). */
  w: number;
  h: number;
  /** Rozměr elipsy záře se středem v (cx, cy). */
  glowW: number;
  glowH: number;
}

export function isStrip(f: FixtureConfig): boolean {
  return f.type === "strip";
}

/** Střed, rozměr a velikost záře svítidla – vše v souřadnicích půdorysu. */
export function fixtureGeometry(f: FixtureConfig): FixtureGeometry {
  if (!isStrip(f)) {
    return { cx: f.x, cy: f.y, w: 0, h: 0, glowW: BULB_GLOW, glowH: BULB_GLOW };
  }
  const len = Math.max(0, f.length ?? 0);
  const along = len + STRIP_GLOW_EXTRA;
  return f.vertical
    ? { cx: f.x, cy: f.y + len / 2, w: 0, h: len, glowW: STRIP_GLOW_ACROSS, glowH: along }
    : { cx: f.x + len / 2, cy: f.y, w: len, h: 0, glowW: along, glowH: STRIP_GLOW_ACROSS };
}

/** Tloušťka stěny mezi místnostmi; pásek na stěně leží na její vnitřní hraně. */
const WALL = 4;

/**
 * Nové svítidlo pro Nastavení (entita zatím prázdná). Žárovka vznikne uprostřed místnosti,
 * LED pásek vodorovně u horní stěny, uprostřed, dlouhý polovinu šířky místnosti (nejvýš 100).
 */
export function newFixture(room: RoomConfig, strip: boolean): FixtureConfig {
  const n = (room.fixtures ?? []).filter((f) => isStrip(f) === strip).length + 1;
  if (!strip) {
    return { entity: "", name: `Světlo ${n}`, x: Math.round(room.x + room.w / 2), y: Math.round(room.y + room.h / 2) };
  }
  const length = Math.round(Math.min(100, room.w / 2));
  return { entity: "", type: "strip", name: `LED pásek ${n}`, x: Math.round(room.x + (room.w - length) / 2), y: room.y + WALL, length };
}
