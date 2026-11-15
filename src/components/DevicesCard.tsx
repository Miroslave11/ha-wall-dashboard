import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { setCoverPosition, vacuumToggle } from "../ha/actions";
import { Icon } from "./Icon";

const VACUUM_STATES: Record<string, string> = {
  cleaning: "Uklízí",
  docked: "V doku",
  returning: "Vrací se do doku",
  idle: "Nečinný",
  paused: "Pozastaven",
  error: "Chyba",
  unavailable: "Nedostupný",
};

const COVER_STATES: Record<string, string> = {
  opening: "Otevírá se",
  closing: "Zavírá se",
  unavailable: "Nedostupné",
};

export function DevicesCard() {
  const { client } = useHass();
  const { vacuum, blinds } = useConfig();
  const vac = useEntity(vacuum?.entity);
  const cover = useEntity(blinds?.entity);
  if (!vacuum && !blinds) return null;

  const busy = vac?.state === "cleaning" || vac?.state === "returning";
  const cleaning = vac?.state === "cleaning";
  const vacBattery = vac?.attributes.battery_level;
  const vacText = [VACUUM_STATES[vac?.state ?? ""] ?? vac?.state ?? "–", cleaning && vacuum?.area ? vacuum.area : null, !cleaning && typeof vacBattery === "number" ? `${vacBattery} %` : null]
    .filter(Boolean)
    .join(" · ");

  const pos = Number(cover?.attributes.current_position ?? (cover?.state === "open" ? 100 : 0));
  const coverText =
    COVER_STATES[cover?.state ?? ""] ?? (pos >= 100 ? "Otevřeno" : pos <= 0 ? "Zavřeno" : `Otevřeno ${pos} %`);

  return (
    <section className="devices glass" aria-label="Zařízení">
      {vacuum && (
        <div className="device-row">
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
          <button className={`btn-pill${busy ? " btn-pill--active" : ""}`} style={{ padding: "0 18px" }} onClick={() => client && vacuumToggle(client, vacuum.entity, vac?.state)}>
            {busy ? "Do doku" : "Uklidit"}
          </button>
        </div>
      )}
      {vacuum && blinds && <div className="divider" />}
      {blinds && (
        <>
          <div className="device-row">
            <span className="icon-circle">
              <Icon name="blinds" />
            </span>
            <div className="device-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2>{blinds.name ?? "Žaluzie"}</h2>
                <span style={{ fontSize: 13, color: "rgba(232,236,255,0.72)" }}>{coverText}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pos))}%` }} />
              </div>
            </div>
          </div>
          <div className="btn-grid">
            <button className="btn-sq" aria-label="Vytáhnout žaluzie" onClick={() => client && setCoverPosition(client, blinds.entity, 100)}>
              <Icon name="chevronUp" size={18} strokeWidth={1.8} />
              Nahoru
            </button>
            <button className="btn-sq" aria-label="Žaluzie napůl" onClick={() => client && setCoverPosition(client, blinds.entity, 50)}>
              <Icon name="minus" size={18} strokeWidth={1.8} />
              Napůl
            </button>
            <button className="btn-sq" aria-label="Stáhnout žaluzie" onClick={() => client && setCoverPosition(client, blinds.entity, 0)}>
              <Icon name="chevronDown" size={18} strokeWidth={1.8} />
              Dolů
            </button>
          </div>
        </>
      )}
    </section>
  );
}
