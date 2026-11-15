import type { HassEntity } from "home-assistant-js-websocket";

/** Co světlo umí (podle `supported_color_modes`, `effect_list` a rozsahu teploty bílé z HA). */
export interface LightCaps {
  /** Umí stmívat. */
  dimmable: boolean;
  /** Umí libovolnou barvu (hs / xy / rgb / rgbw / rgbww). */
  color: boolean;
  /** Umí teplotu bílé; rozsah v kelvinech. */
  colorTemp: { min: number; max: number } | null;
  effects: string[];
}

const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];
const DEFAULT_KELVIN = { min: 2000, max: 6500 };

export function lightCaps(e: HassEntity | undefined): LightCaps {
  const none: LightCaps = { dimmable: false, color: false, colorTemp: null, effects: [] };
  if (!e || !e.entity_id.startsWith("light.")) return none;
  const modes = Array.isArray(e.attributes.supported_color_modes) ? (e.attributes.supported_color_modes as string[]) : [];
  const min = Number(e.attributes.min_color_temp_kelvin);
  const max = Number(e.attributes.max_color_temp_kelvin);
  return {
    dimmable: modes.some((m) => m !== "onoff"),
    color: modes.some((m) => COLOR_MODES.includes(m)),
    colorTemp: modes.includes("color_temp")
      ? { min: Number.isFinite(min) && min > 0 ? min : DEFAULT_KELVIN.min, max: Number.isFinite(max) && max > 0 ? max : DEFAULT_KELVIN.max }
      : null,
    effects: Array.isArray(e.attributes.effect_list) ? (e.attributes.effect_list as unknown[]).filter((x): x is string => typeof x === "string") : [],
  };
}

/** Světlo, u kterého má smysl ladit barvu (barva nebo teplota bílé). */
export function isTunable(e: HassEntity | undefined): boolean {
  const c = lightCaps(e);
  return c.color || c.colorTemp !== null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Teplota chromatičnosti (K) → přibližná RGB barva (Tanner Helland). */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [Math.round(clamp(r, 0, 255)), Math.round(clamp(g, 0, 255)), Math.round(clamp(b, 0, 255))];
}

/** Odstín 0–360 a sytost 0–100 (jas plný) → RGB. */
export function hsToRgb(h: number, s: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 60;
  const sat = clamp(s, 0, 100) / 100;
  const c = sat;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = 1 - c;
  const [r, g, b] = hue < 1 ? [c, x, 0] : hue < 2 ? [x, c, 0] : hue < 3 ? [0, c, x] : hue < 4 ? [0, x, c] : hue < 5 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** RGB → odstín 0–360 a sytost 0–100. */
export function rgbToHs(r: number, g: number, b: number): [number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return [0, 0];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(((h * 60 + 360) % 360) * 10) / 10, Math.round((d / max) * 1000) / 10];
}

function rgbAttr(e: HassEntity): [number, number, number] | null {
  const rgb = e.attributes.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3 && rgb.slice(0, 3).every((n) => typeof n === "number")) return [rgb[0], rgb[1], rgb[2]];
  const k = e.attributes.color_temp_kelvin;
  if (typeof k === "number" && k > 0) return kelvinToRgb(k);
  return null;
}

/**
 * Barva, kterou světlo právě září, jako "r,g,b" pro `rgba(var(--light-rgb), α)`.
 * Jen u zapnutého světla, které umí barvu nebo teplotu bílé; jinak null (použije se barva motivu).
 */
export function lightGlowRgb(e: HassEntity | undefined): string | null {
  if (!e || e.state !== "on" || !isTunable(e)) return null;
  const rgb = rgbAttr(e);
  return rgb ? rgb.join(",") : null;
}

/** Aktuální odstín a sytost světla (z `hs_color`, jinak z RGB); výchozí teplá bílá. */
export function lightHs(e: HassEntity | undefined): [number, number] {
  const hs = e?.attributes.hs_color;
  if (Array.isArray(hs) && typeof hs[0] === "number" && typeof hs[1] === "number") return [hs[0], hs[1]];
  const rgb = e ? rgbAttr(e) : null;
  return rgb ? rgbToHs(...rgb) : [30, 60];
}

/** Aktuální teplota bílé v K, nebo null, když světlo svítí barvou (nebo nesvítí). */
export function lightKelvin(e: HassEntity | undefined): number | null {
  const k = e?.attributes.color_temp_kelvin;
  return e?.state === "on" && e.attributes.color_mode === "color_temp" && typeof k === "number" ? k : null;
}

/** Jas světla v procentech 0–100 (0 = nesvítí; světlo bez jasu = 100). */
export function lightPercent(e: HassEntity | undefined): number {
  if (!e || e.state !== "on") return 0;
  const b = e.attributes.brightness;
  return typeof b === "number" ? Math.max(1, Math.round((b / 255) * 100)) : 100;
}

/** Přednastavené barvy v panelu světla. */
export const WHITE_PRESETS = [
  { label: "Teplá bílá", kelvin: 2700 },
  { label: "Neutrální bílá", kelvin: 4000 },
  { label: "Studená bílá", kelvin: 6000 },
] as const;

export const COLOR_PRESETS = [
  { label: "Červená", hs: [0, 100] },
  { label: "Oranžová", hs: [28, 100] },
  { label: "Žlutá", hs: [52, 100] },
  { label: "Zelená", hs: [125, 100] },
  { label: "Tyrkysová", hs: [178, 100] },
  { label: "Modrá", hs: [225, 100] },
  { label: "Fialová", hs: [275, 100] },
  { label: "Růžová", hs: [320, 80] },
] as const satisfies readonly { label: string; hs: readonly [number, number] }[];

/** Česká jména efektů z Philips Hue / Zigbee2MQTT; neznámý efekt se ukáže pod svým názvem. */
const EFFECT_LABELS: Record<string, string> = {
  none: "Žádný",
  blink: "Blikat",
  breathe: "Dýchat",
  okay: "Potvrzení",
  channel_change: "Změna kanálu",
  finish_effect: "Dokončit efekt",
  stop_effect: "Zastavit efekt",
  colorloop: "Barevný cyklus",
  stop_colorloop: "Zastavit cyklus",
};

export function effectLabel(effect: string): string {
  return EFFECT_LABELS[effect] ?? effect.replace(/_/g, " ");
}

/** Pozadí posuvníku odstínu: celé barevné kolo. */
export const HUE_GRADIENT = `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `rgb(${hsToRgb(h, 100).join(",")})`).join(", ")})`;

/** Pozadí posuvníku sytosti: od bílé po plnou barvu daného odstínu. */
export function saturationGradient(hue: number): string {
  return `linear-gradient(90deg, #fff, rgb(${hsToRgb(hue, 100).join(",")}))`;
}

/** Pozadí posuvníku teploty bílé: od teplé po studenou. */
export function kelvinGradient(min: number, max: number): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((p) => `rgb(${kelvinToRgb(min + (max - min) * p).join(",")})`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
