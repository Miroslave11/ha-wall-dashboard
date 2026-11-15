import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RoomConfig } from "../config/types";
import { useEntity, useHass } from "../ha/HassContext";
import { setLightColor, setLightEffect, setLightKelvin, setLightPercent, toggleLight } from "../ha/actions";
import {
  COLOR_PRESETS,
  HUE_GRADIENT,
  WHITE_PRESETS,
  effectLabel,
  hsToRgb,
  kelvinGradient,
  kelvinToRgb,
  lightCaps,
  lightGlowRgb,
  lightHs,
  lightKelvin,
  lightPercent,
  saturationGradient,
} from "../utils/lightColor";
import { formatNumber } from "../utils/format";
import { Icon } from "./Icon";
import { LightSlider } from "./LightSlider";

/** Co se v okně otevře: místnost a případně světlo, které má být vybrané (dlouhý stisk na svítidlo). */
export interface LightDetailSpec {
  room: RoomConfig;
  focus?: string;
}

/** Jak dlouho po úpravě jednoho z posuvníků odstínu / sytosti se pamatuje poslaná dvojice (ms). */
const HS_MEMORY = 1500;

const rgb = (c: readonly [number, number, number]) => `rgb(${c.join(",")})`;

/** Detail světel místnosti: jas, barva, teplota bílé a efekty. Co světlo neumí, se nezobrazí. */
export function LightDetailModal({ spec, onClose }: { spec: LightDetailSpec; onClose: () => void }) {
  const { entities } = useHass();
  const { room } = spec;
  const ids = useMemo(() => room.lights.filter((id) => id.startsWith("light.") && entities[id]), [room.lights, entities]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Výchozí záložka: světlo, na které se dlouze stisklo; jinak první, které umí barvu; jinak první.
  const fallback = spec.focus && ids.includes(spec.focus) ? spec.focus : (ids.find((id) => lightCaps(entities[id]).color || lightCaps(entities[id]).colorTemp) ?? ids[0]);
  const current = selected && ids.includes(selected) ? selected : fallback;

  const nameOf = (id: string) => room.fixtures?.find((f) => f.entity === id)?.name ?? String(entities[id]?.attributes.friendly_name ?? id);

  return (
    <div className="chart-backdrop" role="dialog" aria-modal="true" aria-label={`Světla: ${room.name}`} onClick={onClose}>
      <div className="chart-modal light-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <Icon name="bulb" size={20} strokeWidth={1.8} style={{ color: "var(--light)" }} />
          <h2 className="chart-title">{room.name}</h2>
          {ids.length > 1 && (
            <div className="tabs light-tabs" role="tablist" aria-label="Světla v místnosti">
              {ids.map((id) => {
                const glow = lightGlowRgb(entities[id]);
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={current === id}
                    className={`tab${current === id ? " tab--active" : ""}`}
                    onClick={() => setSelected(id)}
                  >
                    <span
                      className={`light-dot${entities[id]?.state === "on" ? " light-dot--on" : ""}`}
                      style={glow ? ({ "--dot": `rgb(${glow})` } as CSSProperties) : undefined}
                      aria-hidden="true"
                    />
                    {nameOf(id)}
                  </button>
                );
              })}
            </div>
          )}
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>

        {current ? <LightPanel key={current} id={current} name={nameOf(current)} /> : <p className="chart-empty">V této místnosti není žádné světlo, které by šlo ladit.</p>}
      </div>
    </div>
  );
}

