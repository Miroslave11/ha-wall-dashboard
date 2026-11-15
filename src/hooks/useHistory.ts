import { useEffect, useState } from "react";
import { useHass } from "../ha/HassContext";
import type { HistoryPoint } from "../ha/types";

/** Historie číselných entit pro grafy; obnovuje se každých `refreshMin` minut. */
export function useHistory(entityIds: string[], hours: number, refreshMin = 10) {
  const { client } = useHass();
  const [data, setData] = useState<Record<string, HistoryPoint[]>>({});
  const key = entityIds.join(",");

  useEffect(() => {
    if (!client || !key) return;
    let cancelled = false;
    const load = () =>
      client
        .fetchHistory(key.split(","), hours)
        .then((d) => !cancelled && setData(d))
        .catch((e) => console.warn("Historie se nenačetla", e));
    load();
    const id = window.setInterval(load, refreshMin * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, key, hours, refreshMin]);

  return data;
}
