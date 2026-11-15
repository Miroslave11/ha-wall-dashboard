import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

/** Pohyb prstu (px), po kterém se stisk už nepočítá jako „dlouhý“ (uživatel táhne / posouvá). */
const MOVE_TOLERANCE = 10;

/**
 * Dlouhý stisk na tlačítku. Po `ms` bez většího pohybu zavolá `onLong`; následné klepnutí (click),
 * které prst po puštění vyvolá, se potlačí – `click(fn)` ho obalí.
 *
 *   const lp = useLongPress(() => open());
 *   <button {...lp.bind} onClick={lp.click(() => toggle())} />
 */
export function useLongPress(onLong: () => void, ms = 550) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const handler = useRef(onLong);
  useEffect(() => {
    handler.current = onLong;
  }, [onLong]);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    origin.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const bind = {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        origin.current = null;
        handler.current();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    /** Dlouhý stisk prstem jinak otevře kontextové menu prohlížeče. */
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };

  /** Obalí obsluhu klepnutí: po dlouhém stisku se nespustí. */
  const click = (fn: () => void) => () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    fn();
  };

  return { bind, click };
}
