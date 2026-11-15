import { useState } from "react";
import type { LabelPos, RoomConfig, UserSettings } from "../config/types";
import { useHass } from "../ha/HassContext";
import { suggestRoomFromArea, uniqueRoomId, type EntityFilter } from "../utils/entityOptions";
import { czPlural } from "../utils/format";
import { LABEL_POSITIONS } from "../utils/labels";
import type { HaRegistry } from "../utils/registry";
import { EntityField, EntityListField } from "./EntityPicker";
import { Icon } from "./Icon";

const LIGHT_DOMAINS = ["light", "switch"];

interface Props {
  draft: UserSettings;
  update: (fn: (d: UserSettings) => void) => void;
  registry: HaRegistry;
}

/** Nastavení → Místnosti: seznam místností vlevo, editor vybrané vpravo. */
export function SettingsRooms({ draft, update, registry }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(draft.rooms[0]?.id ?? null);
  const index = draft.rooms.findIndex((r) => r.id === selectedId);
  const room = index >= 0 ? draft.rooms[index] : undefined;

  const addRoom = () => {
    const id = uniqueRoomId(
      "Nová místnost",
      draft.rooms.map((r) => r.id),
    );
    update((d) => {
      d.rooms.push({
        id,
        name: "Nová místnost",
        x: 0,
        y: 0,
        w: 120,
        h: 100,
        lights: [],
      });
    });
    setSelectedId(id);
  };

  return (
    <div className="rooms-settings">
      <nav className="room-list" aria-label="Místnosti">
        {draft.rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`room-list-item${r.id === selectedId ? " room-list-item--active" : ""}`}
            aria-current={r.id === selectedId}
            onClick={() => setSelectedId(r.id)}
          >
            <span className="picker-name">{r.name || "(bez názvu)"}</span>
            <span className="picker-id">
              {r.lights.length} {czPlural(r.lights.length, "světlo", "světla", "světel")}
            </span>
          </button>
        ))}
        <button type="button" className="chip-add room-list-add" onClick={addRoom}>
          <Icon name="plus" size={16} /> Přidat místnost
        </button>
      </nav>

      <div className="room-editor">
        {room ? (
          <RoomEditor
            key={room.id}
            room={room}
            registry={registry}
            onChange={(fn) => update((d) => fn(d.rooms[index]))}
            onDelete={() => {
              update((d) => {
                d.rooms.splice(index, 1);
              });
              setSelectedId(draft.rooms[index + 1]?.id ?? draft.rooms[index - 1]?.id ?? null);
            }}
          />
        ) : (
          <p className="hint">Vyberte místnost vlevo, nebo přidejte novou.</p>
        )}
      </div>
    </div>
  );
}

