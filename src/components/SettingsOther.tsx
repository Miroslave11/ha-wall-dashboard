import type { UserSettings } from "../config/types";
import { useHass } from "../ha/HassContext";
import type { EntityFilter } from "../utils/entityOptions";
import type { HaRegistry } from "../utils/registry";
import { parseVacuumRooms, suggestVacuumSensors } from "../utils/vacuumMap";
import { EntityField, EntityListField } from "./EntityPicker";
import { Icon } from "./Icon";

const WEATHER: EntityFilter = { domains: ["weather"] };
const TEMP: EntityFilter = { domains: ["sensor"], deviceClasses: ["temperature"] };
const VACUUM: EntityFilter = { domains: ["vacuum"] };
const COVER: EntityFilter = { domains: ["cover"] };
const SENSOR: EntityFilter = { domains: ["sensor"] };
const SCENE: EntityFilter = { domains: ["scene", "script"] };
const SUN: EntityFilter = { domains: ["sun"] };
const PRESENCE: EntityFilter = { domains: ["zone", "person", "group", "binary_sensor"], deviceClasses: ["presence", "occupancy"] };
const BATTERY: EntityFilter = { domains: ["sensor"], deviceClasses: ["battery"] };
const ALERTS: EntityFilter = { domains: ["binary_sensor"], deviceClasses: ["window", "door", "opening", "garage_door", "moisture", "smoke", "gas"] };

interface Props {
  draft: UserSettings;
  update: (fn: (d: UserSettings) => void) => void;
  registry: HaRegistry;
}

/** Nastavení → Ostatní: entity mimo místnosti. */
export function SettingsOther({ draft, update, registry }: Props) {
  return (
    <div className="form-grid">
      <section className="form-section">
        <h2 className="form-section-title">Počasí</h2>
        <EntityField
          label="Předpověď počasí"
          filter={WEATHER}
          registry={registry}
          value={draft.weather?.entity}
          onChange={(v) => update((d) => void (d.weather = v ? { ...d.weather, entity: v } : undefined))}
        />
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Grafy teplot</h2>
        <p className="hint">Na hlavní stránce se zobrazí první dva.</p>
        {draft.temperatures.map((t, i) => (
          <div key={i} className="form-row form-row--item">
            <label className="field">
              <span className="field-label">Název</span>
              <input className="input" type="text" value={t.name} onChange={(e) => update((d) => void (d.temperatures[i].name = e.target.value))} />
            </label>
            <EntityField
              label="Teploměr"
              filter={TEMP}
              registry={registry}
              value={t.entity || undefined}
              onChange={(v) => update((d) => void (d.temperatures[i].entity = v ?? ""))}
            />
            <label className="field field--narrow">
              <span className="field-label">Barva</span>
              <select
                className="input"
                value={t.color ?? "warm"}
                onChange={(e) => update((d) => void (d.temperatures[i].color = e.target.value as "warm" | "accent"))}
              >
                <option value="warm">teplá (uvnitř)</option>
                <option value="accent">modrá (venku)</option>
              </select>
            </label>
            <RemoveButton label={`Odebrat graf ${t.name}`} onClick={() => update((d) => void d.temperatures.splice(i, 1))} />
          </div>
        ))}
        <AddButton label="Přidat graf" onClick={() => update((d) => void d.temperatures.push({ name: "Teplota", entity: "", color: "warm" }))} />
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Vysavač a žaluzie</h2>
        <div className="form-row">
          <EntityField
            label="Robotický vysavač"
            filter={VACUUM}
            registry={registry}
            value={draft.vacuum?.entity}
            onChange={(v) => update((d) => void (d.vacuum = v ? { ...d.vacuum, entity: v } : undefined))}
          />
          <EntityField
            label="Žaluzie"
            filter={COVER}
            registry={registry}
            value={draft.blinds?.entity}
            onChange={(v) => update((d) => void (d.blinds = v ? { ...d.blinds, entity: v } : undefined))}
          />
        </div>
        {draft.vacuum && <VacuumMapSettings draft={draft} update={update} registry={registry} />}
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Scény</h2>
        <p className="hint">Tlačítka pod půdorysem. Funguje scéna (scene.*) i skript (script.*).</p>
        {draft.scenes.map((s, i) => (
          <div key={i} className="form-row form-row--item">
            <label className="field">
              <span className="field-label">Název tlačítka</span>
              <input className="input" type="text" value={s.name} onChange={(e) => update((d) => void (d.scenes[i].name = e.target.value))} />
            </label>
            <EntityField
              label="Scéna"
              filter={SCENE}
              registry={registry}
              value={s.entity}
              onChange={(v) =>
                update((d) => {
                  if (v) d.scenes[i].entity = v;
                  else delete d.scenes[i].entity;
                })
              }
            />
            <RemoveButton label={`Odebrat scénu ${s.name}`} onClick={() => update((d) => void d.scenes.splice(i, 1))} />
          </div>
        ))}
        <AddButton label="Přidat scénu" onClick={() => update((d) => void d.scenes.push({ name: "Nová scéna" }))} />
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Horní lišta</h2>
        <div className="form-row">
          <EntityField
            label="Slunce (východ / západ)"
            filter={SUN}
            registry={registry}
            value={draft.header.sun}
            onChange={(v) => update((d) => void (v ? (d.header.sun = v) : delete d.header.sun))}
          />
          <EntityField
            label="Přítomnost (doma / pryč)"
            filter={PRESENCE}
            registry={registry}
            value={draft.header.presence}
            onChange={(v) => update((d) => void (v ? (d.header.presence = v) : delete d.header.presence))}
          />
        </div>
        <EntityField
          label="Baterie žaluzií"
          filter={BATTERY}
          registry={registry}
          value={draft.header.blindsBattery}
          onChange={(v) => update((d) => void (v ? (d.header.blindsBattery = v) : delete d.header.blindsBattery))}
        />
        <EntityListField
          label="Upozornění (okna, dveře… stav „zapnuto“ = upozornění)"
          filter={ALERTS}
          registry={registry}
          values={draft.header.alerts ?? []}
          onChange={(v) => update((d) => void (d.header.alerts = v))}
        />
      </section>
    </div>
  );
}

