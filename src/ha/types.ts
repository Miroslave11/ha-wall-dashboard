import type { HassEntities, HassServiceTarget } from "home-assistant-js-websocket";
import type { HaRegistry } from "../utils/registry";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

export interface HistoryPoint {
  /** čas v ms */
  t: number;
  v: number;
}

export interface ForecastItem {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  /** Úhrn srážek (mm). */
  precipitation?: number;
  /** Pravděpodobnost srážek (%). */
  precipitation_probability?: number;
  wind_speed?: number;
}

/** Druh předpovědi: po dnech nebo po hodinách (hodinovou nemusí každá weather entita umět). */
export type ForecastType = "daily" | "hourly";

/**
 * Společné rozhraní pro skutečné připojení k HA i demo simulaci.
 * Komponenty pracují jen s tímto rozhraním.
 */
export interface HassClient {
  readonly isDemo: boolean;
  /** Adresa HA bez lomítka na konci (pro obrázky z HA, např. mapa vysavače); v demu prázdná. */
  readonly hassUrl: string;
  subscribeEntities(cb: (entities: HassEntities) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  callService(domain: string, service: string, data?: object, target?: HassServiceTarget): Promise<unknown>;
  fetchHistory(entityIds: string[], hours: number): Promise<Record<string, HistoryPoint[]>>;
  subscribeForecast(entityId: string, cb: (forecast: ForecastItem[]) => void, type?: ForecastType): Promise<() => void>;
  /** Oblasti a přiřazení entit k nim (pro výběr entit v Nastavení). Při chybě prázdné. */
  fetchRegistry(): Promise<HaRegistry>;
  /** Data uživatele uložená v HA (frontend/get_user_data); v demu localStorage. */
  loadUserData<T>(key: string): Promise<T | null>;
  /** Uloží data k přihlášenému uživateli HA (frontend/set_user_data); null = smazat. */
  saveUserData(key: string, value: unknown): Promise<void>;
  close(): void;
  /** Odhlášení (smaže uložené tokeny). V demo režimu nic nedělá. */
  logout(): Promise<void>;
}
