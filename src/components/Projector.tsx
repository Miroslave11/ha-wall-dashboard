import { useId, type CSSProperties } from "react";
import type { ProjectorConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { beamMotes, beamPoints, isProjectorOn, screenCenter, screenLength } from "../utils/projector";
import { Icon } from "./Icon";

/** Minimální dotykový cíl v px. */
const TOUCH = 44;

/**
 * Paprsek projektoru k plátnu: světelný kužel, zář plátna, zrnka prachu v paprsku a nápis „KINO“.
 * Barva se pomalu mění jako při filmu (CSS animace `cinema-hue`), vypnutý projektor se nekreslí.
 * Vrstva leží přes celý půdorys (souřadnice jako v configu) a nezachytává dotyky.
 */
export function ProjectorBeam({ projector, width, height }: { projector: ProjectorConfig; width: number; height: number }) {
  const { entities } = useHass();
  const on = isProjectorOn(entities[projector.entity]?.state);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = screenCenter(projector);
  const { x1, y1, x2, y2 } = projector.screen;
  const len = screenLength(projector);

  return (
    <svg
      className={`projector-beam${on ? " projector-beam--on" : ""}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        {/* od čočky (téměř průhledná) k plátnu (nejjasnější) */}
        <linearGradient id={`${gid}-cone`} gradientUnits="userSpaceOnUse" x1={projector.x} y1={projector.y} x2={c.x} y2={c.y}>
          <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="0.12" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={`${gid}-spill`} gradientUnits="userSpaceOnUse" cx={c.x} cy={c.y} r={len * 1.1}>
          <stop offset="0" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* odlesk plátna na okolí */}
      <circle className="projector-spill" cx={c.x} cy={c.y} r={len * 1.1} fill={`url(#${gid}-spill)`} />
      <polygon className="projector-cone" points={beamPoints(projector)} fill={`url(#${gid}-cone)`} />
      {beamMotes(projector).map((m, i) => (
        <circle key={i} className="projector-mote" cx={m.x} cy={m.y} r={1.4} style={{ "--i": i } as CSSProperties} />
      ))}
      <line className="projector-screen-glow" x1={x1} y1={y1} x2={x2} y2={y2} />
      <line className="projector-screen-core" x1={x1} y1={y1} x2={x2} y2={y2} />
      <text className="projector-label" x={Math.max(x1, x2) - 4} y={Math.max(y1, y2) + 14} textAnchor="end">
        KINO
      </text>
    </svg>
  );
}

/** Projektor jako tlačítko v půdorysu: klepnutím se kino zapne / vypne. */
export function ProjectorControl({ projector, onToggle }: { projector: ProjectorConfig; onToggle: (entity: string) => void }) {
  const { entities } = useHass();
  const on = isProjectorOn(entities[projector.entity]?.state);
  const label = projector.name ?? String(entities[projector.entity]?.attributes.friendly_name ?? "Domácí kino");

  return (
    <button
      type="button"
      className={`fixture projector-btn${on ? " projector-btn--on" : ""}`}
      style={{ left: projector.x - TOUCH / 2, top: projector.y - TOUCH / 2, width: TOUCH, height: TOUCH }}
      onClick={() => onToggle(projector.entity)}
      aria-pressed={on}
      aria-label={`${label}, ${on ? "promítá" : "vypnuto"}`}
    >
      <span className="projector-ico" aria-hidden="true">
        <Icon name="projector" size={20} strokeWidth={1.7} />
      </span>
    </button>
  );
}
