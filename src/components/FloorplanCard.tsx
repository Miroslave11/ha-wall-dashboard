import { useEffect, useRef, useState } from "react";
import type { FixtureConfig, RoomConfig } from "../config/types";
import { useConfig, useHass } from "../ha/HassContext";
import { roomBrightness, toggleLight, toggleRoom } from "../ha/actions";
import { FixtureControl } from "./FixtureControl";
import { FloorplanFurniture } from "./FloorplanFurniture";
import type { HistorySpec } from "./HistoryModal";
import type { LightDetailSpec } from "./LightDetailModal";
import { PassageLines } from "./PassageLines";
import { ProjectorBeam, ProjectorControl } from "./Projector";
import { RoomClimate } from "./RoomClimate";
import { RoomTile } from "./RoomTile";
import { VacuumDot } from "./VacuumDot";
import { isOutsideLabel } from "../utils/labels";

/** Největší zvětšení půdorysu nad návrhovou velikost (texty v místnostech se zvětšují s ním). */
const MAX_SCALE = 1.3;
/** Výška popisku mimo dlaždici (labelPos "above" / "below") a pásu, který pro něj půdorys nahoře / dole potřebuje. */
const LABEL_H = 22;
/** Mezera mezi místnostmi (stěna) – stejná jako v RoomTile. */
const WALL = 4;

export function FloorplanCard({ onHistory, onLights }: { onHistory: (spec: HistorySpec) => void; onLights: (spec: LightDetailSpec) => void }) {
  const { client, entities } = useHass();
  const cfg = useConfig();
  const { floorplan } = cfg;

  // Půdorys vyplní všechno volné místo v kartě (poměr stran se zachová)
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: floorplan.width, h: floorplan.height });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // pás nahoře / dole vznikne jen tehdy, když nějaká místnost má popisek mimo dlaždici
  const bandTop = floorplan.rooms.some((r) => r.labelPos === "above") ? LABEL_H + 4 : 0;
  const bandBottom = floorplan.rooms.some((r) => r.labelPos === "below") ? LABEL_H + 4 : 0;
  const planH = floorplan.height + bandTop + bandBottom;
  const scale = Math.max(0.2, Math.min(MAX_SCALE, box.w / floorplan.width, box.h / planH));

  const onToggle = (room: RoomConfig) => {
    if (!client) return;
    toggleRoom(client, room, entities).catch((e) => console.error("Přepnutí světla selhalo", e));
  };
  const onFixture = (f: FixtureConfig) => {
    if (!client) return;
    toggleLight(client, f.entity, entities).catch((e) => console.error("Přepnutí svítidla selhalo", e));
  };
  const onProjector = (entity: string) => {
    if (!client) return;
    toggleLight(client, entity, entities).catch((e) => console.error("Přepnutí kina selhalo", e));
  };

  return (
    <section className="plan-card glass" aria-label="Půdorys domu">
      {client?.isDemo && <span className="demo-badge">DEMO</span>}

      <div className="plan-box" ref={boxRef}>
        <div className="plan" style={{ width: floorplan.width * scale, height: planH * scale }}>
          <div
            style={{
              position: "relative",
              width: floorplan.width,
              height: planH,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Popisky místností s labelPos "above" / "below": název a teplota vedle dlaždice, uvnitř se uvolní místo */}
            {floorplan.rooms
              .filter((r) => isOutsideLabel(r.labelPos))
              .map((r) => (
                <div
                  key={r.id}
                  className={`room-label${roomBrightness(r, entities) > 0 ? " room-label--on" : ""}`}                  style={{
                    left: r.x + WALL,
                    width: r.w - WALL * 2,
                    height: LABEL_H,
                    top: bandTop + (r.labelPos === "above" ? r.y - LABEL_H : r.y + r.h),
                  }}
                >
                  <span className={`room-label-name${r.hideName ? " room-name--hidden" : ""}`}>{r.name}</span>
                  <RoomClimate room={r} onHistory={onHistory} />
                </div>
              ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: bandTop,
                width: floorplan.width,
                height: floorplan.height,
              }}
            >
              {floorplan.background ? (
                <img
                  src={floorplan.background}
                  alt=""
                  className="plan-furniture"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: floorplan.backgroundOpacity ?? 0.35,
                  }}
                />
              ) : (
                floorplan.furniture && <FloorplanFurniture width={floorplan.width} height={floorplan.height} />
              )}
              {floorplan.rooms.map((r) => (
                <RoomTile key={r.id} room={r} passages={floorplan.passages} onToggle={onToggle} onDetail={(room, focus) => onLights({ room, focus })} onHistory={onHistory} />
              ))}
              {floorplan.passages && floorplan.passages.length > 0 && (
                <PassageLines passages={floorplan.passages} width={floorplan.width} height={floorplan.height} />
              )}
              {floorplan.projector && <ProjectorBeam projector={floorplan.projector} width={floorplan.width} height={floorplan.height} />}
              {floorplan.rooms.flatMap((r) =>
                (r.fixtures ?? []).map((f) => (
                  <FixtureControl key={`${r.id}:${f.entity}`} fixture={f} onToggle={onFixture} onDetail={(fx) => onLights({ room: r, focus: fx.entity })} />
                )),
              )}
              {floorplan.projector && <ProjectorControl projector={floorplan.projector} onToggle={onProjector} />}
              <VacuumDot cfg={cfg} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
