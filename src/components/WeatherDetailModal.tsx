import { useEffect, useState } from "react";
import { useConfig, useEntity } from "../ha/HassContext";
import { useForecast } from "../hooks/useForecast";
import { formatNumber, shortWeekday } from "../utils/format";
import { rangeBar, tempRange, weatherIconColor, weatherInfo } from "../utils/weather";
import { Icon } from "./Icon";

type Mode = "daily" | "hourly";

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "daily", label: "Po dnech" },
  { id: "hourly", label: "Po hodinách" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function dayName(d: Date, i: number): string {
  if (i === 0) return "Dnes";
  if (i === 1) return "Zítra";
  const s = d.toLocaleDateString("cs-CZ", { weekday: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rain(mm: number | undefined, prob: number | undefined, unit: string): string {
  const parts: string[] = [];
  if (typeof mm === "number") parts.push(`${formatNumber(mm)} ${unit}`);
  if (typeof prob === "number") parts.push(`${formatNumber(prob, 0)} %`);
  return parts.join(" · ") || "–";
}

/** Detailní předpověď počasí: aktuální stav, předpověď po dnech a po hodinách. */
export function WeatherDetailModal({ onClose }: { onClose: () => void }) {
  const { weather } = useConfig();
  const entity = useEntity(weather?.entity);
  const [mode, setMode] = useState<Mode>("daily");
  const daily = useForecast(weather?.entity, "daily");
  // hodinová předpověď se odebírá až po otevření detailu (a ne každá weather entita ji umí)
  const hourly = useForecast(weather?.entity, "hourly");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!weather) return null;

  const attrs = entity?.attributes ?? {};
  const now = weatherInfo(entity?.state);
  const rainUnit = String(attrs.precipitation_unit ?? "mm");
  const range = tempRange(daily);
  const facts: Array<{ label: string; value: string }> = [];
  if (typeof attrs.humidity === "number")
    facts.push({
      label: "Vlhkost",
      value: `${formatNumber(attrs.humidity, 0)} %`,
    });
  if (typeof attrs.wind_speed === "number")
    facts.push({
      label: "Vítr",
      value: `${formatNumber(attrs.wind_speed)} ${String(attrs.wind_speed_unit ?? "km/h")}`,
    });
  if (typeof attrs.pressure === "number")
    facts.push({
      label: "Tlak",
      value: `${formatNumber(attrs.pressure, 0)} ${String(attrs.pressure_unit ?? "hPa")}`,
    });
  if (typeof attrs.visibility === "number")
    facts.push({
      label: "Dohlednost",
      value: `${formatNumber(attrs.visibility)} ${String(attrs.visibility_unit ?? "km")}`,
    });
  if (typeof attrs.uv_index === "number") facts.push({ label: "UV index", value: formatNumber(attrs.uv_index) });

  return (
    <div className="chart-backdrop" role="dialog" aria-modal="true" aria-label="Detailní předpověď počasí" onClick={onClose}>
      <div className="chart-modal wx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-head">
          <span className="weather-icon" style={{ color: weatherIconColor(now.icon) }}>
            <Icon name={now.icon} size={30} />
          </span>
          <div className="wx-now">
            <h2 className="chart-title">{now.label}</h2>
            <span className="wx-sub">{weather.title ?? "Počasí"}</span>
          </div>
          <b className="wx-temp">{formatNumber(attrs.temperature as number | undefined)} °C</b>
          <div className="tabs" role="tablist" aria-label="Druh předpovědi">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={`tab${mode === m.id ? " tab--active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Zavřít">
            <Icon name="close" size={20} />
          </button>
        </div>

        {facts.length > 0 && (
          <dl
            className="chart-stats wx-facts"
            style={{
              gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))`,
            }}
          >
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {mode === "daily" ? (
          daily.length ? (
            <>
              <div className="wx-day wx-head" aria-hidden="true">
                <span>Den</span>
                <span>Počasí</span>
                <span>Srážky</span>
                <span className="wx-day-low">Min</span>
                <span>Teplotní rozpětí dne</span>
                <span>Max</span>
              </div>
              <ul className="wx-days">
                {daily.slice(0, 10).map((d, i) => {
                  const info = weatherInfo(d.condition);
                  const date = new Date(d.datetime);
                  const bar = range ? rangeBar(d, range) : null;
                  return (
                    <li key={d.datetime} className="wx-day">
                      <span className="wx-day-name">
                        <b>{dayName(date, i)}</b>
                        <small>
                          {date.toLocaleDateString("cs-CZ", {
                            day: "numeric",
                            month: "numeric",
                          })}
                        </small>
                      </span>
                      <span className="wx-day-cond">
                        <Icon name={info.icon} size={24} style={{ color: weatherIconColor(info.icon) }} />
                        {info.label}
                      </span>
                      <span className="wx-day-rain">{rain(d.precipitation, d.precipitation_probability, rainUnit)}</span>
                      <span className="wx-day-low">{formatNumber(d.templow)}°</span>
                      <span className="wx-bar" aria-hidden="true">
                        {bar && (
                          <span
                            className="wx-bar-fill"
                            style={{
                              left: `${bar.left}%`,
                              width: `${bar.width}%`,
                            }}
                          />
                        )}
                      </span>
                      <b className="wx-day-high">{formatNumber(d.temperature)}°</b>
                    </li>
                  );
                })}
              </ul>
              <p className="wx-legend">
                <b>Srážky</b>: úhrn ({rainUnit}) · pravděpodobnost (%). <b>Min</b> je nejnižší teplota dne (obvykle v noci), <b>Max</b>{" "}
                nejvyšší (přes den). Barevný pruh ukazuje rozpětí teplot daného dne vůči celému zobrazenému období: modrý konec je
                chladnější, oranžový teplejší.
              </p>
            </>
          ) : (
            <p className="chart-empty">Předpověď po dnech zatím není k dispozici.</p>
          )
        ) : hourly.length ? (
          <>
            <ul className="wx-hours">
              {hourly.slice(0, 48).map((h, i) => {
                const info = weatherInfo(h.condition);
                const t = new Date(h.datetime);
                const showDay = i === 0 || t.getHours() === 0;
                return (
                  <li key={h.datetime} className={`wx-hour${showDay ? " wx-hour--day" : ""}`}>
                    <small>{showDay ? shortWeekday(t) : ""}</small>
                    <span className="wx-hour-time">{`${pad(t.getHours())}:00`}</span>
                    <Icon name={info.icon} size={24} label={info.label} style={{ color: weatherIconColor(info.icon) }} />
                    <b>{formatNumber(h.temperature, 0)}°</b>
                    <span className="wx-hour-rain">{rain(h.precipitation, h.precipitation_probability, rainUnit)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="wx-legend">
              Pod každou hodinou je teplota a srážky: úhrn ({rainUnit}) · pravděpodobnost (%). Zvýrazněné sloupce označují začátek nového
              dne.
            </p>
          </>
        ) : (
          <p className="chart-empty">Hodinová předpověď tato weather entita neposkytuje.</p>
        )}
      </div>
    </div>
  );
}
