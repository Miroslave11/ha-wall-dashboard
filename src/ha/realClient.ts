import {
  createConnection,
  createLongLivedTokenAuth,
  getAuth,
  subscribeEntities,
  callService,
  ERR_HASS_HOST_REQUIRED,
  ERR_INVALID_AUTH,
  type Auth,
  type AuthData,
  type Connection,
  type HassEntities,
} from "home-assistant-js-websocket";
import type { HassConnectionConfig } from "../config/types";
import type { ConnectionStatus, ForecastItem, ForecastType, HassClient, HistoryPoint } from "./types";
import { parseHistoryResponse, type RawHistoryResponse } from "../utils/history";
import { buildRegistry, EMPTY_REGISTRY, type HaRegistry, type RawArea, type RawDevice, type RawEntityEntry } from "../utils/registry";

const TOKEN_KEY = "ha-wall-dashboard:tokens";

/** Smaže uložené přihlašovací tokeny (např. při změně adresy HA v Nastavení). */
export function clearStoredTokens(): void {
  pendingAuth = null;
  saveTokens(null);
}

function loadTokens(): Promise<AuthData | null> {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return Promise.resolve(raw ? (JSON.parse(raw) as AuthData) : null);
  } catch {
    return Promise.resolve(null);
  }
}

function saveTokens(data: AuthData | null): void {
  try {
    if (data) localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage nemusí být dostupné – tablet se pak přihlásí znovu */
  }
}

async function authenticate(cfg: HassConnectionConfig): Promise<Auth> {
  const hassUrl = cfg.url.replace(/\/+$/, "");
  if (cfg.auth === "token") {
    if (!cfg.token) throw new Error("Chybí hass.token v konfiguraci");
    return createLongLivedTokenAuth(hassUrl, cfg.token);
  }
  try {
    // Při prvním spuštění přesměruje na přihlašovací stránku HA a vrátí se zpět s ?auth_callback=1&code=…
    const auth = await getAuth({ hassUrl, saveTokens, loadTokens });
    if (location.search.includes("auth_callback=1")) {
      history.replaceState(null, "", location.pathname);
    }
    return auth;
  } catch (err) {
    if (err === ERR_INVALID_AUTH) {
      // uložené tokeny už neplatí → smazat a přihlásit znovu
      saveTokens(null);
      return getAuth({ hassUrl, saveTokens, loadTokens });
    }
    if (err === ERR_HASS_HOST_REQUIRED) throw new Error("Chybí hass.url v konfiguraci");
    throw err;
  }
}

class RealHassClient implements HassClient {
  readonly isDemo = false;
  private statusListeners = new Set<(s: ConnectionStatus) => void>();
  private conn: Connection;
  private auth: Auth;

  constructor(conn: Connection, auth: Auth) {
    this.conn = conn;
    this.auth = auth;
    conn.addEventListener("ready", () => this.emit("connected"));
    conn.addEventListener("disconnected", () => this.emit("reconnecting"));
    conn.addEventListener("reconnect-error", () => this.emit("error"));
  }

  private emit(s: ConnectionStatus) {
    this.statusListeners.forEach((cb) => cb(s));
  }

  onStatus(cb: (s: ConnectionStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.conn.connected ? "connected" : "reconnecting");
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  subscribeEntities(cb: (e: HassEntities) => void) {
    return subscribeEntities(this.conn, cb);
  }

  callService(domain: string, service: string, data?: object, target?: { entity_id?: string | string[] }) {
    return callService(this.conn, domain, service, data, target);
  }

  async fetchHistory(entityIds: string[], hours: number): Promise<Record<string, HistoryPoint[]>> {
    if (!entityIds.length) return {};
    const now = Date.now();
    const res = await this.conn.sendMessagePromise<RawHistoryResponse>({
      type: "history/history_during_period",
      start_time: new Date(now - hours * 3600_000).toISOString(),
      end_time: new Date(now).toISOString(),
      entity_ids: entityIds,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    return parseHistoryResponse(res);
  }

  async subscribeForecast(entityId: string, cb: (f: ForecastItem[]) => void, type: ForecastType = "daily") {
    const unsub = await this.conn.subscribeMessage<{ forecast: ForecastItem[] | null }>(
      (msg) => cb(msg.forecast ?? []),
      { type: "weather/subscribe_forecast", entity_id: entityId, forecast_type: type },
    );
    return () => {
      // při výpadku spojení může odhlášení odběru selhat – nevadí
      Promise.resolve(unsub()).catch(() => {});
    };
  }

  async fetchRegistry(): Promise<HaRegistry> {
    try {
      const [areas, devices, entries] = await Promise.all([
        this.conn.sendMessagePromise<RawArea[]>({ type: "config/area_registry/list" }),
        this.conn.sendMessagePromise<RawDevice[]>({ type: "config/device_registry/list" }),
        this.conn.sendMessagePromise<RawEntityEntry[]>({ type: "config/entity_registry/list" }),
      ]);
      return buildRegistry(areas, devices, entries);
    } catch (err) {
      // bez registrů výběr entit funguje dál, jen bez řazení podle oblastí
      console.warn("Registry oblastí se nepodařilo načíst", err);
      return EMPTY_REGISTRY;
    }
  }

  async loadUserData<T>(key: string): Promise<T | null> {
    const res = await this.conn.sendMessagePromise<{ value: T | null }>({ type: "frontend/get_user_data", key });
    return res?.value ?? null;
  }

  async saveUserData(key: string, value: unknown): Promise<void> {
    await this.conn.sendMessagePromise({ type: "frontend/set_user_data", key, value });
  }

  close() {
    this.conn.close();
  }

  async logout() {
    try {
      await this.auth.revoke();
    } catch {
      /* ignorovat – tokeny smažeme i tak */
    }
    clearStoredTokens();
    this.conn.close();
  }
}

/**
 * Probíhající přihlášení. React StrictMode (dev) spouští efekt dvakrát, takže by se kód z
 * přihlášení (?auth_callback=1&code=…) vyměňoval za token dvakrát souběžně: druhá výměna
 * dostane od HA 400, smaže právě uložené tokeny a přesměruje na přihlášení znovu (smyčka).
 */
let pendingAuth: { key: string; promise: Promise<Auth> } | null = null;

function authenticateOnce(cfg: HassConnectionConfig): Promise<Auth> {
  const key = `${cfg.auth}|${cfg.url}|${cfg.token ?? ""}`;
  if (pendingAuth?.key === key) return pendingAuth.promise;
  const promise = authenticate(cfg);
  const entry = { key, promise };
  pendingAuth = entry;
  // po neúspěchu se dá zkusit znovu; po úspěchu zůstává Auth sdílený (tokeny jsou uložené)
  promise.catch(() => {
    if (pendingAuth === entry) pendingAuth = null;
  });
  return promise;
}

export async function connectHass(cfg: HassConnectionConfig): Promise<HassClient> {
  const auth = await authenticateOnce(cfg);
  const conn = await createConnection({ auth });
  return new RealHassClient(conn, auth);
}
