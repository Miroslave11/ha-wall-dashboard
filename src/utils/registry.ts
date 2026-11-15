/** Oblasti (areas) a přiřazení entit k nim z registrů Home Assistantu. */

export interface HaArea {
  id: string;
  name: string;
}

export interface HaRegistry {
  areas: HaArea[];
  /** entity_id → area_id (vlastní oblast entity, jinak oblast jejího zařízení). */
  entityArea: Record<string, string>;
  /** Entity, které nemá smysl nabízet: skryté, vypnuté, konfigurační a diagnostické. */
  excluded: string[];
}

export const EMPTY_REGISTRY: HaRegistry = { areas: [], entityArea: {}, excluded: [] };

/** Surové odpovědi WS příkazů config/area_registry/list, config/device_registry/list, config/entity_registry/list. */
export interface RawArea {
  area_id: string;
  name: string;
}
export interface RawDevice {
  id: string;
  area_id?: string | null;
}
export interface RawEntityEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: string | null;
}

export function buildRegistry(areas: RawArea[], devices: RawDevice[], entries: RawEntityEntry[]): HaRegistry {
  const deviceArea = new Map<string, string>();
  for (const d of devices) if (d.area_id) deviceArea.set(d.id, d.area_id);

  const entityArea: Record<string, string> = {};
  const excluded: string[] = [];
  for (const e of entries) {
    const area = e.area_id ?? (e.device_id ? deviceArea.get(e.device_id) : undefined);
    if (area) entityArea[e.entity_id] = area;
    if (e.hidden_by || e.disabled_by || e.entity_category) excluded.push(e.entity_id);
  }
  return {
    areas: areas.map((a) => ({ id: a.area_id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name, "cs")),
    entityArea,
    excluded,
  };
}
