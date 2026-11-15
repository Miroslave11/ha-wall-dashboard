import { useMemo, useState } from "react";
import { useHass } from "../ha/HassContext";
import { listEntityOptions, type EntityFilter } from "../utils/entityOptions";
import type { HaRegistry } from "../utils/registry";
import { Icon } from "./Icon";

/** Kolik položek seznam vykreslí najednou (zbytek se najde hledáním). */
const MAX_ROWS = 150;

interface ModalProps {
  title: string;
  filter: EntityFilter;
  registry: HaRegistry;
  selected: string[];
  multi: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * Výběr entity ze seznamu s hledáním. Překryje stránku Nastavení (rodič musí mít position: relative).
 * Entity z oblasti místnosti a se správnou device_class jsou nahoře.
 */
function EntityPickerModal({ title, filter, registry, selected, multi, onPick, onClose }: ModalProps) {
  const { entities } = useHass();
  const [query, setQuery] = useState("");
  const options = useMemo(() => listEntityOptions(entities, registry, filter, query), [entities, registry, filter, query]);
  const areaName = useMemo(() => new Map(registry.areas.map((a) => [a.id, a.name])), [registry.areas]);

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <h2 className="picker-title">{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>
        <label className="picker-search">
          <Icon name="search" size={18} />
          <input
            className="input"
            type="search"
            placeholder="Hledat podle názvu nebo ID…"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <ul className="picker-list">
          {options.slice(0, MAX_ROWS).map((o) => {
            const on = selected.includes(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={`picker-row${on ? " picker-row--on" : ""}${o.preferred ? " picker-row--preferred" : ""}`}
                  aria-pressed={on}
                  onClick={() => onPick(o.id)}
                >
                  <span className="picker-check" aria-hidden="true">
                    {on && <Icon name="check" size={16} strokeWidth={2.2} />}
                  </span>
                  <span className="picker-text">
                    <span className="picker-name">{o.name}</span>
                    <span className="picker-id">
                      {o.id}
                      {o.areaId && areaName.get(o.areaId) ? ` · ${areaName.get(o.areaId)}` : ""}
                    </span>
                  </span>
                  <span className="picker-state">{o.state}</span>
                </button>
              </li>
            );
          })}
          {!options.length && <li className="picker-empty">Nic nenalezeno.</li>}
          {options.length > MAX_ROWS && <li className="picker-empty">…a dalších {options.length - MAX_ROWS}, upřesněte hledání.</li>}
        </ul>
        {multi && (
          <div className="picker-foot">
            <button className="btn-pill btn-pill--primary" type="button" onClick={onClose}>
              <Icon name="check" size={18} /> Hotovo ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function entityLabel(id: string, name: unknown): string {
  return typeof name === "string" && name ? name : id;
}

interface FieldProps {
  label: string;
  filter: EntityFilter;
  registry: HaRegistry;
}

/** Jedna entita (teploměr, počasí…). */
export function EntityField({ label, filter, registry, value, onChange }: FieldProps & { value?: string; onChange: (v: string | undefined) => void }) {
  const { entities } = useHass();
  const [open, setOpen] = useState(false);
  const e = value ? entities[value] : undefined;

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="entity-value">
        <button type="button" className="entity-btn" onClick={() => setOpen(true)}>
          {value ? (
            <span className="picker-text">
              <span className="picker-name">{entityLabel(value, e?.attributes.friendly_name)}</span>
              <span className={`picker-id${e ? "" : " picker-id--missing"}`}>{e ? value : `${value} – v HA neexistuje`}</span>
            </span>
          ) : (
            <span className="entity-placeholder">Vybrat entitu…</span>
          )}
        </button>
        {value && (
          <button type="button" className="icon-btn" onClick={() => onChange(undefined)} aria-label={`${label}: zrušit výběr`}>
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {open && (
        <EntityPickerModal
          title={label}
          filter={filter}
          registry={registry}
          selected={value ? [value] : []}
          multi={false}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Seznam entit (světla, upozornění…) – štítky s odebráním a tlačítko Přidat. */
export function EntityListField({ label, filter, registry, values, onChange }: FieldProps & { values: string[]; onChange: (v: string[]) => void }) {
  const { entities } = useHass();
  const [open, setOpen] = useState(false);

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chips">
        {values.map((id) => {
          const e = entities[id];
          return (
            <span key={id} className={`chip-entity${e ? "" : " chip-entity--missing"}`} title={id}>
              {entityLabel(id, e?.attributes.friendly_name)}
              <button type="button" className="chip-x" onClick={() => onChange(values.filter((v) => v !== id))} aria-label={`Odebrat ${id}`}>
                <Icon name="close" size={14} strokeWidth={2} />
              </button>
            </span>
          );
        })}
        <button type="button" className="chip-add" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} /> Přidat
        </button>
      </div>
      {open && (
        <EntityPickerModal
          title={label}
          filter={filter}
          registry={registry}
          selected={values}
          multi
          onPick={(id) => onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id])}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
