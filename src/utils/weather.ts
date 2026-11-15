import type { IconName } from "../components/Icon";

/** Stavy weather entity v HA → český popis a ikona. */
const CONDITIONS: Record<string, { label: string; icon: IconName }> = {
  "clear-night": { label: "Jasná noc", icon: "moon" },
  sunny: { label: "Slunečno", icon: "sun" },
  partlycloudy: { label: "Polojasno", icon: "cloudSun" },
  cloudy: { label: "Zataženo", icon: "cloud" },
  fog: { label: "Mlha", icon: "fog" },
  rainy: { label: "Déšť", icon: "rain" },
  pouring: { label: "Silný déšť", icon: "rain" },
  snowy: { label: "Sněžení", icon: "snow" },
  "snowy-rainy": { label: "Déšť se sněhem", icon: "snow" },
  hail: { label: "Kroupy", icon: "snow" },
  lightning: { label: "Bouřky", icon: "storm" },
  "lightning-rainy": { label: "Bouřky s deštěm", icon: "storm" },
  windy: { label: "Větrno", icon: "wind" },
  "windy-variant": { label: "Větrno, oblačno", icon: "wind" },
  exceptional: { label: "Výjimečné počasí", icon: "alert" },
};

export function weatherInfo(condition: string | undefined): { label: string; icon: IconName } {
  return CONDITIONS[condition ?? ""] ?? { label: condition ?? "–", icon: "cloud" };
}

/** Teplé barvy pro slunce/měsíc, studené pro srážky. */
export function weatherIconColor(icon: IconName): string {
  switch (icon) {
    case "moon":
      return "#FFE3A3";
    case "sun":
    case "cloudSun":
      return "#FFD27A";
    case "rain":
    case "snow":
    case "storm":
      return "#8FC8FF";
    default:
      return "#C9D3EA";
  }
}

/** Nejnižší a nejvyšší teplota přes všechny dny (pro sloupec rozsahu v detailu předpovědi). */
export function tempRange(days: Array<{ temperature?: number; templow?: number }>): { min: number; max: number } | null {
  const vals = days.flatMap((d) => [d.temperature, d.templow]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

/** Poloha pruhu dne v celkovém rozsahu, v procentech šířky: { left, width }. */
export function rangeBar(day: { temperature?: number; templow?: number }, range: { min: number; max: number }): { left: number; width: number } {
  const span = range.max - range.min || 1;
  const hi = day.temperature ?? day.templow ?? range.max;
  const lo = day.templow ?? day.temperature ?? range.min;
  const realLeft = ((Math.min(lo, hi) - range.min) / span) * 100;
  const realWidth = ((Math.max(lo, hi) - Math.min(lo, hi)) / span) * 100;
  // příliš úzký pruh se zvětší na minimum symetricky kolem skutečné polohy
  const width = Math.max(4, realWidth);
  const left = realLeft - (width - realWidth) / 2;
  return { left: Math.min(Math.max(0, left), 100 - width), width };
}