function RoomEditor({
  room,
  registry,
  onChange,
  onDelete,
}: {
  room: RoomConfig;
  registry: HaRegistry;
  onChange: (fn: (r: RoomConfig) => void) => void;
  onDelete: () => void;
}) {
  const { entities } = useHass();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fillMsg, setFillMsg] = useState<string | null>(null);
  const fixtures = room.fixtures ?? [];
  const fixtureIds = fixtures.map((f) => f.entity);
  const otherLights = room.lights.filter((id) => !fixtureIds.includes(id));
  const areaId = room.area;
  const f = (domains: string[], deviceClasses?: string[]): EntityFilter => ({
    domains,
    deviceClasses,
    areaId,
  });

  /** Doplní entity z oblasti HA (jen to, co v oblasti najde; svítidla v půdorysu nechá být). */
  const fillFromArea = () => {
    if (!areaId) return;
    const s = suggestRoomFromArea(areaId, entities, registry);
    const found = s.lights.length + (s.temperature ? 1 : 0) + (s.humidity ? 1 : 0) + (s.motion ? 1 : 0);
    onChange((r) => {
      const keep = r.lights.filter((id) => fixtureIds.includes(id));
      if (s.lights.length) r.lights = [...keep, ...s.lights.filter((id) => !keep.includes(id))];
      if (s.temperature) r.temperature = s.temperature;
      if (s.humidity) r.humidity = s.humidity;
      if (s.motion) r.motion = s.motion;
    });
    setFillMsg(found ? `Doplněno ${found} entit z oblasti.` : "V této oblasti jsem nenašel světla ani čidla.");
  };

  const num = (key: "x" | "y" | "w" | "h", label: string) => (
    <label className="field field--num">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={room[key]}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange((r) => void (r[key] = v));
        }}
      />
    </label>
  );

  return (
    <div className="form-grid">
      <label className="field">
        <span className="field-label">Název</span>
        <input className="input" type="text" value={room.name} onChange={(e) => onChange((r) => void (r.name = e.target.value))} />
      </label>

      <label className="field field--narrow">
        <span className="field-label">Poloha názvu a teploty</span>
        <select
          className="input"
          value={room.labelPos ?? "top-left"}
          onChange={(e) => {
            const v = e.target.value as LabelPos;
            onChange((r) => void (v === "top-left" ? delete r.labelPos : (r.labelPos = v)));
          }}
        >
          {LABEL_POSITIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field field--check">
        <input
          type="checkbox"
          checked={!!room.hideName}
          onChange={(e) => {
            const hide = e.target.checked;
            onChange((r) => void (hide ? (r.hideName = true) : delete r.hideName));
          }}
        />
        <span>Skrýt název místnosti na půdorysu (teplota a vlhkost zůstanou)</span>
      </label>

      <div className="field">
        <span className="field-label">Oblast v Home Assistantu</span>
        <div className="entity-value">
          <select
            className="input"
            value={areaId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange((r) => {
                if (v) r.area = v;
                else delete r.area;
              });
              setFillMsg(null);
            }}
          >
            <option value="">— bez oblasti —</option>
            {registry.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-pill" disabled={!areaId} onClick={fillFromArea}>
            Doplnit z oblasti
          </button>
        </div>
        <span className="hint">{fillMsg ?? "Entity z vybrané oblasti se ve výběru nabízejí jako první."}</span>
      </div>

      {fixtures.map((fx, i) => (
        <div key={i} className="form-row form-row--item">
          <EntityField
            label={`${fx.type === "strip" ? "LED pásek" : "Světlo"} v půdorysu: ${fx.name ?? i + 1}`}
            filter={f(LIGHT_DOMAINS)}
            registry={registry}
            value={fx.entity || undefined}
            onChange={(v) =>
              onChange((r) => {
                const old = r.fixtures![i].entity;
                r.fixtures![i].entity = v ?? "";
                // svítidlo musí být i mezi světly místnosti
                r.lights = r.lights.filter((id) => id !== old);
                if (v && !r.lights.includes(v)) r.lights.unshift(v);
              })
            }
          />
          {(["x", "y"] as const).map((k) => (
            <label key={k} className="field field--num">
              <span className="field-label">{k === "x" ? "Poloha X" : "Poloha Y"}</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={fx[k]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) onChange((r) => void (r.fixtures![i][k] = v));
                }}
              />
            </label>
          ))}
          <button
            type="button"
            className="icon-btn icon-btn--field"
            aria-label={`Odebrat svítidlo ${fx.name ?? i + 1}`}
            onClick={() =>
              onChange((r) => {
                const gone = r.fixtures![i].entity;
                r.fixtures!.splice(i, 1);
                if (!r.fixtures!.length) delete r.fixtures;
                r.lights = r.lights.filter((id) => id !== gone);
              })
            }
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="chip-add"
        onClick={() =>
          onChange((r) => {
            r.fixtures = [
              ...(r.fixtures ?? []),
              // nové svítidlo vznikne uprostřed místnosti; polohu (v souřadnicích půdorysu) lze upravit
              {
                entity: "",
                name: `Světlo ${(r.fixtures?.length ?? 0) + 1}`,
                x: Math.round(r.x + r.w / 2),
                y: Math.round(r.y + r.h / 2),
              },
            ];
          })
        }
      >
        <Icon name="plus" size={16} /> Přidat světlo do půdorysu
      </button>
      {fixtures.length > 0 && (
        <span className="hint">
          Polohu svítidla zadejte v souřadnicích půdorysu (stejných jako X/Y místnosti). Každé svítidlo září a přepíná se samostatně.
        </span>
      )}

      <EntityListField
        label={fixtures.length ? "Další světla (jen se započítají do jasu místnosti)" : "Světla (ikona žárovky v rohu místnosti přepne všechna)"}
        filter={f(LIGHT_DOMAINS)}
        registry={registry}
        values={otherLights}
        onChange={(v) => onChange((r) => void (r.lights = [...r.lights.filter((id) => fixtureIds.includes(id)), ...v]))}
      />

      <div className="form-row">
        <EntityField
          label="Teplota"
          filter={f(["sensor"], ["temperature"])}
          registry={registry}
          value={room.temperature}
          onChange={(v) => onChange((r) => void (v ? (r.temperature = v) : delete r.temperature))}
        />
        <EntityField
          label="Vlhkost"
          filter={f(["sensor"], ["humidity"])}
          registry={registry}
          value={room.humidity}
          onChange={(v) => onChange((r) => void (v ? (r.humidity = v) : delete r.humidity))}
        />
      </div>

      <EntityField
        label="Pohybové čidlo"
        filter={f(["binary_sensor"], ["motion", "occupancy", "presence"])}
        registry={registry}
        value={room.motion}
        onChange={(v) => onChange((r) => void (v ? (r.motion = v) : delete r.motion))}
      />

      <details className="advanced">
        <summary>Poloha v půdorysu (pokročilé)</summary>
        <p className="hint">Souřadnice v ploše půdorysu (výchozí 640 × 460). Místnosti se mají dotýkat, stěny se kreslí samy.</p>
        <div className="form-row form-row--4">
          {num("x", "Vlevo (x)")}
          {num("y", "Nahoře (y)")}
          {num("w", "Šířka")}
          {num("h", "Výška")}
        </div>
      </details>

      <div className="btn-row">
        {confirmDelete ? (
          <>
            <button type="button" className="btn-pill btn-pill--danger" onClick={onDelete}>
              <Icon name="trash" size={18} /> Opravdu smazat „{room.name}“
            </button>
            <button type="button" className="btn-pill" onClick={() => setConfirmDelete(false)}>
              Ponechat
            </button>
          </>
        ) : (
          <button type="button" className="btn-pill" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={18} /> Smazat místnost
          </button>
        )}
      </div>
    </div>
  );
}
