import { describe, expect, it } from "vitest";
import { chartPoints, decimate, niceTicks, summarize, timeTicks, valueAt } from "./chart";

const H = 3600_000;

describe("niceTicks", () => {
  it("pokryje rozsah pěknými kroky", () => {
    expect(niceTicks(0.7, 9.3, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(21.2, 23.9, 5)).toEqual([21, 22, 23, 24]);
  });
  it("stejné min a max → okolí ±1", () => {
    const t = niceTicks(20, 20);
    expect(t[0]).toBeLessThanOrEqual(19);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(21);
  });
  it("záporné hodnoty a bez chyb zaokrouhlení", () => {
    const t = niceTicks(-3.1, 0.4, 5);
    expect(t[0]).toBeLessThanOrEqual(-3.1);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(0.4);
    expect(t.every((v) => Number.isInteger(v * 10))).toBe(true);
  });
});

describe("timeTicks", () => {
  it("24 h → po 4 hodinách na celých hodinách", () => {
    const to = new Date(2026, 10, 14, 15, 30).getTime();
    const ticks = timeTicks(to - 24 * H, to);
    expect(ticks.length).toBeGreaterThanOrEqual(6);
    for (const k of ticks) {
      const d = new Date(k.t);
      expect(d.getMinutes()).toBe(0);
      expect(d.getHours() % 4).toBe(0);
      expect(k.t).toBeGreaterThanOrEqual(to - 24 * H);
      expect(k.t).toBeLessThanOrEqual(to);
    }
  });
  it("týden → půlnoci s názvem dne", () => {
    const to = new Date(2026, 10, 14, 15, 30).getTime();
    const ticks = timeTicks(to - 168 * H, to);
    expect(ticks.length).toBeGreaterThanOrEqual(7);
    for (const k of ticks) {
      const d = new Date(k.t);
      expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
      expect(k.label).toMatch(/^\p{L}+ \d+\.$/u);
    }
  });
});

describe("chartPoints / decimate / summarize / valueAt", () => {
  const pts = [
    { t: 0, v: 10 },
    { t: 4 * H, v: 20 },
    { t: 8 * H, v: 14 },
  ];
  it("doplní hodnotu na začátek a natáhne konec", () => {
    const out = chartPoints(pts, 2 * H, 10 * H);
    expect(out[0]).toEqual({ t: 2 * H, v: 10 });
    expect(out[out.length - 1]).toEqual({ t: 10 * H, v: 14 });
    expect(out).toHaveLength(4);
  });
  it("prázdná historie → prázdné pole", () => {
    expect(chartPoints([], 0, H)).toEqual([]);
  });
  it("decimate omezí počet bodů, krátké řady nechá být", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ t: i * 1000, v: i }));
    expect(decimate(many, 100)).toHaveLength(100);
    expect(decimate(pts, 100)).toBe(pts);
  });
  it("summarize: min, max a průměr vážený časem", () => {
    const s = summarize([
      { t: 0, v: 10 },
      { t: 3 * H, v: 20 },
      { t: 4 * H, v: 20 },
    ])!;
    expect([s.min, s.max]).toEqual([10, 20]);
    expect(s.avg).toBeCloseTo((10 * 3 + 20 * 1) / 4);
    expect(summarize([])).toBeNull();
  });
  it("valueAt interpoluje", () => {
    expect(valueAt(pts, 2 * H)).toBeCloseTo(15);
    expect(valueAt(pts, -5)).toBe(10);
    expect(valueAt(pts, 99 * H)).toBe(14);
    expect(valueAt([], 0)).toBeUndefined();
  });
});
