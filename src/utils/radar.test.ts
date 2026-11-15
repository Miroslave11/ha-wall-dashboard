import { describe, expect, it } from "vitest";
import { frameAge, parseRadarMaps, radarTileUrl, resolveRadar } from "./radar";

describe("radar", () => {
  it("zpracuje odpověď RainViewer: naměřené i předpovědní snímky seřazené podle času", () => {
    const m = parseRadarMaps({
      host: "https://tilecache.rainviewer.com",
      radar: {
        past: [
          { time: 200, path: "/v2/radar/b" },
          { time: 100, path: "/v2/radar/a" },
        ],
        nowcast: [{ time: 300, path: "/v2/radar/c" }],
      },
    });
    expect(m?.host).toBe("https://tilecache.rainviewer.com");
    expect(m?.frames.map((f) => [f.time, f.forecast])).toEqual([
      [100, false],
      [200, false],
      [300, true],
    ]);
  });

  it("neznámý tvar nebo žádné snímky → null", () => {
    expect(parseRadarMaps(null)).toBeNull();
    expect(parseRadarMaps({ host: "x" })).toBeNull();
    expect(parseRadarMaps({ host: "x", radar: { past: [], nowcast: [] } })).toBeNull();
    expect(parseRadarMaps({ host: "x", radar: { past: [{ time: "a", path: 1 }] } })).toBeNull();
  });

  it("šablona dlaždic", () => {
    expect(radarTileUrl("https://h", "/v2/radar/a")).toBe("https://h/v2/radar/a/256/{z}/{x}/{y}/2/1_1.png");
  });

  it("stáří snímku česky", () => {
    const now = 1_000_000 * 1000;
    expect(frameAge(1_000_000 - 60, now)).toBe("nyní");
    expect(frameAge(1_000_000 - 20 * 60, now)).toBe("před 20 min");
    expect(frameAge(1_000_000 - 120 * 60, now)).toBe("před 2 h");
    expect(frameAge(1_000_000 - 100 * 60, now)).toBe("před 1 h 40 min");
    expect(frameAge(1_000_000 + 10 * 60, now)).toBe("za 10 min");
  });

  it("výchozí hodnoty a config", () => {
    expect(resolveRadar(undefined)).toMatchObject({ lat: 49.8, lon: 15.5, zoom: 7 });
    expect(resolveRadar({ lat: 50.08, lon: 14.44, name: "Praha" })).toEqual({ lat: 50.08, lon: 14.44, zoom: 7, name: "Praha" });
  });
});
