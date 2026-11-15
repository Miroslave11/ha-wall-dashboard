import { useId } from "react";
import type { TemperatureCardConfig } from "../config/types";
import { useEntity } from "../ha/HassContext";
import type { HistoryPoint } from "../ha/types";
import { formatNumber } from "../utils/format";
import { resample, sparkPoints } from "../utils/history";
import { Icon } from "./Icon";

const W = 160;
const H = 46;

export function TempCard({
  card,
  history,
  hours,
  onOpen,
}: {
  card: TemperatureCardConfig;
  history: HistoryPoint[] | undefined;
  hours: number;
  /** Klepnutí na kartu otevře detail s grafem historie. */
  onOpen: () => void;
}) {
  const entity = useEntity(card.entity);
  const gid = useId().replace(/:/g, "");
  const color = card.color === "accent" ? "var(--accent)" : "var(--warm)";
  const now = Date.now();
  const values = history?.length ? resample(history, now - hours * 3600_000, now, 48) : [];
  const { line, area } = sparkPoints(values, W, H);

  return (
    <button type="button" className="temp-card glass" onClick={onOpen} aria-label={`Teplota ${card.name}, zobrazit historii`}>
      <div className="temp-head">
        <h2>{card.name}</h2>
        <Icon name="thermo" size={16} strokeWidth={1.8} style={{ color }} />
      </div>
      <div className="temp-value">
        {formatNumber(entity?.state)}
        <small>°C</small>
      </div>
      <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.35} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {area && <polygon points={area} fill={`url(#${gid})`} />}
        {line && <polyline points={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </svg>
    </button>
  );
}
