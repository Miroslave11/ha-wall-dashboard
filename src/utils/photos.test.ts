import { describe, expect, it } from "vitest";
import { listAutoindex, listImmichAlbum, loadPhotoList, shuffle } from "./photos";

function fakeFetch(tree: Record<string, Array<{ name: string; type: string }>>): typeof fetch {
  return (async (url: string) => {
    const body = tree[url];
    return { ok: !!body, status: body ? 200 : 404, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

describe("listAutoindex", () => {
  it("prochází podadresáře, filtruje obrázky a skryté složky Synology", async () => {
    const f = fakeFetch({
      "/photos/": [
        { name: "a.jpg", type: "file" },
        { name: "notes.txt", type: "file" },
        { name: "@eaDir", type: "directory" },
        { name: "Léto 2026", type: "directory" },
      ],
      "/photos/L%C3%A9to%202026/": [{ name: "b.PNG", type: "file" }],
    });
    const list = await listAutoindex("/photos/", 2, f);
    expect(list).toEqual(["/photos/a.jpg", "/photos/L%C3%A9to%202026/b.PNG"]);
  });
  it("respektuje maxDepth", async () => {
    const f = fakeFetch({
      "/p/": [
        { name: "x.jpg", type: "file" },
        { name: "sub", type: "directory" },
      ],
    });
    expect(await listAutoindex("/p/", 1, f)).toEqual(["/p/x.jpg"]);
  });
});

describe("loadPhotoList", () => {
  it("typ list vrací jen obrázky", async () => {
    expect(await loadPhotoList({ type: "list", urls: ["/a.jpg", "/b.mp4", "/c.webp?v=1"] })).toEqual(["/a.jpg", "/c.webp?v=1"]);
  });
});

function immichFetch(routes: Record<string, { status?: number; body: unknown }>): typeof fetch {
  return (async (url: string) => {
    const r = routes[url];
    return { ok: !!r && (r.status ?? 200) < 400, status: r ? (r.status ?? 200) : 404, json: async () => r?.body } as Response;
  }) as unknown as typeof fetch;
}

describe("listImmichAlbum", () => {
  const routes = {
    "/immich/api/albums": { body: [{ id: "a1", albumName: "Jiné" }] },
    "/immich/api/albums?shared=true": { body: [{ id: "a2", albumName: "Fotky pro wall panel" }] },
    "/immich/api/albums/a2": {
      body: {
        assets: [
          { id: "i1", type: "IMAGE" },
          { id: "v1", type: "VIDEO" },
          { id: "t1", type: "IMAGE", isTrashed: true },
          { id: "i2", type: "IMAGE" },
        ],
      },
    },
  };

  it("najde album podle názvu (i sdílené) a vrátí jen náhledy obrázků", async () => {
    const list = await listImmichAlbum(" fotky PRO wall panel ", "/immich/", "preview", immichFetch(routes));
    expect(list).toEqual(["/immich/api/assets/i1/thumbnail?size=preview", "/immich/api/assets/i2/thumbnail?size=preview"]);
  });
  it("nový Immich (bez assets v detailu alba) čte fotky přes stránkované vyhledávání", async () => {
    const pages: Record<string, unknown> = {
      "1": { assets: { items: [{ id: "n1", type: "IMAGE" }], nextPage: "2" } },
      "2": { assets: { items: [{ id: "n2", type: "IMAGE" }], nextPage: null } },
    };
    const calls: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url === "/immich/api/albums") return { ok: true, status: 200, json: async () => [{ id: "a3", albumName: "Nové" }] } as Response;
      if (url === "/immich/api/albums?shared=true") return { ok: true, status: 200, json: async () => [] } as Response;
      if (url === "/immich/api/albums/a3") return { ok: true, status: 200, json: async () => ({ assetCount: 2 }) } as Response;
      if (url === "/immich/api/search/metadata") {
        const body = JSON.parse(String(init?.body));
        expect(body.albumIds).toEqual(["a3"]);
        return { ok: true, status: 200, json: async () => pages[String(body.page)] } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }) as unknown as typeof fetch;
    const list = await listImmichAlbum("Nové", "/immich", "preview", f);
    expect(list).toEqual(["/immich/api/assets/n1/thumbnail?size=preview", "/immich/api/assets/n2/thumbnail?size=preview"]);
    expect(calls.filter((c) => c.startsWith("POST")).length).toBe(2);
  });
  it("vyhledávání bez oprávnění asset.read vyhodí srozumitelnou chybu", async () => {
    const f = (async (url: string) => {
      if (url === "/immich/api/albums") return { ok: true, status: 200, json: async () => [{ id: "a3", albumName: "Nové" }] } as Response;
      if (url === "/immich/api/albums?shared=true") return { ok: true, status: 200, json: async () => [] } as Response;
      if (url === "/immich/api/albums/a3") return { ok: true, status: 200, json: async () => ({ assetCount: 2 }) } as Response;
      return { ok: false, status: 403 } as Response;
    }) as unknown as typeof fetch;
    await expect(listImmichAlbum("Nové", "/immich", "preview", f)).rejects.toThrow(/asset\.read/);
  });
  it("loadPhotoList používá výchozí baseUrl a imageSize", async () => {
    const list = await loadPhotoList({ type: "immich", albumName: "Fotky pro wall panel", imageSize: "fullsize" }, immichFetch(routes));
    expect(list[0]).toBe("/immich/api/assets/i1/thumbnail?size=fullsize");
  });
  it("chybějící album vyhodí srozumitelnou chybu", async () => {
    await expect(listImmichAlbum("Nic", "/immich", "preview", immichFetch(routes))).rejects.toThrow(/nenalezeno/);
  });
  it("odmítnutý klíč vyhodí chybu o API klíči", async () => {
    const f = immichFetch({ "/immich/api/albums": { status: 401, body: {} } });
    await expect(listImmichAlbum("x", "/immich", "preview", f)).rejects.toThrow(/API klíč/);
  });
});

describe("shuffle", () => {
  it("zachová prvky", () => {
    const a = [1, 2, 3, 4, 5];
    expect(shuffle(a).sort()).toEqual(a);
  });
});
