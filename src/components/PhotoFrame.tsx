import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig, useEntity, useHass } from "../ha/HassContext";
import { roomBrightness } from "../ha/actions";
import { withWebcamsOnly } from "../config/userSettings";
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
import { frameWebcams, isNightAfterSunset, webcamSnapshotUrls } from "../utils/webcams";
import { Icon } from "./Icon";
import { WebcamCaption } from "./WebcamCaption";
import { fetchPlaceWeather, isValidPlace } from "../utils/placeWeather";
import type { WebcamConfig } from "../config/types";

/** Jedna fotka na slajdu: rozměry a (u rozostřeného pozadí) zmenšená kopie. */
interface SlideItem {
  url: string;
  bg: string | null;
}

interface Layer {
  key: number;
  fit: Fit;
  items: SlideItem[];
  /** Webkamera, když slajd není fotka (nadpis s místem a teplotou). */
  cam?: WebcamConfig;
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
  const { entities, userSettings, saveUserSettings } = useHass();
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
  // V noci (západ slunce + 30 min) se podle nastavení vynechají evropské kamery
  const skipEuropeRef = useRef(false);
  skipEuropeRef.current = !!pf.webcamsSkipEuropeAtNight;
  const sunRef = useRef(cfg.header.sun ? entities[cfg.header.sun] : undefined);
  sunRef.current = cfg.header.sun ? entities[cfg.header.sun] : undefined;
  // Režim „Jen kamery“: přepíná se tlačítky na rámečku hned (uložení do HA doběhne na pozadí)
  const [camsOnlyChoice, setCamsOnlyChoice] = useState(!!pf.webcamsOnly);
  useEffect(() => setCamsOnlyChoice(!!pf.webcamsOnly), [pf.webcamsOnly]);
  const hasFrameCams = !!pf.webcams && frameWebcams(cfg.webcams).length > 0;
  const camsOnly = hasFrameCams && camsOnlyChoice;
  // V noci můžou být všechny kamery vynechané (jen evropské) – pak se i v režimu Jen kamery ukazují fotky
  const nightSkipsAllCams =
    camsOnly &&
    !!pf.webcamsSkipEuropeAtNight &&
    isNightAfterSunset(cfg.header.sun ? entities[cfg.header.sun] : undefined, now.getTime()) &&
    frameWebcams(cfg.webcams, { skipEurope: true }).length === 0;
  const camsOnlyRef = useRef(camsOnly);
  camsOnlyRef.current = camsOnly;
  const sinceWebcam = useRef(0);
  const camIdx = useRef(0);
  /** Adresa snímku webkamery → kamera (podle toho se pozná, že slajd není fotka). */
  const captions = useRef(new Map<string, WebcamConfig>());

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
    const cam = captions.current.get(urls[0]);
    // snímek webkamery se nikdy neořezává
    const fit: Fit = cam ? "blur" : loaded.length > 1 ? "pair" : chooseFit(first.w, first.h, modesRef.current, false);
    const items: SlideItem[] = loaded.map((p) => ({ url: p.url, bg: fit === "blur" || fit === "pair" ? blurDataUrl(p.img) : null }));
    const key = ++counter.current;
    setView((s) => {
      const back = 1 - s.front;
      const layers = [...s.layers];
      layers[back] = { key, fit, items, cam };
      return { layers, front: back };
    });
    if (push) historyRef.current = pushSlide(historyRef.current, urls);
    setNav({ back: canGoBack(historyRef.current) });
    const at = photosRef.current.indexOf(urls[0]);
    if (at >= 0) setIndex(at);
  }, []);

  /** Další snímek webkamery, nebo null, když žádná neodpovídá (offline, malý zástupný obrázek). */
  const pickWebcam = useCallback(async (): Promise<string | null> => {
    const cams = frameWebcams(webcamsRef.current, { skipEurope: skipEuropeRef.current && isNightAfterSunset(sunRef.current, Date.now()) });
    for (let k = 0; k < cams.length; k++) {
      const cam = cams[camIdx.current++ % cams.length];
      // teplota na místě kamery se načítá souběžně se snímkem, ať je v nadpisu hned
      if (isValidPlace(cam.place)) void fetchPlaceWeather(cam.place);
      for (const url of webcamSnapshotUrls(cam, Date.now())) {
        const p = await Promise.race([loadPhoto(url), new Promise<null>((r) => window.setTimeout(() => r(null), WEBCAM_LOAD_TIMEOUT_MS))]);
        if (p && p.w >= WEBCAM_MIN_WIDTH) {
          captions.current.set(url, cam);
          return url;
        }
      }
    }
    return null;
  }, []);

  /** Vybere další snímek v pořadí; v režimu „pair“ k fotce na výšku dohledá další na výšku a přesune ji hned za ni. */
  const pickNext = useCallback(async (): Promise<string[]> => {
    if (camsOnlyRef.current) {
      // jen kamery; když žádná neodpoví, raději fotka než prázdná obrazovka
      const cam = await pickWebcam();
      if (cam) return [cam];
    } else if (webcamOn.current && sinceWebcam.current >= webcamEvery.current) {
      sinceWebcam.current = 0; // i při neúspěchu se další pokus udělá až po dalších fotkách
      const cam = await pickWebcam();
      if (cam) return [cam];
    }
    sinceWebcam.current += 1;
    const list = photosRef.current;
    if (list.length === 0) return [];
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
    if (busy.current || (photosRef.current.length === 0 && !camsOnlyRef.current)) return;
    busy.current = true;
    try {
      const h = historyRef.current;
      if (canGoForwardInHistory(h)) {
        historyRef.current = { ...h, pos: h.pos + 1 };
        await showUrls(h.items[h.pos + 1], false);
      } else {
        const next = await pickNext();
        if (next.length) await showUrls(next, true);
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

  /** Přepnutí „Fotky + kamery“ / „Jen kamery“: projeví se hned (efekt níže ukáže nový snímek) a uloží se do nastavení. */
  const chooseCamsOnly = (on: boolean) => {
    if (on === camsOnly) return;
    setCamsOnlyChoice(on);
    sinceWebcam.current = 0;
    void saveUserSettings(withWebcamsOnly(userSettings, cfg, on)).then((errs) => {
      if (errs.length) console.warn("Režim fotorámečku se neuložil", errs);
    });
  };

  // Prezentace běží jen když je rámeček aktivní a není noční okno; po změně režimu začne znovu novým snímkem
  useEffect(() => {
    if (!active || blackout || (photos.length === 0 && !camsOnly)) return;
    holdUntil.current = 0;
    // po novém zapnutí se pokračuje od posledního zobrazeného snímku
    historyRef.current = { ...historyRef.current, pos: historyRef.current.items.length - 1 };
    void advance();
    const id = window.setInterval(() => {
      if (Date.now() >= holdUntil.current) void advance();
    }, Math.max(3, pf.slideSeconds) * 1000);
    return () => clearInterval(id);
  }, [active, blackout, photos, pf.slideSeconds, advance, camsOnly]);

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
                {l.cam && <WebcamCaption cam={l.cam} />}
              </div>
            );
          })}
          <div className="pf-scrim" />
          {(photos.length > 1 || camsOnly) && (
            <>
              <button
                type="button"
                className="pf-nav pf-nav--prev"
                aria-label="Předchozí snímek"
                disabled={!nav.back}
                tabIndex={active ? 0 : -1}
                onPointerDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  manual(goBack);
                }}
              >
                <Icon name="chevronLeft" size={30} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="pf-nav pf-nav--next"
                aria-label="Další snímek"
                tabIndex={active ? 0 : -1}
                onPointerDown={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  manual(advance);
                }}
              >
                <Icon name="chevronRight" size={30} strokeWidth={2} />
              </button>
            </>
          )}
          {hasFrameCams && (
            <div className="pf-mode" role="group" aria-label="Co fotorámeček ukazuje" onPointerDown={stop} onClick={stop}>
              {[
                { on: false, icon: "image" as const, label: "Fotky + kamery" },
                { on: true, icon: "camera" as const, label: "Jen kamery" },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className={`pf-mode-btn${camsOnly === m.on ? " pf-mode-btn--on" : ""}`}
                  aria-pressed={camsOnly === m.on}
                  aria-label={m.label}
                  title={m.label}
                  tabIndex={active ? 0 : -1}
                  onClick={() => chooseCamsOnly(m.on)}
                >
                  <Icon name={m.icon} size={22} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          )}
          {nightSkipsAllCams && <div className="pf-mode-note">Po západu slunce jsou evropské kamery vypnuté, zatím se ukazují fotky</div>}
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
          {!camsOnly && photos.length > 1 && photos.length <= MAX_DOTS && (
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
