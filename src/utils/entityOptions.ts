import type { HassEntities } from "home-assistant-js-websocket";
import type { RoomConfig } from "../config/types";
import type { HaRegistry } from "./registry";

/** Co výběr entity nabízí (domény, případně device_class) – např. teploměry: sensor + temperature. */
export interface EntityFilter {
  domains: string[];
  /** Upřednostnit (ne vyloučit) entity s těmito device_class. */
  deviceClasses?: string[];
  /** Upřednostnit entity z této oblasti HA. */
  areaId?: string;
}

export interface EntityOption {
  id: string;
  name: string;
  state: string;
  areaId?: string;
  /** Odpovídá preferované oblasti / device_class – zobrazí se nahoře. */
  preferred: boolean;
}

/** Text bez diakritiky a velkých písmen – pro hledání „prac“ = „Pracovna“. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function domainOf(id: string): string {
  return id.split(".")[0] ?? "";
}

/** Seznam entit pro výběr: filtr podle domény a hledaného textu, řazení oblast → device_class → název. */
export function listEntityOptions(entities: HassEntities, registry: HaRegistry, filter: EntityFilter, query = ""): EntityOption[] {
  const q = fold(query.trim());
  const excluded = new Set(registry.excluded);
  const out: Array<EntityOption & { score: number }> = [];

  for (const [id, e] of Object.entries(entities)) {
    if (!filter.domains.includes(domainOf(id))) continue;
    const name = String(e.attributes.friendly_name ?? id);
    if (q && !fold(name).includes(q) && !fold(id).includes(q)) continue;
    // skryté/konfigurační entity nabízíme jen při hledání
    if (!q && excluded.has(id)) continue;

    const areaId = registry.entityArea[id];
    const inArea = !!filter.areaId && areaId === filter.areaId;
    const dc = e.attributes.device_class as string | undefined;
    const classMatch = !!filter.deviceClasses?.length && !!dc && filter.deviceClasses.includes(dc);
    const score = (inArea ? 2 : 0) + (classMatch ? 1 : 0) - (excluded.has(id) ? 4 : 0);
    out.push({ id, name, state: e.state, areaId, preferred: inArea || classMatch, score });
  }

  return out
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "cs"))
    .map(({ score: _score, ...o }) => o);
}

const TEMP = ["temperature"];
const HUMIDITY = ["humidity"];
const MOTION = ["motion", "occupancy", "presence"];

/**
 * Návrh entit místnosti podle oblasti v HA: světla (light.*, když žádná nejsou, tak switch.*),
 * teploměr, vlhkoměr a pohybové čidlo. Vrací jen to, co v oblasti našel.
 */
export function suggestRoomFromArea(
  areaId: string,
  entities: HassEntities,
  registry: HaRegistry,
): Pick<RoomConfig, "lights"> & Partial<Pick<RoomConfig, "temperature" | "humidity" | "motion">> {
  const excluded = new Set(registry.excluded);
  const inArea = Object.keys(entities)
    .filter((id) => registry.entityArea[id] === areaId && !excluded.has(id))
    .sort();
  const dc = (id: string) => entities[id]?.attributes.device_class as string | undefined;
  const pick = (domain: string, classes: string[]) => inArea.find((id) => domainOf(id) === domain && classes.includes(dc(id) ?? ""));

  let lights = inArea.filter((id) => domainOf(id) === "light");
  if (!lights.length) lights = inArea.filter((id) => domainOf(id) === "switch" && dc(id) !== "outlet");

  const out: ReturnType<typeof suggestRoomFromArea> = { lights };
  const temperature = pick("sensor", TEMP);
  const humidity = pick("sensor", HUMIDITY);
  const motion = pick("binary_sensor", MOTION);
  if (temperature) out.temperature = temperature;
  if (humidity) out.humidity = humidity;
  if (motion) out.motion = motion;
  return out;
}

/** ID nové místnosti z názvu ("Dětský pokoj" → "detsky_pokoj"), unikátní vůči existujícím. */
export function uniqueRoomId(name: string, existing: string[]): string {
  const base =
    fold(name)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "mistnost";
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
