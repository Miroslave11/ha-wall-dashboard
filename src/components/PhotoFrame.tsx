import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { roomBrightness } from "../ha/actions";
import { formatClock, formatDate, formatNumber, formatWeekday, isInTimeWindow, litText } from "../utils/format";
import { blurDataUrl, loadPhoto, loadPhotoList, shuffle } from "../utils/photos";
import {
  canGoBack,
  canGoForwardInHistory,
  chooseFit,
  emptyHistory,
  isPortrait,
  moveAfter,
  PAIR_LOOKAHEAD,
  photoModes,
  pushSlide,
  type Fit,
  type SlideHistory,
} from "../utils/photoLayout";
import { weatherIconColor, weatherInfo } from "../utils/weather";
import { frameWebcams, webcamSnapshotUrls } from "../utils/webcams";
import { Icon } from "./Icon";

/** Jedna fotka na slajdu: rozměry a (u rozostřeného pozadí) zmenšená kopie. */
interface SlideItem {
  url: string;
  bg: string | null;
}

interface Layer {
  key: number;
  fit: Fit;
  items: SlideItem[];
  /** Název webkamery, když slajd není fotka. */
  caption?: string;
}

/** Rozhraní Fully Kiosk Browseru (Nastavení → Advanced Web Settings → Enable JavaScript Interface). */
interface FullyApi {
  turnScreenOff?: (keepAlive?: boolean) => void;
  turnScreenOn?: () => void;
}
const fully = (): FullyApi | undefined => (window as unknown as { fully?: FullyApi }).fully;

const PHOTO_LIST_REFRESH_MS = 60 * 60_000;
const MAX_DOTS = 12;
/** Po ručním listování se prezentace na tuto dobu zastaví, ať je čas fotku prohlédnout. */
const MANUAL_HOLD_MS = 60_000;
/** Jak dlouho čekat na snímek webkamery, než se přeskočí na další. */
const WEBCAM_LOAD_TIMEOUT_MS = 8000;
/** Menší snímek (např. zástupný čtvereček z YouTube) se nepovažuje za platný. */
const WEBCAM_MIN_WIDTH = 200;

/** Jedna fotka (nebo polovina dvojice): rozostřené pozadí a celá fotka. U černého pozadí `bg` chybí. */
function Panel({ item, black, motion }: { item: SlideItem; black: boolean; motion: string }) {
  return (
    <div className="pf-panel">
      {!black && (item.bg ? <div className="pf-bg" style={{ backgroundImage: `url(${item.bg})` }} /> : <img className="pf-bg pf-bg--css" src={item.url} alt="" />)}
      <img className={`pf-img pf-img--fit ${motion}`} src={item.url} alt="" />
    </div>
  );
}

/**
 * Celoobrazovkový fotorámeček. Zobrazí se při nečinnosti (`active`),
 * klepnutím se zavře (`onWake`). Fotky se prolínají přes dvě vrstvy s Ken Burns efektem.
 * Fotky na výšku se podle nastavení (`photoFrame.portrait`) neořezávají: celé na rozostřeném nebo černém
 * pozadí, nebo po dvou vedle sebe. Šipkami se dá listovat vpřed a zpět.
 */
