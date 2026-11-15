import { useEffect, useMemo, useState } from "react";
import { getStoredHassUrl } from "../config/connection";
import type { UserSettings } from "../config/types";
import { extractUserSettings, sameSettings } from "../config/userSettings";
import { useHass } from "../ha/HassContext";
import { EMPTY_REGISTRY, type HaRegistry } from "../utils/registry";
import { ConnectForm } from "./ConnectForm";
import { Icon } from "./Icon";
import { SettingsOther } from "./SettingsOther";
import { SettingsPhotoFrame } from "./SettingsPhotoFrame";
import { SettingsRooms } from "./SettingsRooms";
import { SettingsWebcams } from "./SettingsWebcams";

const STATUS: Record<string, string> = {
  connecting: "Připojuji…",
  connected: "Připojeno",
  reconnecting: "Obnovuji spojení…",
  error: "Chyba připojení",
};

type Tab = "connection" | "rooms" | "other" | "webcams" | "photoframe";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "connection", label: "Připojení" },
  { id: "rooms", label: "Místnosti" },
  { id: "other", label: "Ostatní entity" },
  { id: "webcams", label: "Webkamery" },
  { id: "photoframe", label: "Fotorámeček" },
];

export function SettingsPage({ onPhotoFrame }: { onPhotoFrame: () => void }) {
  const { client, config, fileConfig, userSettings, saveUserSettings } = useHass();
  const [tab, setTab] = useState<Tab>(client?.isDemo ? "connection" : "rooms");
  const saved = useMemo(() => extractUserSettings(config), [config]);
  const [draft, setDraft] = useState<UserSettings>(saved);
  const [registry, setRegistry] = useState<HaRegistry>(EMPTY_REGISTRY);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = !sameSettings(draft, saved);

  useEffect(() => {
    let alive = true;
    client?.fetchRegistry().then((r) => alive && setRegistry(r));
    return () => {
      alive = false;
    };
  }, [client]);

  /** Úprava konceptu: kopie + změna (formuláře mění vnořená pole). */
  const update = (fn: (d: UserSettings) => void) => {
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });
    setNotice(null);
  };

  const onSave = async () => {
    setBusy(true);
    const errs = await saveUserSettings(draft);
    setBusy(false);
    setErrors(errs);
    if (!errs.length) setNotice(client?.isDemo ? "Uloženo (v demu do tohoto prohlížeče)." : "Uloženo do Home Assistantu.");
  };

  const onReset = async () => {
    setBusy(true);
    const errs = await saveUserSettings(null);
    setBusy(false);
    setErrors(errs);
    if (!errs.length) {
      setDraft(extractUserSettings(fileConfig));
      setNotice("Nastavení z aplikace smazáno, platí konfigurace ze souboru.");
    }
  };

  return (
    <section className="page glass settings" aria-label="Nastavení">
      <nav className="settings-nav" aria-label="Sekce nastavení">
        <h1 className="card-title">Nastavení</h1>
        <div className="settings-menu" role="tablist" aria-orientation="vertical">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`settings-menu-item${tab === t.id ? " settings-menu-item--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="settings-main">
      <div className="settings-body">
        {tab === "connection" && <ConnectionTab onPhotoFrame={onPhotoFrame} onReset={userSettings ? onReset : undefined} busy={busy} />}
        {tab === "rooms" && <SettingsRooms draft={draft} update={update} registry={registry} />}
        {tab === "other" && <SettingsOther draft={draft} update={update} registry={registry} />}
        {tab === "webcams" && <SettingsWebcams draft={draft} update={update} />}
        {tab === "photoframe" && <SettingsPhotoFrame draft={draft} update={update} />}
      </div>

      {(tab !== "connection" || errors.length > 0 || notice) && (
        <div className="save-bar">
          <div className="save-msg" aria-live="polite">
            {errors.length > 0 ? (
              <ul className="form-error">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : dirty ? (
              <span className="save-dirty">Neuložené změny</span>
            ) : (
              <span className="hint">
                {notice ??
                  (!userSettings
                    ? "Používá se konfigurace ze souboru."
                    : client?.isDemo
                      ? "Nastavení je uložené v aplikaci (demo – v tomto prohlížeči)."
                      : "Nastavení je uložené v Home Assistantu.")}
              </span>
            )}
          </div>
          {tab !== "connection" && (
            <div className="btn-row">
              <button
                type="button"
                className="btn-pill"
                disabled={!dirty || busy}
                onClick={() => {
                  setDraft(saved);
                  setErrors([]);
                }}
              >
                Zahodit změny
              </button>
              <button type="button" className="btn-pill btn-pill--primary" disabled={!dirty || busy} onClick={onSave}>
                <Icon name="check" size={18} /> {busy ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
}

function ConnectionTab({ onPhotoFrame, onReset, busy }: { onPhotoFrame: () => void; onReset?: () => void; busy: boolean }) {
  const { client, status, entities, config, userSettings, userSettingsWarning } = useHass();
  const storedUrl = getStoredHassUrl();

  return (
    <div className="form-grid">
      {client?.isDemo && (
        <p className="notice">
          Běží <strong>demo</strong> se simulovanými entitami. Zadejte adresu svého Home Assistantu a přihlaste se – pak v záložce
          Místnosti vyberete skutečné entity.
        </p>
      )}
      {userSettingsWarning && <p className="form-error">{userSettingsWarning}</p>}

      <dl className="kv">
        <dt>Režim</dt>
        <dd>{client?.isDemo ? "Demo (simulované entity)" : "Home Assistant"}</dd>
        <dt>Home Assistant</dt>
        <dd>
          {config.hass.url || "–"}
          {storedUrl ? " (zadáno v aplikaci)" : config.hass.url ? " (ze souboru)" : ""}
        </dd>
        <dt>Stav spojení</dt>
        <dd>{STATUS[status] ?? status}</dd>
        <dt>Počet entit</dt>
        <dd>{Object.keys(entities).length}</dd>
        <dt>Nastavení entit</dt>
        <dd>{userSettings ? (client?.isDemo ? "uložené v aplikaci (demo – v prohlížeči)" : "uložené v Home Assistantu") : "ze souboru config.json"}</dd>
        <dt>Fotorámeček</dt>
        <dd>
          {config.photoFrame.enabled ? `po ${config.photoFrame.idleSeconds} s nečinnosti, fotka ${config.photoFrame.slideSeconds} s` : "vypnut"}
        </dd>
        <dt>Rozlišení displeje</dt>
        <dd>
          {window.innerWidth} × {window.innerHeight} (návrh {config.stage.width} × {config.stage.height})
        </dd>
      </dl>

      <section className="form-section">
        <h2 className="form-section-title">Připojení k Home Assistantu</h2>
        <ConnectForm currentUrl={config.hass.url} />
      </section>

      <div className="btn-row">
        <button className="btn-pill" type="button" onClick={() => location.reload()}>
          <Icon name="refresh" size={18} /> Načíst znovu
        </button>
        <button className="btn-pill" type="button" onClick={onPhotoFrame}>
          <Icon name="image" size={18} /> Spustit fotorámeček
        </button>
        {!client?.isDemo && (
          <button
            className="btn-pill"
            type="button"
            onClick={async () => {
              await client?.logout();
              location.reload();
            }}
          >
            <Icon name="logout" size={18} /> Odhlásit tablet
          </button>
        )}
        {onReset && (
          <button className="btn-pill" type="button" disabled={busy} onClick={onReset}>
            <Icon name="trash" size={18} /> Smazat nastavení z aplikace
          </button>
        )}
      </div>
    </div>
  );
}
