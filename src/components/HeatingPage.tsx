import { useState } from "react";
import type { HeaterConfig } from "../config/types";
import { useConfig } from "../ha/HassContext";
import { HeaterCard } from "./HeaterCard";
import { HeaterScheduleModal } from "./HeaterScheduleModal";

/** Stránka Topení: karta s kruhovým ovladačem pro každou hlavici z `heating` v configu. */
export function HeatingPage() {
  const { heating } = useConfig();
  const [plan, setPlan] = useState<HeaterConfig | null>(null);
  const heaters = heating ?? [];

  return (
    <section className="page glass heating-page" aria-label="Topení">
      <h1 className="card-title">Topení</h1>
      {heaters.length === 0 ? (
        <p>Žádné hlavice. Přidejte je do configu v části „heating“ (viz docs/KONFIGURACE.md).</p>
      ) : (
        <div className="heating-grid">
          {heaters.map((h) => (
            <HeaterCard key={h.entity} heater={h} onSchedule={setPlan} />
          ))}
        </div>
      )}
      {plan && <HeaterScheduleModal heater={plan} onClose={() => setPlan(null)} />}
    </section>
  );
}