export function PhotoFrame({ active, onWake, now }: { active: boolean; onWake: () => void; now: Date }) {
  const cfg = useConfig();
  const pf = cfg.photoFrame;
  const modes = photoModes(pf);
  const { entities } = useHass();
  const weather = useEntity(cfg.weather?.entity);
  const indoor = useEntity(cfg.temperatures.find((t) => t.color !== "accent")?.entity);

  const [photos, setPhotos] = useState<string[]>([]);
  const [view, setView] = useState<{ layers: Array<Layer | null>; front: number }>({ layers: [null, null], front: 0 });
  const [index, setIndex] = useState(0);
  const [nav, setNav] = useState({ back: false });
  const counter = useRef(0);
  const indexRef = useRef(0);
  const photosRef = useRef<string[]>([]);
  const historyRef = useRef<SlideHistory>(emptyHistory());
  const busy = useRef(false);
  const holdUntil = useRef(0);
  const modesRef = useRef(modes);
  modesRef.current = modes;
  // Webkamery mezi fotkami: po každých `every` fotkách jedna kamera (postupně všechny dokola)
  const webcamsRef = useRef(cfg.webcams);
  webcamsRef.current = cfg.webcams;
  const webcamOn = useRef(false);
  webcamOn.current = !!pf.webcams;
  const webcamEvery = useRef(4);
  webcamEvery.current = Math.max(1, pf.webcamEvery ?? 4);
  const sinceWebcam = useRef(0);
  const camIdx = useRef(0);
  /** Adresa snímku webkamery → její název (podle toho se pozná, že slajd není fotka). */
  const captions = useRef(new Map<string, string>());

  // Seznam fotek – načíst při startu a pak každou hodinu
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadPhotoList(pf.source)
        .then((list) => {
          if (cancelled) return;
          const ordered = pf.shuffle ? shuffle(list) : list;
          photosRef.current = ordered;
          setPhotos(ordered);
        })
        .catch((e) => console.warn("Fotky se nenačetly", e));
    load();
    const id = window.setInterval(load, PHOTO_LIST_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pf.source, pf.shuffle]);

  /** Načte fotky snímku a vykreslí je; `push` = zapsat do historie (nový snímek), jinak jde o listování. */
  const showUrls = useCallback(async (urls: string[], push: boolean) => {
    const loaded = await Promise.all(urls.map((u) => loadPhoto(u)));
    const first = loaded[0];
    const caption = captions.current.get(urls[0]);
    // snímek webkamery se nikdy neořezává
    const fit: Fit = caption ? "blur" : loaded.length > 1 ? "pair" : chooseFit(first.w, first.h, modesRef.current, false);
    const items: SlideItem[] = loaded.map((p) => ({ url: p.url, bg: fit === "blur" || fit === "pair" ? blurDataUrl(p.img) : null }));
    const key = ++counter.current;
    setView((s) => {
      const back = 1 - s.front;
      const layers = [...s.layers];
      layers[back] = { key, fit, items, caption };
      return { layers, front: back };
    });
    if (push) historyRef.current = pushSlide(historyRef.current, urls);
    setNav({ back: canGoBack(historyRef.current) });
    const at = photosRef.current.indexOf(urls[0]);
    if (at >= 0) setIndex(at);
  }, []);

  /** Další snímek webkamery, nebo null, když žádná neodpovídá (offline, malý zástupný obrázek). */
  const pickWebcam = useCallback(async (): Promise<string | null> => {
    const cams = frameWebcams(webcamsRef.current);
    for (let k = 0; k < cams.length; k++) {
      const cam = cams[camIdx.current++ % cams.length];
      for (const url of webcamSnapshotUrls(cam, Date.now())) {
        const p = await Promise.race([loadPhoto(url), new Promise<null>((r) => window.setTimeout(() => r(null), WEBCAM_LOAD_TIMEOUT_MS))]);
        if (p && p.w >= WEBCAM_MIN_WIDTH) {
          captions.current.set(url, cam.name);
          return url;
        }
      }
    }
    return null;
  }, []);

  /** Vybere další snímek v pořadí; v režimu „pair“ k fotce na výšku dohledá další na výšku a přesune ji hned za ni. */
  const pickNext = useCallback(async (): Promise<string[]> => {
    if (webcamOn.current && sinceWebcam.current >= webcamEvery.current) {
      sinceWebcam.current = 0; // i při neúspěchu se další pokus udělá až po dalších fotkách
      const cam = await pickWebcam();
      if (cam) return [cam];
    }
    sinceWebcam.current += 1;
    const list = photosRef.current;
    const i = indexRef.current % list.length;
    const first = await loadPhoto(list[i]);
    indexRef.current = i + 1;
    if (modesRef.current.portrait === "pair" && isPortrait(first.w, first.h)) {
      for (let k = 1; k <= PAIR_LOOKAHEAD && i + k < list.length; k++) {
        const other = await loadPhoto(list[i + k]);
        if (isPortrait(other.w, other.h)) {
          photosRef.current = moveAfter(list, i + k, i);
          indexRef.current = i + 2;
          return [first.url, other.url];
        }
      }
    }
    return [first.url];
  }, [pickWebcam]);

  /** Další snímek: nejdřív se znovu ukážou snímky, od kterých se uživatel vrátil zpět, pak nový. */
  const advance = useCallback(async () => {
    if (busy.current || photosRef.current.length === 0) return;
    busy.current = true;
    try {
      const h = historyRef.current;
      if (canGoForwardInHistory(h)) {
        historyRef.current = { ...h, pos: h.pos + 1 };
        await showUrls(h.items[h.pos + 1], false);
      } else {
        await showUrls(await pickNext(), true);
      }
    } finally {
      busy.current = false;
    }
  }, [pickNext, showUrls]);

  const goBack = useCallback(async () => {
    const h = historyRef.current;
    if (busy.current || !canGoBack(h)) return;
    busy.current = true;
    try {
      historyRef.current = { ...h, pos: h.pos - 1 };
      await showUrls(h.items[h.pos - 1], false);
    } finally {
      busy.current = false;
    }
  }, [showUrls]);

  const manual = (fn: () => Promise<void>) => {
    holdUntil.current = Date.now() + MANUAL_HOLD_MS;
    void fn();
  };

  const blackout = !!pf.blackout && isInTimeWindow(now, pf.blackout.from, pf.blackout.to);

  // Prezentace běží jen když je rámeček aktivní a není noční okno
  useEffect(() => {
    if (!active || blackout || photos.length === 0) return;
    holdUntil.current = 0;
    // po novém zapnutí se pokračuje od posledního zobrazeného snímku
    historyRef.current = { ...historyRef.current, pos: historyRef.current.items.length - 1 };
    void advance();
    const id = window.setInterval(() => {
      if (Date.now() >= holdUntil.current) void advance();
    }, Math.max(3, pf.slideSeconds) * 1000);
    return () => clearInterval(id);
  }, [active, blackout, photos, pf.slideSeconds, advance]);

  // Volitelně vypnout displej v noci (Fully Kiosk)
  useEffect(() => {
    if (!pf.blackout?.screenOff) return;
    const f = fully();
    if (active && blackout) f?.turnScreenOff?.(true);
    else f?.turnScreenOn?.();
  }, [active, blackout, pf.blackout?.screenOff]);

  const lit = cfg.floorplan.rooms.filter((r) => roomBrightness(r, entities) > 0).length;
  const w = weatherInfo(weather?.state);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div className={`photo-frame${active ? " photo-frame--on" : ""}`} aria-hidden={!active} onClick={onWake}>
      {blackout ? null : (
        <>
          {photos.length === 0 && <div className="pf-empty" />}
          {view.layers.map((l, i) => {
            if (!l) return null;
            const motion = `pf-m-${modes.kenBurns} ${l.key % 2 ? "pf-p1" : "pf-p2"}`;
            return (
              <div key={l.key} className={`pf-slide${view.front === i ? " pf-slide--active" : ""}`}>
                {l.fit === "crop" ? (
                  <img className={`pf-img pf-img--crop ${motion}`} src={l.items[0].url} alt="" />
                ) : l.fit === "pair" ? (
                  <div className="pf-pair">
                    {l.items.map((it) => (
                      <Panel key={it.url} item={it} black={false} motion={motion} />
                    ))}
                  </div>
                ) : (
                  <Panel item={l.items[0]} black={l.fit === "black"} motion={motion} />
                )}
                {l.caption && (
                  <div className="pf-caption">
                    <Icon name="camera" size={16} strokeWidth={1.8} />
                    {l.caption}
                  </div>
                )}
              </div>
            );
          })}
          <div className="pf-scrim" />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className="pf-nav pf-nav--prev"
                aria-label="Předchozí fotka"
                disabled={!nav.back}
                tabIndex={active ? 0 : -1}
                onPointerDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  manual(goBack);
                }}
              >
                <Icon name="chevronLeft" size={22} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="pf-nav pf-nav--next"
                aria-label="Další fotka"
                tabIndex={active ? 0 : -1}
                onPointerDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  manual(advance);
                }}
              >
                <Icon name="chevronRight" size={22} strokeWidth={2} />
              </button>
            </>
          )}
          <div className="pf-clock">
            <b>{formatClock(now)}</b>
            <span>
              {formatWeekday(now)}, {formatDate(now)}
            </span>
          </div>
          <div className="pf-info">
            {weather && (
              <div className="pf-weather">
                <Icon name={w.icon} size={39} style={{ color: weatherIconColor(w.icon) }} />
                <div>
                  <b>{formatNumber(weather.attributes.temperature as number | undefined)} °C</b>
                  <span>
                    {w.label}
                    {indoor ? ` · uvnitř ${formatNumber(indoor.state)} °C` : ""}
                  </span>
                </div>
              </div>
            )}
            <div className="pf-lit">
              <span className="dot" style={{ width: 7, height: 7, background: lit ? "var(--light)" : "rgba(255,255,255,0.45)", boxShadow: lit ? "0 0 8px var(--light)" : "none" }} />
              {litText(lit)}
            </div>
          </div>
          {photos.length > 1 && photos.length <= MAX_DOTS && (
            <div className="pf-dots">
              {photos.map((p, i) => (
                <span key={p} className={i === index ? "on" : undefined} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
