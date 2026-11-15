import { useConfig, useEntity } from "../ha/HassContext";
import { useForecast } from "../hooks/useForecast";
import { formatNumber, shortWeekday } from "../utils/format";
import { weatherIconColor, weatherInfo } from "../utils/weather";
import { Icon } from "./Icon";

export function WeatherCard({ onOpen }: { onOpen: () => void }) {
  const { weather } = useConfig();
  const entity = useEntity(weather?.entity);
  const forecast = useForecast(weather?.entity);
  if (!weather) return null;

  const now = weatherInfo(entity?.state);
  const today = forecast[0];
  const days = forecast.slice(0, 5);

  return (
    <button type="button" className="weather glass" onClick={onOpen} aria-label="Počasí, zobrazit detailní předpověď">
      <div className="weather-now">
        <div className="weather-cond">
          <span className="weather-icon" style={{ color: weatherIconColor(now.icon) }}>
            <Icon name={now.icon} size={30} />
          </span>
          <div>
            <h2 className="card-title">{now.label}</h2>
            <div className="weather-sub">{weather.title ?? "Počasí"}</div>
          </div>
        </div>
        <div className="weather-temp">
          <b>{formatNumber(entity?.attributes.temperature as number | undefined)} °C</b>
          {today && (
            <span>
              {formatNumber(today.temperature)}° / {formatNumber(today.templow)}°
            </span>
          )}
        </div>
      </div>
      {days.length > 0 && (
        <div className="forecast">
          {days.map((d, i) => {
            const info = weatherInfo(d.condition);
            return (
              <div key={d.datetime} className={`fc-day${i === 0 ? " fc-day--today" : ""}`}>
                <small>{i === 0 ? "Dnes" : shortWeekday(new Date(d.datetime))}</small>
                <Icon name={info.icon} size={24} label={info.label} style={{ color: weatherIconColor(info.icon) }} />
                <b>{formatNumber(d.temperature)}°</b>
                <span>{formatNumber(d.templow)}°</span>
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
