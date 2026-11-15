import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, deepMerge } from "./loadConfig";
import type { DashboardConfig } from "./types";
import { applyUserSettings, extractUserSettings, parseUserSettings, sameSettings } from "./userSettings";

const cfg = (): DashboardConfig =>
  deepMerge(DEFAULT_CONFIG, {
    header: { sun: "sun.sun" },
    floorplan: { rooms: [{ id: "a", name: "A", x: 0, y: 0, w: 100, h: 100, lights: ["light.a"] }] },
    scenes: [{ name: "Večer", entity: "scene.vecer" }],
    temperatures: [{ name: "Venku", entity: "sensor.venku" }],
  });

describe("userSettings", () => {
  it("extract → apply vrátí stejnou konfiguraci a nesdílí s ní objekty", () => {
    const c = cfg();
    const s = extractUserSettings(c);
    expect(applyUserSettings(c, s)).toEqual(c);
    s.rooms[0].name = "Změna";
    expect(c.floorplan.rooms[0].name).toBe("A");
  });

  it("nastavení z aplikace přepíše místnosti a entity, zbytek zůstane ze souboru", () => {
    const c = cfg();
    const s = extractUserSettings(c);
    s.rooms = [{ id: "pracovna", name: "Pracovna", x: 0, y: 0, w: 100, h: 100, lights: ["switch.vypinac_pracovna"] }];
    s.weather = { entity: "weather.doma" };
    const out = applyUserSettings(c, s);
    expect(out.floorplan.rooms.map((r) => r.id)).toEqual(["pracovna"]);
    expect(out.weather?.entity).toBe("weather.doma");
    expect(out.floorplan.width).toBe(c.floorplan.width);
    expect(out.photoFrame).toEqual(c.photoFrame);
    expect(applyUserSettings(c, null)).toBe(c);
  });

  it("vysavač: starší nastavení bez voleb mapy je převezme ze souboru, smazané (prázdné) ne", () => {
    const c = deepMerge(cfg(), { vacuum: { entity: "vacuum.r", positionEntity: "sensor.p", roomsEntity: "sensor.r", roomMap: { "1": "a" } } });
    const s = extractUserSettings(c);
    s.vacuum = { entity: "vacuum.r", name: "Robot" };
    expect(applyUserSettings(c, s).vacuum).toEqual({ entity: "vacuum.r", name: "Robot", positionEntity: "sensor.p", roomsEntity: "sensor.r", roomMap: { "1": "a" } });
    s.vacuum = { entity: "vacuum.r", positionEntity: "" };
    expect(applyUserSettings(c, s).vacuum).toEqual({ entity: "vacuum.r", positionEntity: "" });
    s.vacuum = { entity: "vacuum.jiny" };
    expect(applyUserSettings(c, s).vacuum).toEqual({ entity: "vacuum.jiny" });
  });

  it("poloha a velikost místnosti jsou ze souboru, ne z uloženého nastavení", () => {
    const c = cfg();
    const s = extractUserSettings(c);
    s.rooms[0].x = 50;
    s.rooms[0].w = 10;
    s.rooms[0].name = "Přejmenováno";
    const out = applyUserSettings(c, s);
    expect(out.floorplan.rooms[0]).toMatchObject({ name: "Přejmenováno", x: 0, y: 0, w: 100, h: 100 });
  });

  it("zobrazení fotek: výchozí hodnoty do nastavení, uložená volba přepíše soubor, starší nastavení bez ní ho nechá", () => {
    const c = deepMerge(cfg(), { photoFrame: { portrait: "crop", landscape: "blur", kenBurns: "subtle" } });
    const s = extractUserSettings(c);
    expect(s.photoFrame).toMatchObject({ portrait: "crop", landscape: "blur", kenBurns: "subtle" });
    expect(extractUserSettings(cfg()).photoFrame).toMatchObject({ portrait: "blur", landscape: "crop", kenBurns: "on" });
    s.photoFrame!.portrait = "pair";
    expect(applyUserSettings(c, s).photoFrame.portrait).toBe("pair");
    // starší uložené nastavení volby nemá → platí soubor
    const old = JSON.parse(JSON.stringify(extractUserSettings(c)));
    delete old.photoFrame.portrait;
    delete old.photoFrame.kenBurns;
    const out = applyUserSettings(c, parseUserSettings(old));
    expect(out.photoFrame.portrait).toBe("crop");
    expect(out.photoFrame.kenBurns).toBe("subtle");
  });

  it("fotorámeček: nastavení z aplikace přepíše časy, zdroj fotek zůstane ze souboru", () => {
    const c = deepMerge(cfg(), { photoFrame: { source: { type: "immich", albumName: "Album" }, blackout: { from: "23:00", to: "06:00" } } });
    const s = extractUserSettings(c);
    s.photoFrame = { enabled: true, idleSeconds: 90, slideSeconds: 20, shuffle: false, blackout: undefined };
    const out = applyUserSettings(c, parseUserSettings(JSON.parse(JSON.stringify(s))));
    expect(out.photoFrame.idleSeconds).toBe(90);
    expect(out.photoFrame.slideSeconds).toBe(20);
    expect(out.photoFrame.shuffle).toBe(false);
    expect(out.photoFrame.blackout).toBeUndefined();
    expect(out.photoFrame.source).toMatchObject({ type: "immich", albumName: "Album" });
  });

  it("starší uložené nastavení bez photoFrame ponechá fotorámeček ze souboru", () => {
    const c = cfg();
    const s = extractUserSettings(c);
    delete s.photoFrame;
    const stored = parseUserSettings(JSON.parse(JSON.stringify(s)));
    expect(stored).not.toBeNull();
    expect(applyUserSettings(c, stored).photoFrame).toBe(c.photoFrame);
    expect(parseUserSettings({ ...s, photoFrame: { enabled: "ano" } })).toBeNull();
  });

  it("skrytý název místnosti (hideName) se uloží i načte, a sameSettings změnu pozná", () => {
    const c = cfg();
    const s = extractUserSettings(c);
    const before = extractUserSettings(c);
    s.rooms[0].hideName = true;
    expect(sameSettings(before, s)).toBe(false);
    const stored = parseUserSettings(JSON.parse(JSON.stringify(s)));
    expect(stored?.rooms[0].hideName).toBe(true);
    expect(applyUserSettings(c, stored).floorplan.rooms[0].hideName).toBe(true);
  });

  it("parseUserSettings odmítne neznámý formát", () => {
    const s = extractUserSettings(cfg());
    expect(parseUserSettings(s)).toEqual(s);
    expect(parseUserSettings(null)).toBeNull();
    expect(parseUserSettings({ ...s, version: 2 })).toBeNull();
    expect(parseUserSettings({ ...s, rooms: [{ name: "bez id" }] })).toBeNull();
  });

  it("sameSettings porovnává obsah", () => {
    const a = extractUserSettings(cfg());
    const b = extractUserSettings(cfg());
    expect(sameSettings(a, b)).toBe(true);
    b.rooms[0].lights.push("light.b");
    expect(sameSettings(a, b)).toBe(false);
  });
});
