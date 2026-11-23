import type { WebcamConfig } from "../config/types";
import { isValidPlace } from "./placeWeather";

/** Výchozí a nejkratší interval obnovy snímku webkamery (s). */
export const WEBCAM_REFRESH_DEFAULT = 60;
export const WEBCAM_REFRESH_MIN = 10;

const YT_ID_RE = /^[\w-]{11}$/;

/**
 * ID videa na YouTube z ID nebo odkazu (watch?v=, youtu.be/, /live/, /embed/, /shorts/).
 * Vrací null, když z vloženého textu ID nevyčteme.
 */
export function youtubeId(input: string): string | null {
  const text = input.trim();
  if (YT_ID_RE.test(text)) return text;
  try {
    const u = new URL(text);
    const host = u.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{11})/)?.[1] ?? null;
    }
    return id && YT_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Interval obnovy snímku v sekundách (nejméně WEBCAM_REFRESH_MIN). */
export function refreshSeconds(cam: WebcamConfig): number {
  const v = cam.refreshSec;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(WEBCAM_REFRESH_MIN, v) : WEBCAM_REFRESH_DEFAULT;
}

/** Přidá k adrese parametr, který obejde cache prohlížeče (snímek je pokaždé jiný). */
export function cacheBust(url: string, stamp: number): string {
  const hash = url.indexOf("#");
  const base = hash >= 0 ? url.slice(0, hash) : url;
  const tail = hash >= 0 ? url.slice(hash) : "";
  return `${base}${base.includes("?") ? "&" : "?"}_=${stamp}${tail}`;
}

/**
 * Adresy snímku kamery v pořadí, jak je zkoušet. U „image“ je to jedna adresa, u YouTube náhled
 * živého přenosu (ten YouTube sám obnovuje; dokumentovaný není, proto druhá, menší varianta jako záloha).
 */
export function webcamSnapshotUrls(cam: WebcamConfig, stamp: number): string[] {
  if (cam.type === "youtube") {
    const id = youtubeId(cam.url);
    if (!id) return [];
    return [`https://i.ytimg.com/vi/${id}/maxresdefault_live.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`].map((u) => cacheBust(u, stamp));
  }
  return cam.url ? [cacheBust(cam.url, stamp)] : [];
}

/** Adresa přehrávače YouTube pro vložení (bez zvuku, spustí se sám). */
export function webcamEmbedUrl(cam: WebcamConfig): string | null {
  if (cam.type !== "youtube") return null;
  const id = youtubeId(cam.url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1` : null;
}

/** Skupiny kamer v pořadí, v jakém se poprvé objeví (kamery bez skupiny se neřadí nikam). */
export function webcamGroups(cams: WebcamConfig[]): string[] {
  const out: string[] = [];
  for (const c of cams) {
    const g = c.group?.trim();
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

/** Za jak dlouho po západu slunce se u nás doma považuje za noc (min). */
export const NIGHT_AFTER_SUNSET_MIN = 30;

/**
 * Je u nás „noc“: slunce je pod obzorem a od západu uplynulo aspoň `NIGHT_AFTER_SUNSET_MIN` minut.
 * Poslední západ se odvodí z `next_setting` − 24 h (rozdíl mezi dny jsou jednotky minut). Bez entity → false.
 */
export function isNightAfterSunset(sun: { state: string; attributes?: Record<string, unknown> } | undefined, nowMs: number): boolean {
  if (!sun || sun.state !== "below_horizon") return false;
  const next = Date.parse(String(sun.attributes?.next_setting ?? ""));
  if (!Number.isFinite(next)) return true; // bez času západu věříme stavu slunce
  return nowMs >= next - 24 * 3600_000 + NIGHT_AFTER_SUNSET_MIN * 60_000;
}

/**
 * Kamery vybrané pro fotorámeček: ty, které nejsou vypnuté (`inFrame: false`) a mají použitelný snímek.
 * S `skipEurope` (v noci) se vynechají kamery z Evropy (`region` jiný než "other").
 */
export function frameWebcams(cams: WebcamConfig[] | undefined, opts: { skipEurope?: boolean } = {}): WebcamConfig[] {
  return (cams ?? []).filter((c) => c.inFrame !== false && !(opts.skipEurope && c.region !== "other") && webcamSnapshotUrls(c, 0).length > 0);
}

/** Je adresa snímku v pořádku? Absolutní http(s) nebo cesta v rámci dashboardu (začíná "/"). */
export function isWebcamUrl(url: string): boolean {
  return /^https?:\/\/\S+$/.test(url) || /^\/\S+$/.test(url);
}

/** Kontrola webkamer v konfiguraci – seznam chyb (prázdný = OK). */
export function validateWebcams(cams: WebcamConfig[] | undefined): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of cams ?? []) {
    const label = c.name?.trim() || c.id || "?";
    if (!c.id) errors.push(`Webkamera ${label}: chybí id`);
    else if (ids.has(c.id)) errors.push(`Duplicitní id webkamery: ${c.id}`);
    ids.add(c.id);
    if (!c.name?.trim()) errors.push(`Webkamera ${c.id}: chybí název`);
    if (c.type !== "image" && c.type !== "youtube") errors.push(`Webkamera ${label}: typ musí být "image" nebo "youtube"`);
    else if (c.type === "youtube" && !youtubeId(c.url ?? "")) errors.push(`Webkamera ${label}: nerozpoznal jsem ID videa na YouTube`);
    else if (c.type === "image" && !isWebcamUrl(c.url ?? "")) errors.push(`Webkamera ${label}: adresa snímku musí začínat http://, https:// nebo /`);
    if (c.place !== undefined && !isValidPlace(c.place)) {
      errors.push(`Webkamera ${label}: místo musí mít zeměpisnou šířku −90 až 90 a délku −180 až 180`);
    }
    if (c.refreshSec !== undefined && !(typeof c.refreshSec === "number" && c.refreshSec >= WEBCAM_REFRESH_MIN)) {
      errors.push(`Webkamera ${label}: obnova musí být alespoň ${WEBCAM_REFRESH_MIN} s`);
    }
  }
  return errors;
}
