import type { HistoryPoint } from "../ha/types";
import { resample } from "./history";
import { shortWeekday } from "./format";

const HOUR = 3600_000;

/** „Pěkné“ hodnoty osy (1, 2, 5 × 10^n), které pokrývají celý rozsah min–max. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step + 1e-9) * step;
  const end = Math.ceil(max / step - 1e-9) * step;
  const out: number[] = [];
  for (let i = 0; start + i * step <= end + step / 1000; i++) out.push(Number((start + i * step).toFixed(10)));
  return out;
}

export interface TimeTick {
  t: number;
  label: string;
}

/** Popisky časové osy v lokálním čase: hodiny pro krátké rozsahy, dny (půlnoc) pro týden. */
export function timeTicks(from: number, to: number): TimeTick[] {
  const spanH = (to - from) / HOUR;
  const out: TimeTick[] = [];

  if (spanH > 48) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < from) d.setDate(d.getDate() + 1);
    for (; d.getTime() <= to; d.setDate(d.getDate() + 1)) {
      out.push({ t: d.getTime(), label: `${shortWeekday(d)} ${d.getDate()}.` });
    }
    return out;
  }

  const step = spanH <= 8 ? 1 : spanH <= 14 ? 2 : spanH <= 30 ? 4 : 6;
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  while (d.getTime() < from || d.getHours() % step !== 0) d.setHours(d.getHours() + 1);
  for (; d.getTime() <= to; d.setHours(d.getHours() + step)) {
    out.push({ t: d.getTime(), label: `${String(d.getHours()).padStart(2, "0")}:00` });
  }
  return out;
}

/**
 * Historie omezená na [from, to]: hodnota platná na začátku intervalu (z bodu před ním)
 * se přidá na `from`, poslední hodnota se natáhne až do `to`.
 */
export function chartPoints(points: HistoryPoint[], from: number, to: number): HistoryPoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  if (!sorted.length) return [];
  let carry: HistoryPoint | undefined;
  const out: HistoryPoint[] = [];
  for (const p of sorted) {
    if (p.t < from) carry = p;
    else if (p.t <= to) out.push(p);
  }
  if (carry) out.unshift({ t: from, v: carry.v });
  const last = out[out.length - 1];
  if (last && last.t < to) out.push({ t: to, v: last.v });
  return out;
}

/** Zredukuje body na nejvýše `max` (rovnoměrně v čase), ať se nekreslí tisíce bodů. */
export function decimate(points: HistoryPoint[], max = 240): HistoryPoint[] {
  if (points.length <= max) return points;
  const first = points[0].t;
  const last = points[points.length - 1].t;
  return resample(points, first, last, max).map((v, i) => ({ t: first + ((last - first) * i) / (max - 1), v }));
}

export interface SeriesSummary {
  min: number;
  max: number;
  /** Průměr vážený časem (stav platí do další změny). */
  avg: number;
}

export function summarize(points: HistoryPoint[]): SeriesSummary | null {
  if (!points.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let span = 0;
  for (let i = 0; i < points.length; i++) {
    const v = points[i].v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (i + 1 < points.length) {
      const dt = points[i + 1].t - points[i].t;
      sum += v * dt;
      span += dt;
    }
  }
  const avg = span > 0 ? sum / span : points.reduce((a, p) => a + p.v, 0) / points.length;
  return { min, max, avg };
}

/** Hodnota v čase `t` (lineární interpolace mezi sousedními body, mimo rozsah krajní hodnota). */
export function valueAt(points: HistoryPoint[], t: number): number | undefined {
  if (!points.length) return undefined;
  if (t <= points[0].t) return points[0].v;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].t) {
      const a = points[i - 1];
      const b = points[i];
      const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * k;
    }
  }
  return points[points.length - 1].v;
}
