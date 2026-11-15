import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Nejkratší odstup mezi dvěma voláními služby při tažení (ms). */
const THROTTLE = 150;
/** Jak dlouho po posledním pohybu se drží tažená hodnota, než se vrátí k hodnotě z HA (ms). */
const SETTLE = 1200;

interface Props {
  label: string;
  /** Hodnota z HA; během tažení a krátce po něm se zobrazuje tažená. */
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Zavolá se průběžně při tažení (s odstupem THROTTLE) a naposledy s konečnou hodnotou. */
  onCommit: (value: number) => void;
  /** Text vedle posuvníku (např. "63 %"). */
  format: (value: number) => string;
  /** CSS `background` dráhy (přechod barev); bez něj výchozí. */
  track?: string;
  disabled?: boolean;
  /** Skryje text vedle posuvníku (hodnota je už zobrazena jinde); čtečka ji dostane dál. */
  hideValue?: boolean;
}

/**
 * Velký posuvník pro dotykový displej. Mezi tažením a odpovědí z HA drží vlastní hodnotu
 * (HA je zdroj pravdy, ale bez toho by palec při každé odpovědi „skákal“ zpět).
 */
export function LightSlider({ label, value, min, max, step = 1, onCommit, format, track, disabled, hideValue }: Props) {
  const [draft, setDraft] = useState<number | null>(null);
  const lastSent = useRef(0);
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

  const change = (v: number) => {
    setDraft(v);
    window.clearTimeout(sendTimer.current);
    const wait = THROTTLE - (Date.now() - lastSent.current);
    const send = () => {
      lastSent.current = Date.now();
      commit.current(v);
    };
    if (wait <= 0) send();
    else sendTimer.current = window.setTimeout(send, wait);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setDraft(null), SETTLE);
  };

  const shown = Math.min(max, Math.max(min, draft ?? value));
  const style = { "--track": track, "--fill": `${((shown - min) / (max - min)) * 100}%` } as CSSProperties;

  return (
    <div className="light-slider">
      <input
        type="range"
        className={`light-range${track ? " light-range--track" : ""}`}
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format(shown)}
        style={style}
        onChange={(e) => change(Number(e.target.value))}
      />
      {!hideValue && <span className="light-slider-value">{format(shown)}</span>}
    </div>
  );
}
