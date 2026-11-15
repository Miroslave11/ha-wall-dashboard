import type { CSSProperties } from "react";
import type { PassageConfig, RoomConfig } from "../config/types";

/** Mezera mezi místnostmi (stěna) v px – stejná jako v RoomTile / FloorplanCard. */
export const WALL = 4;
/** Hloubka vystřižení do dlaždice (px) – jen 1px okraj dlaždice, takže otvor je stejně široký jako zeď. */
const CUT = 1;
/** Tolerance při hledání zdi místnosti (px půdorysu). */
const EPS = 1;

/** Obdélník otvoru v souřadnicích uvnitř dlaždice (počátek v jejím levém horním rohu). */
export interface Hole {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Konce otvoru v souřadnicích půdorysu: od (x1, y1) do (x2, y2). */
export function passageEnds(p: PassageConfig): { x1: number; y1: number; x2: number; y2: number } {
  return p.horizontal ? { x1: p.x, y1: p.y, x2: p.x + p.length, y2: p.y } : { x1: p.x, y1: p.y, x2: p.x, y2: p.y + p.length };
}

/**
 * Otvory, které průchody dělají v dlaždici dané místnosti. Průchod patří dlaždici, když leží na její zdi
 * (levá / pravá hrana u svislé zdi, horní / dolní u vodorovné) a otvor se překrývá s jejím rozsahem.
 */
export function passageHoles(room: RoomConfig, passages: PassageConfig[] | undefined): Hole[] {
  const holes: Hole[] = [];
  const tileW = room.w - WALL * 2;
  const tileH = room.h - WALL * 2;
  for (const p of passages ?? []) {
    if (p.horizontal) {
      const from = Math.max(p.x, room.x + WALL) - (room.x + WALL);
      const to = Math.min(p.x + p.length, room.x + room.w - WALL) - (room.x + WALL);
      if (to <= from) continue;
      if (Math.abs(p.y - room.y) <= EPS) holes.push({ x: from, y: -CUT, w: to - from, h: CUT * 2 });
      else if (Math.abs(p.y - (room.y + room.h)) <= EPS) holes.push({ x: from, y: tileH - CUT, w: to - from, h: CUT * 2 });
    } else {
      const from = Math.max(p.y, room.y + WALL) - (room.y + WALL);
      const to = Math.min(p.y + p.length, room.y + room.h - WALL) - (room.y + WALL);
      if (to <= from) continue;
      if (Math.abs(p.x - room.x) <= EPS) holes.push({ x: -CUT, y: from, w: CUT * 2, h: to - from });
      else if (Math.abs(p.x - (room.x + room.w)) <= EPS) holes.push({ x: tileW - CUT, y: from, w: CUT * 2, h: to - from });
    }
  }
  return holes;
}

/**
 * CSS maska, která z dlaždice vystřihne otvory (okraj i záře u zdi v nich zmizí). Základem je celá dlaždice,
 * každý otvor se odečte režimem `exclude`. Bez otvorů vrací prázdný objekt (dlaždice zůstane beze masky).
 */
export function passageMask(holes: Hole[]): CSSProperties {
  if (!holes.length) return {};
  const full = "linear-gradient(#000 0 0)";
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  const layers = [full, ...holes.map(() => full)].join(",");
  const sizes = ["100% 100%", ...holes.map((h) => `${px(h.w)} ${px(h.h)}`)].join(",");
  const positions = ["0 0", ...holes.map((h) => `${px(h.x)} ${px(h.y)}`)].join(",");
  const repeat = Array(holes.length + 1).fill("no-repeat").join(",");
  return {
    maskImage: layers,
    maskSize: sizes,
    maskPosition: positions,
    maskRepeat: repeat,
    maskComposite: "exclude",
    WebkitMaskImage: layers,
    WebkitMaskSize: sizes,
    WebkitMaskPosition: positions,
    WebkitMaskRepeat: repeat,
    WebkitMaskComposite: "xor",
  } as CSSProperties;
}
