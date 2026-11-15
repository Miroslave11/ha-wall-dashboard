import type { HistoryPoint } from "../ha/types";

/**
 * Odpověď WS příkazu `history/history_during_period` s `minimal_response: true`.
 * Položky jsou v komprimovaném tvaru: `s` = stav, `lu` / `lc` = čas v sekundách (float).
 */
export type RawHistoryResponse = Record<string, Array<{ s?: string; lu?: number; lc?: number; state?: string; last_changed?: string }>>;

export function parseHistoryResponse(res: RawHistoryResponse): Record<string, HistoryPoint[]> {
  const out: Record<string, HistoryPoint[]> = {};
  for (const [id, items] of Object.entries(res ?? {})) {
    out[id] = items
      .map((it) => {
        const raw = it.s ?? it.state;
        const t = it.lu ?? it.lc;
        const ms = t !== undefined ? t * 1000 : it.last_changed ? Date.parse(it.last_changed) : NaN;
        return { t: ms, v: raw === undefined ? NaN : parseFloat(raw) };
      })
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
  }
  return out;
}

/**
 * Převzorkuje schodovitou historii (stav platí do další změny) na `n` rovnoměrných bodů
 * v intervalu [from, to]. Před prvním známým bodem použije první hodnotu.
 */
export function resample(points: HistoryPoint[], from: number, to: number, n: number): number[] {
  if (!points.length || n < 2) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / (n - 1);
    while (j + 1 < sorted.length && sorted[j + 1].t <= t) j++;
    out.push(sorted[j].t <= t ? sorted[j].v : sorted[0].v);
  }
  return out;
}

/** Body pro SVG polyline/polygon sparkline grafu. */
export function sparkPoints(values: number[], w: number, h: number, pad = 4): { line: string; area: string } {
  if (values.length < 2) return { line: "", area: "" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - pad - ((v - min) / range) * (h - pad * 2.5);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(" ");
  return { line, area: `0,${h} ${line} ${w},${h}` };
}
