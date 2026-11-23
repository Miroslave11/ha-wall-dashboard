import { describe, expect, it } from "vitest";
import { BULB_GLOW, fixtureGeometry, isStrip, newFixture, syncFixtureLights } from "./fixtures";

describe("fixtureGeometry", () => {
  it("žárovka: střed je přímo x/y a záře je kruh", () => {
    const g = fixtureGeometry({ entity: "light.a", x: 130, y: 112 });
    expect(g).toMatchObject({ cx: 130, cy: 112, w: 0, h: 0, glowW: BULB_GLOW, glowH: BULB_GLOW });
  });

  it("vodorovný pásek: střed uprostřed délky, záře protažená podél pásku", () => {
    const g = fixtureGeometry({ entity: "light.led", type: "strip", x: 194, y: 4, length: 82 });
    expect(g.cx).toBe(235);
    expect(g.cy).toBe(4);
    expect(g.w).toBe(82);
    expect(g.h).toBe(0);
    expect(g.glowW).toBeGreaterThan(82);
  });

  it("svislý pásek: rozměry a záře se prohodí", () => {
    const g = fixtureGeometry({ entity: "light.led", type: "strip", vertical: true, x: 4, y: 100, length: 200 });
    expect(g).toMatchObject({ cx: 4, cy: 200, w: 0, h: 200 });
    expect(g.glowH).toBeGreaterThan(g.glowW);
  });

  it("pásek bez délky nespadne", () => {
    const g = fixtureGeometry({ entity: "light.led", type: "strip", x: 10, y: 10 });
    expect(g.w).toBe(0);
    expect(isStrip({ entity: "light.led", type: "strip", x: 0, y: 0 })).toBe(true);
    expect(isStrip({ entity: "light.a", x: 0, y: 0 })).toBe(false);
  });
});

describe("newFixture", () => {
  const room = { id: "pokoj", name: "Pracovna", x: 0, y: 300, w: 210, h: 160, lights: [] };

  it("žárovka vznikne uprostřed místnosti", () => {
    expect(newFixture(room, false)).toEqual({ entity: "", name: "Světlo 1", x: 105, y: 380 });
  });

  it("LED pásek vznikne u horní stěny uprostřed a leží celý v místnosti", () => {
    const f = newFixture({ ...room, fixtures: [{ entity: "light.a", type: "strip", x: 15, y: 456, length: 100 }] }, true);
    expect(f).toEqual({ entity: "", type: "strip", name: "LED pásek 2", x: 55, y: 304, length: 100 });
    expect(isStrip(f)).toBe(true);
  });
});

describe("syncFixtureLights", () => {
  it("doplní chybějící entity svítidel do světel, prázdné a existující nechá", () => {
    const room = {
      id: "pokoj",
      name: "Pracovna",
      x: 0,
      y: 300,
      w: 210,
      h: 160,
      lights: ["switch.a"],
      fixtures: [
        { entity: "switch.a", x: 105, y: 370 },
        { entity: "light.led", type: "strip" as const, x: 10, y: 456, length: 110 },
        { entity: "", x: 50, y: 350 },
      ],
    };
    syncFixtureLights(room);
    expect(room.lights).toEqual(["light.led", "switch.a"]);
  });
});
