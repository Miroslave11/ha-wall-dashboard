import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { useEntity, useHass } from "../ha/HassContext";
import type { HistoryPoint } from "../ha/types";
import { chartPoints, decimate, niceTicks, summarize, timeTicks, valueAt } from "../utils/chart";
import { formatNumber } from "../utils/format";
import { Icon } from "./Icon";

const W = 900;
const H = 320;
const PAD = { l: 48, r: 18, t: 16, b: 30 };

const RANGES = [
  { hours: 6, label: "6 hodin" },
  { hours: 24, label: "24 hodin" },
  { hours: 168, label: "7 dní" },
] as const;

interface Loaded {
  hours: number;
  from: number;
  to: number;
  points: HistoryPoint[];
}

const axisNumber = (v: number) => v.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

function hoverLabel(t: number, hours: number): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  return hours > 24 ? `${d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" })} ${time}` : time;
}

/** Co se v okně zobrazí: teplota (°C) nebo vlhkost (%) jedné entity. */
export interface HistorySpec {
  /** Nadpis okna, např. "Obývák" nebo "Ložnice – vlhkost". */
  title: string;
  entity: string;
  kind: "temperature" | "humidity";
  /** Barva čáry: "warm" (teplá) nebo "accent" (modrá). */
  color?: "warm" | "accent";
}

const KINDS = {
  temperature: { unit: "°C", icon: "thermo", label: "teploty", decimals: 1 },
  humidity: { unit: "%", icon: "drop", label: "vlhkosti", decimals: 0 },
} as const;

/** Detail teploty / vlhkosti: graf historie z HA s přepínačem rozsahu a odečtem hodnoty dotykem / myší. */
export function HistoryModal({ spec, onClose }: { spec: HistorySpec; onClose: () => void }) {
  const { client } = useHass();
  const kind = KINDS[spec.kind];
  const fmt = (v: number | string | undefined) => `${formatNumber(v, kind.decimals)} ${kind.unit}`;
  const entity = useEntity(spec.entity);
  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/:/g, "");
  const color = spec.color === "accent" ? "var(--accent)" : "var(--warm)";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!client || !spec.entity) return;
    let cancelled = false;
    setFailed(false);
    const load = () => {
      const to = Date.now();
      const from = to - hours * 3600_000;
      client
        .fetchHistory([spec.entity], hours)
        .then((d) => !cancelled && setData({ hours, from, to, points: d[spec.entity] ?? [] }))
        .catch((e) => {
          console.warn("Historie se nenačetla", e);
          if (!cancelled) setFailed(true);
        });
    };
    load();
    const id = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, spec.entity, hours]);

  // Zobrazí se jen graf pro aktuálně zvolený rozsah (jinak by chvíli bliknul starý)
  const ready = data && data.hours === hours ? data : null;

  const chart = useMemo(() => {
    if (!ready) return null;
    const pts = chartPoints(ready.points, ready.from, ready.to);
    if (pts.length < 2) return null;
    const stats = summarize(pts)!;
    const ticks = niceTicks(stats.min, stats.max, 4);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const x = (t: number) => PAD.l + ((t - ready.from) / (ready.to - ready.from)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
    const line = decimate(pts)
      .map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(" ");
    const base = H - PAD.b;
    const first = decimate(pts)[0];
    const area = `${x(first.t).toFixed(1)},${base} ${line} ${x(ready.to).toFixed(1)},${base}`;
    return { pts, stats, ticks, x, y, line, area, xt: timeTicks(ready.from, ready.to) };
  }, [ready]);

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (!ready || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const k = Math.min(1, Math.max(0, (px - PAD.l) / (W - PAD.l - PAD.r)));
    setHoverT(ready.from + k * (ready.to - ready.from));
  };

  const hoverV = chart && hoverT !== null ? valueAt(chart.pts, hoverT) : undefined;

  return (
    <div className="chart-backdrop" role="dialog" aria-modal="true" aria-label={`Historie ${kind.label}: ${spec.title}`} onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <Icon name={kind.icon} size={20} strokeWidth={1.8} style={{ color }} />
          <h2 className="chart-title">{spec.title}</h2>
          <div className="tabs" role="tablist" aria-label="Rozsah grafu">
            {RANGES.map((r) => (
              <button
                key={r.hours}
                type="button"
                role="tab"
                aria-selected={hours === r.hours}
                className={`tab${hours === r.hours ? " tab--active" : ""}`}
                onClick={() => {
                  setHours(r.hours);
                  setHoverT(null);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="chart-readout" aria-live="polite">
          {hoverV !== undefined && hoverT !== null ? (
            <>
              <b>{fmt(hoverV)}</b>
              <span>{hoverLabel(hoverT, hours)}</span>
            </>
          ) : (
            <>
              <b>{fmt(entity?.state)}</b>
              <span>nyní</span>
            </>
          )}
        </div>

        <div className="chart-area">
          {chart && ready ? (
            <svg
              ref={svgRef}
              className="chart-svg"
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Graf ${kind.label} ${spec.title} za posledních ${RANGES.find((r) => r.hours === hours)?.label ?? ""}`}
              onPointerDown={onPointer}
              onPointerMove={onPointer}
              onPointerLeave={(e) => e.pointerType === "mouse" && setHoverT(null)}
            >
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity={0.32} />
                  <stop offset="1" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {chart.ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={chart.y(v)} y2={chart.y(v)} className="chart-grid" />
                  <text x={PAD.l - 8} y={chart.y(v)} className="chart-label chart-label--y" dominantBaseline="middle">
                    {axisNumber(v)}
                  </text>
                </g>
              ))}
              {chart.xt.map((k) => (
                <g key={k.t}>
                  <line x1={chart.x(k.t)} x2={chart.x(k.t)} y1={PAD.t} y2={H - PAD.b} className="chart-grid chart-grid--v" />
                  <text x={chart.x(k.t)} y={H - 8} className="chart-label chart-label--x">
                    {k.label}
                  </text>
                </g>
              ))}
              <polygon points={chart.area} fill={`url(#${gid})`} />
              <polyline points={chart.line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {hoverT !== null && hoverV !== undefined && (
                <g pointerEvents="none">
                  <line x1={chart.x(hoverT)} x2={chart.x(hoverT)} y1={PAD.t} y2={H - PAD.b} className="chart-cursor" />
                  <circle cx={chart.x(hoverT)} cy={chart.y(hoverV)} r={5} fill={color} stroke="#0b1020" strokeWidth={2} />
                </g>
              )}
            </svg>
          ) : (
            <p className="chart-empty">
              {failed
                ? "Historii se nepodařilo načíst."
                : ready
                  ? "Pro tuto entitu zatím není v Home Assistantu žádná historie."
                  : "Načítám historii…"}
            </p>
          )}
        </div>

        {chart && (
          <dl className="chart-stats">
            <div>
              <dt>Minimum</dt>
              <dd>{fmt(chart.stats.min)}</dd>
            </div>
            <div>
              <dt>Průměr</dt>
              <dd>{fmt(chart.stats.avg)}</dd>
            </div>
            <div>
              <dt>Maximum</dt>
              <dd>{fmt(chart.stats.max)}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
