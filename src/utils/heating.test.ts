import { describe, expect, it } from "vitest";
import {
  arcPath,
  DIAL_START,
  formatSchedule,
  fraction,
  heaterStatus,
  minutesToTime,
  parseSchedule,
  polar,
  scheduledTemp,
  scheduleSegments,
  snap,
  timeToMinutes,
  validateSchedule,
  valueFromPoint,
  visiblePresets,
} from "./heating";

const TEXT = "06:00/22°C 08:00/22°C 12:00/22°C 15:30/22°C 19:00/22°C 19:01/19°C";

describe("týdenní plán", () => {
  it("zpracuje text z hlavice a vrátí stejný text", () => {
    const p = parseSchedule(TEXT)!;
    expect(p).toHaveLength(6);
    expect(p[0]).toEqual({ time: "06:00", temp: 22 });
    expect(p[5]).toEqual({ time: "19:01", temp: 19 });
    expect(formatSchedule(p)).toBe(TEXT);
  });

  it("desetinné teploty a čárka", () => {
    expect(parseSchedule("06:00/21.5°C 22:00/17,5°C")).toEqual([
      { time: "06:00", temp: 21.5 },
      { time: "22:00", temp: 17.5 },
    ]);
    expect(formatSchedule([{ time: "06:00", temp: 21.5 }])).toBe("06:00/21.5°C");
  });

  it("neznámý tvar → null", () => {
    expect(parseSchedule(undefined)).toBeNull();
    expect(parseSchedule("")).toBeNull();
    expect(parseSchedule("unknown")).toBeNull();
    expect(parseSchedule("25:00/22°C")).toBeNull();
    expect(parseSchedule("06:00/22")).toBeNull();
  });

  it("čas a minuty", () => {
    expect(timeToMinutes("06:30")).toBe(390);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("6:5")).toBeNull();
    expect(minutesToTime(390)).toBe("06:30");
    expect(minutesToTime(1440)).toBe("00:00");
  });

  it("kontrola před uložením: čas roste, teplota v rozsahu", () => {
    const ok = parseSchedule(TEXT)!;
    expect(validateSchedule(ok, 5, 35)).toEqual([]);
    const bad = [
      { time: "08:00", temp: 22 },
      { time: "08:00", temp: 22 },
      { time: "07:00", temp: 40 },
    ];
    const errs = validateSchedule(bad, 5, 35);
    expect(errs.some((e) => e.includes("Řádek 2") && e.includes("čas"))).toBe(true);
    expect(errs.some((e) => e.includes("Řádek 3") && e.includes("čas"))).toBe(true);
    expect(errs.some((e) => e.includes("Řádek 3") && e.includes("teplota"))).toBe(true);
  });

  it("osa dne: úsek před prvním bodem patří poslednímu bodu, poslední končí o půlnoci", () => {
    const seg = scheduleSegments(parseSchedule("06:00/20°C 22:00/16°C")!);
    expect(seg).toEqual([
      { from: 0, to: 360, temp: 16 },
      { from: 360, to: 1320, temp: 20 },
      { from: 1320, to: 1440, temp: 16 },
    ]);
    const pts = parseSchedule("06:00/20°C 22:00/16°C")!;
    expect(scheduledTemp(pts, 120)).toBe(16);
    expect(scheduledTemp(pts, 400)).toBe(20);
    expect(scheduledTemp(pts, 1400)).toBe(16);
  });
});

describe("ciferník", () => {
  it("zaokrouhlení na krok a rozsah", () => {
    expect(snap(22.3, 5, 35, 0.5)).toBe(22.5);
    expect(snap(22.2, 5, 35, 0.5)).toBe(22);
    expect(snap(99, 5, 35, 0.5)).toBe(35);
    expect(snap(-3, 5, 35, 0.5)).toBe(5);
    expect(fraction(20, 5, 35)).toBe(0.5);
    expect(fraction(50, 5, 35)).toBe(1);
  });

  it("bod na kružnici a oblouk", () => {
    const p = polar(100, 100, 50, 0);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(100);
    const start = polar(100, 100, 50, DIAL_START);
    expect(start.x).toBeLessThan(100);
    expect(start.y).toBeGreaterThan(100);
    expect(arcPath(100, 100, 50, 135, 405)).toMatch(/^M.*A50 50 0 1 1 /);
    expect(arcPath(100, 100, 50, 135, 200)).toMatch(/A50 50 0 0 1 /);
  });

  it("hodnota podle dotyku: vlevo dole = min, nahoře = střed, vpravo dole = max, mezera dole drží blíž ležící konec", () => {
    const f = (dx: number, dy: number) => valueFromPoint(dx, dy, 5, 35, 0.5);
    expect(f(-50, 50)).toBe(5);
    expect(f(0, -50)).toBe(20);
    expect(f(50, 50)).toBe(35);
    expect(f(-5, 50)).toBe(5);
    expect(f(5, 50)).toBe(35);
  });
});

describe("texty", () => {
  it("předvolby: výběr z configu omezený na to, co hlavice umí", () => {
    const avail = ["none", "schedule", "manual", "boost", "eco", "away"];
    expect(visiblePresets(undefined, avail)).toEqual(["schedule", "manual", "boost", "eco", "away"]);
    expect(visiblePresets(["eco", "comfort"], avail)).toEqual(["eco"]);
    expect(visiblePresets(["eco"], undefined)).toEqual(["eco"]);
  });

  it("stav hlavice česky", () => {
    expect(heaterStatus("auto", "heating")).toBe("Topí");
    expect(heaterStatus("auto", "idle")).toBe("Netopí");
    expect(heaterStatus("off", "off")).toBe("Vypnuto");
    expect(heaterStatus("unavailable", undefined)).toBe("Nedostupné");
  });
});
