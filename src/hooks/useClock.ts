import { useEffect, useState } from "react";

/** Aktuální čas, aktualizovaný na začátku každé minuty (případně častěji). */
export function useClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNow((prev) => (prev.getMinutes() !== d.getMinutes() || intervalMs < 60000 ? d : prev));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
