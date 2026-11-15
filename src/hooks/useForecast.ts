import { useEffect, useState } from "react";
import { useHass } from "../ha/HassContext";
import type { ForecastItem, ForecastType } from "../ha/types";

/** Předpověď (denní / hodinová) přes WS odběr `weather/subscribe_forecast`. */
export function useForecast(entityId: string | undefined, type: ForecastType = "daily"): ForecastItem[] {
  const { client, status } = useHass();
  const [forecast, setForecast] = useState<ForecastItem[]>([]);

  useEffect(() => {
    if (!client || !entityId || status !== "connected") return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    client
      .subscribeForecast(entityId, (f) => !cancelled && setForecast(f), type)
      .then((u) => (cancelled ? u() : (unsub = u)))
      .catch((e) => console.warn("Předpověď se nenačetla", e));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [client, entityId, status, type]);

  return forecast;
}
