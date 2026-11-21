import { useMemo, useState } from "react";
import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { applyAffine, parseVacuumImage, parseVacuumPosition, roomPixelRect, type PixelRect } from "../utils/vacuumMap";
import type { VacuumRoomChoice } from "../utils/vacuumRooms";

interface Props {
  choices: VacuumRoomChoice[];
  selected: ReadonlySet<string>;
  onToggle: (roomId: string) => void;
}

/** Klikatelná oblast místnosti na mapě. */
interface Zone {
  roomId: string;
  name: string;
  rects: PixelRect[];
}

/** Střed největšího obdélníku (tam se píše název). */
function labelAt(rects: PixelRect[]): { x: number; y: number } {
  const r = rects.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Adresa obrázku: data/http(s) adresa se použije přímo, cesta z HA se doplní o adresu HA. */
function imageUrl(picture: string, hassUrl: string): string {
  return /^(data:|https?:)/.test(picture) ? picture : `${hassUrl}${picture}`;
}

interface MapViewProps {
  width: number;
  height: number;
  zones: Zone[];
  selected: ReadonlySet<string>;
  onToggle: (roomId: string) => void;
  dot?: { x: number; y: number } | null;
  /** schematický půdorys (jinak se nad obrázkem kreslí jen průhledné oblasti) */
  plan?: boolean;
}

/** Vrstva SVG s oblastmi místností; klepnutí na oblast přepne její výběr. */
function ZonesLayer({ width, height, zones, selected, onToggle, dot, plan }: MapViewProps) {
  const font = Math.max(width, height) / 32;
  return (
    <svg className={`vac-map-svg${plan ? " vac-map-svg--plan" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {zones.map((z) => {
        const on = selected.has(z.roomId);
        const label = labelAt(z.rects);
        const toggle = () => onToggle(z.roomId);
        return (
          <g
            key={z.roomId}
            className={`vac-zone${on ? " vac-zone--on" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={z.name}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle();
              }
            }}
          >
            {z.rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={Math.min(r.w, r.h) * 0.04} />
            ))}
            <text x={label.x} y={label.y} fontSize={font} textAnchor="middle" dominantBaseline="central">
              {on ? "✓ " : ""}
              {z.name}
            </text>
          </g>
        );
      })}
      {dot && <circle className="vac-map-dot" cx={dot.x} cy={dot.y} r={font * 0.38} />}
    </svg>
  );
}

/**
 * Mapa k výběru místností. Primárně skutečná mapa vysavače (image entita `vacuum.mapEntity` s kalibrací
 * a místnostmi), jinak (bez entity, bez obrázku, při chybě načtení) schematický půdorys z configu.
 */
export function VacuumMapPicker({ choices, selected, onToggle }: Props) {
  const { client } = useHass();
  const { vacuum, floorplan } = useConfig();
  const image = useEntity(vacuum?.mapEntity);
  const position = useEntity(vacuum?.positionEntity);
  const map = useMemo(() => parseVacuumImage(image), [image]);
  const url = map ? imageUrl(map.picture, client?.hassUrl ?? "") : null;
  /** přirozená velikost obrázku (pro vrstvu SVG); chyba načtení = záložní půdorys */
  const [size, setSize] = useState<{ url: string; w: number; h: number } | "error" | null>(null);

  const realZones: Zone[] = useMemo(() => {
    if (!map) return [];
    return choices.flatMap((c) => {
      const rects = c.segments.flatMap((n) => (map.rooms[String(n)] ? [roomPixelRect(map.toPixels, map.rooms[String(n)])] : []));
      return rects.length ? [{ roomId: c.roomId, name: c.name, rects }] : [];
    });
  }, [map, choices]);

  const planZones: Zone[] = useMemo(
    () =>
      choices.flatMap((c) => {
        const r = floorplan.rooms.find((x) => x.id === c.roomId);
        return r ? [{ roomId: c.roomId, name: c.name, rects: [{ x: r.x, y: r.y, w: r.w, h: r.h }] }] : [];
      }),
    [choices, floorplan.rooms],
  );

  const useReal = !!map && !!url && size !== "error" && realZones.length > 0;
  if (!useReal) {
    if (planZones.length === 0) return null;
    return (
      <div className="vac-map vac-map--plan" aria-label="Půdorys k výběru místností">
        <ZonesLayer width={floorplan.width} height={floorplan.height} zones={planZones} selected={selected} onToggle={onToggle} plan />
      </div>
    );
  }

  const loaded = typeof size === "object" && size !== null && size.url === url ? size : null;
  const point = vacuum?.positionEntity ? parseVacuumPosition(position) : null;
  const dot = loaded && point ? applyAffine(map.toPixels, point) : null;

  return (
    <div className="vac-map" aria-label="Mapa k výběru místností">
      <img
        src={url}
        alt=""
        draggable={false}
        onLoad={(e) => setSize({ url, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        onError={() => setSize("error")}
      />
      {loaded && <ZonesLayer width={loaded.w} height={loaded.h} zones={realZones} selected={selected} onToggle={onToggle} dot={dot} />}
    </div>
  );
}
