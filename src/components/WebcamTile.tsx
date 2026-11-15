import type { WebcamConfig } from "../config/types";
import { useWebcamSnapshot } from "../hooks/useWebcamSnapshot";
import { Icon } from "./Icon";

/** Dlaždice webkamery v mřížce: snímek s názvem; klepnutím se otevře na celou obrazovku. */
export function WebcamTile({ cam, active, onOpen }: { cam: WebcamConfig; active: boolean; onOpen: () => void }) {
  const snap = useWebcamSnapshot(cam, active);
  return (
    <button type="button" className="cam-tile" onClick={onOpen} aria-label={`${cam.name}${cam.group ? `, ${cam.group}` : ""}: otevřít na celou obrazovku`}>
      {snap.src ? <img className="cam-img" src={snap.src} alt="" referrerPolicy="no-referrer" /> : <div className="cam-empty">{snap.ok ? "Načítám…" : "Kamera je nedostupná"}</div>}
      <div className="cam-scrim" />
      <div className="cam-label">
        <b>{cam.name}</b>
        {cam.group && <span>{cam.group}</span>}
      </div>
      {cam.type === "youtube" && (
        <span className="cam-badge">
          <Icon name="play" size={12} strokeWidth={2} /> živě
        </span>
      )}
      {!snap.ok && snap.src && (
        <span className="cam-badge cam-badge--warn">
          <Icon name="wifiOff" size={12} strokeWidth={2} /> nedostupná
        </span>
      )}
    </button>
  );
}
