import { useEffect, useState } from "react";
import { parseRadarMaps, type RadarMaps } from "../utils/radar";

const RADAR_URL = "https://api.rainviewer.com/public/weather-maps.json";
/** Jak často se obnoví seznam snímků (RainViewer je publikuje po ~10 minutách). */
const REFRESH_MS = 10 * 60_000;

export type RadarStatus = "loading" | "ok" | "error";

/**
 * Seznam snímků radaru z RainViewer. Při chybě obnovy zůstanou poslední známé snímky
 * (kiosk se tak přežije krátký výpadek sítě) a zkusí se to znovu.
 */
export function useRadarFrames(): { maps: RadarMaps | null; status: RadarStatus } {
  const [maps, setMaps] = useState<RadarMaps | null>(null);
  const [status, setStatus] = useState<RadarStatus>("loading");

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(RADAR_URL, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`RainViewer: HTTP ${res.status}`);
        const parsed = parseRadarMaps(await res.json());
        if (!parsed) throw new Error("RainViewer: neznámý formát odpovědi");
        if (alive) {
          setMaps(parsed);
          setStatus("ok");
        }
      } catch (e) {
        if (alive && !ctrl.signal.aborted) {
          console.warn("Radar se nepodařilo načíst", e);
          setStatus("error");
        }
      }
    };
    void load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      ctrl.abort();
      window.clearInterval(t);
    };
  }, []);

  return { maps, status };
}
