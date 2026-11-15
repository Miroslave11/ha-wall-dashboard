import type { PhotoSource } from "../config/types";

const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif)$/i;

/** Položka výpisu nginx `autoindex_format json`. */
interface AutoindexEntry {
  name: string;
  type: "file" | "directory" | "other";
}

function joinUrl(base: string, name: string): string {
  return (base.endsWith("/") ? base : base + "/") + encodeURIComponent(name);
}

/** Načte seznam fotek z nginx autoindexu (rekurzivně do maxDepth úrovní). */
export async function listAutoindex(url: string, maxDepth = 2, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, depth: number) {
    const res = await fetchImpl(dir.endsWith("/") ? dir : dir + "/", { cache: "no-store" });
    if (!res.ok) throw new Error(`Výpis fotek selhal: ${res.status} ${dir}`);
    const entries = (await res.json()) as AutoindexEntry[];
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name.startsWith("@")) continue; // @eaDir apod. ze Synology
      if (e.type === "file" && IMAGE_RE.test(e.name)) out.push(joinUrl(dir, e.name));
      else if (e.type === "directory" && depth < maxDepth) await walk(joinUrl(dir, e.name) + "/", depth + 1);
    }
  }
  await walk(url, 1);
  return out;
}

/** Výchozí adresa Immiche přes proxy v nginx (viz nginx.conf, location /immich/). */
export const IMMICH_DEFAULT_BASE = "/immich";

interface ImmichAlbum {
  id: string;
  albumName: string;
}

interface ImmichAsset {
  id: string;
  type: string;
  isTrashed?: boolean;
}

async function immichJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Immich odmítl API klíč (zkontroluj IMMICH_API_KEY a jeho oprávnění album.read, asset.read, asset.view)");
  }
  if (!res.ok) throw new Error(`Immich neodpovídá: ${res.status} ${url}`);
  return (await res.json()) as T;
}

/**
 * Načte fotky z alba v Immichi (podle názvu, včetně alb sdílených s uživatelem API klíče).
 * Vrací URL náhledů (JPEG, HEIC a RAW Immich převádí sám); videa se přeskakují.
 */
export async function listImmichAlbum(
  albumName: string,
  baseUrl: string = IMMICH_DEFAULT_BASE,
  size: "preview" | "fullsize" = "preview",
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const wanted = albumName.trim().toLocaleLowerCase("cs");
  const [own, shared] = await Promise.all([
    immichJson<ImmichAlbum[]>(`${base}/api/albums`, fetchImpl),
    immichJson<ImmichAlbum[]>(`${base}/api/albums?shared=true`, fetchImpl).catch(() => [] as ImmichAlbum[]),
  ]);
  const album = [...own, ...shared].find((a) => a.albumName.trim().toLocaleLowerCase("cs") === wanted);
  if (!album) throw new Error(`Album „${albumName}“ v Immichi nenalezeno`);
  const detail = await immichJson<{ assets?: ImmichAsset[]; assetCount?: number }>(`${base}/api/albums/${album.id}`, fetchImpl);
  // Starší Immich vrací fotky přímo v detailu alba, novější (2.x/3.x) už ne → vyhledávání podle alba
  let assets = detail.assets ?? [];
  if (assets.length === 0 && (detail.assetCount ?? 1) > 0) assets = await searchAlbumAssets(album.id, base, fetchImpl);
  return assets.filter((a) => a.type === "IMAGE" && !a.isTrashed).map((a) => `${base}/api/assets/${a.id}/thumbnail?size=${size}`);
}

/** Fotky alba přes `POST /search/metadata` (stránkované; vyžaduje oprávnění klíče asset.read). */
async function searchAlbumAssets(albumId: string, base: string, fetchImpl: typeof fetch): Promise<ImmichAsset[]> {
  const out: ImmichAsset[] = [];
  let page: string | number | null = 1;
  for (let guard = 0; page && guard < 50; guard++) {
    const res = await fetchImpl(`${base}/api/search/metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ albumIds: [albumId], type: "IMAGE", size: 1000, page }),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Immich odmítl čtení fotek alba (klíč potřebuje oprávnění asset.read, album.read a asset.view)");
    }
    if (!res.ok) throw new Error(`Immich vyhledávání fotek selhalo: ${res.status}`);
    const body = (await res.json()) as { assets?: { items?: ImmichAsset[]; nextPage?: string | null } };
    out.push(...(body.assets?.items ?? []));
    page = body.assets?.nextPage ?? null;
  }
  return out;
}

export async function loadPhotoList(source: PhotoSource, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  if (source.type === "list") return source.urls.filter((u) => IMAGE_RE.test(u.split("?")[0]));
  if (source.type === "immich") return listImmichAlbum(source.albumName, source.baseUrl, source.imageSize, fetchImpl);
  return listAutoindex(source.url, source.maxDepth ?? 2, fetchImpl);
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Přednačte obrázek, aby prolínání nezačalo s prázdným snímkem. */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/** Načtená fotka: rozměry a (ne vždy) odkaz na obrázek pro vytvoření rozostřeného pozadí. Chyba načtení = rozměry 0. */
export interface LoadedPhoto {
  url: string;
  w: number;
  h: number;
  img: HTMLImageElement | null;
}

const loaded = new Map<string, Promise<LoadedPhoto>>();
/** Kolik načtených fotek se drží v paměti (pro listování zpět a dohledávání dvojic). */
const LOADED_MAX = 14;

/** Načte fotku (a zapamatuje ji), aby prolínání nezačalo s prázdným snímkem a bylo znát, jestli je na výšku. */
export function loadPhoto(url: string): Promise<LoadedPhoto> {
  const hit = loaded.get(url);
  if (hit) return hit;
  const p = new Promise<LoadedPhoto>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ url, w: img.naturalWidth, h: img.naturalHeight, img });
    img.onerror = () => resolve({ url, w: 0, h: 0, img: null });
    img.src = url;
  });
  loaded.set(url, p);
  if (loaded.size > LOADED_MAX) loaded.delete(loaded.keys().next().value as string);
  return p;
}

/**
 * Rozostřené pozadí z fotky: zmenšená ztmavená kopie, kterou prohlížeč plynule roztáhne přes obrazovku
 * (bez drahého CSS filtru blur na celou plochu). Fotka z jiné domény bez CORS plátno „zašpiní“ → null.
 */
export function blurDataUrl(img: HTMLImageElement | null, width = 64): string | null {
  try {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const h = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    if ("filter" in ctx) ctx.filter = "blur(1.5px)";
    ctx.drawImage(img, 0, 0, width, h);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fillRect(0, 0, width, h);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
