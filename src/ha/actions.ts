import type { HassEntities } from "home-assistant-js-websocket";
import type { RoomConfig, SceneConfig } from "../config/types";
import type { HassClient } from "./types";

/** Jas místnosti 0–1: nejvyšší jas ze všech jejích světel (switch = 1). */
/** Jas jednoho světla 0–1 (0 = nesvítí; switch bez jasu = 1). */
export function lightBrightness(id: string, entities: HassEntities): number {
  const e = entities[id];
  if (!e || e.state !== "on") return 0;
  const b = e.attributes.brightness;
  return typeof b === "number" ? b / 255 : 1;
}

export function roomBrightness(room: RoomConfig, entities: HassEntities): number {
  let max = 0;
  for (const id of room.lights) max = Math.max(max, lightBrightness(id, entities));
  return max;
}

/** Klepnutí na svítidlo v půdorysu: přepne jen tuto jednu entitu. */
export function toggleLight(client: HassClient, id: string, entities: HassEntities) {
  const on = entities[id]?.state === "on";
  return client.callService("homeassistant", on ? "turn_off" : "turn_on", {}, { entity_id: id });
}

/** Jas jednoho světla v procentech (1–100). Zapne ho, pokud nesvítí. */
export function setLightPercent(client: HassClient, id: string, pct: number) {
  const p = Math.min(100, Math.max(1, Math.round(pct)));
  return client.callService("light", "turn_on", { brightness_pct: p }, { entity_id: id });
}

/** Barva světla: odstín 0–360 a sytost 0–100 (HA si ji převede na xy / rgb podle možností světla). */
export function setLightColor(client: HassClient, id: string, hue: number, saturation: number) {
  const hs_color = [Math.round(((hue % 360) + 360) % 360), Math.min(100, Math.max(0, Math.round(saturation)))];
  return client.callService("light", "turn_on", { hs_color }, { entity_id: id });
}

/** Teplota bílé v kelvinech. */
export function setLightKelvin(client: HassClient, id: string, kelvin: number) {
  return client.callService("light", "turn_on", { color_temp_kelvin: Math.round(kelvin) }, { entity_id: id });
}

/** Efekt světla (z `effect_list`). */
export function setLightEffect(client: HassClient, id: string, effect: string) {
  return client.callService("light", "turn_on", { effect }, { entity_id: id });
}

/** Klepnutí na místnost: když něco svítí → zhasnout vše, jinak rozsvítit vše. */
export function toggleRoom(client: HassClient, room: RoomConfig, entities: HassEntities) {
  if (!room.lights.length) return Promise.resolve();
  const anyOn = room.lights.some((id) => entities[id]?.state === "on");
  return client.callService("homeassistant", anyOn ? "turn_off" : "turn_on", {}, { entity_id: room.lights });
}

export function allLightsOff(client: HassClient, rooms: RoomConfig[]) {
  const ids = rooms.flatMap((r) => r.lights);
  if (!ids.length) return Promise.resolve();
  return client.callService("homeassistant", "turn_off", {}, { entity_id: ids });
}

export async function activateScene(client: HassClient, scene: SceneConfig) {
  if (scene.entity) {
    // scene.* i script.* se spouští službou <doména>.turn_on
    const domain = scene.entity.startsWith("script.") ? "script" : "scene";
    await client.callService(domain, "turn_on", {}, { entity_id: scene.entity });
    return;
  }
  for (const [id, b] of Object.entries(scene.lights ?? {})) {
    if (b <= 0) await client.callService("homeassistant", "turn_off", {}, { entity_id: id });
    else if (id.startsWith("light.")) await client.callService("light", "turn_on", { brightness_pct: Math.round(b * 100) }, { entity_id: id });
    else await client.callService("homeassistant", "turn_on", {}, { entity_id: id });
  }
}

export function vacuumToggle(client: HassClient, entityId: string, state: string | undefined) {
  const busy = state === "cleaning" || state === "returning";
  return client.callService("vacuum", busy ? "return_to_base" : "start", {}, { entity_id: entityId });
}

export function setCoverPosition(client: HassClient, entityId: string, position: number) {
  if (position >= 100) return client.callService("cover", "open_cover", {}, { entity_id: entityId });
  if (position <= 0) return client.callService("cover", "close_cover", {}, { entity_id: entityId });
  return client.callService("cover", "set_cover_position", { position }, { entity_id: entityId });
}

/** Cílová teplota hlavice (°C). HA ji zaokrouhlí podle `target_temp_step` hlavice. */
export function setHeaterTemperature(client: HassClient, entityId: string, temperature: number) {
  return client.callService("climate", "set_temperature", { temperature }, { entity_id: entityId });
}

/** Režim hlavice: "off" | "auto" | "heat". */
export function setHeaterMode(client: HassClient, entityId: string, mode: string) {
  return client.callService("climate", "set_hvac_mode", { hvac_mode: mode }, { entity_id: entityId });
}

/** Předvolba hlavice: "schedule", "manual", "boost", "eco", "away"… */
export function setHeaterPreset(client: HassClient, entityId: string, preset: string) {
  return client.callService("climate", "set_preset_mode", { preset_mode: preset }, { entity_id: entityId });
}

/** Zapíše týdenní plán hlavice do její entity `text.*` ("06:00/22°C 08:00/22°C …"). */
export function setHeaterSchedule(client: HassClient, entityId: string, schedule: string) {
  return client.callService("text", "set_value", { value: schedule }, { entity_id: entityId });
}
