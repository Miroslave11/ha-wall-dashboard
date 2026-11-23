import type { IconName } from "../components/Icon";
import type { WebcamPlace } from "../config/types";

/**
 * Aktuální počasí na místě webkamery z Open-Meteo (bez klíče, CORS povolené).
 * Hodnota je z meteorologických modelů pro dané souřadnice a výšku, obnovuje se po 15 minutách.
 * Posílají se jen souřadnice místa kamery.
 */

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";

/** Jak dlouho platí načtená teplota (Open-Meteo ji přepočítává po 15 minutách). */
export const PLACE_WEATHER_TTL_MS = 15 * 60_000;
/** Po neúspěchu (výpadek internetu) se další pokus udělá nejdřív po této době. */
export const PLACE_WEATHER_RETRY_MS = 2 * 60_000;

export interface PlaceWeather {
  /** Teplota vzduchu ve 2 m (°C). */
  temp: number;
  /** Kód počasí WMO. */
  code: number;
  isDay: boolean;
}

/** Adresa dotazu na aktuální počasí. Výška místa zpřesní teplotu na horách (jinak se bere průměrná výška okolí). */
export function placeWeatherUrl(p: WebcamPlace): string {
  const q = new URLSearchParams({
    latitude: p.lat.toFixed(4),
    longitude: p.lon.toFixed(4),
    current: "temperature_2m,weather_code,is_day",
    timezone: "auto",
  });
  if (typeof p.elevation === "number" && Number.isFinite(p.elevation)) q.set("elevation", String(Math.round(p.elevation)));
  return `${FORECAST_API}?${q}`;
}

/** Odpověď Open-Meteo → počasí, nebo null, když v ní teplota chybí. */
export function parsePlaceWeather(json: unknown): PlaceWeather | null {
  const cur = (json as { current?: Record<string, unknown> } | null)?.current;
  const temp = cur?.temperature_2m;
  if (typeof temp !== "number" || !Number.isFinite(temp)) return null;
  const code = typeof cur?.weather_code === "number" ? cur.weather_code : -1;
  return { temp, code, isDay: cur?.is_day !== 0 };
}

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** Po jak dlouhou dobu výpadku se ještě ukazuje poslední známá teplota. */
const STALE_MAX_MS = 60 * 60_000;

interface CacheEntry {
  /** Kdy se naposledy zkoušelo načíst. */
  checkedAt: number;
  /** Poslední úspěšně načtené počasí a kdy. */
  data: PlaceWeather | null;
  dataAt: number;
  /** Poslední pokus selhal. */
  failed: boolean;
  pending?: Promise<PlaceWeather | null>;
}

const cache = new Map<string, CacheEntry>();

/** Platná hodnota k zobrazení: poslední známá, pokud není starší než hodinu. */
function usable(e: CacheEntry | undefined, now: number): PlaceWeather | null {
  return e?.data && now - e.dataAt < STALE_MAX_MS ? e.data : null;
}

/** Vyprázdní mezipaměť (pro testy). */
export function clearPlaceWeatherCache(): void {
  cache.clear();
}

/** Uložená hodnota bez dotazu (null = zatím nic nebo neúspěch). */
export function cachedPlaceWeather(p: WebcamPlace | undefined, now = Date.now()): PlaceWeather | null {
  return p ? usable(cache.get(placeWeatherUrl(p)), now) : null;
}

/**
 * Aktuální počasí na místě: z mezipaměti, když je mladší než 15 min, jinak nový dotaz.
 * Souběžné dotazy na stejné místo se spojí do jednoho. Při výpadku se vrátí poslední známá hodnota
 * (nejvýš hodinu stará) a další pokus bude za 2 minuty.
 */
export function fetchPlaceWeather(p: WebcamPlace, now = Date.now(), fetchFn: Fetch = (u) => fetch(u)): Promise<PlaceWeather | null> {
  const url = placeWeatherUrl(p);
  const hit = cache.get(url);
  if (hit?.pending) return hit.pending;
  if (hit && now - hit.checkedAt < (hit.failed ? PLACE_WEATHER_RETRY_MS : PLACE_WEATHER_TTL_MS)) return Promise.resolve(usable(hit, now));
  const pending = fetchFn(url)
    .then((r) => (r.ok ? r.json() : null))
    .then(parsePlaceWeather)
    .catch(() => null)
    .then((data) => {
      const entry: CacheEntry = data
        ? { checkedAt: now, data, dataAt: now, failed: false }
        : { checkedAt: now, data: hit?.data ?? null, dataAt: hit?.dataAt ?? 0, failed: true };
      cache.set(url, entry);
      return usable(entry, now);
    });
  cache.set(url, { checkedAt: hit?.checkedAt ?? 0, data: hit?.data ?? null, dataAt: hit?.dataAt ?? 0, failed: hit?.failed ?? false, pending });
  return pending;
}

/** Kód počasí WMO → český popis a ikona. */
export function wmoInfo(code: number, isDay = true): { label: string; icon: IconName } {
  if (code === 0) return isDay ? { label: "jasno", icon: "sun" } : { label: "jasno", icon: "moon" };
  if (code === 1 || code === 2) return { label: code === 1 ? "skoro jasno" : "polojasno", icon: isDay ? "cloudSun" : "moon" };
  if (code === 3) return { label: "zataženo", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "mlha", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "mrholení", icon: "rain" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 65 && code !== 80 ? "silný déšť" : "déšť", icon: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "sněžení", icon: "snow" };
  if (code >= 95) return { label: "bouřky", icon: "storm" };
  return { label: "", icon: "cloud" };
}

/** Teplota pro nadpis: celé stupně se znaménkem minus (−10 °C). */
export function formatPlaceTemp(t: number): string {
  const r = Math.round(t);
  return `${r < 0 ? "−" : ""}${Math.abs(r)} °C`;
}

/** Popis místa pod nadpisem: „Česko, 1603 m“. */
export function placeLabel(p: WebcamPlace | undefined): string {
  if (!p) return "";
  const parts = [p.country, typeof p.elevation === "number" && Number.isFinite(p.elevation) ? `${Math.round(p.elevation)} m` : ""];
  return parts.filter(Boolean).join(", ");
}

/** Adresa hledání místa podle názvu (česky, nejvýš 6 výsledků). */
export function geocodeUrl(query: string): string {
  return `${GEOCODING_API}?${new URLSearchParams({ name: query.trim(), count: "6", language: "cs", format: "json" })}`;
}

/** Výsledek hledání → místa (s krajem pro rozlišení stejných názvů). */
export function parseGeocode(json: unknown): Array<WebcamPlace & { region?: string }> {
  const results = (json as { results?: Array<Record<string, unknown>> } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
    .map((r) => ({
      name: typeof r.name === "string" ? r.name : undefined,
      country: typeof r.country === "string" ? r.country : undefined,
      region: typeof r.admin1 === "string" ? r.admin1 : undefined,
      lat: r.latitude as number,
      lon: r.longitude as number,
      elevation: typeof r.elevation === "number" ? r.elevation : undefined,
    }));
}

/** Najde místa podle názvu; chyba nebo prázdný dotaz = prázdný seznam. */
export async function searchPlaces(query: string, fetchFn: Fetch = (u) => fetch(u)): Promise<Array<WebcamPlace & { region?: string }>> {
  if (!query.trim()) return [];
  try {
    const r = await fetchFn(geocodeUrl(query));
    return r.ok ? parseGeocode(await r.json()) : [];
  } catch {
    return [];
  }
}

/** Je místo použitelné (platné souřadnice)? */
export function isValidPlace(p: WebcamPlace | undefined): p is WebcamPlace {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}