function LightPanel({ id, name }: { id: string; name: string }) {
  const { client, entities } = useHass();
  const entity = useEntity(id);
  const caps = lightCaps(entity);
  const on = entity?.state === "on";
  const pct = lightPercent(entity);
  const kelvinNow = lightKelvin(entity);
  const [hue, sat] = lightHs(entity);
  const colorMode = on && entity?.attributes.color_mode !== "color_temp";
  const effect = typeof entity?.attributes.effect === "string" ? entity.attributes.effect : null;

  // Odstín a sytost se posílají společně; dvojice naposledy poslaná z posuvníků má před HA přednost
  // (jinak by druhý posuvník vzal starou hodnotu z entity, která ještě nedorazila).
  const sentHs = useRef<{ hs: [number, number]; timer: number } | null>(null);
  useEffect(() => () => window.clearTimeout(sentHs.current?.timer), []);
  const baseHs = (): [number, number] => sentHs.current?.hs ?? [hue, sat];
  const sendHs = (h: number, s: number) => {
    if (!client) return;
    window.clearTimeout(sentHs.current?.timer);
    sentHs.current = { hs: [h, s], timer: window.setTimeout(() => (sentHs.current = null), HS_MEMORY) };
    setLightColor(client, id, h, s).catch((e) => console.error("Změna barvy selhala", e));
  };
  const run = (p: Promise<unknown> | undefined, what: string) => p?.catch((e) => console.error(`${what} selhalo`, e));

  const kelvinRange = caps.colorTemp;
  const clampK = (k: number) => (kelvinRange ? Math.min(kelvinRange.max, Math.max(kelvinRange.min, k)) : k);

  // celý panel (výplň posuvníku jasu, vypínač) přebírá aktuální barvu světla
  const glow = lightGlowRgb(entity);

  return (
    <div className="light-body" style={glow ? ({ "--light-rgb": glow } as CSSProperties) : undefined}>
      <div className="light-row">
        <button
          type="button"
          className={`light-power${on ? " light-power--on" : ""}`}
          style={on ? ({ "--power": `rgb(${glow ?? "255,180,92"})` } as CSSProperties) : undefined}
          aria-pressed={on}
          aria-label={`${name}: ${on ? "vypnout" : "zapnout"}`}
          onClick={() => client && run(toggleLight(client, id, entities), "Přepnutí světla")}
        >
          <Icon name="power" size={24} strokeWidth={1.8} />
        </button>
        <div className="light-main">
          <div className="light-label">
            <span>{name}</span>
            <b>{on ? `${formatNumber(pct, 0)} %` : "Vypnuto"}</b>
          </div>
          {caps.dimmable ? (
            <LightSlider
              label={`Jas: ${name}`}
              value={pct}
              min={1}
              max={100}
              format={(v) => `${formatNumber(v, 0)} %`}
              hideValue
              onCommit={(v) => client && run(setLightPercent(client, id, v), "Změna jasu")}
              disabled={!client}
            />
          ) : (
            <p className="light-note">Toto světlo se dá jen zapnout a vypnout.</p>
          )}
        </div>
      </div>

      {(caps.color || kelvinRange) && (
        <section className="light-section" aria-label="Barva">
          <h3>Barva</h3>
          <div className="swatches" role="group" aria-label="Rychlé barvy">
            {kelvinRange &&
              WHITE_PRESETS.map((w) => {
                const k = clampK(w.kelvin);
                const active = kelvinNow !== null && Math.abs(kelvinNow - k) < 150;
                return (
                  <Swatch
                    key={w.kelvin}
                    label={`${w.label}, ${k} K`}
                    color={rgb(kelvinToRgb(k))}
                    active={active}
                    onClick={() => client && run(setLightKelvin(client, id, k), "Změna teploty bílé")}
                  />
                );
              })}
            {caps.color &&
              COLOR_PRESETS.map((c) => {
                const active = colorMode && Math.abs(hue - c.hs[0]) < 10 && sat > 55;
                return (
                  <Swatch
                    key={c.label}
                    label={c.label}
                    color={rgb(hsToRgb(c.hs[0], c.hs[1]))}
                    active={active}
                    onClick={() => {
                      sentHs.current = null;
                      sendHs(c.hs[0], c.hs[1]);
                    }}
                  />
                );
              })}
          </div>

          <div className="light-fine">
            {caps.color && (
              <>
                <span className="light-fine-label">Odstín</span>
                <LightSlider
                  label={`Odstín: ${name}`}
                  value={Math.round(hue)}
                  min={0}
                  max={359}
                  track={HUE_GRADIENT}
                  format={(v) => `${v}°`}
                  // při tažení odstínu bez barvy (bílá, malá sytost) se sytost zvedne, jinak by tažení nebylo vidět
                  onCommit={(h) => sendHs(h, baseHs()[1] < 20 ? 100 : baseHs()[1])}
                  disabled={!client}
                />
                <span className="light-fine-label">Sytost</span>
                <LightSlider
                  label={`Sytost: ${name}`}
                  value={Math.round(sat)}
                  min={0}
                  max={100}
                  track={saturationGradient(baseHs()[0])}
                  format={(v) => `${v} %`}
                  onCommit={(s) => sendHs(baseHs()[0], s)}
                  disabled={!client}
                />
              </>
            )}
            {kelvinRange && (
              <>
                <span className="light-fine-label">Teplota bílé</span>
                <LightSlider
                  label={`Teplota bílé: ${name}`}
                  value={kelvinNow ?? clampK(2700)}
                  min={kelvinRange.min}
                  max={kelvinRange.max}
                  step={50}
                  track={kelvinGradient(kelvinRange.min, kelvinRange.max)}
                  format={(v) => `${formatNumber(v, 0)} K`}
                  onCommit={(k) => client && run(setLightKelvin(client, id, k), "Změna teploty bílé")}
                  disabled={!client}
                />
              </>
            )}
          </div>
        </section>
      )}

      {caps.effects.length > 0 && (
        <section className="light-section" aria-label="Efekty">
          <h3>Efekty</h3>
          <div className="fx-list" role="group" aria-label="Efekty světla">
            {caps.effects.map((fx) => (
              <button
                key={fx}
                type="button"
                className={`fx${effect === fx ? " fx--active" : ""}`}
                aria-pressed={effect === fx}
                onClick={() => client && run(setLightEffect(client, id, fx), "Spuštění efektu")}
              >
                {effectLabel(fx)}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Swatch({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`swatch${active ? " swatch--active" : ""}`} aria-label={label} title={label} aria-pressed={active} onClick={onClick}>
      <span className="swatch-dot" style={{ background: color }} />
    </button>
  );
}
