import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useConfig } from "../ha/HassContext";
import { useRadarFrames } from "../hooks/useRadarFrames";
import { formatClock } from "../utils/format";
import { frameAge, radarTileUrl, RADAR_MAX_NATIVE_ZOOM, resolveRadar } from "../utils/radar";
import { Icon } from "./Icon";

/** Průhlednost radarové vrstvy nad mapou. */
const RADAR_OPACITY = 0.78;
/** Doba zobrazení jednoho snímku ve smyčce a prodleva na posledním snímku (ms). */
const STEP_MS = 650;
const HOLD_MS = 1800;

/** Podkladová mapa Esri (tmavá šedá, bez API klíče): základ a zvlášť popisky měst, které leží nad radarem. */
const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASE_URL = `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABELS_URL = `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;

/**
 * Stránka Radar: mapa (Esri) se středem v `radar` (config) a animovanou smyčkou radaru RainViewer za poslední ~2 hodiny.
 * Snímky se načtou předem a přepínají se jen průhledností. Bez internetu zůstane jen hláška, zbytek dashboardu funguje.
 */
export function RadarPage() {
  const cfg = useConfig();
  const radar = resolveRadar(cfg.radar);
  const { maps, status } = useRadarFrames();

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.TileLayer[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const frames = maps?.frames ?? [];
  const last = frames.length - 1;

  // Mapa: podklad, značka ve středu a vlastní atribuce (bez odkazů, ať kiosk neodejde z dashboardu)
  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;
    const map = L.map(el, { center: [radar.lat, radar.lon], zoom: radar.zoom, minZoom: 5, maxZoom: 10, attributionControl: false });
    L.tileLayer(BASE_URL, { maxZoom: 16 }).addTo(map);
    // popisky nad radarem (radar je v tilePane, z-index 200)
    map.createPane("labels").style.zIndex = "250";
    map.getPane("labels")!.style.pointerEvents = "none";
    L.tileLayer(LABELS_URL, { maxZoom: 16, pane: "labels" }).addTo(map);
    const marker = L.circleMarker([radar.lat, radar.lon], { radius: 6, weight: 2, color: "#fff", fillColor: "#7cc4ff", fillOpacity: 1, interactive: false }).addTo(map);
    if (radar.name) marker.bindTooltip(radar.name, { permanent: true, direction: "right", offset: [8, 0], className: "radar-tip" });
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
    };
    // střed a přiblížení se čtou jen při vytvoření mapy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vrstvy snímků: všechny se přidají hned (předčtení), viditelný je jen aktuální
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maps) return;
    const layers = maps.frames.map((f, i) =>
      L.tileLayer(radarTileUrl(maps.host, f.path), { opacity: 0, maxNativeZoom: RADAR_MAX_NATIVE_ZOOM, maxZoom: 10, zIndex: 10 + i, keepBuffer: 1 }).addTo(map),
    );
    layersRef.current = layers;
    // začít na nejnovějším naměřeném snímku (předpovědní jsou až za ním)
    const lastPast = maps.frames.map((f) => f.forecast).lastIndexOf(false);
    setIndex(lastPast >= 0 ? lastPast : maps.frames.length - 1);
    return () => {
      layers.forEach((l) => l.remove());
      layersRef.current = [];
    };
  }, [maps]);

  useEffect(() => {
    layersRef.current.forEach((l, i) => l.setOpacity(i === index ? RADAR_OPACITY : 0));
  }, [index, maps]);

  // Smyčka: kratší krok, na posledním snímku delší prodleva, pak znovu od nejstaršího
  useEffect(() => {
    if (!playing || last < 1) return;
    const t = window.setTimeout(() => setIndex((i) => (i >= last ? 0 : i + 1)), index >= last ? HOLD_MS : STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, index, last]);

  // Popisek stáří snímku se přepočítá každou minutu
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const frame = frames[index];

  return (
    <section className="page glass radar-page" aria-label="Radar">
      <div className="radar-head">
        <h1 className="card-title">Radar</h1>
        <span className="radar-sub">Srážky{radar.name ? ` · ${radar.name}` : ""}</span>
      </div>
      <div className="radar-wrap">
        <div ref={mapEl} className="radar-map" />
        {status === "loading" && !maps && <p className="radar-msg">Načítám radar…</p>}
        {status === "error" && !maps && <p className="radar-msg">Radar se nepodařilo načíst. Zkontrolujte připojení k internetu, zkusím to znovu za chvíli.</p>}
        {frame && (
          <div className="radar-bar">
            <button type="button" className="radar-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Zastavit smyčku" : "Přehrát smyčku"}>
              <Icon name={playing ? "pause" : "play"} size={20} strokeWidth={1.8} />
            </button>
            <input
              type="range"
              className="radar-slider"
              min={0}
              max={last}
              step={1}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              aria-label="Čas snímku radaru"
            />
            <span className="radar-time">
              <b>{formatClock(new Date(frame.time * 1000))}</b>
              <span>{frame.forecast ? `předpověď, ${frameAge(frame.time, now)}` : frameAge(frame.time, now)}</span>
            </span>
          </div>
        )}
        <span className="radar-credit">Weather data by RainViewer (rainviewer.com) · mapa © Esri, HERE, Garmin, © OpenStreetMap</span>
      </div>
    </section>
  );
}
