import { useMemo } from "react";
import type { DashboardConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { buildVacuumMapping, parseVacuumPosition, parseVacuumRooms, showsLivePosition, vacuumPlanPosition } from "../utils/vacuumMap";

/** Odstup tečky od stěn místnosti (poloměr tečky + stěna). */
const MARGIN = 14;
/** Polovina velikosti tečky (.vacuum-dot má 18 px). */
const HALF = 9;

/**
 * Tečka vysavače v půdorysu. Se senzory polohy z Xiaomi Cloud Map Extractoru ukazuje skutečnou polohu
 * (mimo dok), jinak během úklidu jen animaci.
 */
export function VacuumDot({ cfg }: { cfg: DashboardConfig }) {
  const { entities } = useHass();
  const vac = cfg.vacuum;
  const state = vac ? entities[vac.entity]?.state : undefined;
  const roomsEntity = vac?.roomsEntity ? entities[vac.roomsEntity] : undefined;

  // obdélníky místností se mění jen s mapou – spárování se nepočítá při každém posunu vysavače
  const vacRooms = useMemo(() => parseVacuumRooms(roomsEntity), [roomsEntity]);
  const mapping = useMemo(
    () => (vac?.positionEntity ? buildVacuumMapping(vacRooms, vac.roomMap, cfg.floorplan.rooms) : null),
    [vac?.positionEntity, vac?.roomMap, vacRooms, cfg.floorplan.rooms],
  );

  if (!vac || vac.showOnPlan === false) return null;

  if (vac.positionEntity) {
    const point = parseVacuumPosition(entities[vac.positionEntity]);
    if (!mapping || !point || !showsLivePosition(state)) return null;
    const vacRoomId = vac.roomEntity ? entities[vac.roomEntity]?.state : undefined;
    const pos = vacuumPlanPosition(point, vacRooms, vac.roomMap, mapping, cfg.floorplan, { vacRoomId, margin: MARGIN });
    if (!pos) return null;
    return <span className="vacuum-dot vacuum-dot--live" style={{ left: pos.x - HALF, top: pos.y - HALF }} aria-hidden="true" />;
  }

  return state === "cleaning" ? <span className="vacuum-dot" aria-hidden="true" /> : null;
}
