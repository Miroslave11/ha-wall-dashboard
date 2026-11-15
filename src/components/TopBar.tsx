import { useEffect, useState } from "react";
import { useConfig, useHass } from "../ha/HassContext";
import { formatClock, formatDate, formatNumber, formatWeekday, relativeFuture } from "../utils/format";
import { Icon, type IconName } from "./Icon";

function Chip({ icon, label, value, variant, onClick, expanded }: { icon: IconName; label: string; value: string; variant?: "warm" | "accent" | "warn" | "danger"; onClick?: () => void; expanded?: boolean }) {
  const cls = `chip${variant ? ` chip--${variant}` : ""}`;
  const body = (
    <>
      <span className="chip-icon">
        <Icon name={icon} size={18} strokeWidth={1.7} />
      </span>
      <span className="chip-text">
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </>
  );
  return onClick ? (
    <button className={cls} onClick={onClick} aria-expanded={expanded}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function TopBar({ now }: { now: Date }) {
  const { entities, status } = useHass();
  const { header } = useConfig();
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    if (!showAlerts) return;
    const id = window.setTimeout(() => setShowAlerts(false), 10_000);
    return () => clearTimeout(id);
  }, [showAlerts]);

  const sun = header.sun ? entities[header.sun] : undefined;
  const sunUp = sun?.state === "above_horizon";
  const battery = header.blindsBattery ? entities[header.blindsBattery] : undefined;
  const presence = header.presence ? entities[header.presence] : undefined;
  const activeAlerts = (header.alerts ?? []).map((id) => entities[id]).filter((e) => e?.state === "on");

  let presenceText = "–";
  if (presence) {
    const n = Number(presence.state);
    if (Number.isFinite(n)) presenceText = n > 0 ? (n > 1 ? `Doma · ${n}` : "Doma") : "Nikdo doma";
    else presenceText = presence.state === "home" || presence.state === "on" ? "Doma" : "Pryč";
  }

  const batteryValue = !battery || ["unknown", "unavailable"].includes(battery.state) ? "Neznámá" : `${formatNumber(battery.state, 0)} %`;

  return (
    <header className="topbar">
      <div className="clock">
        <div className="clock-time">{formatClock(now)}</div>
        <div className="clock-date">
          <b>{formatWeekday(now)}</b>
          <span>{formatDate(now)}</span>
        </div>
      </div>
      <div className="chips">
        {sun && (
          <Chip
            icon={sunUp ? "sunset" : "sunrise"}
            label={sunUp ? "Západ slunce" : "Východ slunce"}
            value={relativeFuture(String(sunUp ? sun.attributes.next_setting : sun.attributes.next_rising), now.getTime())}
            variant="warm"
          />
        )}
        {status !== "connected" ? (
          <Chip icon="wifiOff" label="Home Assistant" value={status === "connecting" ? "Připojuji…" : "Odpojeno"} variant="danger" />
        ) : (
          header.blindsBattery && <Chip icon="battery" label="Baterie žaluzií" value={batteryValue} />
        )}
        {header.alerts && header.alerts.length > 0 && (
          <Chip
            icon={activeAlerts.length ? "alert" : "check"}
            label="Upozornění"
            value={activeAlerts.length ? `${activeAlerts.length} aktivní` : "Vše v pořádku"}
            variant={activeAlerts.length ? "warn" : undefined}
            onClick={activeAlerts.length ? () => setShowAlerts((v) => !v) : undefined}
            expanded={showAlerts}
          />
        )}
        {header.presence && <Chip icon="home" label="Přítomnost" value={presenceText} variant="accent" />}
        {showAlerts && activeAlerts.length > 0 && (
          <div className="popover glass" role="dialog" aria-label="Aktivní upozornění">
            {activeAlerts.map((e) => (
              <div className="popover-item" key={e!.entity_id}>
                <Icon name="alert" size={16} />
                {String(e!.attributes.friendly_name ?? e!.entity_id)}
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
