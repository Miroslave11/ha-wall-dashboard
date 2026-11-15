import type { HeaterConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { setHeaterMode, setHeaterPreset, setHeaterTemperature } from "../ha/actions";
import { formatNumber } from "../utils/format";
import { HVAC_LABELS, HVAC_ORDER, heaterStatus, PRESET_LABELS, visiblePresets } from "../utils/heating";
import { HeaterDial } from "./HeaterDial";
import { Icon } from "./Icon";

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Karta jedné hlavice: kruhový ovladač teploty, ventil, režim, předvolby a plán. */
export function HeaterCard({ heater, onSchedule }: { heater: HeaterConfig; onSchedule: (h: HeaterConfig) => void }) {
  const { client, entities } = useHass();
  const e = entities[heater.entity];
  const a = e?.attributes ?? {};
  const unavailable = !e || e.state === "unavailable" || e.state === "unknown";
  const off = e?.state === "off";
  const heating = !unavailable && !off && a.hvac_action === "heating";

  const modes = HVAC_ORDER.filter((m) => !Array.isArray(a.hvac_modes) || a.hvac_modes.includes(m));
  const presets = visiblePresets(heater.presets, a.preset_modes);
  const position = heater.position ? Number(entities[heater.position]?.state) : NaN;
  const batteryLow = heater.battery ? entities[heater.battery]?.state === "on" : false;
  const windowOpen = heater.window ? entities[heater.window]?.state === "on" : false;
  const run = (p: Promise<unknown> | undefined) => p?.catch((err) => console.error("Ovládání topení selhalo", err));

  return (
    <section className={`heater glass${heating ? " heater--heating" : ""}`} aria-label={`Topení ${heater.name}`}>
      <div className="heater-head">
        <h2 className="heater-name">{heater.name}</h2>
        {windowOpen && <span className="heater-flag heater-flag--warn">Okno otevřeno</span>}
        {batteryLow && (
          <span className="heater-flag heater-flag--warn" title="Hlavici je potřeba vyměnit baterie">
            <Icon name="battery" size={14} /> Slabá baterie
          </span>
        )}
        <span className={`heater-flag${heating ? " heater-flag--heat" : ""}`}>{heaterStatus(e?.state, a.hvac_action)}</span>
      </div>

      <HeaterDial
        label={heater.name}
        target={num(a.temperature)}
        current={num(a.current_temperature)}
        min={num(a.min_temp) ?? 5}
        max={num(a.max_temp) ?? 35}
        step={num(a.target_temp_step) ?? 0.5}
        heating={heating}
        disabled={unavailable || off || !client}
        onCommit={(v) => client && run(setHeaterTemperature(client, heater.entity, v))}
      />

      {heater.position && (
        <div className="heater-valve" role="img" aria-label={Number.isFinite(position) ? `Ventil otevřen na ${formatNumber(position, 0)} %` : "Poloha ventilu neznámá"}>
          <span>Ventil</span>
          <span className="heater-valve-bar">
            <span style={{ width: `${Number.isFinite(position) ? Math.min(100, Math.max(0, position)) : 0}%` }} />
          </span>
          <b>{Number.isFinite(position) ? `${formatNumber(position, 0)} %` : "–"}</b>
        </div>
      )}

      <div className="heater-seg" role="group" aria-label="Režim">
        {modes.map((m) => (
          <button key={m} type="button" className={`heater-seg-btn${e?.state === m ? " heater-seg-btn--active" : ""}`} aria-pressed={e?.state === m} disabled={unavailable || !client} onClick={() => client && run(setHeaterMode(client, heater.entity, m))}>
            {HVAC_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      {presets.length > 0 && (
        <div className="heater-presets" role="group" aria-label="Předvolba">
          {presets.map((p) => (
            <button key={p} type="button" className={`heater-chip${a.preset_mode === p ? " heater-chip--active" : ""}`} aria-pressed={a.preset_mode === p} disabled={unavailable || off || !client} onClick={() => client && run(setHeaterPreset(client, heater.entity, p))}>
              {PRESET_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      {heater.schedule && (
        <button type="button" className="btn-pill heater-plan" onClick={() => onSchedule(heater)} disabled={unavailable}>
          Plán topení
        </button>
      )}
    </section>
  );
}
