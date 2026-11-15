const nf1 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

/** "23.4" → "23,4"; nečíselné stavy (unavailable…) → "–". */
export function formatNumber(value: string | number | undefined | null, decimals: 0 | 1 = 1): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return "–";
  return (decimals === 1 ? nf1 : nf0).format(n);
}

/** České skloňování podle počtu: 1 světlo, 2–4 světla, 0/5+ světel. */
export function czPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}

export function litText(n: number): string {
  if (n === 0) return "Vše zhasnuto";
  return `Svítí ${n} ${czPlural(n, "světlo", "světla", "světel")}`;
}

/** Relativní čas do budoucna: "za 21 h", "za 45 min", "za 1 h 30 min". */
export function relativeFuture(target: Date | string | undefined, now = Date.now()): string {
  if (!target) return "–";
  const t = typeof target === "string" ? Date.parse(target) : target.getTime();
  if (!Number.isFinite(t)) return "–";
  const mins = Math.max(0, Math.round((t - now) / 60000));
  if (mins < 60) return `za ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 6 || m === 0) return `za ${Math.round(mins / 60)} h`;
  return `za ${h} h ${m} min`;
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

export function formatWeekday(d: Date): string {
  const s = d.toLocaleDateString("cs-CZ", { weekday: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

/** Krátký den v týdnu pro předpověď: "Po", "Út"… */
export function shortWeekday(d: Date): string {
  const s = d.toLocaleDateString("cs-CZ", { weekday: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

/** "HH:MM" → minuty od půlnoci. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Je čas uvnitř okna? Okno může přecházet přes půlnoc ("23:00"–"06:00"). */
export function isInTimeWindow(d: Date, from: string, to: string): boolean {
  const cur = d.getHours() * 60 + d.getMinutes();
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a === b) return false;
  return a < b ? cur >= a && cur < b : cur >= a || cur < b;
}
