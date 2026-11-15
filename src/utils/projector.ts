import type { ProjectorConfig } from "../config/types";

/** Promítá se? (entita kina je ve stavu "on") */
export function isProjectorOn(state: string | undefined): boolean {
  return state === "on";
}

/** Body trojúhelníku paprsku od projektoru k oběma koncům plátna (SVG `points`). */
export function beamPoints(p: ProjectorConfig): string {
  const { x1, y1, x2, y2 } = p.screen;
  return `${p.x},${p.y} ${x1},${y1} ${x2},${y2}`;
}

/** Střed plátna. */
export function screenCenter(p: ProjectorConfig): { x: number; y: number } {
  const { x1, y1, x2, y2 } = p.screen;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

/** Délka plátna v souřadnicích půdorysu. */
export function screenLength(p: ProjectorConfig): number {
  const { x1, y1, x2, y2 } = p.screen;
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Zrnka prachu v paprsku: pevné body (bez náhody, ať se při překreslení nehýbou) rozložené
 * podél paprsku. `t` = poloha od projektoru (0) k plátnu (1), `s` = příčně v rozsahu −1…1 (okraje paprsku).
 */
const MOTES: { t: number; s: number }[] = [
  { t: 0.18, s: -0.4 },
  { t: 0.3, s: 0.55 },
  { t: 0.42, s: -0.1 },
  { t: 0.55, s: 0.3 },
  { t: 0.66, s: -0.65 },
  { t: 0.78, s: 0.05 },
  { t: 0.88, s: 0.6 },
];

export function beamMotes(p: ProjectorConfig): { x: number; y: number }[] {
  const { x1, y1, x2, y2 } = p.screen;
  return MOTES.map(({ t, s }) => {
    // bod na plátně posunutý příčně, pak vedený do projektoru podle t
    const u = (s + 1) / 2;
    const sx = x1 + (x2 - x1) * u;
    const sy = y1 + (y2 - y1) * u;
    return { x: p.x + (sx - p.x) * t, y: p.y + (sy - p.y) * t };
  });
}
