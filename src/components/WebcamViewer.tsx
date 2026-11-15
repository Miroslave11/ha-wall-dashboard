import { useEffect } from "react";
import type { WebcamConfig } from "../config/types";
import { useWebcamSnapshot } from "../hooks/useWebcamSnapshot";
import { webcamEmbedUrl } from "../utils/webcams";
import { Icon } from "./Icon";

interface Props {
  cam: WebcamConfig;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

/** Webkamera na celou plochu stránky: u YouTube živé video, jinak obnovovaný snímek. Šipky přepínají kamery. */
export function WebcamViewer({ cam, onClose, onPrev, onNext }: Props) {
  const embed = webcamEmbedUrl(cam);
  const snap = useWebcamSnapshot(cam, !embed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="cam-viewer" role="dialog" aria-modal="true" aria-label={`Webkamera ${cam.name}`}>
      <div className="cam-viewer-head">
        <h2 className="cam-viewer-title">
          {cam.name}
          {cam.group && <small>{cam.group}</small>}
        </h2>
        {snap.at && !embed && <span className="cam-viewer-time">{new Date(snap.at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        <button type="button" className="icon-btn" aria-label="Zavřít" onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
      </div>
      <div className="cam-viewer-stage">
        {embed ? (
          <iframe className="cam-frame" src={embed} title={cam.name} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
        ) : snap.src ? (
          <img className="cam-viewer-img" src={snap.src} alt={cam.name} referrerPolicy="no-referrer" />
        ) : (
          <div className="cam-empty">{snap.ok ? "Načítám…" : "Kamera je nedostupná"}</div>
        )}
        {!embed && !snap.ok && snap.src && <span className="cam-badge cam-badge--warn cam-badge--big">nedostupná, ukazuje poslední snímek</span>}
        {onPrev && (
          <button type="button" className="cam-nav cam-nav--prev" aria-label="Předchozí kamera" onClick={onPrev}>
            <Icon name="chevronLeft" size={26} strokeWidth={2} />
          </button>
        )}
        {onNext && (
          <button type="button" className="cam-nav cam-nav--next" aria-label="Další kamera" onClick={onNext}>
            <Icon name="chevronRight" size={26} strokeWidth={2} />
          </button>
        )}
      </div>
      {cam.source && <div className="cam-viewer-source">Zdroj: {cam.source}</div>}
    </div>
  );
}
