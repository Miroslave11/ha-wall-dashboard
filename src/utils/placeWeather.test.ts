import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPlaceWeatherCache,
  fetchPlaceWeather,
  formatPlaceTemp,
  isValidPlace,
  parseGeocode,
  parsePlaceWeather,
  placeLabel,
  placeWeatherUrl,
  PLACE_WEATHER_RETRY_MS,
  PLACE_WEATHER_TTL_MS,
  wmoInfo,
} from "./placeWeather";

const snezka = { name: "Sněžka", country: "Česko", lat: 50.73609, lon: 15.73979, elevation: 1603 };
const reply = (temp: number, code = 3) => ({ ok: true, json: async () => ({ current: { temperature_2m: temp, weather_code: code, is_day: 1 } }) });

describe("placeWeather", () => {
  beforeEach(() => clearPlaceWeatherCache());

  it("adresa dotazu obsahuje souřadnice, aktuální teplotu a výšku místa", () => {
    const u = new URL(placeWeatherUrl(snezka));
    expect(u.searchParams.get("latitude")).toBe("50.7361");
    expect(u.searchParams.get("longitude")).toBe("15.7398");
    expect(u.searchParams.get("current")).toContain("temperature_2m");
    expect(u.searchParams.get("elevation")).toBe("1603");
    expect(new URL(placeWeatherUrl({ lat: 1, lon: 2 })).searchParams.has("elevation")).toBe(false);
  });

  it("odpověď bez teploty → null", () => {
    expect(parsePlaceWeather({ current: { temperature_2m: -10.1, weather_code: 77, is_day: 0 } })).toEqual({ temp: -10.1, code: 77, isDay: false });
    expect(parsePlaceWeather({ error: true })).toBeNull();
    expect(parsePlaceWeather(null)).toBeNull();
  });

  it("do 15 minut se znovu neptá, pak ano; souběžné dotazy se spojí", async () => {
    const f = vi.fn(async () => reply(-10));
    const [a, b] = await Promise.all([fetchPlaceWeather(snezka, 0, f), fetchPlaceWeather(snezka, 0, f)]);
    expect(a?.temp).toBe(-10);
    expect(b?.temp).toBe(-10);
    expect(f).toHaveBeenCalledTimes(1);
    await fetchPlaceWeather(snezka, PLACE_WEATHER_TTL_MS - 1, f);
    expect(f).toHaveBeenCalledTimes(1);
    f.mockImplementation(async () => reply(-8));
    expect((await fetchPlaceWeather(snezka, PLACE_WEATHER_TTL_MS, f))?.temp).toBe(-8);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("při výpadku vrátí poslední známou hodnotu (nejvýš hodinu starou) a zkusí to znovu za 2 minuty", async () => {
    const f = vi.fn(async () => reply(5));
    await fetchPlaceWeather(snezka, 0, f);
    f.mockImplementation(async () => {
      throw new Error("offline");
    });
    expect((await fetchPlaceWeather(snezka, PLACE_WEATHER_TTL_MS, f))?.temp).toBe(5);
    await fetchPlaceWeather(snezka, PLACE_WEATHER_TTL_MS + PLACE_WEATHER_RETRY_MS - 1, f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(await fetchPlaceWeather(snezka, 61 * 60_000, f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("kódy počasí, teplota a popis místa česky", () => {
    expect(wmoInfo(0, true)).toEqual({ label: "jasno", icon: "sun" });
    expect(wmoInfo(0, false).icon).toBe("moon");
    expect(wmoInfo(77).label).toBe("sněžení");
    expect(wmoInfo(95).icon).toBe("storm");
    expect(formatPlaceTemp(-10.1)).toBe("−10 °C");
    expect(formatPlaceTemp(4.6)).toBe("5 °C");
    expect(placeLabel(snezka)).toBe("Česko, 1603 m");
    expect(placeLabel({ lat: 1, lon: 2 })).toBe("");
  });

  it("hledání místa: výsledky s krajem a výškou, neplatné vynechá", () => {
    const out = parseGeocode({
      results: [
        { name: "Sněžka", latitude: 50.73609, longitude: 15.73979, elevation: 1603, country: "Česko", admin1: "Královéhradecký" },
        { name: "Bez souřadnic" },
      ],
    });
    expect(out).toEqual([{ name: "Sněžka", country: "Česko", region: "Královéhradecký", lat: 50.73609, lon: 15.73979, elevation: 1603 }]);
    expect(parseGeocode({})).toEqual([]);
  });

  it("platné místo", () => {
    expect(isValidPlace(snezka)).toBe(true);
    expect(isValidPlace({ lat: 91, lon: 0 })).toBe(false);
    expect(isValidPlace({ lat: NaN, lon: 0 })).toBe(false);
    expect(isValidPlace(undefined)).toBe(false);
  });
});
