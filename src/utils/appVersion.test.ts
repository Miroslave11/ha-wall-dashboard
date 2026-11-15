import { describe, expect, it } from "vitest";
import { isNewVersion, parseVersion } from "./appVersion";

describe("parseVersion", () => {
  it("přečte číslo verze včetně konce řádku", () => {
    expect(parseVersion("1.2.0\n")).toBe("1.2.0");
    expect(parseVersion("v1.0.0-rc.1")).toBe("v1.0.0-rc.1");
  });

  it("index.html, prázdný nebo chybějící soubor není verze", () => {
    expect(parseVersion("<!doctype html>\n<html lang=\"cs\">")).toBeNull();
    expect(parseVersion("")).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
});

describe("isNewVersion", () => {
  it("obnoví jen při změně známé verze", () => {
    expect(isNewVersion("1.0.0", "1.1.0")).toBe(true);
    expect(isNewVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewVersion(null, "1.1.0")).toBe(false);
    expect(isNewVersion("1.0.0", null)).toBe(false);
  });
});
