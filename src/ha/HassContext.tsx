import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HassEntities, HassEntity } from "home-assistant-js-websocket";
import { validateConfig } from "../config/loadConfig";
import type { DashboardConfig, UserSettings } from "../config/types";
import { applyUserSettings, parseUserSettings, USER_SETTINGS_KEY } from "../config/userSettings";
import type { ConnectionStatus, HassClient } from "./types";
import { MockHassClient } from "./mockClient";
import { connectHass } from "./realClient";

interface HassState {
  client: HassClient | null;
  entities: HassEntities;
  status: ConnectionStatus;
  error: string | null;
  /** Výsledná konfigurace (soubor + nastavení uložené v HA). */
  config: DashboardConfig;
  /** Konfigurace jen ze souboru (config.json / config.local.json + adresa z aplikace). */
  fileConfig: DashboardConfig;
  /** Nastavení uložené v HA, null = používá se jen soubor. */
  userSettings: UserSettings | null;
  /** Hláška, když uložené nastavení nešlo načíst nebo použít. */
  userSettingsWarning: string | null;
  /** Klient je připojený a nastavení z HA je načtené – dashboard se může vykreslit. */
  ready: boolean;
  /** Uloží nastavení do HA (null = smazat a vrátit se k souboru). Vrací seznam chyb (prázdný = uloženo). */
  saveUserSettings: (s: UserSettings | null) => Promise<string[]>;
}

const HassCtx = createContext<HassState | null>(null);

/** Jak dlouho čekat na nastavení z HA, než se dashboard vykreslí jen podle souboru. */
const SETTINGS_TIMEOUT = 5000;

export function HassProvider({ config, children }: { config: DashboardConfig; children: ReactNode }) {
  const [client, setClient] = useState<HassClient | null>(null);
  const [entities, setEntities] = useState<HassEntities>({});
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [userSettingsWarning, setUserSettingsWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let active: HassClient | null = null;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        const useDemo = config.demo || !config.hass.url;
        const c = useDemo ? new MockHassClient(config) : await connectHass(config.hass);
        if (cancelled) {
          c.close();
          return;
        }
        active = c;
        unsubs.push(c.onStatus(setStatus));
        unsubs.push(c.subscribeEntities(setEntities));

        // Nastavení z aplikace (uložené v HA) – načíst dřív, než se dashboard vykreslí,
        // aby na tabletu neproblikly entity ze šablony.
        try {
          const raw = await Promise.race([
            c.loadUserData<unknown>(USER_SETTINGS_KEY),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("vypršel čas")), SETTINGS_TIMEOUT)),
          ]);
          if (cancelled) return;
          if (raw !== null) {
            const parsed = parseUserSettings(raw);
            const errors = parsed ? validateConfig(applyUserSettings(config, parsed)) : ["neznámý formát dat"];
            if (parsed && !errors.length) setUserSettings(parsed);
            else setUserSettingsWarning(`Uložené nastavení nelze použít (${errors.join("; ")}), platí konfigurace ze souboru.`);
          }
        } catch (err) {
          console.warn("Nastavení z HA se nenačetlo", err);
          if (!cancelled) setUserSettingsWarning("Nastavení uložené v Home Assistantu se nepodařilo načíst, platí konfigurace ze souboru.");
        }
        if (!cancelled) setClient(c);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setStatus("error");
        setError(err instanceof Error ? err.message : `Chyba připojení (${String(err)})`);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      active?.close();
    };
  }, [config]);

  const effective = useMemo(() => applyUserSettings(config, userSettings), [config, userSettings]);

  const saveUserSettings = useCallback(
    async (s: UserSettings | null): Promise<string[]> => {
      if (!client) return ["Není připojeno k Home Assistantu"];
      if (s) {
        const errors = validateConfig(applyUserSettings(config, s));
        if (errors.length) return errors;
      }
      try {
        await client.saveUserData(USER_SETTINGS_KEY, s);
      } catch (err) {
        return [`Uložení do Home Assistantu selhalo: ${err instanceof Error ? err.message : String(err)}`];
      }
      setUserSettings(s);
      setUserSettingsWarning(null);
      return [];
    },
    [client, config],
  );

  const value: HassState = {
    client,
    entities,
    status,
    error,
    config: effective,
    fileConfig: config,
    userSettings,
    userSettingsWarning,
    ready: client !== null,
    saveUserSettings,
  };

  return <HassCtx.Provider value={value}>{children}</HassCtx.Provider>;
}

export function useHass(): HassState {
  const ctx = useContext(HassCtx);
  if (!ctx) throw new Error("useHass musí být uvnitř <HassProvider>");
  return ctx;
}

export function useEntity(entityId: string | undefined): HassEntity | undefined {
  const { entities } = useHass();
  return entityId ? entities[entityId] : undefined;
}

export function useConfig(): DashboardConfig {
  return useHass().config;
}
