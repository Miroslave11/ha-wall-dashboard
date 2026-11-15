import type { DashboardConfig } from "./types";

/**
 * Adresa Home Assistantu zadaná přímo v aplikaci (Nastavení → Připojení).
 * Ukládá se v localStorage tabletu a má přednost před hass.url ze souboru.
 * Přihlášení je pak vždy přes OAuth – token se v aplikaci nezadává.
 */
const URL_KEY = "ha-wall-dashboard:hass-url";

export function getStoredHassUrl(): string | null {
  try {
    return localStorage.getItem(URL_KEY);
  } catch {
    return null;
  }
}

export function setStoredHassUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(URL_KEY, url);
    else localStorage.removeItem(URL_KEY);
  } catch {
    /* bez localStorage se adresa nezapamatuje */
  }
}

/**
 * Upraví zadanou adresu do tvaru "http://host:port": doplní http://, odstraní koncové lomítko,
 * cestu a mezery. Neplatná adresa → null.
 */
export function normalizeHassUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Uloženou adresu z aplikace použije místo hass.url ze souboru (a vypne demo). */
export function applyStoredConnection(cfg: DashboardConfig, storedUrl: string | null): DashboardConfig {
  if (!storedUrl) return cfg;
  return { ...cfg, demo: false, hass: { url: storedUrl, auth: "oauth" } };
}

/**
 * Ověří, že adresa HA odpovídá, ještě než na ni přesměrujeme přihlášení.
 * Bez toho by tablet s překlepem v adrese skončil na chybové stránce prohlížeče.
 * Vrací chybovou hlášku, nebo null když je vše v pořádku.
 */
export async function checkHassReachable(url: string, timeoutMs = 6000): Promise<string | null> {
  if (location.protocol === "https:" && url.startsWith("http:")) {
    return "Dashboard běží přes https, Home Assistant přes http – prohlížeč takové spojení zablokuje. Použijte pro oba stejný protokol.";
  }
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // no-cors: zajímá nás jen to, jestli server vůbec odpoví (CORS se řeší až při přihlášení)
    await fetch(`${url}/manifest.json`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return null;
  } catch {
    return `Na adrese ${url} nic neodpovídá. Zkontrolujte IP adresu a port (obvykle 8123).`;
  } finally {
    window.clearTimeout(timer);
  }
}
