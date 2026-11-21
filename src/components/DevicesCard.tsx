import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { vacuumToggle } from "../ha/actions";
import { VACUUM_STATES } from "../utils/vacuumRooms";
import { Icon } from "./Icon";

/** Karta vysavače; klepnutí na název a stav otevře okno s výběrem místností (`onOpen`). */
export function DevicesCard({ onOpen }: { onOpen: () => void }) {
  const { client } = useHass();
  const { vacuum } = useConfig();
  const vac = useEntity(vacuum?.entity);
  if (!vacuum) return null;

  const busy = vac?.state === "cleaning" || vac?.state === "returning";
  const cleaning = vac?.state === "cleaning";
  const vacBattery = vac?.attributes.battery_level;
  const vacText = [VACUUM_STATES[vac?.state ?? ""] ?? vac?.state ?? "–", cleaning && vacuum?.area ? vacuum.area : null, !cleaning && typeof vacBattery === "number" ? `${vacBattery} %` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="devices glass" aria-label="Zařízení">
      {vacuum && (
        <div className="device-row">
          <button type="button" className="device-open" aria-label={`${vacuum.name ?? "Robotický vysavač"}: úklid místností`} onClick={onOpen}>
            <span className="icon-circle" style={{ color: cleaning ? "var(--accent)" : undefined }}>
              <Icon name="vacuum" />
            </span>
            <div className="device-body">
              <h2>{vacuum.name ?? "Robotický vysavač"}</h2>
              <div className="device-sub">
                <span className="dot" style={{ width: 7, height: 7, background: cleaning ? "var(--accent)" : "rgba(232,236,255,0.45)", boxShadow: cleaning ? "0 0 8px var(--accent)" : "none" }} />
                {vacText}
              </div>
            </div>
          </button>
          <button className={`btn-pill${busy ? " btn-pill--active" : ""}`} style={{ padding: "0 18px" }} onClick={() => client && vacuumToggle(client, vacuum.entity, vac?.state)}>
            {busy ? "Do doku" : "Uklidit"}
          </button>
        </div>
      )}
    </section>
  );
}
