import type { RoomConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { formatNumber } from "../utils/format";
import type { HistorySpec } from "./HistoryModal";

/** Teplota a vlhkost místnosti jako tlačítka, která otevřou graf historie. Bez čidel nevykreslí nic. */
export function RoomClimate({
  room,
  onHistory,
  corner = false,
}: {
  room: RoomConfig;
  onHistory: (spec: HistorySpec) => void;
  /** Uvnitř dlaždice: hodnoty pod sebou v pravém dolním rohu místnosti. */
  corner?: boolean;
}) {
  const { entities } = useHass();
  const temp = room.temperature ? entities[room.temperature] : undefined;
  const hum = room.humidity ? entities[room.humidity] : undefined;
  if (!temp && !hum) return null;

  return (
    <span className={`room-climate${corner ? " room-climate--corner" : ""}`}>
      {temp && (
        <button
          type="button"
          className="climate-btn"
          aria-label={`${room.name}: teplota ${formatNumber(temp.state)} °C, zobrazit historii`}
          onClick={() => onHistory({ title: `${room.name} – teplota`, entity: room.temperature!, kind: "temperature", color: "warm" })}
        >
          {formatNumber(temp.state)} °C
        </button>
      )}
      {hum && (
        <button
          type="button"
          className="climate-btn"
          aria-label={`${room.name}: vlhkost ${formatNumber(hum.state, 0)} %, zobrazit historii`}
          onClick={() => onHistory({ title: `${room.name} – vlhkost`, entity: room.humidity!, kind: "humidity", color: "accent" })}
        >
          {formatNumber(hum.state, 0)} %
        </button>
      )}
    </span>
  );
}
