import type { KenBurnsMode, LandscapeMode, PhotoFrameConfig, PortraitMode } from "../config/types";

/** Jak fotorámeček zobrazuje fotky (z `photoFrame` s doplněnými výchozími hodnotami). */
export interface PhotoModes {
  portrait: PortraitMode;
  landscape: LandscapeMode;
  kenBurns: KenBurnsMode;
}

export const DEFAULT_MODES: PhotoModes = { portrait: "blur", landscape: "crop", kenBurns: "on" };

const PORTRAIT: PortraitMode[] = ["blur", "pair", "black", "crop"];
const LANDSCAPE: LandscapeMode[] = ["crop", "blur", "black"];
const KEN_BURNS: KenBurnsMode[] = ["on", "subtle", "off"];

/** Režimy z configu; neznámá hodnota (např. překlep ve starém uloženém nastavení) → výchozí. */
export function photoModes(pf: Partial<Pick<PhotoFrameConfig, "portrait" | "landscape" | "kenBurns">> | undefined): PhotoModes {
  return {
    portrait: PORTRAIT.find((m) => m === pf?.portrait) ?? DEFAULT_MODES.portrait,
    landscape: LANDSCAPE.find((m) => m === pf?.landscape) ?? DEFAULT_MODES.landscape,
    kenBurns: KEN_BURNS.find((m) => m === pf?.kenBurns) ?? DEFAULT_MODES.kenBurns,
  };
}

/** Fotka na výšku (a čtverec, který by se na obrazovce na šířku taky hodně ořezal). Neznámé rozměry → ne. */
export function isPortrait(w: number, h: number): boolean {
  return w > 0 && h > 0 && w / h < 1.02;
}

/** Jak se konkrétní fotka na slajdu vykreslí. */
export type Fit = "crop" | "blur" | "black" | "pair";

/**
 * Způsob zobrazení fotky podle její orientace a nastavení. U `pair` je `hasPartner` informace,
 * že se našla druhá fotka na výšku; bez ní se použije rozostřené pozadí.
 */
export function chooseFit(w: number, h: number, modes: PhotoModes, hasPartner: boolean): Fit {
  if (!isPortrait(w, h)) return modes.landscape;
  if (modes.portrait === "pair") return hasPartner ? "pair" : "blur";
  return modes.portrait;
}

/** Přesune prvek z pozice `from` těsně za pozici `after` (pořadí ostatních se zachová). Vrací novou kopii. */
export function moveAfter<T>(list: T[], from: number, after: number): T[] {
  if (from < 0 || from >= list.length || from === after || from === after + 1) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  const target = from < after ? after : after + 1;
  out.splice(target, 0, item);
  return out;
}

/** Nejvýš kolik dalších fotek se prohledá při hledání druhé fotky na výšku. */
export const PAIR_LOOKAHEAD = 6;

/** Historie zobrazených snímků pro listování zpět a vpřed. Snímek = jedna fotka, nebo dvojice (pair). */
export interface SlideHistory {
  items: string[][];
  /** Index právě zobrazeného snímku. */
  pos: number;
}

export const HISTORY_MAX = 40;

export const emptyHistory = (): SlideHistory => ({ items: [], pos: -1 });

/** Přidá nový snímek na konec (případně zahodí „budoucnost“ za aktuální pozicí) a omezí délku. */
export function pushSlide(h: SlideHistory, urls: string[]): SlideHistory {
  const items = [...h.items.slice(0, h.pos + 1), urls].slice(-HISTORY_MAX);
  return { items, pos: items.length - 1 };
}

/** Je za aktuální pozicí už zobrazený snímek, na který se dá vrátit? */
export const canGoForwardInHistory = (h: SlideHistory): boolean => h.pos < h.items.length - 1;
export const canGoBack = (h: SlideHistory): boolean => h.pos > 0;
