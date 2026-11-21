import { useEffect, useMemo, useState } from "react";
import { vacuumCleanRooms, vacuumLocate, vacuumToggle } from "../ha/actions";
import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { selectedSegments, VACUUM_STATES, vacuumRoomChoices } from "../utils/vacuumRooms";
import { Icon } from "./Icon";
import { VacuumMapPicker } from "./VacuumMapPicker";

/** Okno vysavače: výběr místností k úklidu (segmenty z `vacuum.roomMap`), úklid celého bytu, do doku, najít vysavač. */
export function VacuumRoomsModal({ onClose }: { onClose: () => void }) {
  const { client } = useHass();
  const { vacuum, floorplan } = useConfig();
  const vac = useEntity(vacuum?.entity);
  const choices = useMemo(() => vacuumRoomChoices(vacuum, floorplan.rooms), [vacuum, floorplan.rooms]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!vacuum) return null;

  const busy = vac?.state === "cleaning" || vac?.state === "returning";
  const battery = vac?.attributes.battery_level;
  const status = [VACUUM_STATES[vac?.state ?? ""] ?? vac?.state ?? "–", typeof battery === "number" ? `${battery} %` : null].filter(Boolean).join(" · ");
  const segments = selectedSegments(choices, selected);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const run = (fn: () => unknown) => {
    if (!client) return;
    void fn();
    onClose();
  };

  return (
    <div className="chart-backdrop" role="dialog" aria-modal="true" aria-label="Úklid místností" onClick={onClose}>
      <div className="chart-modal vac-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <span className="icon-circle" style={{ color: vac?.state === "cleaning" ? "var(--accent)" : undefined }}>
            <Icon name="vacuum" />
          </span>
          <div className="wx-now">
            <h2 className="chart-title">{vacuum.name ?? "Robotický vysavač"}</h2>
            <span className="wx-sub">{status}</span>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>

        {choices.length > 0 ? (
          <>
            <p className="vac-hint">Klepnutím na mapu vyberte místnosti, které má vysavač uklidit.</p>
            <VacuumMapPicker choices={choices} selected={selected} onToggle={toggle} />
          </>
        ) : (
          <p className="vac-hint">Pro výběr místností je potřeba v Nastavení → Ostatní entity (nebo v configu) spárovat místnosti vysavače (`vacuum.roomMap`).</p>
        )}

        <div className="vac-actions">
          <button
            type="button"
            className="btn-pill btn-pill--primary"
            disabled={segments.length === 0}
            onClick={() => run(() => client && vacuumCleanRooms(client, vacuum.entity, segments))}
          >
            Uklidit vybrané{segments.length > 0 ? ` (${selected.size})` : ""}
          </button>
          <button type="button" className="btn-pill" onClick={() => run(() => client?.callService("vacuum", "start", {}, { entity_id: vacuum.entity }))}>
            Uklidit vše
          </button>
          {busy && (
            <button type="button" className="btn-pill" onClick={() => run(() => client && vacuumToggle(client, vacuum.entity, vac?.state))}>
              Do doku
            </button>
          )}
          <button type="button" className="btn-pill" onClick={() => client && void vacuumLocate(client, vacuum.entity)}>
            Najít vysavač
          </button>
        </div>
      </div>
    </div>
  );
}
