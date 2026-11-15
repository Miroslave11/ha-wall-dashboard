import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

/**
 * Sleduje nečinnost uživatele. Po `idleMs` bez aktivity vrátí `idle = true`.
 * Když je `idle`, globální aktivita ho NEukončí – probuzení řeší překryv fotorámečku
 * voláním `wake()` po klepnutí, aby se klepnutí "nepropsalo" do ovládacího prvku pod ním.
 */
export function useIdle(idleMs: number, enabled = true) {
  const [idle, setIdle] = useState(false);
  const last = useRef(Date.now());
  const idleRef = useRef(false);
  idleRef.current = idle;

  useEffect(() => {
    if (!enabled) return;
    const mark = () => {
      if (!idleRef.current) last.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    const id = window.setInterval(() => {
      if (!idleRef.current && Date.now() - last.current >= idleMs) setIdle(true);
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, mark));
      clearInterval(id);
    };
  }, [idleMs, enabled]);

  const wake = useCallback(() => {
    last.current = Date.now();
    setIdle(false);
  }, []);

  const start = useCallback(() => setIdle(true), []);

  return { idle: enabled && idle, wake, start };
}
