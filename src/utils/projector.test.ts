import { describe, expect, it } from "vitest";
import type { ProjectorConfig } from "../config/types";
import { beamMotes, beamPoints, isProjectorOn, screenCenter, screenLength } from "./projector";

const p: ProjectorConfig = { entity: "switch.zapni_kino", x: 400, y: 70, screen: { x1: 636, y1: 10, x2: 636, y2: 130 } };

describe("projektor", () => {
  it("promítá jen ve stavu on", () => {
    expect(isProjectorOn("on")).toBe(true);
    expect(isProjectorOn("off")).toBe(false);
    expect(isProjectorOn("unavailable")).toBe(false);
    expect(isProjectorOn(undefined)).toBe(false);
  });

  it("paprsek vede z projektoru na oba konce plátna", () => {
    expect(beamPoints(p)).toBe("400,70 636,10 636,130");
  });

  it("střed a délka plátna", () => {
    expect(screenCenter(p)).toEqual({ x: 636, y: 70 });
    expect(screenLength(p)).toBe(120);
  });

  it("zrnka prachu leží uvnitř paprsku", () => {
    for (const m of beamMotes(p)) {
      expect(m.x).toBeGreaterThan(p.x);
      expect(m.x).toBeLessThan(636);
      // šířka paprsku v místě m.x
      const half = (60 * (m.x - p.x)) / (636 - p.x);
      expect(Math.abs(m.y - 70)).toBeLessThanOrEqual(half + 1e-9);
    }
  });
});
