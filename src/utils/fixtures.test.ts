import { describe, expect, it } from "vitest";
import { BULB_GLOW, fixtureGeometry, isStrip } from "./fixtures";

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
