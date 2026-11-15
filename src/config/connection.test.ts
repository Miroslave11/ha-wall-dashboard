import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, deepMerge } from "./loadConfig";
import { applyStoredConnection, getStoredHassUrl, normalizeHassUrl, setStoredHassUrl } from "./connection";

describe("normalizeHassUrl", () => {
  it("doplní http:// a odstraní lomítko, cestu a mezery", () => {
    expect(normalizeHassUrl(" 192.168.1.10:8123/ ")).toBe("http://192.168.1.10:8123");
    expect(normalizeHassUrl("http://192.168.1.10:8123/lovelace/0")).toBe("http://192.168.1.10:8123");
    expect(normalizeHassUrl("HTTPS://ha.local")).toBe("https://ha.local");
  });
  it("neplatnou adresu odmítne", () => {
    expect(normalizeHassUrl("")).toBeNull();
    expect(normalizeHassUrl("http://")).toBeNull();
    expect(normalizeHassUrl("ha dom")).toBeNull();
  });
});

describe("applyStoredConnection", () => {
  it("adresa z aplikace má přednost, vypne demo a vynutí OAuth", () => {
    const file = deepMerge(DEFAULT_CONFIG, { demo: true, hass: { url: "", auth: "token", token: "x" } });
    const out = applyStoredConnection(file, "http://192.168.1.10:8123");
    expect(out.demo).toBe(false);
    expect(out.hass).toEqual({ url: "http://192.168.1.10:8123", auth: "oauth" });
    expect(applyStoredConnection(file, null)).toBe(file);
  });
});

describe("uložená adresa", () => {
  it("uloží a smaže adresu v localStorage", () => {
    setStoredHassUrl("http://ha:8123");
    expect(getStoredHassUrl()).toBe("http://ha:8123");
    setStoredHassUrl(null);
    expect(getStoredHassUrl()).toBeNull();
  });
});
