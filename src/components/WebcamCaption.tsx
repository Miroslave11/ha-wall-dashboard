import { useEffect, useState } from "react";
import type { WebcamConfig } from "../config/types";
import { cachedPlaceWeather, fetchPlaceWeather, formatPlaceTemp, isValidPlace, placeLabel, wmoInfo, type PlaceWeather } from "../utils/placeWeather";
import { weatherIconColor } from "../utils/weather";
import { Icon } from "./Icon";

/**
 * Nadpis webkamery ve fotorámečku: název místa a pod ním aktuální teplota, počasí, země a výška.
 * Bez zadaného místa (nebo bez internetu) zůstane jen název.
 */
export function WebcamCaption({ cam }: { cam: WebcamConfig }) {
  const place = isValidPlace(cam.place) ? cam.place : undefined;
  const [weather, setWeather] = useState<PlaceWeather | null>(() => cachedPlaceWeather(place));

  useEffect(() => {
    if (!place) return;
    let alive = true;
    void fetchPlaceWeather(place).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
    // stačí při změně místa (souřadnice a výška), ne při každém novém objektu konfigurace
  }, [place?.lat, place?.lon, place?.elevation]);

  const info = weather ? wmoInfo(weather.code, weather.isDay) : null;
  const where = placeLabel(place);
  const details = [weather ? formatPlaceTemp(weather.temp) : "", info?.label ?? "", where].filter(Boolean);

  return (
    <div className="pf-caption">
      <div className="pf-caption-title">{cam.name}</div>
      {details.length > 0 && (
        <div className="pf-caption-sub">
          {info && <Icon name={info.icon} size={18} strokeWidth={1.8} style={{ color: weatherIconColor(info.icon) }} />}
          {details.join(" · ")}
        </div>
      )}
    </div>
  );
}
