/**
 * Verze nasazené aplikace. Docker image při sestavení zapíše číslo verze do `/version.txt`.
 * Tablet ho pravidelně čte a po nasazení nové verze stránku sám obnoví (kiosk se jinak nikdy nepřenačte).
 */

export const VERSION_URL = "/version.txt";
/** Jak často se kontroluje nová verze. */
export const VERSION_CHECK_MS = 10 * 60 * 1000;

/**
 * Přečte verzi z obsahu `/version.txt`. Když soubor chybí, server (vývoj i nginx) vrátí
 * místo něj index.html – ten se jako verze nebere, výsledek je pak `null`.
 */
export function parseVersion(text: string | null | undefined): string | null {
  const v = (text ?? "").trim();
  return /^[\w.+-]{1,64}$/.test(v) ? v : null;
}

/** Obnovit stránku? Jen když známe původní i nově nasazenou verzi a liší se. */
export function isNewVersion(loaded: string | null, latest: string | null): boolean {
  return loaded !== null && latest !== null && loaded !== latest;
}
