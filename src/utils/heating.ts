/** Logika stránky Topení bez závislosti na DOM: týdenní plán hlavice, geometrie ciferníku, české názvy. */

// ---------- Týdenní plán ("06:00/22°C 08:00/22°C …") ----------

export interface SchedulePoint {
  /** "HH:MM" */
  time: string;
  /** cílová teplota od tohoto času (°C) */
  temp: number;
}

const POINT = /^(\d{1,2}):(\d{2})\/(-?\d+(?:[.,]\d+)?)\s*°?C$/i;

const pad = (n: number) => String(n).padStart(2, "0");

/** Čas "HH:MM" → minuty od půlnoci, neplatný čas → null. */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

export function minutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Plán z textové entity hlavice. Neznámý tvar (nebo žádný bod) → null. */
export function parseSchedule(text: string | undefined): SchedulePoint[] | null {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  const out: SchedulePoint[] = [];
  for (const part of parts) {
    const m = POINT.exec(part);
    if (!m) return null;
    const mins = timeToMinutes(`${m[1]}:${m[2]}`);
    if (mins === null) return null;
    out.push({ time: minutesToTime(mins), temp: Number(m[3].replace(",", ".")) });
  }
  return out.length ? out : null;
}

/** Plán zpět na text pro `text.set_value`; teplota bez zbytečných nul ("22", "22.5"). */
export function formatSchedule(points: SchedulePoint[]): string {
  return points.map((p) => `${p.time}/${Number(p.temp.toFixed(1))}°C`).join(" ");
}

/** Chyby plánu před uložením (prázdné pole = v pořádku). Časy musí být platné a přísně rostoucí, teploty v rozsahu hlavice. */
export function validateSchedule(points: SchedulePoint[], min: number, max: number): string[] {
  const errors: string[] = [];
  let prev = -1;
  points.forEach((p, i) => {
    const mins = timeToMinutes(p.time);
    if (mins === null) errors.push(`Řádek ${i + 1}: neplatný čas`);
    else {
      if (mins <= prev) errors.push(`Řádek ${i + 1}: čas musí být pozdější než v předchozím řádku`);
      prev = mins;
    }
    if (!(p.temp >= min && p.temp <= max)) errors.push(`Řádek ${i + 1}: teplota musí být ${min}–${max} °C`);
  });
  return errors;
}

export interface ScheduleSegment {
  /** minuty od půlnoci */
  from: number;
  to: number;
  temp: number;
}

/**
 * Časová osa dne z plánu: každý bod platí od svého času do dalšího, poslední až do půlnoci.
 * Úsek před prvním bodem patří poslednímu bodu z předchozího dne.
 */
export function scheduleSegments(points: SchedulePoint[]): ScheduleSegment[] {
  const pts = points.flatMap((p) => {
    const m = timeToMinutes(p.time);
    return m === null ? [] : [{ m, temp: p.temp }];
  });
  if (!pts.length) return [];
  const out: ScheduleSegment[] = [];
  if (pts[0].m > 0) out.push({ from: 0, to: pts[0].m, temp: pts[pts.length - 1].temp });
  pts.forEach((p, i) => out.push({ from: p.m, to: i + 1 < pts.length ? pts[i + 1].m : 1440, temp: p.temp }));
  return out.filter((s) => s.to > s.from);
}

/** Teplota z plánu v daném čase (minuty od půlnoci). */
export function scheduledTemp(points: SchedulePoint[], minutes: number): number | null {
  const seg = scheduleSegments(points).find((s) => minutes >= s.from && minutes < s.to);
  return seg ? seg.temp : null;
}

// ---------- Ciferník (oblouk 270°) ----------

/** Oblouk začíná vlevo dole (135°) a po směru hodin končí vpravo dole (405° = 45°); dole zůstává mezera 90°. */
export const DIAL_START = 135;
export const DIAL_SWEEP = 270;

/** Zaokrouhlí na krok a drží v rozsahu. */
export function snap(v: number, min: number, max: number, step: number): number {
  const s = Math.round((v - min) / step) * step + min;
  return Math.min(max, Math.max(min, Math.round(s * 100) / 100));
}

/** Podíl 0–1 hodnoty v rozsahu. */
export function fraction(v: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0;
}

/** Bod na kružnici (úhel ve stupních, 0° = doprava, po směru hodin; osa y SVG míří dolů). */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** SVG cesta oblouku od úhlu `from` po `to` (po směru hodin). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)}A${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Hodnota podle místa dotyku vůči středu ciferníku. V mezeře dole se drží blíž ležící konec. */
export function valueFromPoint(dx: number, dy: number, min: number, max: number, step: number): number {
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const rel = (deg - DIAL_START + 360) % 360;
  const f = rel <= DIAL_SWEEP ? rel / DIAL_SWEEP : rel < DIAL_SWEEP + (360 - DIAL_SWEEP) / 2 ? 1 : 0;
  return snap(min + f * (max - min), min, max, step);
}

// ---------- Texty ----------

export const HVAC_LABELS: Record<string, string> = { off: "Vypnuto", auto: "Auto", heat: "Topit", cool: "Chlazení", heat_cool: "Auto", dry: "Sušení", fan_only: "Ventilátor" };
/** Pořadí tlačítek režimu. */
export const HVAC_ORDER = ["off", "auto", "heat"];

export const PRESET_LABELS: Record<string, string> = {
  schedule: "Plán",
  manual: "Ručně",
  boost: "Boost",
  eco: "Eko",
  away: "Pryč",
  comfort: "Komfort",
  complex: "Komplex",
  none: "Žádná",
};
export const DEFAULT_PRESETS = ["schedule", "manual", "boost", "eco", "away"];

/** Předvolby k zobrazení: výběr z configu (nebo výchozí) omezený na to, co hlavice umí; bez znalosti jejích předvoleb všechny. */
export function visiblePresets(wanted: string[] | undefined, available: unknown): string[] {
  const want = wanted && wanted.length ? wanted : DEFAULT_PRESETS;
  if (!Array.isArray(available)) return want;
  return want.filter((p) => available.includes(p));
}

/** Stav hlavice česky: „Topí“, „Netopí“, „Vypnuto“, „Nedostupné“. */
export function heaterStatus(state: string | undefined, action: unknown): string {
  if (!state || state === "unavailable" || state === "unknown") return "Nedostupné";
  if (state === "off") return "Vypnuto";
  return action === "heating" ? "Topí" : "Netopí";
}
