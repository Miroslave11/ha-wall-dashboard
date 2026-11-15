import { describe, expect, it } from "vitest";
import { czPlural, formatNumber, isInTimeWindow, litText, relativeFuture } from "./format";

describe("formatNumber", () => {
  it("formátuje s desetinnou čárkou", () => {
    expect(formatNumber("23.4")).toBe("23,4");
    expect(formatNumber(1.66, 0)).toBe("2");
  });
  it("vrací pomlčku pro nečíselné stavy", () => {
    expect(formatNumber("unavailable")).toBe("–");
    expect(formatNumber(undefined)).toBe("–");
  });
});

describe("české skloňování", () => {
  it("světlo / světla / světel", () => {
    expect(czPlural(1, "světlo", "světla", "světel")).toBe("světlo");
    expect(czPlural(3, "světlo", "světla", "světel")).toBe("světla");
    expect(czPlural(5, "světlo", "světla", "světel")).toBe("světel");
    expect(litText(0)).toBe("Vše zhasnuto");
    expect(litText(2)).toBe("Svítí 2 světla");
  });
});

describe("relativeFuture", () => {
  const now = Date.parse("2026-11-14T19:30:00Z");
  it("minuty a hodiny", () => {
    expect(relativeFuture(new Date(now + 45 * 60000), now)).toBe("za 45 min");
    expect(relativeFuture(new Date(now + 90 * 60000), now)).toBe("za 1 h 30 min");
    expect(relativeFuture(new Date(now + 21 * 3600000), now)).toBe("za 21 h");
  });
  it("neplatné vstupy", () => {
    expect(relativeFuture(undefined, now)).toBe("–");
    expect(relativeFuture("nesmysl", now)).toBe("–");
  });
});

describe("isInTimeWindow", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m);
  it("okno přes půlnoc", () => {
    expect(isInTimeWindow(at(23, 45), "23:30", "06:00")).toBe(true);
    expect(isInTimeWindow(at(3), "23:30", "06:00")).toBe(true);
    expect(isInTimeWindow(at(6), "23:30", "06:00")).toBe(false);
    expect(isInTimeWindow(at(12), "23:30", "06:00")).toBe(false);
  });
  it("okno během dne", () => {
    expect(isInTimeWindow(at(13), "12:00", "14:00")).toBe(true);
    expect(isInTimeWindow(at(14), "12:00", "14:00")).toBe(false);
  });
});
