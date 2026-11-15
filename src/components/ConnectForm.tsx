import { useState, type FormEvent } from "react";
import { checkHassReachable, getStoredHassUrl, normalizeHassUrl, setStoredHassUrl } from "../config/connection";
import { clearStoredTokens } from "../ha/realClient";
import { Icon } from "./Icon";

/**
 * Zadání adresy Home Assistantu přímo v aplikaci. Adresa se uloží v tabletu (localStorage),
 * stránka se znovu načte a přesměruje na přihlášení do HA (OAuth).
 */
export function ConnectForm({ currentUrl }: { currentUrl?: string }) {
  const stored = getStoredHassUrl();
  const [value, setValue] = useState(stored ?? currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeHassUrl(value);
    if (!url) {
      setMsg("Zadejte adresu ve tvaru http://192.168.1.10:8123");
      return;
    }
    setBusy(true);
    setMsg(null);
    const problem = await checkHassReachable(url);
    setBusy(false);
    if (problem) {
      setMsg(problem);
      return;
    }
    // nová adresa → staré tokeny patří k jinému serveru
    clearStoredTokens();
    setStoredHassUrl(url);
    location.replace(location.pathname);
  };

  const onUseFile = () => {
    clearStoredTokens();
    setStoredHassUrl(null);
    location.replace(location.pathname);
  };

  return (
    <form className="connect-form" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Adresa Home Assistantu</span>
        <input
          className="input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="http://192.168.1.10:8123"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="btn-row">
        <button className="btn-pill btn-pill--primary" type="submit" disabled={busy}>
          <Icon name="check" size={18} /> {busy ? "Ověřuji…" : "Připojit a přihlásit"}
        </button>
        {stored && (
          <button className="btn-pill" type="button" onClick={onUseFile}>
            Použít adresu ze souboru
          </button>
        )}
      </div>
      {msg && <p className="form-error">{msg}</p>}
      <p className="hint">
        Po připojení vás Home Assistant požádá o přihlášení. V jeho <code>configuration.yaml</code> musí být povolena adresa
        dashboardu: <code>http: cors_allowed_origins: - {location.origin}</code>
      </p>
    </form>
  );
}
