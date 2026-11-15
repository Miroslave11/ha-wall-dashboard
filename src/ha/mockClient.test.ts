import { describe, expect, it } from "vitest";
import type { HassEntities } from "home-assistant-js-websocket";
import { DEFAULT_CONFIG, deepMerge } from "../config/loadConfig";
import { MockHassClient } from "./mockClient";
import { activateScene, roomBrightness, setHeaterMode, setHeaterPreset, setHeaterSchedule, setHeaterTemperature, toggleRoom } from "./actions";

const cfg = deepMerge(DEFAULT_CONFIG, {
  demo: true,
  floorplan: { rooms: [{ id: "r", name: "R", x: 0, y: 0, w: 100, h: 100, lights: ["light.a", "light.b"] }] },
  scenes: [{ name: "Film", lights: { "light.a": 0.25, "light.b": 0 } }],
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("MockHassClient – nastavení a oblasti", () => {
  it("uživatelská data uloží, načte a smaže (v demu localStorage)", async () => {
    const client = new MockHassClient(cfg);
    expect(await client.loadUserData("test")).toBeNull();
    await client.saveUserData("test", { a: 1 });
    expect(await client.loadUserData("test")).toEqual({ a: 1 });
    await client.saveUserData("test", null);
    expect(await client.loadUserData("test")).toBeNull();
    client.close();
  });

  it("oblasti v demu odpovídají místnostem", async () => {
    const client = new MockHassClient(cfg);
    const reg = await client.fetchRegistry();
    expect(reg.areas).toEqual([{ id: "r", name: "R" }]);
    expect(reg.entityArea["light.a"]).toBe("r");
    client.close();
  });
});

describe("MockHassClient – projektor", () => {
  const pjCfg = deepMerge(DEFAULT_CONFIG, {
    demo: true,
    floorplan: {
      rooms: [{ id: "r", name: "R", x: 0, y: 0, w: 100, h: 100, lights: ["light.a"] }],
      projector: { entity: "switch.zapni_kino", x: 10, y: 10, screen: { x1: 90, y1: 10, x2: 90, y2: 60 } },
    },
  });

  it("projektor je v demu vypnutý a jde přepnout", async () => {
    const client = new MockHassClient(pjCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    expect(ents["switch.zapni_kino"].state).toBe("off");
    await client.callService("homeassistant", "turn_on", {}, { entity_id: "switch.zapni_kino" });
    await flush();
    expect(ents["switch.zapni_kino"].state).toBe("on");
    client.close();
  });
});

describe("MockHassClient – topení", () => {
  const heatCfg = deepMerge(DEFAULT_CONFIG, {
    demo: true,
    floorplan: { rooms: [{ id: "r", name: "R", x: 0, y: 0, w: 100, h: 100, lights: ["light.a"] }] },
    heating: [
      {
        name: "Pracovna",
        entity: "climate.topeni_ventil_pracovna",
        position: "sensor.topeni_ventil_pracovna_position",
        schedule: "text.topeni_ventil_pracovna_workdays_schedule",
        battery: "binary_sensor.topeni_ventil_pracovna_battery_low",
      },
    ],
  });
  const id = "climate.topeni_ventil_pracovna";

  it("hlavice a její senzory jsou v demu hned k dispozici", () => {
    const client = new MockHassClient(heatCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    expect(ents[id].state).toBe("auto");
    expect(ents[id].attributes.hvac_action).toBe("idle");
    expect(ents["sensor.topeni_ventil_pracovna_position"].state).toBe("0");
    expect(ents["text.topeni_ventil_pracovna_workdays_schedule"].state).toContain("06:00/22°C");
    expect(ents["binary_sensor.topeni_ventil_pracovna_battery_low"].state).toBe("on");
    client.close();
  });

  it("vyšší cílová teplota než v místnosti: topí a otevře ventil, vypnutí ho zavře", async () => {
    const client = new MockHassClient(heatCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    await setHeaterTemperature(client, id, 24);
    await flush();
    expect(ents[id].attributes.temperature).toBe(24);
    expect(ents[id].attributes.hvac_action).toBe("heating");
    expect(Number(ents["sensor.topeni_ventil_pracovna_position"].state)).toBeGreaterThan(0);
    await setHeaterMode(client, id, "off");
    await flush();
    expect(ents[id].state).toBe("off");
    expect(ents[id].attributes.hvac_action).toBe("off");
    expect(ents["sensor.topeni_ventil_pracovna_position"].state).toBe("0");
    client.close();
  });

  it("předvolba a plán se zapíšou", async () => {
    const client = new MockHassClient(heatCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    await setHeaterPreset(client, id, "boost");
    await setHeaterSchedule(client, "text.topeni_ventil_pracovna_workdays_schedule", "06:00/20°C 22:00/16°C");
    await flush();
    expect(ents[id].attributes.preset_mode).toBe("boost");
    expect(ents["text.topeni_ventil_pracovna_workdays_schedule"].state).toBe("06:00/20°C 22:00/16°C");
    client.close();
  });
});

describe("MockHassClient – barva a efekty světla", () => {
  const ledCfg = deepMerge(DEFAULT_CONFIG, {
    demo: true,
    floorplan: { rooms: [{ id: "r", name: "R", x: 0, y: 0, w: 100, h: 100, lights: ["light.strop", "light.led_pasek"] }] },
  });

  it("LED umí barvu a teplotu bílé, běžné světlo jen stmívat", () => {
    const client = new MockHassClient(ledCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    expect(ents["light.strop"].attributes.supported_color_modes).toEqual(["brightness"]);
    expect(ents["light.led_pasek"].attributes.supported_color_modes).toEqual(["color_temp", "xy"]);
    expect(ents["light.led_pasek"].attributes.effect_list).toContain("colorloop");
    client.close();
  });

  it("hs_color přepne do barvy, color_temp_kelvin zpět na bílou, rozsvícení začne teplou bílou", async () => {
    const client = new MockHassClient(ledCfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    const id = "light.led_pasek";

    await client.callService("light", "turn_on", {}, { entity_id: id });
    await flush();
    expect(ents[id].state).toBe("on");
    expect(ents[id].attributes).toMatchObject({ color_mode: "color_temp", color_temp_kelvin: 2700, brightness: 255 });

    await client.callService("light", "turn_on", { hs_color: [240, 100], brightness_pct: 50 }, { entity_id: id });
    await flush();
    expect(ents[id].attributes).toMatchObject({ color_mode: "xy", hs_color: [240, 100], rgb_color: [0, 0, 255], brightness: 128 });

    await client.callService("light", "turn_on", { color_temp_kelvin: 4000 }, { entity_id: id });
    await flush();
    expect(ents[id].attributes).toMatchObject({ color_mode: "color_temp", color_temp_kelvin: 4000 });

    await client.callService("light", "turn_on", { effect: "colorloop" }, { entity_id: id });
    await flush();
    expect(ents[id].attributes.effect).toBe("colorloop");
    await client.callService("light", "turn_on", { effect: "stop_colorloop" }, { entity_id: id });
    await flush();
    expect(ents[id].attributes.effect).toBeNull();

    await client.callService("homeassistant", "turn_off", {}, { entity_id: id });
    await flush();
    expect(ents[id].state).toBe("off");
    expect(ents[id].attributes.rgb_color).toBeUndefined();
    client.close();
  });
});

describe("MockHassClient + akce", () => {
  it("přepne místnost a aplikuje scénu s jasem", async () => {
    const client = new MockHassClient(cfg);
    let ents: HassEntities = {};
    client.subscribeEntities((e) => (ents = e));
    const room = cfg.floorplan.rooms[0];

    expect(roomBrightness(room, ents)).toBe(0);
    await toggleRoom(client, room, ents);
    await flush();
    expect(roomBrightness(room, ents)).toBe(1);

    await activateScene(client, cfg.scenes[0]);
    await flush();
    expect(ents["light.a"].state).toBe("on");
    expect(ents["light.b"].state).toBe("off");
    expect(roomBrightness(room, ents)).toBeCloseTo(64 / 255, 2);

    await toggleRoom(client, room, ents);
    await flush();
    expect(roomBrightness(room, ents)).toBe(0);
    client.close();
  });
});
