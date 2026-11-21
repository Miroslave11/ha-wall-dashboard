import { useState } from "react";
import { useConfig } from "../ha/HassContext";
import { useHistory } from "../hooks/useHistory";
import { DevicesCard } from "./DevicesCard";
import { FloorplanCard } from "./FloorplanCard";
import { HistoryModal, type HistorySpec } from "./HistoryModal";
import { LightDetailModal, type LightDetailSpec } from "./LightDetailModal";
import { VacuumRoomsModal } from "./VacuumRoomsModal";
import { TempCard } from "./TempCard";
import { WeatherCard } from "./WeatherCard";
import { WeatherDetailModal } from "./WeatherDetailModal";

export function HomePage() {
  const cfg = useConfig();
  /** Otevřený graf historie (teplota / vlhkost) a detail předpovědi – oba překryjí hlavní plochu. */
  const [history, setHistory] = useState<HistorySpec | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [vacuumOpen, setVacuumOpen] = useState(false);
  const [lights, setLights] = useState<LightDetailSpec | null>(null);
  const sparks = useHistory(
    cfg.temperatures.map((t) => t.entity),
    cfg.historyHours,
  );

  return (
    <div className="content-row">
      <FloorplanCard onHistory={setHistory} onLights={setLights} />
      <div className="side-col">
        <WeatherCard onOpen={() => setWeatherOpen(true)} />
        {cfg.temperatures.length > 0 && (
          <div className="temps">
            {cfg.temperatures.slice(0, 2).map((t) => (
              <TempCard
                key={t.entity}
                card={t}
                history={sparks[t.entity]}
                hours={cfg.historyHours}
                onOpen={() => setHistory({ title: t.name, entity: t.entity, kind: "temperature", color: t.color })}
              />
            ))}
          </div>
        )}
        <DevicesCard onOpen={() => setVacuumOpen(true)} />
      </div>
      {history && <HistoryModal spec={history} onClose={() => setHistory(null)} />}
      {weatherOpen && <WeatherDetailModal onClose={() => setWeatherOpen(false)} />}
      {vacuumOpen && <VacuumRoomsModal onClose={() => setVacuumOpen(false)} />}
      {lights && <LightDetailModal spec={lights} onClose={() => setLights(null)} />}
    </div>
  );
}
