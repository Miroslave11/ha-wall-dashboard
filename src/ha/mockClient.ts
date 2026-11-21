import type { HassEntities, HassEntity } from "home-assistant-js-websocket";
import type { DashboardConfig, HeaterConfig } from "../config/types";
import { hsToRgb, isTunable, kelvinToRgb, rgbToHs } from "../utils/lightColor";
import type { HaArea, HaRegistry } from "../utils/registry";
import type { ConnectionStatus, ForecastItem, ForecastType, HassClient, HistoryPoint } from "./types";

/** Prefix v localStorage pro „uživatelská data HA“ v demo režimu. */
const DEMO_USER_DATA = "ha-wall-dashboard:demo-user-data:";

/**
 * Demo klient – simuluje entity podle konfigurace, takže UI jde vyvíjet bez Home Assistantu.
 * Reaguje na stejná volání služeb jako skutečný HA (light.turn_on, vacuum.start, cover.set_cover_position…).
 */

function makeEntity(entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity {
  const now = new Date().toISOString();
  return {
    entity_id,
    state,
    attributes: { friendly_name: entity_id.split(".")[1]?.replace(/_/g, " "), ...attributes },
    last_changed: now,
    last_updated: now,
    context: { id: Math.random().toString(36).slice(2), user_id: null, parent_id: null },
  };
}

/** Ukázkové hodnoty pro entity z demo konfigurace (odpovídají původnímu dashboardu). */
const DEMO_VALUES: Record<string, string> = {
  "sensor.loznice_teplota": "22.9",
  "sensor.loznice_vlhkost": "66.3",
  "sensor.obyvak_teplota": "23.4",
  "sensor.obyvak_vlhkost": "67.2",
  "sensor.pokoj_teplota": "22.7",
  "sensor.pokoj_vlhkost": "70.0",
  "sensor.venku_teplota": "1.7",
};

/** Výchozí stav demo hlavic podle entit; ostatní začnou na 21,5 / 21 °C. */
const DEMO_HEATERS: Record<string, { current: number; target: number; batteryLow?: boolean }> = {
  "climate.topeni_ventil_loznice": { current: 23, target: 23 },
  "climate.topeni_ventil_pracovna": { current: 22.5, target: 22, batteryLow: true },
};
const DEMO_SCHEDULE = "06:00/22°C 08:00/22°C 12:00/22°C 15:30/22°C 19:00/22°C 19:01/19°C";

/** V ložnici svítí na začátku jen jedno stropní světlo a LED pásek – je vidět záře po svítidlech. */
const DEMO_ON_LIGHTS = new Set(["light.loznice", "light.loznice_svetlo_1", "light.loznice_led", "light.obyvak", "light.kuchyn"]);

/** Světla s „led“ v názvu umí v demu barvu a teplotu bílé jako Zigbee2MQTT LED v HA, ostatní jen stmívat. */
const DEMO_COLOR_LIGHT = /led/i;
const DEMO_EFFECTS = ["blink", "breathe", "okay", "channel_change", "finish_effect", "stop_effect", "colorloop", "stop_colorloop"];

/** Trvalé schopnosti světla (`supported_color_modes` …); u switch.* žádné. */
function lightCapabilities(id: string): Record<string, unknown> {
  if (!id.startsWith("light.")) return {};
  if (!DEMO_COLOR_LIGHT.test(id)) return { supported_color_modes: ["brightness"] };
  return { supported_color_modes: ["color_temp", "xy"], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6329, effect_list: DEMO_EFFECTS };
}

/** Barevné atributy světla svítícího teplotou bílé. */
function kelvinAttrs(kelvin: number): Record<string, unknown> {
  const rgb = kelvinToRgb(kelvin);
  return { color_mode: "color_temp", color_temp_kelvin: kelvin, rgb_color: rgb, hs_color: rgbToHs(...rgb) };
}

/** Atributy, které ze služby light.turn_on změní barvu nebo efekt (hs_color, color_temp_kelvin, effect). */
function colorPatch(data: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const hs = data.hs_color as [number, number] | undefined;
  const kelvin = data.color_temp_kelvin as number | undefined;
  if (Array.isArray(hs)) Object.assign(patch, { color_mode: "xy", hs_color: [hs[0], hs[1]], rgb_color: hsToRgb(hs[0], hs[1]), color_temp_kelvin: undefined });
  else if (typeof kelvin === "number") Object.assign(patch, kelvinAttrs(kelvin));
  if (typeof data.effect === "string") patch.effect = /^(stop_|none$)/.test(data.effect) ? null : data.effect;
  return patch;
}

/**
 * Obdélníky místností vysavače pro demo: z místností půdorysu podle `vacuum.roomMap`
 * (1 px půdorysu = 10 mm, mapa otočená o 90° jako u Roborocku).
 */
function demoVacuumBoxes(c: DashboardConfig): Record<string, { x0: number; y0: number; x1: number; y1: number }> {
  const out: Record<string, { x0: number; y0: number; x1: number; y1: number }> = {};
  for (const [num, roomId] of Object.entries(c.vacuum?.roomMap ?? {})) {
    const r = c.floorplan.rooms.find((x) => x.id === roomId);
    if (!r) continue;
    out[num] = { x0: 30000 - (r.y + r.h) * 10, y0: 30000 - (r.x + r.w) * 10, x1: 30000 - r.y * 10, y1: 30000 - r.x * 10 };
  }
  return out;
}

/** Dok v demu: u kraje první místnosti z roomMap. */
function demoDock(boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>): { x: number; y: number } {
  const b = Object.values(boxes)[0];
  return b ? { x: Math.round(b.x0 + 0.1 * (b.x1 - b.x0)), y: Math.round((b.y0 + b.y1) / 2) } : { x: 25500, y: 25500 };
}

/**
 * Obrázek mapy vysavače pro demo (jako image entita extractoru): SVG s místnostmi ve stejném měřítku jako skutečná mapa
 * (200 px na 10 000 jednotek, osa y obrácená), s kalibračními body a obdélníky místností v atributech.
 */
function demoMapImage(boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>): Record<string, unknown> {
  const list = Object.entries(boxes);
  const S = 0.02;
  const M = 400; // okraj v jednotkách vysavače
  const x0 = Math.min(...list.map(([, b]) => b.x0)) - M;
  const y0 = Math.min(...list.map(([, b]) => b.y0)) - M;
  const W = Math.round((Math.max(...list.map(([, b]) => b.x1)) + M - x0) * S);
  const H = Math.round((Math.max(...list.map(([, b]) => b.y1)) + M - y0) * S);
  const px = (x: number) => Math.round((x - x0) * S);
  const py = (y: number) => H - Math.round((y - y0) * S);
  const colors = ["#3b4f7a", "#4a6a5f", "#6b4f6e", "#7a6a3b", "#3b6f7a", "#6e5a4f", "#52527a"];
  const rects = list
    .map(([n, b], i) => {
      const x = px(b.x0) + 1, y = py(b.y1) + 1, w = px(b.x1) - px(b.x0) - 2, h = py(b.y0) - py(b.y1) - 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${colors[i % colors.length]}" stroke="#cfd8ff" stroke-opacity=".5" data-room="${n}"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0c1222"/>${rects}</svg>`;
  const pt = (vx: number, vy: number) => ({ vacuum: { x: vx, y: vy }, map: { x: px(vx), y: py(vy) } });
  return {
    entity_picture: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    calibration_points: [pt(x0, y0), pt(x0 + 10000, y0), pt(x0, y0 + 10000)],
    rooms: Object.fromEntries(list.map(([n, b]) => [n, { ...b, number: Number(n) }])),
  };
}

function asList(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export class MockHassClient implements HassClient {
  readonly isDemo = true;
  readonly hassUrl = "";
  private entities: HassEntities = {};
  private listeners = new Set<(e: HassEntities) => void>();
  private timers: number[] = [];
  private cfg: DashboardConfig;

  constructor(cfg: DashboardConfig) {
    this.cfg = cfg;
    this.seed();
    // pohybová čidla v demu občas "zachytí" pohyb
    this.timers.push(
      window.setInterval(() => {
        for (const r of cfg.floorplan.rooms) {
          if (r.motion && Math.random() < 0.35) this.set(r.motion, this.entities[r.motion]?.state === "on" ? "off" : "on");
        }
      }, 6000),
    );
  }

  private seed() {
    const c = this.cfg;
    const add = (e: HassEntity) => (this.entities[e.entity_id] = e);
    const sensorValue = (id: string, fallback: number) => DEMO_VALUES[id] ?? fallback.toFixed(1);

    for (const r of c.floorplan.rooms) {
      for (const l of r.lights) {
        const on = DEMO_ON_LIGHTS.has(l);
        const caps = lightCapabilities(l);
        add(makeEntity(l, on ? "on" : "off", { ...caps, ...(on ? { brightness: 255, ...(caps.effect_list ? kelvinAttrs(2700) : {}) } : {}) }));
      }
      if (r.temperature) add(makeEntity(r.temperature, sensorValue(r.temperature, 22 + Math.random()), { unit_of_measurement: "°C", device_class: "temperature" }));
      if (r.humidity) add(makeEntity(r.humidity, sensorValue(r.humidity, 55 + Math.random() * 10), { unit_of_measurement: "%", device_class: "humidity" }));
      if (r.motion) add(makeEntity(r.motion, "on", { device_class: "motion" }));
    }
    const pj = c.floorplan.projector;
    if (pj && !this.entities[pj.entity]) add(makeEntity(pj.entity, "off", { friendly_name: pj.name ?? "Domácí kino" }));
    for (const h of c.heating ?? []) this.seedHeater(h);
    for (const t of c.temperatures) {
      if (!this.entities[t.entity]) add(makeEntity(t.entity, sensorValue(t.entity, 21), { unit_of_measurement: "°C" }));
    }
    const h = c.header;
    if (h.sun) add(makeEntity(h.sun, "below_horizon", { next_setting: new Date(Date.now() + 21 * 3600_000).toISOString(), next_rising: new Date(Date.now() + 11.5 * 3600_000).toISOString() }));
    if (h.blindsBattery) add(makeEntity(h.blindsBattery, "unknown", { unit_of_measurement: "%" }));
    if (h.presence) add(makeEntity(h.presence, h.presence.startsWith("zone.") ? "1" : "home"));
    (h.alerts ?? []).forEach((a, i) => add(makeEntity(a, i < 4 ? "on" : "off", { device_class: "window" })));
    if (c.weather) {
      add(
        makeEntity(c.weather.entity, "clear-night", {
          temperature: 1.1,
          temperature_unit: "°C",
          humidity: 88,
          wind_speed: 11.5,
          wind_speed_unit: "km/h",
          pressure: 1018,
          pressure_unit: "hPa",
        }),
      );
    }
    if (c.vacuum) {
      add(makeEntity(c.vacuum.entity, "docked", { battery_level: 100 }));
      this.seedVacuumMap();
    }
    if (c.blinds) add(makeEntity(c.blinds.entity, "open", { current_position: 100 }));
    for (const s of c.scenes) if (s.entity) add(makeEntity(s.entity, new Date().toISOString()));
  }

  /** Krok simulace úklidu (kolikátý bod trasy). */
  private vacStep = 0;
  /** Čísla segmentů, které vysavač zrovna uklízí (app_segment_clean); null = celý byt. */
  private vacSegments: string[] | null = null;

  /**
   * Senzory mapy vysavače jako z Xiaomi Cloud Map Extractoru v3. Mapa vysavače je vůči půdorysu
   * otočená o 90° (jako u Roborocku), obdélníky místností vzniknou z `vacuum.roomMap`.
   */
  private seedVacuumMap() {
    const v = this.cfg.vacuum;
    if (!v?.positionEntity) return;
    const boxes = demoVacuumBoxes(this.cfg);
    const nums = Object.keys(boxes);
    if (v.roomsEntity) {
      const attrs = Object.fromEntries(nums.map((n) => [n, { ...boxes[n], number: Number(n) }]));
      this.entities[v.roomsEntity] = makeEntity(v.roomsEntity, String(nums.length), { ...attrs, unit_of_measurement: "rooms" });
    }
    if (v.mapEntity) this.entities[v.mapEntity] = makeEntity(v.mapEntity, new Date().toISOString(), demoMapImage(boxes));
    const dock = demoDock(boxes);
    this.entities[v.positionEntity] = makeEntity(v.positionEntity, JSON.stringify({ ...dock, a: 0 }), { ...dock, a: 0 });
    if (v.roomEntity && nums[0]) this.entities[v.roomEntity] = makeEntity(v.roomEntity, nums[0]);
    // senzor se v HA obnovuje po několika sekundách – stejně tak v demu
    this.timers.push(window.setInterval(() => this.tickVacuum(boxes), 4000));
  }

  /** Úklid: „cik-cak“ po místnostech v pořadí roomMap; návrat: přímo do doku. */
  private tickVacuum(boxes: Record<string, { x0: number; y0: number; x1: number; y1: number }>) {
    const v = this.cfg.vacuum;
    if (!v?.positionEntity) return;
    const state = this.entities[v.entity]?.state;
    const nums = Object.keys(boxes);
    let pos: { x: number; y: number } | null = null;
    let num: string | undefined;
    if (state === "cleaning" && nums.length && (this.vacSegments?.some((n) => nums.includes(n)) ?? true)) {
      const STEPS = 8;
      const step = this.vacStep++;
      const route = this.vacSegments?.filter((n) => nums.includes(n)) ?? nums;
      num = route[Math.floor(step / STEPS) % route.length];
      const b = boxes[num];
      const t = step % STEPS;
      const row = Math.floor(t / 2);
      const end = (t % 2 === 0) === (row % 2 === 0) ? 0.15 : 0.85;
      pos = { x: b.x0 + ((row + 0.5) / (STEPS / 2)) * (b.x1 - b.x0), y: b.y0 + end * (b.y1 - b.y0) };
    } else if (state === "returning" || state === "docked") {
      this.vacStep = 0;
      pos = demoDock(boxes);
      num = nums[0];
    }
    if (!pos) return;
    const p = { x: Math.round(pos.x), y: Math.round(pos.y), a: 0 };
    this.set(v.positionEntity, JSON.stringify(p), p);
    if (v.roomEntity && num) this.set(v.roomEntity, num);
  }

  /** Hlavice v demu: stavy podle skutečných Zigbee2MQTT hlavic (režimy heat/auto/off, předvolby, plán v textu). */
  private seedHeater(h: HeaterConfig) {
    const demo = DEMO_HEATERS[h.entity] ?? { current: 21.5, target: 21 };
    this.entities[h.entity] = makeEntity(h.entity, "auto", {
      hvac_modes: ["heat", "auto", "off"],
      min_temp: 5,
      max_temp: 35,
      target_temp_step: 0.5,
      preset_modes: ["none", "schedule", "manual", "boost", "complex", "comfort", "eco", "away"],
      preset_mode: "schedule",
      current_temperature: demo.current,
      temperature: demo.target,
      hvac_action: "idle",
      friendly_name: h.name,
    });
    if (h.position) this.entities[h.position] = makeEntity(h.position, "0", { unit_of_measurement: "%" });
    if (h.schedule) this.entities[h.schedule] = makeEntity(h.schedule, DEMO_SCHEDULE, { friendly_name: `${h.name} – plán` });
    if (h.battery) this.entities[h.battery] = makeEntity(h.battery, demo.batteryLow ? "on" : "off", { device_class: "battery" });
    if (h.window) this.entities[h.window] = makeEntity(h.window, "off", { device_class: "window" });
    this.updateHeater(h.entity);
  }

  /** Hlavice topí, když je zapnutá a v místnosti je chladněji, než je cíl; ventil se otevře úměrně rozdílu. */
  private updateHeater(id: string) {
    const h = (this.cfg.heating ?? []).find((x) => x.entity === id);
    const e = this.entities[id];
    if (!h || !e) return;
    const target = Number(e.attributes.temperature);
    const current = Number(e.attributes.current_temperature);
    const heating = e.state !== "off" && target > current;
    this.set(id, e.state, { hvac_action: e.state === "off" ? "off" : heating ? "heating" : "idle" });
    if (h.position) this.set(h.position, heating ? String(Math.min(100, Math.round((target - current) * 60 + 20))) : "0");
  }

  private set(id: string, state: string, attrs?: Record<string, unknown>) {
    const prev = this.entities[id] ?? makeEntity(id, state);
    const now = new Date().toISOString();
    this.entities = {
      ...this.entities,
      [id]: {
        ...prev,
        state,
        attributes: attrs ? { ...prev.attributes, ...attrs } : prev.attributes,
        last_changed: prev.state !== state ? now : prev.last_changed,
        last_updated: now,
      },
    };
    this.emitSoon();
  }

  private pending = false;
  private emitSoon() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      this.listeners.forEach((cb) => cb(this.entities));
    });
  }

  subscribeEntities(cb: (e: HassEntities) => void) {
    this.listeners.add(cb);
    cb(this.entities);
    return () => {
      this.listeners.delete(cb);
    };
  }

  onStatus(cb: (s: ConnectionStatus) => void) {
    cb("connected");
    return () => {};
  }

  private setLight(id: string, on: boolean, brightness?: number, color: Record<string, unknown> = {}) {
    if (!on) {
      // vypnuté světlo v HA nemá jas ani barvu
      return this.set(id, "off", { brightness: undefined, color_mode: undefined, rgb_color: undefined, hs_color: undefined, color_temp_kelvin: undefined, effect: undefined });
    }
    const prev = this.entities[id]?.attributes ?? {};
    // laditelné světlo, které se právě rozsvěcí bez zadané barvy, začne teplou bílou
    const initial = isTunable(this.entities[id]) && !prev.color_mode && !color.color_mode ? kelvinAttrs(2700) : {};
    this.set(id, "on", { brightness: brightness ?? (prev.brightness as number | undefined) ?? 255, ...initial, ...color });
  }

  private animateCover(id: string, target: number) {
    const tick = () => {
      const cur = Number(this.entities[id]?.attributes.current_position ?? 0);
      if (cur === target) {
        this.set(id, target === 0 ? "closed" : "open");
        return;
      }
      const next = cur < target ? Math.min(target, cur + 5) : Math.max(target, cur - 5);
      this.set(id, cur < target ? "opening" : "closing", { current_position: next });
      this.timers.push(window.setTimeout(tick, 150));
    };
    tick();
  }

  async callService(domain: string, service: string, data: Record<string, unknown> = {}, target?: { entity_id?: string | string[] }) {
    const ids = asList(target?.entity_id ?? (data.entity_id as string | string[] | undefined));
    const key = `${domain}.${service}`;
    for (const id of ids) {
      const entityDomain = id.split(".")[0];
      if (["light", "switch"].includes(entityDomain) || domain === "homeassistant") {
        if (service === "turn_on") {
          const pct = data.brightness_pct as number | undefined;
          const b = pct !== undefined ? Math.round((pct / 100) * 255) : (data.brightness as number | undefined);
          this.setLight(id, b !== 0, b, colorPatch(data));
        } else if (service === "turn_off") this.setLight(id, false);
        else if (service === "toggle") this.setLight(id, this.entities[id]?.state !== "on");
        continue;
      }
      switch (key) {
        case "scene.turn_on": {
          const scene = this.cfg.scenes.find((s) => s.entity === id);
          if (scene?.lights) await this.applyLightMap(scene.lights);
          this.set(id, new Date().toISOString());
          break;
        }
        case "climate.set_temperature":
          this.set(id, this.entities[id]?.state ?? "auto", { temperature: Number(data.temperature) });
          this.updateHeater(id);
          break;
        case "climate.set_hvac_mode":
          this.set(id, String(data.hvac_mode));
          this.updateHeater(id);
          break;
        case "climate.set_preset_mode":
          this.set(id, this.entities[id]?.state ?? "auto", { preset_mode: String(data.preset_mode) });
          break;
        case "text.set_value":
          this.set(id, String(data.value ?? ""));
          break;
        case "vacuum.start":
          this.vacSegments = null;
          this.vacStep = 0;
          this.set(id, "cleaning");
          break;
        case "vacuum.send_command":
          if (data.command === "app_segment_clean" && Array.isArray(data.params)) {
            this.vacSegments = data.params.map(String);
            this.vacStep = 0;
            this.set(id, "cleaning");
          }
          break;
        case "vacuum.locate":
          break;
        case "vacuum.pause":
        case "vacuum.stop":
          this.set(id, "idle");
          break;
        case "vacuum.return_to_base":
          this.set(id, "returning");
          this.timers.push(window.setTimeout(() => this.set(id, "docked"), 4000));
          break;
        case "cover.open_cover":
          this.animateCover(id, 100);
          break;
        case "cover.close_cover":
          this.animateCover(id, 0);
          break;
        case "cover.set_cover_position":
          this.animateCover(id, Number(data.position ?? 0));
          break;
        default:
          console.info("[demo] neobsloužená služba", key, id, data);
      }
    }
    return null;
  }

  private async applyLightMap(map: Record<string, number>) {
    for (const [id, b] of Object.entries(map)) {
      this.setLight(id, b > 0, Math.round(b * 255));
    }
  }

  async fetchHistory(entityIds: string[], hours: number): Promise<Record<string, HistoryPoint[]>> {
    const now = Date.now();
    const out: Record<string, HistoryPoint[]> = {};
    for (const id of entityIds) {
      const current = parseFloat(this.entities[id]?.state ?? "20");
      const outdoor = id.includes("venku") || id.includes("outdoor");
      const amp = outdoor ? 3 : 0.8;
      const points: HistoryPoint[] = [];
      for (let i = 0; i <= 48; i++) {
        const t = now - hours * 3600_000 + (i / 48) * hours * 3600_000;
        const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
        const daily = Math.cos(((hour - 15) / 24) * 2 * Math.PI);
        const noise = Math.sin(i * 1.7) * 0.08;
        points.push({ t, v: daily * amp + noise });
      }
      const shift = current - points[points.length - 1].v;
      out[id] = points.map((p) => ({ t: p.t, v: +(p.v + shift).toFixed(2) }));
    }
    return out;
  }

  async subscribeForecast(_entityId: string, cb: (f: ForecastItem[]) => void, type: ForecastType = "daily") {
    if (type === "hourly") {
      const base = new Date();
      base.setMinutes(0, 0, 0);
      const conditions = ["clear-night", "clear-night", "partlycloudy", "cloudy", "rainy", "rainy", "cloudy", "partlycloudy"];
      cb(
        Array.from({ length: 48 }, (_, i) => {
          const t = new Date(base.getTime() + (i + 1) * 3600_000);
          const hour = t.getHours();
          return {
            datetime: t.toISOString(),
            condition: conditions[Math.floor(i / 3) % conditions.length],
            temperature: +(4 + 4 * Math.cos(((hour - 15) / 24) * 2 * Math.PI)).toFixed(1),
            precipitation: i % 8 >= 4 && i % 8 <= 5 ? 0.4 : 0,
            precipitation_probability: i % 8 >= 4 && i % 8 <= 5 ? 60 : 10,
          };
        }),
      );
      return () => {};
    }
    const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();
    cb([
      { datetime: day(0), condition: "clear-night", temperature: 6.5, templow: 0.3, precipitation: 0, precipitation_probability: 5 },
      { datetime: day(1), condition: "clear-night", temperature: 6.8, templow: 0.7, precipitation: 0, precipitation_probability: 10 },
      { datetime: day(2), condition: "rainy", temperature: 8.2, templow: 4.6, precipitation: 3.4, precipitation_probability: 80 },
      { datetime: day(3), condition: "rainy", temperature: 9.3, templow: 3.6, precipitation: 5.1, precipitation_probability: 90 },
      { datetime: day(4), condition: "rainy", temperature: 11.4, templow: 7.6, precipitation: 2.2, precipitation_probability: 70 },
      { datetime: day(5), condition: "cloudy", temperature: 10.1, templow: 6.2, precipitation: 0.3, precipitation_probability: 30 },
      { datetime: day(6), condition: "partlycloudy", temperature: 9.0, templow: 3.8, precipitation: 0, precipitation_probability: 15 },
    ]);
    return () => {};
  }

  /** V demu jsou oblasti = místnosti z konfigurace (id oblasti = room.area, jinak room.id). */
  async fetchRegistry(): Promise<HaRegistry> {
    const areas: HaArea[] = [];
    const entityArea: Record<string, string> = {};
    for (const r of this.cfg.floorplan.rooms) {
      const id = r.area ?? r.id;
      areas.push({ id, name: r.name });
      const ids = [...r.lights, r.temperature, r.humidity, r.motion, ...(r.fixtures ?? []).map((f) => f.entity)];
      for (const e of ids) if (e) entityArea[e] = id;
    }
    return { areas, entityArea, excluded: [] };
  }

  async loadUserData<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(DEMO_USER_DATA + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async saveUserData(key: string, value: unknown): Promise<void> {
    if (value === null || value === undefined) localStorage.removeItem(DEMO_USER_DATA + key);
    else localStorage.setItem(DEMO_USER_DATA + key, JSON.stringify(value));
  }

  close() {
    this.timers.forEach((t) => clearTimeout(t));
    this.listeners.clear();
  }

  async logout() {}
}
