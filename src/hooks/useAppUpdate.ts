import { useEffect, useRef } from "react";
import { isNewVersion, parseVersion, VERSION_CHECK_MS, VERSION_URL } from "../utils/appVersion";

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    return res.ok ? parseVersion(await res.text()) : null;
  } catch {
    return null; // NAS chvíli nedostupný (aktualizace kontejneru) → zkusí se příště
  }
}

/**
 * Po nasazení nové verze (automatická aktualizace na NASu) stránku obnoví.
 * `canReload` = false odloží obnovení (např. v Nastavení s rozpracovanými změnami).
 */
export function useAppUpdate(canReload: boolean): void {
  const loaded = useRef<string | null>(null);
  const pending = useRef(false);
  const canReloadRef = useRef(canReload);
  canReloadRef.current = canReload;

  useEffect(() => {
    let alive = true;
    void fetchVersion().then((v) => {
      if (alive) loaded.current = v;
    });
    const id = window.setInterval(async () => {
      const latest = await fetchVersion();
      if (!alive) return;
      if (loaded.current === null) loaded.current = latest;
      else if (isNewVersion(loaded.current, latest)) pending.current = true;
      if (pending.current && canReloadRef.current) location.reload();
    }, VERSION_CHECK_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // nová verze čekala, až uživatel odejde z Nastavení
  useEffect(() => {
    if (canReload && pending.current) location.reload();
  }, [canReload]);
}
