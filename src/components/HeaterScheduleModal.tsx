import { useEffect, useMemo, useState } from "react";
import type { HeaterConfig } from "../config/types";
import { useHass } from "../ha/HassContext";
import { setHeaterSchedule } from "../ha/actions";
import { formatNumber } from "../utils/format";
import { formatSchedule, minutesToTime, parseSchedule, scheduleSegments, snap, timeToMinutes, validateSchedule, type SchedulePoint } from "../utils/heating";
import { Icon } from "./Icon";

/** Barva úseku podle teploty: studená modrá (≤ 15 °C) → teplá oranžová (≥ 25 °C). */
function tempColor(t: number): string {
  const k = Math.min(1, Math.max(0, (t - 15) / 10));
  return `hsl(${Math.round(210 - 190 * k)} 70% 52%)`;
}

const AXIS = [0, 6, 12, 18, 24];

/**
 * Editor týdenního plánu hlavice (text.* ve tvaru "06:00/22°C 08:00/22°C …"): časová osa dne a řádky s časem a teplotou.
 * Počet bodů zůstává, jaký plán má hlavice (zařízení jich umí pevný počet). Uloží se jedním zápisem celého textu.
 */
export function HeaterScheduleModal({ heater, onClose }: { heater: HeaterConfig; onClose: () => void }) {
  const { client, entities } = useHass();
  const text = heater.schedule ? entities[heater.schedule]?.state : undefined;
  const original = useMemo(() => parseSchedule(text), [text]);
  const a = entities[heater.entity]?.attributes ?? {};
  const min = typeof a.min_temp === "number" ? a.min_temp : 5;
  const max = typeof a.max_temp === "number" ? a.max_temp : 35;
  const step = typeof a.target_temp_step === "number" ? a.target_temp_step : 0.5;

  const [rows, setRows] = useState<SchedulePoint[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // plán se načte do editoru jednou, při otevření (pozdější změna v HA nepřepíše rozdělanou úpravu)
  useEffect(() => {
    if (rows === null && original) setRows(original.map((p) => ({ ...p })));
  }, [original, rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const errors = rows ? validateSchedule(rows, min, max) : [];
  const changed = !!rows && !!original && formatSchedule(rows) !== formatSchedule(original);
  const segments = rows && !errors.length ? scheduleSegments(rows) : [];

  const update = (i: number, patch: Partial<SchedulePoint>) => setRows((r) => r && r.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const shiftTime = (i: number, delta: number) => {
    if (!rows) return;
    const m = timeToMinutes(rows[i].time);
    if (m !== null) update(i, { time: minutesToTime(m + delta) });
  };

  const save = async () => {
    if (!client || !heater.schedule || !rows || errors.length) return;
    setSaving(true);
    setFailed(false);
    try {
      await setHeaterSchedule(client, heater.schedule, formatSchedule(rows));
      onClose();
    } catch (e) {
      console.error("Uložení plánu topení selhalo", e);
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <div className="chart-backdrop" role="dialog" aria-modal="true" aria-label={`Plán topení – ${heater.name}`} onClick={onClose}>
      <div className="chart-modal heater-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <h2 className="chart-title">Plán topení – {heater.name}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>

        {!original || !rows ? (
          <p className="heater-note">{text ? "Plán má neznámý formát, a proto ho tady nejde upravit." : "Plán hlavice není dostupný."}</p>
        ) : (
          <>
            <p className="heater-note">Teplota platí od zadaného času do dalšího řádku. Plán je společný pro všechny dny, pokud je hlavice v týdenním programu „7 dní“.</p>

            <div className="sched-bar" role="img" aria-label="Teploty plánu během dne">
              {segments.map((s) => (
                <span key={s.from} className="sched-seg" style={{ flexGrow: s.to - s.from, background: tempColor(s.temp) }} title={`${minutesToTime(s.from)}–${minutesToTime(s.to % 1440)}: ${formatNumber(s.temp)} °C`}>
                  {s.to - s.from >= 100 ? `${formatNumber(s.temp)}°` : ""}
                </span>
              ))}
            </div>
            <div className="sched-axis" aria-hidden="true">
              {AXIS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>

            <ul className="sched-rows">
              {rows.map((p, i) => (
                <li key={i} className="sched-row">
                  <span className="sched-no">{i + 1}</span>
                  <button type="button" className="icon-btn" onClick={() => shiftTime(i, -15)} aria-label={`Řádek ${i + 1}: o 15 minut dřív`}>
                    <Icon name="minus" size={18} />
                  </button>
                  <input className="input sched-time" type="time" step={60} value={p.time} onChange={(e) => update(i, { time: e.target.value })} aria-label={`Řádek ${i + 1}: čas`} />
                  <button type="button" className="icon-btn" onClick={() => shiftTime(i, 15)} aria-label={`Řádek ${i + 1}: o 15 minut později`}>
                    <Icon name="plus" size={18} />
                  </button>
                  <span className="sched-gap" />
                  <button type="button" className="icon-btn" onClick={() => update(i, { temp: snap(p.temp - step, min, max, step) })} aria-label={`Řádek ${i + 1}: nižší teplota`}>
                    <Icon name="minus" size={18} />
                  </button>
                  <b className="sched-temp">{formatNumber(p.temp)} °C</b>
                  <button type="button" className="icon-btn" onClick={() => update(i, { temp: snap(p.temp + step, min, max, step) })} aria-label={`Řádek ${i + 1}: vyšší teplota`}>
                    <Icon name="plus" size={18} />
                  </button>
                </li>
              ))}
            </ul>

            {errors.length > 0 && (
              <ul className="sched-errors" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {failed && (
              <p className="sched-errors" role="alert">
                Plán se nepodařilo uložit. Zkuste to znovu.
              </p>
            )}

            <div className="sched-actions">
              <button type="button" className="btn-pill" onClick={onClose}>
                Zrušit
              </button>
              <button type="button" className="btn-pill btn-pill--primary" onClick={save} disabled={!changed || errors.length > 0 || saving || !client}>
                {saving ? "Ukládám…" : "Uložit plán"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
