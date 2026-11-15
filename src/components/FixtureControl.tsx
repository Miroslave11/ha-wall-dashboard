import type { CSSProperties } from "react";
import type { FixtureConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { lightBrightness } from "../ha/actions";
import { useLongPress } from "../hooks/useLongPress";
import { fixtureGeometry, isStrip } from "../utils/fixtures";
import { lightCaps, lightGlowRgb } from "../utils/lightColor";
import { Icon } from "./Icon";

/** Minimální dotykový cíl v px. */
const TOUCH = 44;

/**
 * Svítidlo v půdorysu (žárovka nebo LED pásek) jako samostatné tlačítko nad místností.
 * Leží mimo <button> místnosti (vnořená tlačítka nejsou v HTML povolena), poloha je v souřadnicích půdorysu.
 */
export function FixtureControl({
  fixture,
  onToggle,
  onDetail,
}: {
  fixture: FixtureConfig;
  onToggle: (f: FixtureConfig) => void;
  /** Dlouhý stisk: otevře panel světla (jas, barva). Bez něj se dlouhý stisk chová jako klepnutí. */
  onDetail?: (f: FixtureConfig) => void;
}) {
  const { entities } = useHass();
  const lp = useLongPress(() => onDetail?.(fixture));
  /** Dlouhý stisk má smysl jen u světla, které umí stmívat nebo měnit barvu. */
  const canDetail = !!onDetail && lightCaps(entities[fixture.entity]).dimmable;
  const b = lightBrightness(fixture.entity, entities);
  const glow = lightGlowRgb(entities[fixture.entity]);
  const on = b > 0;
  const g = fixtureGeometry(fixture);
  const strip = isStrip(fixture);
  const label = fixture.name ?? String(entities[fixture.entity]?.attributes.friendly_name ?? fixture.entity);

  // Hit plocha: u žárovky čtverec kolem středu, u pásku celá délka × TOUCH napříč.
  const w = strip && !fixture.vertical ? Math.max(g.w, TOUCH) : TOUCH;
  const h = strip && fixture.vertical ? Math.max(g.h, TOUCH) : TOUCH;

  const style = {
    left: g.cx - w / 2,
    top: g.cy - h / 2,
    width: w,
    height: h,
    "--glow-op": on ? (0.4 + 0.6 * b).toFixed(2) : "0",
    // světlo s barvou září svou skutečnou barvou, ostatní barvou motivu
    ...(glow ? { "--light-rgb": glow, "--light": `rgb(${glow})` } : {}),
  } as CSSProperties;

  return (
    <button
      className={`fixture${strip ? " fixture--strip" : ""}${fixture.vertical ? " fixture--vertical" : ""}${on ? " fixture--on" : ""}`}
      style={style}
      {...(canDetail ? lp.bind : {})}
      onClick={canDetail ? lp.click(() => onToggle(fixture)) : () => onToggle(fixture)}
      aria-pressed={on}
      aria-label={`${label}, ${on ? `svítí ${Math.round(b * 100)} %` : "vypnuto"}`}
    >
      {strip ? (
        <>
          <span className="fixture-strip" aria-hidden="true" />
          {/* odznak uprostřed pásku: pozná se podle něj, že jde o LED pásek, a svítí barvou pásku */}
          <span className="fixture-badge" aria-hidden="true">
            <Icon name="ledStrip" size={16} strokeWidth={1.8} />
          </span>
        </>
      ) : (
        <span className="room-bulb" aria-hidden="true">
          <Icon name="bulb" size={18} strokeWidth={1.7} />
        </span>
      )}
    </button>
  );
}
