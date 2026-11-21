import type { HassEntities } from "home-assistant-js-websocket";
import { describe, expect, it, vi } from "vitest";
import type { RoomConfig } from "../config/types";
import { activateScene, lightBrightness, roomBrightness, setLightColor, setLightEffect, setLightKelvin, setLightPercent, toggleLight, vacuumCleanRooms } from "./actions";
import type { HassClient } from "./types";

const ent = (state: string, brightness?: number) =>
  ({ state, attributes: brightness === undefined ? {} : { brightness } }) as unknown as HassEntities[string];

const entities: HassEntities = {
  "light.a": ent("on", 51),
  "light.b": ent("off"),
  "switch.c": ent("on"),
};

describe("lightBrightness / roomBrightness", () => {
  it("jas jednoho světla: vypnuté 0, switch bez jasu 1", () => {
    expect(lightBrightness("light.a", entities)).toBeCloseTo(0.2);
    expect(lightBrightness("light.b", entities)).toBe(0);
    expect(lightBrightness("switch.c", entities)).toBe(1);
    expect(lightBrightness("light.neni", entities)).toBe(0);
  });
  it("jas místnosti = nejvyšší jas jejích světel", () => {
    const room = { lights: ["light.a", "light.b"] } as RoomConfig;
    expect(roomBrightness(room, entities)).toBeCloseTo(0.2);
  });
});

describe("activateScene", () => {
  it("scénu i skript spustí službou jejich domény", async () => {
    const callService = vi.fn().mockResolvedValue(null);
    const client = { callService } as unknown as HassClient;
    await activateScene(client, { name: "Večer", entity: "scene.vecer" });
    await activateScene(client, { name: "Film", entity: "script.film" });
    expect(callService).toHaveBeenNthCalledWith(1, "scene", "turn_on", {}, { entity_id: "scene.vecer" });
    expect(callService).toHaveBeenNthCalledWith(2, "script", "turn_on", {}, { entity_id: "script.film" });
  });
});

describe("vacuumCleanRooms", () => {
  it("pošle app_segment_clean s čísly segmentů", async () => {
    const callService = vi.fn().mockResolvedValue(null);
    await vacuumCleanRooms({ callService } as unknown as HassClient, "vacuum.robot", [2, 6, 7]);
    expect(callService).toHaveBeenCalledWith("vacuum", "send_command", { command: "app_segment_clean", params: [2, 6, 7] }, { entity_id: "vacuum.robot" });
  });
});

describe("ladění světla (jas, barva, teplota, efekt)", () => {
  const setup = () => {
    const callService = vi.fn().mockResolvedValue(null);
    return { callService, client: { callService } as unknown as HassClient };
  };
  it("jas se omezí na 1–100 % a zaokrouhlí", async () => {
    const { callService, client } = setup();
    await setLightPercent(client, "light.led", 0);
    await setLightPercent(client, "light.led", 55.4);
    await setLightPercent(client, "light.led", 250);
    expect(callService).toHaveBeenNthCalledWith(1, "light", "turn_on", { brightness_pct: 1 }, { entity_id: "light.led" });
    expect(callService).toHaveBeenNthCalledWith(2, "light", "turn_on", { brightness_pct: 55 }, { entity_id: "light.led" });
    expect(callService).toHaveBeenNthCalledWith(3, "light", "turn_on", { brightness_pct: 100 }, { entity_id: "light.led" });
  });
  it("barva pošle hs_color s odstínem v rozsahu 0–359", async () => {
    const { callService, client } = setup();
    await setLightColor(client, "light.led", 360, 120);
    expect(callService).toHaveBeenCalledWith("light", "turn_on", { hs_color: [0, 100] }, { entity_id: "light.led" });
  });
  it("teplota bílé a efekt", async () => {
    const { callService, client } = setup();
    await setLightKelvin(client, "light.led", 2699.6);
    await setLightEffect(client, "light.led", "colorloop");
    expect(callService).toHaveBeenNthCalledWith(1, "light", "turn_on", { color_temp_kelvin: 2700 }, { entity_id: "light.led" });
    expect(callService).toHaveBeenNthCalledWith(2, "light", "turn_on", { effect: "colorloop" }, { entity_id: "light.led" });
  });
});

describe("toggleLight", () => {
  it("přepne jen jednu entitu podle jejího stavu", async () => {
    const callService = vi.fn().mockResolvedValue(null);
    const client = { callService } as unknown as HassClient;
    await toggleLight(client, "light.a", entities);
    await toggleLight(client, "light.b", entities);
    expect(callService).toHaveBeenNthCalledWith(1, "homeassistant", "turn_off", {}, { entity_id: "light.a" });
    expect(callService).toHaveBeenNthCalledWith(2, "homeassistant", "turn_on", {}, { entity_id: "light.b" });
  });
});
