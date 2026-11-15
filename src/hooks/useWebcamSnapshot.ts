import { useEffect, useState } from "react";
import type { WebcamConfig } from "../config/types";
import { refreshSeconds, webcamSnapshotUrls } from "../utils/webcams";

/** Náhled živého přenosu z YouTube se obnovuje sám, stačí ho přenačítat jednou za dvě minuty. */
const YOUTUBE_REFRESH_SEC = 120;
/** Menší obrázek než tento je zástupný (YouTube vrací 120×90 šedý čtverec, když náhled neexistuje). */
const MIN_WIDTH = 200;

export interface WebcamSnapshot {
  /** Adresa poslední úspěšně načtené podoby snímku (null = ještě žádná). */
  src: string | null;
  /** Poslední pokus se povedl. Při neúspěchu zůstává předchozí snímek a kamera se označí jako nedostupná. */
  ok: boolean;
  /** Kdy se snímek naposledy podařilo načíst (ms). */
  at: number | null;
}

/**
 * Pravidelně načítá snímek webkamery. Nový snímek se nejdřív přednačte, až pak vymění starý,
 * takže nic neproblikne. Když je `enabled` false (stránka není vidět), nic se nestahuje.
 */
export function useWebcamSnapshot(cam: WebcamConfig, enabled: boolean): WebcamSnapshot {
  const [state, setState] = useState<WebcamSnapshot>({ src: null, ok: true, at: null });
  const interval = (cam.type === "youtube" ? YOUTUBE_REFRESH_SEC : refreshSeconds(cam)) * 1000;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const attempt = (urls: string[], i: number) => {
      if (cancelled) return;
      if (i >= urls.length) {
        setState((s) => ({ ...s, ok: false }));
        return;
      }
      const img = new Image();
      img.referrerPolicy = "no-referrer"; // některé servery blokují odkazy z cizích stránek podle Referer
      img.onload = () => {
        if (cancelled) return;
        if (img.naturalWidth < MIN_WIDTH) attempt(urls, i + 1);
        else setState({ src: urls[i], ok: true, at: Date.now() });
      };
      img.onerror = () => attempt(urls, i + 1);
      img.src = urls[i];
    };

    const tick = () => {
      if (document.hidden) return;
      attempt(webcamSnapshotUrls(cam, Date.now()), 0);
    };
    tick();
    const id = window.setInterval(tick, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- závisí jen na tom, co určuje adresu a interval
  }, [cam.id, cam.type, cam.url, interval, enabled]);

  return state;
}
