import { useHass } from "../ha/HassContext";
import type { KenBurnsMode, LandscapeMode, PortraitMode, UserSettings } from "../config/types";
import { czPlural } from "../utils/format";
import { photoModes } from "../utils/photoLayout";

interface Props {
  draft: UserSettings;
  update: (fn: (d: UserSettings) => void) => void;
}

/** Délka v sekundách česky: 90 → „1 min 30 s“. */
function durationText(sec: number): string {
  if (!Number.isFinite(sec)) return "";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m} min ${s} s` : `${m} ${czPlural(m, "minuta", "minuty", "minut")}`;
}

/** Číselné pole: prázdné pole = NaN (ověření při ukládání ho odmítne), ne tichá nula. */
function NumberField({ label, value, min, hint, onChange }: { label: string; value: number; min: number; hint: string; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
      <span className="hint">{hint}</span>
    </label>
  );
}

const PORTRAIT_CHOICES: Array<{ value: PortraitMode; label: string; hint: string }> = [
  { value: "blur", label: "Celá fotka, rozostřené pozadí", hint: "Fotka se neořezává, po stranách je ztlumená rozmazaná kopie téže fotky." },
  { value: "pair", label: "Dvě fotky na výšku vedle sebe", hint: "Dvě po sobě jdoucí fotky na výšku v jednom záběru (druhá se dohledá v následujících fotkách; bez ní se použije rozostřené pozadí)." },
  { value: "black", label: "Celá fotka, černé pozadí", hint: "Fotka se neořezává, po stranách jsou černé pruhy." },
  { value: "crop", label: "Ořezat na celou obrazovku", hint: "Fotka vyplní obrazovku, ořízne se hlavně nahoře a dole." },
];

const LANDSCAPE_CHOICES: Array<{ value: LandscapeMode; label: string; hint: string }> = [
  { value: "crop", label: "Vyplnit obrazovku", hint: "Fotka vyplní obrazovku, ořízne se jen malý pruh (u fotek 3:2 asi 7 %)." },
  { value: "blur", label: "Celá fotka, rozostřené pozadí", hint: "Fotka se neořezává, případné prázdné pruhy vyplní ztlumená rozmazaná kopie." },
  { value: "black", label: "Celá fotka, černé pozadí", hint: "Fotka se neořezává, případné prázdné pruhy jsou černé." },
];

const MOTION_CHOICES: Array<{ value: KenBurnsMode; label: string; hint: string }> = [
  { value: "on", label: "Plný (přiblížení a posun)", hint: "Fotky pomalu jezdí. U fotek zobrazených celé je pohyb jen velmi jemný, ať se okraje neořezávají." },
  { value: "subtle", label: "Jemný", hint: "Fotky se jen nepatrně přibližují." },
  { value: "off", label: "Vypnutý", hint: "Fotky stojí." },
];

/** Nastavení → Fotorámeček: kdy se zapne, jak dlouho zůstane fotka, zobrazení fotek, noční černá obrazovka. */
export function SettingsPhotoFrame({ draft, update }: Props) {
  const { config } = useHass();
  const p = draft.photoFrame;
  if (!p) return null;
  const modes = photoModes(p);
  const src = config.photoFrame.source;

  return (
    <div className="form-grid">
      <section className="form-section">
        <h2 className="form-section-title">Fotorámeček</h2>
        <label className="field field--check">
          <input type="checkbox" checked={p.enabled} onChange={(e) => update((d) => void (d.photoFrame!.enabled = e.target.checked))} />
          <span>Zapnout fotorámeček (spustí se po nečinnosti, nebo tlačítkem v menu)</span>
        </label>
        <div className="form-row">
          <NumberField
            label="Zapnout po nečinnosti (s)"
            value={p.idleSeconds}
            min={5}
            hint={`Min. 5 s. Teď: ${durationText(p.idleSeconds)}`}
            onChange={(v) => update((d) => void (d.photoFrame!.idleSeconds = v))}
          />
          <NumberField
            label="Doba zobrazení fotky (s)"
            value={p.slideSeconds}
            min={3}
            hint={`Min. 3 s. Teď: ${durationText(p.slideSeconds)}`}
            onChange={(v) => update((d) => void (d.photoFrame!.slideSeconds = v))}
          />
        </div>
        <label className="field field--check">
          <input type="checkbox" checked={p.shuffle} onChange={(e) => update((d) => void (d.photoFrame!.shuffle = e.target.checked))} />
          <span>Náhodné pořadí fotek</span>
        </label>
        <p className="hint">
          Zdroj fotek: {src.type === "immich" ? `Immich, album „${src.albumName}“` : src.type === "autoindex" ? `složka ${src.url}` : "pevný seznam"} (mění se v config.json).
        </p>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Zobrazení fotek</h2>
        <label className="field">
          <span className="field-label">Fotky na výšku</span>
          <select className="input" value={modes.portrait} onChange={(e) => update((d) => void (d.photoFrame!.portrait = e.target.value as PortraitMode))}>
            {PORTRAIT_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">{PORTRAIT_CHOICES.find((c) => c.value === modes.portrait)?.hint}</span>
        </label>
        <label className="field">
          <span className="field-label">Fotky na šířku</span>
          <select className="input" value={modes.landscape} onChange={(e) => update((d) => void (d.photoFrame!.landscape = e.target.value as LandscapeMode))}>
            {LANDSCAPE_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">{LANDSCAPE_CHOICES.find((c) => c.value === modes.landscape)?.hint}</span>
        </label>
        <label className="field">
          <span className="field-label">Pohyb fotek</span>
          <select className="input" value={modes.kenBurns} onChange={(e) => update((d) => void (d.photoFrame!.kenBurns = e.target.value as KenBurnsMode))}>
            {MOTION_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="hint">{MOTION_CHOICES.find((c) => c.value === modes.kenBurns)?.hint}</span>
        </label>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Webkamery ve fotorámečku</h2>
        <label className="field field--check">
          <input type="checkbox" checked={!!p.webcams} onChange={(e) => update((d) => void (d.photoFrame!.webcams = e.target.checked))} />
          <span>Prokládat fotky záběry z webkamer</span>
        </label>
        {p.webcams && (
          <>
            <NumberField
              label="Jedna kamera po kolika fotkách"
              value={p.webcamEvery ?? 4}
              min={1}
              hint="Kamery se střídají postupně. Které kamery se použijí, nastavíte u každé v záložce Webkamery (Ve fotorámečku)."
              onChange={(v) => update((d) => void (d.photoFrame!.webcamEvery = v))}
            />
            <label className="field field--check">
              <input
                type="checkbox"
                checked={!!p.webcamsSkipEuropeAtNight}
                onChange={(e) => update((d) => void (d.photoFrame!.webcamsSkipEuropeAtNight = e.target.checked))}
              />
              <span>Po západu slunce vynechat evropské kamery</span>
            </label>
            <span className="hint">
              Začne 30 minut po západu slunce u vás (entita slunce v Nastavení → Ostatní entity) a trvá do východu. Kamery označené v záložce Webkamery jako „Mimo
              Evropu“ se zobrazují dál.
            </span>
            {(draft.webcams ?? []).length === 0 && <p className="hint">Zatím není přidaná žádná kamera (Nastavení → Webkamery).</p>}
          </>
        )}
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Noční režim</h2>
        <label className="field field--check">
          <input
            type="checkbox"
            checked={!!p.blackout}
            onChange={(e) =>
              update((d) => {
                if (e.target.checked) d.photoFrame!.blackout = { from: "23:30", to: "06:00", screenOff: false };
                else delete d.photoFrame!.blackout;
              })
            }
          />
          <span>V noci místo fotek černá obrazovka</span>
        </label>
        {p.blackout && (
          <>
            <div className="form-row">
              <label className="field field--narrow">
                <span className="field-label">Od</span>
                <input className="input" type="time" value={p.blackout.from} onChange={(e) => update((d) => void (d.photoFrame!.blackout!.from = e.target.value))} />
              </label>
              <label className="field field--narrow">
                <span className="field-label">Do</span>
                <input className="input" type="time" value={p.blackout.to} onChange={(e) => update((d) => void (d.photoFrame!.blackout!.to = e.target.value))} />
              </label>
            </div>
            <label className="field field--check">
              <input type="checkbox" checked={!!p.blackout.screenOff} onChange={(e) => update((d) => void (d.photoFrame!.blackout!.screenOff = e.target.checked))} />
              <span>Vypnout i displej (jen ve Fully Kiosk Browseru se zapnutým JavaScript Interface)</span>
            </label>
          </>
        )}
      </section>
    </div>
  );
}
