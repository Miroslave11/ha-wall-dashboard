import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatNumber } from "../utils/format";
import { arcPath, DIAL_START, DIAL_SWEEP, fraction, polar, snap, valueFromPoint } from "../utils/heating";

/** Prodleva po posledním klepnutí na −/+, než se cílová teplota odešle (ať hlavice na baterii nedostane příkaz při každém klepnutí). */
const SEND_DELAY = 700;
/** Nejdéle se drží zobrazená (nastavovaná) hodnota, když HA nepotvrdí novou cílovou teplotu (ms). */
const SETTLE_MAX = 8000;

const C = 100;
const R = 80;

interface Props {
  label: string;
  /** Cílová teplota z HA; během nastavování se ukazuje nastavovaná. */
  target: number | undefined;
  /** Aktuální teplota v místnosti. */
  current: number | undefined;
  min: number;
  max: number;
  step: number;
  /** Hlavice právě topí (oblouk se zbarví teple). */
  heating: boolean;
  disabled?: boolean;
  /** Odešle novou cílovou teplotu (po puštění oblouku, resp. s prodlevou po −/+). */
  onCommit: (value: number) => void;
}

/**
 * Kruhový ovladač cílové teploty: oblouk 270°, tah palcem po oblouku a přesné −/+ po kroku hlavice.
 * Bílá tečka na oblouku je aktuální teplota v místnosti. HA zůstává zdrojem pravdy,
 * při nastavování se jen drží lokální hodnota, ať palec neskáče zpět.
 */
export function HeaterDial({ label, target, current, min, max, step, heating, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState<number | null>(null);
  const latest = useRef<number | null>(null);
  const dragging = useRef(false);
  const sendTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  }, [onCommit]);
  useEffect(
    () => () => {
      window.clearTimeout(sendTimer.current);
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  // HA potvrdilo nastavenou hodnotu → vrátit se k hodnotě z HA
  useEffect(() => {
    if (draft !== null && target !== undefined && Math.abs(target - draft) < 0.01 && !dragging.current && sendTimer.current === undefined) setDraft(null);
  }, [target, draft]);

  const hold = (v: number) => {
    latest.current = v;
    setDraft(v);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setDraft(null), SETTLE_MAX);
  };
  const send = () => {
    window.clearTimeout(sendTimer.current);
    sendTimer.current = undefined;
    if (latest.current !== null) commit.current(latest.current);
  };
  const bump = (delta: number) => {
    const v = snap((draft ?? target ?? min) + delta, min, max, step);
    hold(v);
    window.clearTimeout(sendTimer.current);
    sendTimer.current = window.setTimeout(send, SEND_DELAY);
  };

  const fromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    hold(valueFromPoint(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), min, max, step));
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    window.clearTimeout(sendTimer.current);
    fromEvent(e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) fromEvent(e);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    send();
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (disabled) return;
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? step : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -step : 0;
    if (!d) return;
    e.preventDefault();
    bump(d);
  };

  const shown = draft ?? target;
  const f = shown === undefined ? 0 : fraction(shown, min, max);
  const endDeg = DIAL_START + DIAL_SWEEP * f;
  const handle = polar(C, C, R, endDeg);
  const now = current === undefined ? null : polar(C, C, R, DIAL_START + DIAL_SWEEP * fraction(current, min, max));

  return (
    <div className={`dial${heating ? " dial--heating" : ""}${disabled ? " dial--off" : ""}`}>
      <svg
        className="dial-svg"
        viewBox="0 0 200 200"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label}: cílová teplota`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={shown === undefined ? "neznámá" : `${formatNumber(shown)} °C`}
        aria-disabled={disabled}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <path className="dial-track" d={arcPath(C, C, R, DIAL_START, DIAL_START + DIAL_SWEEP)} />
        {f > 0 && <path className="dial-fill" d={arcPath(C, C, R, DIAL_START, endDeg)} />}
        {now && <circle className="dial-now" cx={now.x} cy={now.y} r={3.5} />}
        {shown !== undefined && <circle className="dial-handle" cx={handle.x} cy={handle.y} r={10} />}
        {/* velká je skutečná teplota v místnosti (s malým „teď“ nad ní), pod ní menší nastavená (cíl); při nastavování se cíl zvýrazní */}
        <text className="dial-label" x={C} y={C - 34} textAnchor="middle">
          teď
        </text>
        <text className="dial-temp" x={C} y={C + 8} textAnchor="middle">
          {current === undefined ? "–" : `${formatNumber(current)}°`}
        </text>
        <text className="dial-label" x={C} y={C + 36} textAnchor="middle">
          nastaveno
        </text>
        <text className={`dial-sub${draft !== null ? " dial-sub--set" : ""}`} x={C} y={C + 56} textAnchor="middle">
          {shown === undefined ? "–" : `${formatNumber(shown)} °C`}
        </text>
      </svg>
      <button type="button" className="dial-step dial-step--minus" onClick={() => bump(-step)} disabled={disabled} aria-label={`${label}: snížit o ${formatNumber(step)} °C`}>
        −
      </button>
      <button type="button" className="dial-step dial-step--plus" onClick={() => bump(step)} disabled={disabled} aria-label={`${label}: zvýšit o ${formatNumber(step)} °C`}>
        +
      </button>
    </div>
  );
}
