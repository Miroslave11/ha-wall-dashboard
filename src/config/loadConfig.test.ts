import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, deepMerge, validateConfig } from "./loadConfig";
import type { DashboardConfig } from "./types";

describe("deepMerge", () => {
  it("slučuje objekty, nahrazuje pole a ignoruje _komentáře", () => {
    const merged = deepMerge(DEFAULT_CONFIG, { _comment: "x", theme: { accent: "#000000" }, scenes: [{ name: "A", entity: "scene.a" }] });
    expect(merged.theme).toEqual({ accent: "#000000", light: DEFAULT_CONFIG.theme.light });
    expect(merged.scenes).toHaveLength(1);
    expect((merged as unknown as Record<string, unknown>)._comment).toBeUndefined();
  });
});

describe("validateConfig", () => {
  const base = (): DashboardConfig => deepMerge(DEFAULT_CONFIG, {});
  it("demo bez URL je v pořádku", () => {
    expect(validateConfig(base())).toEqual([]);
  });
  it("hlídá token, duplicitní místnosti a přesah půdorysu", () => {
    const c = deepMerge(base(), {
      hass: { url: "http://ha.local:8123", auth: "token" },
      floorplan: {
        rooms: [
          { id: "a", name: "A", x: 0, y: 0, w: 100, h: 100, lights: [] },
          { id: "a", name: "B", x: 600, y: 0, w: 100, h: 100, lights: [] },
        ],
      },
    });
    const errs = validateConfig(c);
    expect(errs.some((e) => e.includes("hass.token"))).toBe(true);
    expect(errs.some((e) => e.includes("Duplicitní"))).toBe(true);
    expect(errs.some((e) => e.includes("přesahuje"))).toBe(true);
  });
  it("hlídá svítidla: entita v lights, délka pásku, poloha uvnitř místnosti", () => {
    const room = (fixtures: unknown[]) =>
      deepMerge(base(), {
        floorplan: { rooms: [{ id: "l", name: "L", x: 0, y: 0, w: 300, h: 300, lights: ["light.a", "light.led"], fixtures }] },
      });
    expect(
      validateConfig(
        room([
          { entity: "light.a", x: 130, y: 112 },
          { entity: "light.led", type: "strip", x: 194, y: 4, length: 82 },
        ]),
      ),
    ).toEqual([]);
    const errs = validateConfig(
      room([
        { entity: "light.cizi", x: 10, y: 10 },
        { entity: "light.led", type: "strip", x: 10, y: 4 },
        { entity: "light.a", x: 400, y: 10 },
      ]),
    );
    expect(errs.some((e) => e.includes('i v "lights"'))).toBe(true);
    expect(errs.some((e) => e.includes("length"))).toBe(true);
    expect(errs.some((e) => e.includes("mimo místnost"))).toBe(true);
  });
  it("hlídá volby zobrazení fotek", () => {
    const pf = (photoFrame: unknown) => validateConfig(deepMerge(base(), { photoFrame }));
    expect(pf({ portrait: "pair", landscape: "black", kenBurns: "off" })).toEqual([]);
    expect(pf({ portrait: "nesmysl" }).some((e) => e.includes("portrait"))).toBe(true);
    expect(pf({ landscape: "pair" }).some((e) => e.includes("landscape"))).toBe(true);
    expect(pf({ kenBurns: "full" }).some((e) => e.includes("kenBurns"))).toBe(true);
  });
  it("hlídá projektor: entita a čísla polohy i plátna", () => {
    const pj = (projector: unknown) => validateConfig(deepMerge(base(), { floorplan: { projector } }));
    expect(pj({ entity: "switch.zapni_kino", x: 398, y: 68, screen: { x1: 637, y1: 10, x2: 637, y2: 128 } })).toEqual([]);
    expect(pj({ entity: "", x: 1, y: 1, screen: { x1: 0, y1: 0, x2: 1, y2: 1 } }).some((e) => e.includes("entita"))).toBe(true);
    expect(pj({ entity: "switch.a", x: 1, y: 1 }).some((e) => e.includes("screen"))).toBe(true);
  });
  it("hlídá polohu vysavače: senzor místností a spárování s existujícími místnostmi", () => {
    const rooms = [{ id: "obyvak", name: "Obývák", x: 0, y: 0, w: 100, h: 100, lights: [] }];
    const vac = (vacuum: unknown) => validateConfig(deepMerge(base(), { floorplan: { rooms }, vacuum }));
    expect(vac({ entity: "vacuum.r", positionEntity: "sensor.p", roomsEntity: "sensor.r", roomMap: { "1": "obyvak" } })).toEqual([]);
    expect(vac({ entity: "vacuum.r", positionEntity: "sensor.p" }).some((e) => e.includes("roomsEntity"))).toBe(true);
    expect(vac({ entity: "vacuum.r", roomMap: { "2": "neexistuje" } }).some((e) => e.includes("neexistuje"))).toBe(true);
  });
});
