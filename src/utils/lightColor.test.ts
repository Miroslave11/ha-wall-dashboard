import type { HassEntity } from "home-assistant-js-websocket";
import { describe, expect, it } from "vitest";
import { effectLabel, hsToRgb, isTunable, kelvinToRgb, lightCaps, lightGlowRgb, lightHs, lightKelvin, lightPercent, rgbToHs } from "./lightColor";

const light = (state: string, attributes: Record<string, unknown> = {}, id = "light.led") => ({ entity_id: id, state, attributes }) as unknown as HassEntity;

const led = (state: string, extra: Record<string, unknown> = {}) =>
  light(state, { supported_color_modes: ["color_temp", "xy"], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6329, effect_list: ["blink", "colorloop"], ...extra });

describe("lightCaps", () => {
  it("rozpozná barvu, teplotu bílé a efekty (Zigbee LED pásek)", () => {
    expect(lightCaps(led("off"))).toEqual({ dimmable: true, color: true, colorTemp: { min: 2000, max: 6329 }, effects: ["blink", "colorloop"] });
  });
  it("jen stmívatelné světlo nemá barvu ani teplotu", () => {
    const c = lightCaps(light("on", { supported_color_modes: ["brightness"] }));
    expect(c).toMatchObject({ dimmable: true, color: false, colorTemp: null });
  });
  it("onoff, switch a neexistující entita nejsou stmívatelné", () => {
    expect(lightCaps(light("on", { supported_color_modes: ["onoff"] })).dimmable).toBe(false);
    expect(lightCaps(light("on", {}, "switch.x")).dimmable).toBe(false);
    expect(lightCaps(undefined).dimmable).toBe(false);
  });
  it("chybějící rozsah teploty nahradí výchozím", () => {
    expect(lightCaps(light("on", { supported_color_modes: ["color_temp"] })).colorTemp).toEqual({ min: 2000, max: 6500 });
  });
  it("isTunable", () => {
    expect(isTunable(led("on"))).toBe(true);
    expect(isTunable(light("on", { supported_color_modes: ["brightness"] }))).toBe(false);
  });
});

describe("převody barev", () => {
  it("kelvinToRgb: teplá je červenější, studená modřejší", () => {
    const warm = kelvinToRgb(2700);
    const cold = kelvinToRgb(6500);
    expect(warm[0]).toBe(255);
    expect(warm[2]).toBeLessThan(cold[2]);
    expect(cold[2]).toBeGreaterThan(240);
    expect(kelvinToRgb(6600)[2]).toBe(255);
    expect(kelvinToRgb(100)).toEqual(kelvinToRgb(1000));
  });
  it("hsToRgb: základní barvy a bílá", () => {
    expect(hsToRgb(0, 100)).toEqual([255, 0, 0]);
    expect(hsToRgb(120, 100)).toEqual([0, 255, 0]);
    expect(hsToRgb(240, 100)).toEqual([0, 0, 255]);
    expect(hsToRgb(200, 0)).toEqual([255, 255, 255]);
    expect(hsToRgb(360, 100)).toEqual([255, 0, 0]);
  });
  it("rgbToHs je inverzní k hsToRgb", () => {
    expect(rgbToHs(255, 0, 0)).toEqual([0, 100]);
    expect(rgbToHs(0, 0, 255)).toEqual([240, 100]);
    expect(rgbToHs(255, 255, 255)).toEqual([0, 0]);
    const [h, s] = rgbToHs(...hsToRgb(275, 100));
    expect(h).toBeCloseTo(275, 0);
    expect(s).toBe(100);
  });
});

describe("stav světla", () => {
  it("záře: barva jen u zapnutého laditelného světla", () => {
    expect(lightGlowRgb(led("on", { rgb_color: [10, 20, 30] }))).toBe("10,20,30");
    expect(lightGlowRgb(led("on", { color_temp_kelvin: 2700 }))).toBe(kelvinToRgb(2700).join(","));
    expect(lightGlowRgb(led("off", { rgb_color: [10, 20, 30] }))).toBeNull();
    expect(lightGlowRgb(light("on", { supported_color_modes: ["brightness"], rgb_color: [1, 2, 3] }))).toBeNull();
    expect(lightGlowRgb(undefined)).toBeNull();
  });
  it("lightHs bere hs_color, jinak RGB, jinak teplou bílou", () => {
    expect(lightHs(led("on", { hs_color: [200, 50] }))).toEqual([200, 50]);
    expect(lightHs(led("on", { rgb_color: [255, 0, 0] }))).toEqual([0, 100]);
    expect(lightHs(led("off"))).toEqual([30, 60]);
  });
  it("lightKelvin jen v režimu color_temp a při svícení", () => {
    expect(lightKelvin(led("on", { color_mode: "color_temp", color_temp_kelvin: 3000 }))).toBe(3000);
    expect(lightKelvin(led("on", { color_mode: "xy", color_temp_kelvin: 3000 }))).toBeNull();
    expect(lightKelvin(led("off", { color_mode: "color_temp", color_temp_kelvin: 3000 }))).toBeNull();
  });
  it("lightPercent", () => {
    expect(lightPercent(led("off"))).toBe(0);
    expect(lightPercent(led("on", { brightness: 255 }))).toBe(100);
    expect(lightPercent(led("on", { brightness: 1 }))).toBe(1);
    expect(lightPercent(led("on"))).toBe(100);
  });
  it("effectLabel: česky, neznámý efekt čitelně", () => {
    expect(effectLabel("colorloop")).toBe("Barevný cyklus");
    expect(effectLabel("some_new_effect")).toBe("some new effect");
  });
});
