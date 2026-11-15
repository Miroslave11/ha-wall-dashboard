import { describe, expect, it } from "vitest";
import { rangeBar, tempRange, weatherInfo } from "./weather";

describe("tempRange", () => {
  it("najde minimum a maximum přes dny", () => {
    expect(
      tempRange([
        { temperature: 6.5, templow: 0.3 },
        { temperature: 11.4, templow: 7.6 },
      ]),
    ).toEqual({ min: 0.3, max: 11.4 });
  });
  it("bez údajů vrací null", () => {
    expect(tempRange([])).toBeNull();
    expect(tempRange([{}])).toBeNull();
  });
});

describe("rangeBar", () => {
  const range = { min: 0, max: 10 };
  it("pruh odpovídá poloze dne v rozsahu", () => {
    expect(rangeBar({ temperature: 8, templow: 2 }, range)).toEqual({ left: 20, width: 60 });
  });
  it("příliš úzký pruh má minimální šířku a nepřeteče", () => {
    const b = rangeBar({ temperature: 10, templow: 10 }, range);
    expect(b.width).toBe(4);
    expect(b.left + b.width).toBeLessThanOrEqual(100);
  });
  it("den jen s jednou hodnotou", () => {
    expect(rangeBar({ temperature: 5 }, range).left).toBeCloseTo(48);
  });
});

describe("weatherInfo", () => {
  it("zná stavy HA a neznámý stav vrátí tak, jak je", () => {
    expect(weatherInfo("rainy").label).toBe("Déšť");
    expect(weatherInfo("neco").label).toBe("neco");
  });
});
