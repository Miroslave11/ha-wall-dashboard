import { useState } from "react";
import type { WebcamPlace } from "../config/types";
import { placeLabel, searchPlaces } from "../utils/placeWeather";
import { Icon } from "./Icon";

type Found = WebcamPlace & { region?: string };

/**
 * Místo webkamery v Nastavení → Webkamery: hledání podle názvu (Open-Meteo) nebo ruční souřadnice.
 * Podle místa se ve fotorámečku ukazuje aktuální teplota.
 */
export function WebcamPlaceEditor({
  camName,
  place,
  onChange,
}: {
  camName: string;
  place: WebcamPlace | undefined;
  onChange: (p: WebcamPlace | undefined) => void;
}) {
  const [query, setQuery] = useState(place?.name ?? camName);
  const [results, setResults] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setResults(await searchPlaces(query));
    setBusy(false);
  };

  /** Ruční úprava jednoho čísla; prázdná výška = bez výšky. */
  const setNum = (key: "lat" | "lon" | "elevation", raw: string) => {
    const v = raw === "" ? undefined : Number(raw);
    if (v !== undefined && !Number.isFinite(v)) return;
    const base: WebcamPlace = place ?? { lat: 0, lon: 0 };
    if (key === "elevation") onChange({ ...base, elevation: v });
    else onChange({ ...base, [key]: v ?? NaN });
  };

  return (
    <div className="wc-place">
      <p className="hint">
        {place ? (
          <>
            Místo: <b>{[place.name, placeLabel(place)].filter(Boolean).join(", ") || "vlastní souřadnice"}</b>. Ve fotorámečku se pod názvem kamery ukáže aktuální
            teplota a počasí na tomto místě (Open-Meteo, obnova po 15 minutách).
          </>
        ) : (
          "Místo není nastavené – ve fotorámečku bude jen název kamery. Najděte místo podle názvu, nebo zadejte souřadnice."
        )}
      </p>
      <form
        className="wc-place-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input className="input" value={query} placeholder="např. Sněžka" aria-label="Hledat místo" onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn-pill" disabled={busy || !query.trim()}>
          <Icon name="search" size={18} /> {busy ? "Hledám…" : "Najít"}
        </button>
      </form>
      {results && results.length === 0 && <p className="hint">Nic jsem nenašel (nebo není internet). Zkuste jiný název, třeba obec, nebo zadejte souřadnice.</p>}
      {results && results.length > 0 && (
        <div className="wc-place-results">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="wc-place-result"
              onClick={() => {
                onChange({ name: r.name, country: r.country, lat: r.lat, lon: r.lon, elevation: r.elevation });
                setResults(null);
              }}
            >
              <Icon name="pin" size={16} />
              <b>{r.name}</b>
              <span>{[r.region, r.country, typeof r.elevation === "number" ? `${Math.round(r.elevation)} m` : ""].filter(Boolean).join(", ")}</span>
            </button>
          ))}
        </div>
      )}
      <div className="wc-place-coords">
        {(
          [
            ["lat", "Šířka"],
            ["lon", "Délka"],
            ["elevation", "Výška (m)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="field field--num">
            <span className="field-label">{label}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="any"
              value={place && Number.isFinite(place[key] ?? NaN) ? place[key] : ""}
              onChange={(e) => setNum(key, e.target.value)}
            />
          </label>
        ))}
        {place && (
          <button type="button" className="btn-pill" onClick={() => onChange(undefined)}>
            <Icon name="trash" size={16} /> Odebrat místo
          </button>
        )}
      </div>
    </div>
  );
}
