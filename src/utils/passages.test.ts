import { describe, expect, it } from "vitest";
import type { PassageConfig, RoomConfig } from "../config/types";
import { passageEnds, passageHoles, passageMask } from "./passages";

const room = (id: string, x: number, y: number, w: number, h: number): RoomConfig => ({ id, name: id, x, y, w, h, lights: [] });
const loznice = room("loznice", 0, 0, 300, 300);
const obyvak = room("obyvak", 300, 0, 340, 300);
const chodba = room("chodba", 300, 300, 120, 160);

describe("průchody", () => {
  it("svislý průchod vystřihne otvor v pravé hraně levé a levé hraně pravé dlaždice", () => {
    const p: PassageConfig[] = [{ x: 300, y: 195, length: 40 }];
    // dlaždice ložnice: šířka 292, výška 292, počátek (4, 4) → y 195 → 191
    expect(passageHoles(loznice, p)).toEqual([{ x: 292 - 1, y: 191, w: 2, h: 40 }]);
    expect(passageHoles(obyvak, p)).toEqual([{ x: -1, y: 191, w: 2, h: 40 }]);
    expect(passageHoles(chodba, p)).toEqual([]);
  });

  it("vodorovný průchod vystřihne otvor ve spodní hraně horní a horní hraně dolní dlaždice", () => {
    const p: PassageConfig[] = [{ x: 313, y: 300, length: 80, horizontal: true }];
    expect(passageHoles(obyvak, p)).toEqual([{ x: 9, y: 292 - 1, w: 80, h: 2 }]);
    expect(passageHoles(chodba, p)).toEqual([{ x: 9, y: -1, w: 80, h: 2 }]);
    expect(passageHoles(loznice, p)).toEqual([]);
  });

  it("bez průchodů nebo bez hrany na zdi nevzniká žádný otvor ani maska", () => {
    expect(passageHoles(loznice, undefined)).toEqual([]);
    expect(passageHoles(loznice, [{ x: 150, y: 100, length: 40 }])).toEqual([]);
    expect(passageMask([])).toEqual({});
  });

  it("maska má vrstvu pro celou dlaždici a pro každý otvor", () => {
    const m = passageMask([
      { x: 1, y: 2, w: 3, h: 4 },
      { x: 5, y: 6, w: 7, h: 8 },
    ]) as Record<string, string>;
    expect(m.maskComposite).toBe("exclude");
    expect(m.maskSize).toBe("100% 100%,3px 4px,7px 8px");
    expect(m.maskPosition).toBe("0 0,1px 2px,5px 6px");
  });

  it("konce otvoru", () => {
    expect(passageEnds({ x: 300, y: 195, length: 40 })).toEqual({ x1: 300, y1: 195, x2: 300, y2: 235 });
    expect(passageEnds({ x: 313, y: 300, length: 80, horizontal: true })).toEqual({ x1: 313, y1: 300, x2: 393, y2: 300 });
  });
});
