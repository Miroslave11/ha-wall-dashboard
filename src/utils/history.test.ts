import { describe, expect, it } from "vitest";
import { parseHistoryResponse, resample, sparkPoints } from "./history";

describe("parseHistoryResponse", () => {
  it("čte komprimovaný formát a zahazuje nečíselné stavy", () => {
    const res = parseHistoryResponse({
      "sensor.t": [
        { s: "21.5", lu: 1000 },
        { s: "unavailable", lu: 1100 },
        { s: "22", lu: 1200 },
      ],
    });
    expect(res["sensor.t"]).toEqual([
      { t: 1_000_000, v: 21.5 },
      { t: 1_200_000, v: 22 },
    ]);
  });
});

describe("resample", () => {
  it("drží hodnotu do další změny (schodovitě)", () => {
    const pts = [
      { t: 0, v: 1 },
      { t: 50, v: 2 },
    ];
    expect(resample(pts, 0, 100, 5)).toEqual([1, 1, 2, 2, 2]);
  });
  it("před prvním bodem použije první hodnotu", () => {
    expect(resample([{ t: 60, v: 7 }], 0, 100, 3)).toEqual([7, 7, 7]);
  });
  it("prázdná historie", () => {
    expect(resample([], 0, 100, 5)).toEqual([]);
  });
});

describe("sparkPoints", () => {
  it("vytvoří čáru i plochu", () => {
    const { line, area } = sparkPoints([1, 2, 3], 100, 40);
    expect(line.split(" ")).toHaveLength(3);
    expect(area.startsWith("0,40 ")).toBe(true);
    expect(area.endsWith(" 100,40")).toBe(true);
  });
  it("konstantní řada nedělí nulou", () => {
    expect(sparkPoints([5, 5], 10, 10).line).not.toContain("NaN");
  });
});
