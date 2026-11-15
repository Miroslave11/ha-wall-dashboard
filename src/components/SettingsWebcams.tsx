import { useState } from "react";
import type { UserSettings, WebcamConfig } from "../config/types";
import { webcamGroups, youtubeId } from "../utils/webcams";
import { Icon } from "./Icon";

interface Props {
  draft: UserSettings;
  update: (fn: (d: UserSettings) => void) => void;
}

/** Klíč skupiny pro kamery bez skupiny. */
const NO_GROUP = "";

const norm = (s: string | undefined) => (s ?? "").toLocaleLowerCase("cs");

/** Nastavení → Webkamery: tabulka kamer seskupená podle skupin (snímek z internetu nebo živý přenos z YouTube). */
export function SettingsWebcams({ draft, update }: Props) {
  const cams = draft.webcams ?? [];
  const groups = webcamGroups(cams);
  const hasUngrouped = cams.some((c) => !c.group?.trim());
  const groupKeys = hasUngrouped ? [...groups, NO_GROUP] : groups;

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const q = norm(query.trim());

  const edit = (i: number, fn: (c: WebcamConfig) => void) =>
    update((d) => {
      d.webcams ??= [];
      fn(d.webcams[i]);
    });

  /** Posun o jednu pozici uvnitř skupiny (prohodí se s nejbližší kamerou téže skupiny). */
  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const list = (d.webcams ??= []);
      const key = list[i].group?.trim() ?? NO_GROUP;
      let j = i + dir;
      while (j >= 0 && j < list.length && (list[j].group?.trim() ?? NO_GROUP) !== key) j += dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    });

  const add = (group: string) => {
    update((d) => {
      (d.webcams ??= []).push({
        id: `cam-${Date.now().toString(36)}`,
        name: "",
        group: group || undefined,
        type: "image",
        url: "",
        refreshSec: 60,
      });
    });
    setCollapsed((s) => {
      const next = new Set(s);
      next.delete(group);
      return next;
    });
  };

  const toggle = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const confirmNewGroup = () => {
    const name = (newGroup ?? "").trim();
    if (name) add(name);
    setNewGroup(null);
  };

  const matches = (c: WebcamConfig) => !q || [c.name, c.group, c.url, c.source].some((v) => norm(v).includes(q));

  return (
    <div className="form-grid">
      <div className="wc-toolbar">
        <label className="wc-search">
          <Icon name="search" size={18} />
          <input className="wc-search-input" type="search" value={query} placeholder="Hledat kameru" aria-label="Hledat kameru" onChange={(e) => setQuery(e.target.value)} />
        </label>
        {newGroup === null ? (
          <>
            <button type="button" className="btn-pill" onClick={() => setNewGroup("")}>
              <Icon name="plus" size={18} /> Nová skupina
            </button>
            <button type="button" className="btn-pill btn-pill--primary" onClick={() => add(groups[groups.length - 1] ?? NO_GROUP)}>
              <Icon name="plus" size={18} /> Přidat kameru
            </button>
          </>
        ) : (
          <form
            className="wc-newgroup"
            onSubmit={(e) => {
              e.preventDefault();
              confirmNewGroup();
            }}
          >
            <input className="input" autoFocus value={newGroup} placeholder="Název skupiny" aria-label="Název nové skupiny" onChange={(e) => setNewGroup(e.target.value)} />
            <button type="submit" className="btn-pill btn-pill--primary" disabled={!newGroup.trim()}>
              <Icon name="check" size={18} /> Přidat
            </button>
            <button type="button" className="btn-pill" onClick={() => setNewGroup(null)}>
              Zrušit
            </button>
          </form>
        )}
      </div>

      <details className="wc-help">
        <summary>Nápověda</summary>
        <p className="hint">
          „Snímek“ je adresa obrázku (JPEG), který se v zadaném odstupu obnovuje. „YouTube“ je živý přenos (ID videa nebo odkaz); v mřížce se ukáže jeho
          náhled, po klepnutí video. „Zdroj“ se zobrazí na celé obrazovce. Kamery bez zaškrtnutí „Rám.“ se ve fotorámečku nepoužijí. Dbejte na podmínky
          provozovatele kamery.
        </p>
      </details>

      {cams.length === 0 && <p className="hint">Zatím není přidaná žádná kamera. Začněte tlačítkem Přidat kameru.</p>}

      {cams.length > 0 && (
        <div className="wc-scroll">
          <div className="wc-table">
            <div className="wc-row wc-row--head" aria-hidden="true">
              <span>Název</span>
              <span>Skupina</span>
              <span>Typ</span>
              <span>Adresa</span>
              <span>Obnova</span>
              <span>Zdroj</span>
              <span>Rám.</span>
              <span />
            </div>

            {groupKeys.map((key) => {
              const members = cams.map((c, i) => ({ c, i })).filter(({ c }) => (c.group?.trim() ?? NO_GROUP) === key);
              const shown = members.filter(({ c }) => matches(c));
              if (q && shown.length === 0) return null;
              const isOpen = q !== "" || !collapsed.has(key);
              const title = key || "Bez skupiny";

              return (
                <section className="wc-group" key={key || "__none"}>
                  <button type="button" className="wc-group-head" aria-expanded={isOpen} onClick={() => toggle(key)}>
                    <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={20} />
                    <span className="wc-group-name">{title}</span>
                    <span className="wc-group-count">{members.length}</span>
                  </button>

                  {isOpen &&
                    shown.map(({ c, i }) => {
                      const prevInGroup = members.findIndex((m) => m.i === i) > 0;
                      const nextInGroup = members.findIndex((m) => m.i === i) < members.length - 1;
                      const badYoutube = c.type === "youtube" && c.url.trim() !== "" && !youtubeId(c.url);
                      return (
                        <div className="wc-row" key={c.id}>
                          <input className="input" value={c.name} placeholder="např. Sněžka" aria-label="Název" onChange={(e) => edit(i, (x) => void (x.name = e.target.value))} />
                          <select
                            className="input"
                            value={c.group?.trim() ?? NO_GROUP}
                            aria-label="Skupina"
                            onChange={(e) => edit(i, (x) => void (x.group = e.target.value || undefined))}
                          >
                            <option value={NO_GROUP}>Bez skupiny</option>
                            {groups.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                          <select
                            className="input"
                            value={c.type}
                            aria-label="Typ"
                            onChange={(e) =>
                              edit(i, (x) => {
                                x.type = e.target.value as WebcamConfig["type"];
                                if (x.type === "image") x.refreshSec ??= 60;
                              })
                            }
                          >
                            <option value="image">Snímek</option>
                            <option value="youtube">YouTube</option>
                          </select>
                          <input
                            className={`input${badYoutube ? " input--error" : ""}`}
                            value={c.url}
                            inputMode="url"
                            aria-label={c.type === "youtube" ? "ID videa nebo odkaz na YouTube" : "Adresa snímku (JPEG)"}
                            title={badYoutube ? "Nepoznávám ID videa." : c.url}
                            placeholder={c.type === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://…/kamera.jpg"}
                            onChange={(e) => edit(i, (x) => void (x.url = e.target.value))}
                          />
                          {c.type === "image" ? (
                            <input
                              className="input"
                              type="number"
                              inputMode="numeric"
                              min={10}
                              aria-label="Obnova v sekundách"
                              value={Number.isFinite(c.refreshSec ?? 60) ? (c.refreshSec ?? 60) : ""}
                              onChange={(e) => edit(i, (x) => void (x.refreshSec = e.target.value === "" ? NaN : Number(e.target.value)))}
                            />
                          ) : (
                            <span className="wc-na" aria-hidden="true">
                              –
                            </span>
                          )}
                          <input
                            className="input"
                            value={c.source ?? ""}
                            placeholder="skimu.cz"
                            aria-label="Zdroj (zobrazí se na celé obrazovce)"
                            onChange={(e) => edit(i, (x) => void (x.source = e.target.value || undefined))}
                          />
                          <label className="wc-check">
                            <input type="checkbox" aria-label="Ve fotorámečku" checked={c.inFrame !== false} onChange={(e) => edit(i, (x) => void (x.inFrame = e.target.checked))} />
                          </label>
                          <div className="wc-actions">
                            <button type="button" className="icon-btn" aria-label="Posunout nahoru" disabled={!prevInGroup} onClick={() => move(i, -1)}>
                              <Icon name="chevronUp" size={20} />
                            </button>
                            <button type="button" className="icon-btn" aria-label="Posunout dolů" disabled={!nextInGroup} onClick={() => move(i, 1)}>
                              <Icon name="chevronDown" size={20} />
                            </button>
                            <button type="button" className="icon-btn" aria-label="Odebrat kameru" onClick={() => update((d) => void d.webcams?.splice(i, 1))}>
                              <Icon name="trash" size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {isOpen && !q && (
                    <button type="button" className="wc-add" onClick={() => add(key)}>
                      <Icon name="plus" size={18} /> Přidat do skupiny {title}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
