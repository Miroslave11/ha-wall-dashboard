import type { CSSProperties } from "react";
import type { PassageConfig, RoomConfig } from "../config/types";
import { passageHoles, passageMask } from "../utils/passages";
import { useHass } from "../ha/HassContext";
import { lightBrightness, roomBrightness } from "../ha/actions";
import { useLongPress } from "../hooks/useLongPress";
import { fixtureGeometry, isStrip } from "../utils/fixtures";
import { lightCaps, lightGlowRgb } from "../utils/lightColor";
import type { HistorySpec } from "./HistoryModal";
import { Icon } from "./Icon";
import { RoomClimate } from "./RoomClimate";
import { isOutsideLabel } from "../utils/labels";

/** Mezera mezi místnostmi (stěna) v px. */
const WALL = 4;

export function RoomTile({
  room,
  passages,
  onToggle,
  onDetail,
  onHistory,
}: {
  room: RoomConfig;
  /** Průchody v půdorysu: dlaždici se v nich vystřihne okraj zdi. */
  passages?: PassageConfig[];
  onToggle: (room: RoomConfig) => void;
  /** Panel světel (jas, barva): dlouhý stisk na ikonu žárovky (místnost bez svítidel) nebo klepnutí na % LED pásku (`focus` = jeho entita). */
  onDetail: (room: RoomConfig, focus?: string) => void;
  /** Klepnutí na teplotu / vlhkost otevře graf historie. */
  onHistory: (spec: HistorySpec) => void;
}) {
  const { entities } = useHass();
  const lp = useLongPress(() => onDetail(room));
  /** Panel světel má smysl, když se aspoň jedno světlo v místnosti dá stmívat nebo mu měnit barvu. */
  const canDetail = room.lights.some((id) => lightCaps(entities[id]).dimmable);
  const b = roomBrightness(room, entities);
  const on = b > 0;
  /**
   * Intenzita (%) se ukazuje jen u místností s LED páskem – je to jas pásku (ne celé místnosti)
   * a klepnutí na ni otevře jeho panel. U žárovek se nezobrazuje.
   */
  const strips = (room.fixtures ?? []).filter(isStrip).filter((f) => lightBrightness(f.entity, entities) > 0);
  const led = strips.reduce<{ entity: string; b: number } | null>((best, f) => {
    const fb = lightBrightness(f.entity, entities);
    return !best || fb > best.b ? { entity: f.entity, b: fb } : best;
  }, null);
  const ledGlow = led ? lightGlowRgb(entities[led.entity]) : null;
  const motion = room.motion ? entities[room.motion]?.state === "on" : false;
  const hasLights = room.lights.length > 0;
  /** Poloha názvu a teploty; "above" / "below" je kreslí FloorplanCard mimo dlaždici. */
  const pos = room.labelPos ?? "top-left";
  const outside = isOutsideLabel(pos);
  /** V úzké místnosti (WC) se u pohybu ukáže jen tečka. */
  const narrow = room.w < 120;
  /** Se zakreslenými svítidly září každé ze svého místa a rohová žárovka se nekreslí. */
  const fixtures = room.fixtures ?? [];
  const hasFixtures = fixtures.length > 0;
  /** Počátek souřadnic uvnitř dlaždice (stěna + 1px rámeček). */
  const ox = room.x + WALL + 1;
  const oy = room.y + WALL + 1;

  const style = {
    left: room.x + WALL,
    top: room.y + WALL,
    width: room.w - WALL * 2,
    height: room.h - WALL * 2,
    "--glow-op": on ? (0.35 + 0.65 * b).toFixed(2) : "0",
    "--glow-pos": room.glow ?? "50% 45%",
    ...passageMask(passageHoles(room, passages)),
  } as CSSProperties;

  return (
    <div
      className={`room${on ? " room--on" : ""}${pos.endsWith("right") ? " room--right" : ""}${pos.startsWith("bottom") ? " room--bottom" : ""}${pos === "center" ? " room--center" : ""}${hasLights && !hasFixtures ? " room--bulb" : ""}`}
      style={style}
    >
      {hasFixtures ? (
        fixtures.map((f) => {
          const g = fixtureGeometry(f);
          const fb = lightBrightness(f.entity, entities);
          const glow = lightGlowRgb(entities[f.entity]);
          return (
            <span
              key={f.entity}
              className={`fixture-glow${isStrip(f) ? " fixture-glow--strip" : ""}`}
              aria-hidden="true"
              style={
                {
                  left: g.cx - ox,
                  top: g.cy - oy,
                  width: g.glowW,
                  height: g.glowH,
                  "--glow-op": fb > 0 ? (0.4 + 0.6 * fb).toFixed(2) : "0",
                  ...(glow ? { "--light-rgb": glow } : {}),
                } as CSSProperties
              }
            />
          );
        })
      ) : (
        <span className="room-glow" aria-hidden="true" />
      )}
      <span className="room-ring" aria-hidden="true" />
      {/* Klepnutí na samotnou místnost nic nedělá. Světla se ovládají svými svítidly v půdorysu (FixtureControl);
          u místnosti bez zakreslených svítidel je „svítidlem“ ikona žárovky v rohu, která přepne všechna světla. */}
      <span className="room-top">
        {!outside && (
          <span className="room-info">
            <span className={`room-name${room.hideName ? " room-name--hidden" : ""}`}>{room.name}</span>
          </span>
        )}
        {hasLights && !hasFixtures && (
          <button
            type="button"
            className="room-bulb room-bulb--btn"
            {...(canDetail ? lp.bind : {})}
            onClick={canDetail ? lp.click(() => onToggle(room)) : () => onToggle(room)}
            aria-pressed={on}
            aria-label={`${room.name}, světlo ${on ? "zapnuto" : "vypnuto"}`}
          >
            <Icon name="bulb" size={18} strokeWidth={1.7} />
          </button>
        )}
      </span>
      <span className="room-status">
        {/* v klidovém stavu (zhasnuto) se nic nepíše */}
        {led && (
          <button
            type="button"
            className="room-pct"
            style={ledGlow ? ({ color: `rgb(${ledGlow})` } as CSSProperties) : undefined}
            onClick={() => onDetail(room, led.entity)}
            aria-label={`${room.name}: LED pásek svítí ${Math.round(led.b * 100)} %, otevřít jas a barvu`}
          >
            {Math.round(led.b * 100)} %
          </button>
        )}
        {motion && (
          <span className="motion" title="Pohyb">
            <span className="motion-dot" />
            {!narrow && "Pohyb"}
          </span>
        )}
      </span>
      {/* Teplota a vlhkost pod sebou v pravém dolním rohu */}
      {!outside && <RoomClimate room={room} onHistory={onHistory} corner />}
    </div>
  );
}
