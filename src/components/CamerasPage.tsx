import { useMemo, useState } from "react";
import { useConfig } from "../ha/HassContext";
import { webcamGroups } from "../utils/webcams";
import { WebcamTile } from "./WebcamTile";
import { WebcamViewer } from "./WebcamViewer";

/** Stránka Kamery: mřížka webkamer s filtrem podle skupin, klepnutím celá obrazovka. */
export function CamerasPage() {
  const { webcams = [] } = useConfig();
  const groups = useMemo(() => webcamGroups(webcams), [webcams]);
  const [group, setGroup] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = group && groups.includes(group) ? webcams.filter((c) => c.group?.trim() === group) : webcams;
  const openIdx = shown.findIndex((c) => c.id === openId);
  const open = openIdx >= 0 ? shown[openIdx] : null;
  const step = (d: number) => setOpenId(shown[(openIdx + d + shown.length) % shown.length].id);

  return (
    <section className="page glass cams-page" aria-label="Web kamery">
      <div className="cams-head">
        <h1 className="card-title">Web kamery</h1>
        {groups.length > 0 && (
          <div className="tabs" role="tablist">
            {[null, ...groups].map((g) => (
              <button key={g ?? "all"} type="button" role="tab" aria-selected={group === g} className={`tab${group === g ? " tab--active" : ""}`} onClick={() => setGroup(g)}>
                {g ?? "Vše"}
              </button>
            ))}
          </div>
        )}
      </div>

      {webcams.length === 0 ? (
        <p>Zatím tu nejsou žádné kamery. Přidejte je v Nastavení → Webkamery (adresa snímku nebo živý přenos z YouTube).</p>
      ) : (
        <div className="cams-grid">
          {shown.map((c) => (
            <WebcamTile key={c.id} cam={c} active={!open} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      )}

      {open && <WebcamViewer cam={open} onClose={() => setOpenId(null)} onPrev={shown.length > 1 ? () => step(-1) : undefined} onNext={shown.length > 1 ? () => step(1) : undefined} />}
    </section>
  );
}