type VacuumSensorKey = "positionEntity" | "roomsEntity" | "roomEntity";

/**
 * Skutečná poloha vysavače v půdorysu: senzory z Xiaomi Cloud Map Extractoru v3 a spárování
 * čísel místností vysavače s místnostmi dashboardu.
 */
function VacuumMapSettings({ draft, update, registry }: Props) {
  const { entities } = useHass();
  const vac = draft.vacuum!;
  const vacRooms = parseVacuumRooms(vac.roomsEntity ? entities[vac.roomsEntity] : undefined);
  const nums = Object.keys(vacRooms).sort((a, b) => Number(a) - Number(b));

  // smazání = prázdná hodnota (ne odebrání klíče), aby se volba nevrátila z config souboru (viz mergeVacuum)
  const setSensor = (key: VacuumSensorKey, v: string | undefined) => update((d) => void (d.vacuum && (d.vacuum[key] = v ?? "")));
  const findSensors = () => {
    const s = suggestVacuumSensors(entities);
    update((d) => void (d.vacuum && Object.assign(d.vacuum, s)));
  };
  const setRoom = (num: string, roomId: string) =>
    update((d) => {
      if (!d.vacuum) return;
      const map = { ...(d.vacuum.roomMap ?? {}) };
      if (roomId) map[num] = roomId;
      else delete map[num];
      d.vacuum.roomMap = map;
    });

  return (
    <>
      <h3 className="form-subtitle">Poloha vysavače v půdorysu</h3>
      <p className="hint">
        Senzory z integrace Xiaomi Cloud Map Extractor (v3). Bez nich se během úklidu ukazuje jen animace. Spárujte aspoň 3 místnosti, aby se poznalo otočení
        mapy vysavače.
      </p>
      <div className="form-row">
        <EntityField label="Poloha (…_vacuum_position)" filter={SENSOR} registry={registry} value={vac.positionEntity} onChange={(v) => setSensor("positionEntity", v)} />
        <EntityField label="Místnosti (…_rooms)" filter={SENSOR} registry={registry} value={vac.roomsEntity} onChange={(v) => setSensor("roomsEntity", v)} />
      </div>
      <div className="form-row">
        <EntityField label="Aktuální místnost (…_vacuum_room_id, nepovinné)" filter={SENSOR} registry={registry} value={vac.roomEntity} onChange={(v) => setSensor("roomEntity", v)} />
      </div>
      <button type="button" className="chip-add" onClick={findSensors}>
        <Icon name="vacuum" size={16} /> Najít senzory mapy
      </button>
      {vac.roomsEntity &&
        (nums.length === 0 ? (
          <p className="hint">Senzor místností zatím nemá žádné místnosti (mapa se ještě nestáhla?).</p>
        ) : (
          <div className="form-row form-row--wrap">
            {nums.map((n) => (
              <label key={n} className="field field--narrow">
                <span className="field-label">Místnost vysavače {n}</span>
                <select className="input" value={vac.roomMap?.[n] ?? ""} onChange={(e) => setRoom(n, e.target.value)}>
                  <option value="">– nespárováno –</option>
                  {draft.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}
    </>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="chip-add" onClick={onClick}>
      <Icon name="plus" size={16} /> {label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn icon-btn--field" onClick={onClick} aria-label={label}>
      <Icon name="trash" size={18} />
    </button>
  );
}
