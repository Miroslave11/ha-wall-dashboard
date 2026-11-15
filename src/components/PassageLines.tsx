import type { PassageConfig } from "../config/types";
import { passageEnds } from "../utils/passages";

/** Konce čáry se zkrátí, aby nedosedala na samotné rohy otvoru. */
const INSET = 2;

/**
 * Jemná čárkovaná čára přes každý průchod (zeď je v něm vystřižená v RoomTile). Vrstva leží přes celý půdorys
 * v jeho souřadnicích a nezachytává dotyky.
 */
export function PassageLines({ passages, width, height }: { passages: PassageConfig[]; width: number; height: number }) {
  return (
    <svg className="passage-lines" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {passages.map((p, i) => {
        const e = passageEnds(p);
        const dx = p.horizontal ? INSET : 0;
        const dy = p.horizontal ? 0 : INSET;
        return <line key={i} x1={e.x1 + dx} y1={e.y1 + dy} x2={e.x2 - dx} y2={e.y2 - dy} />;
      })}
    </svg>
  );
}
