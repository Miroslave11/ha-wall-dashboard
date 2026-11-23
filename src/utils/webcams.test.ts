import { describe, expect, it } from "vitest";
import type { WebcamConfig } from "../config/types";
import { cacheBust, frameWebcams, isNightAfterSunset, refreshSeconds, validateWebcams, webcamEmbedUrl, webcamGroups, webcamSnapshotUrls, youtubeId } from "./webcams";

const img = (over: Partial<WebcamConfig> = {}): WebcamConfig => ({ id: "a", name: "Sněžka", type: "image", url: "https://example.cz/cam.jpg", ...over });
const yt = (over: Partial<WebcamConfig> = {}): WebcamConfig => ({ id: "b", name: "Etna", type: "youtube", url: "dQw4w9WgXcQ", ...over });

describe("youtubeId", () => {
  it("přijme samotné ID", () => expect(youtubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"));
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?t=5",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("vyčte ID z odkazu %s", (u) => expect(youtubeId(u)).toBe("dQw4w9WgXcQ"));
  it("nesmysl vrátí null", () => {
    expect(youtubeId("")).toBeNull();
    expect(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("krátké")).toBeNull();
  });
});

describe("cacheBust", () => {
  it("přidá parametr za otazník nebo jako první", () => {
    expect(cacheBust("https://a.cz/x.jpg", 5)).toBe("https://a.cz/x.jpg?_=5");
    expect(cacheBust("https://a.cz/x.jpg?q=1", 5)).toBe("https://a.cz/x.jpg?q=1&_=5");
  });
  it("zachová #fragment na konci", () => expect(cacheBust("/c.jpg#x", 5)).toBe("/c.jpg?_=5#x"));
});

describe("refreshSeconds", () => {
  it("výchozí 60 s, minimum 10 s", () => {
    expect(refreshSeconds(img())).toBe(60);
    expect(refreshSeconds(img({ refreshSec: 3 }))).toBe(10);
    expect(refreshSeconds(img({ refreshSec: 120 }))).toBe(120);
  });
});

describe("webcamSnapshotUrls / webcamEmbedUrl", () => {
  it("image: jedna adresa s cache-bustem", () => expect(webcamSnapshotUrls(img(), 7)).toEqual(["https://example.cz/cam.jpg?_=7"]));
  it("youtube: náhled živého přenosu ve dvou velikostech", () => {
    const urls = webcamSnapshotUrls(yt(), 7);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("/vi/dQw4w9WgXcQ/maxresdefault_live.jpg");
  });
  it("neplatné youtube ID = žádná adresa", () => expect(webcamSnapshotUrls(yt({ url: "x" }), 0)).toEqual([]));
  it("embed jen pro youtube", () => {
    expect(webcamEmbedUrl(img())).toBeNull();
    expect(webcamEmbedUrl(yt())).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1");
  });
});

describe("webcamGroups / frameWebcams", () => {
  it("skupiny v pořadí prvního výskytu bez prázdných", () => {
    expect(webcamGroups([img({ group: "Česko" }), img({ id: "c" }), yt({ group: "Evropa" }), img({ id: "d", group: "Česko" })])).toEqual(["Česko", "Evropa"]);
  });
  it("do fotorámečku jen nevypnuté s použitelným snímkem", () => {
    const list = [img(), img({ id: "x", inFrame: false }), yt({ id: "y", url: "špatné" }), yt({ id: "z" })];
    expect(frameWebcams(list).map((c) => c.id)).toEqual(["a", "z"]);
    expect(frameWebcams(undefined)).toEqual([]);
  });
});

describe("frameWebcams v noci", () => {
  it("s skipEurope vynechá evropské kamery, ponechá region other", () => {
    const list = [img({ id: "eu" }), img({ id: "eu2", region: "europe" }), img({ id: "as", region: "other" })];
    expect(frameWebcams(list, { skipEurope: true }).map((c) => c.id)).toEqual(["as"]);
    expect(frameWebcams(list).map((c) => c.id)).toEqual(["eu", "eu2", "as"]);
  });
});

describe("isNightAfterSunset", () => {
  const H = 3600_000;
  const now = Date.parse("2026-11-21T20:00:00Z");
  // poslední západ ve 15:30Z (next_setting zítra v 15:30Z)
  const sun = (state: string, next = "2026-11-22T15:30:00Z") => ({ state, attributes: { next_setting: next } });
  it("přes den ne", () => expect(isNightAfterSunset(sun("above_horizon", "2026-11-21T21:00:00Z"), now)).toBe(false));
  it("do 30 min po západu ještě ne", () => expect(isNightAfterSunset(sun("below_horizon"), Date.parse("2026-11-21T15:50:00Z"))).toBe(false));
  it("30 min po západu ano", () => expect(isNightAfterSunset(sun("below_horizon"), Date.parse("2026-11-21T16:00:00Z"))).toBe(true));
  it("v noci i krátce před východem", () => expect(isNightAfterSunset(sun("below_horizon"), now + 8 * H)).toBe(true));
  it("bez entity ne, bez času západu věří stavu", () => {
    expect(isNightAfterSunset(undefined, now)).toBe(false);
    expect(isNightAfterSunset({ state: "below_horizon" }, now)).toBe(true);
  });
});

describe("validateWebcams", () => {
  it("místo kamery: platné projde, neplatné souřadnice jsou chyba", () => {
    expect(validateWebcams([img({ place: { name: "Sněžka", lat: 50.7, lon: 15.7, elevation: 1603 } })])).toEqual([]);
    expect(validateWebcams([img({ place: { lat: 120, lon: 15 } })]).some((e) => e.includes("místo"))).toBe(true);
  });
  it("platný seznam bez chyb", () => expect(validateWebcams([img(), yt(), img({ id: "r", url: "/photos/demo.jpg" })])).toEqual([]));
  it("najde chyby", () => {
    const errs = validateWebcams([img({ url: "ftp://x" }), img({ name: " " }), yt({ url: "blbost" }), img({ id: "q", refreshSec: 2 })]);
    expect(errs.some((e) => e.includes("adresa snímku"))).toBe(true);
    expect(errs.some((e) => e.includes("chybí název"))).toBe(true);
    expect(errs.some((e) => e.includes("Duplicitní id"))).toBe(true);
    expect(errs.some((e) => e.includes("ID videa"))).toBe(true);
    expect(errs.some((e) => e.includes("alespoň 10 s"))).toBe(true);
  });
});
