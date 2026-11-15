import type { FixtureConfig } from "../config/types";

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
