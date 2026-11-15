import { describe, expect, it } from "vitest";
import { canGoBack, canGoForwardInHistory, chooseFit, DEFAULT_MODES, emptyHistory, HISTORY_MAX, isPortrait, moveAfter, photoModes, pushSlide } from "./photoLayout";

describe("fotorámeček – rozložení fotek", () => {
  it("orientace: na výšku a čtverec ano, na šířku a neznámé rozměry ne", () => {
    expect(isPortrait(3000, 4000)).toBe(true);
    expect(isPortrait(1000, 1000)).toBe(true);
    expect(isPortrait(4000, 3000)).toBe(false);
    expect(isPortrait(1600, 1000)).toBe(false);
    expect(isPortrait(0, 0)).toBe(false);
  });

  it("režimy z configu, neznámá hodnota → výchozí", () => {
    expect(photoModes(undefined)).toEqual(DEFAULT_MODES);
    expect(photoModes({ portrait: "pair", landscape: "blur", kenBurns: "off" })).toEqual({ portrait: "pair", landscape: "blur", kenBurns: "off" });
    expect(photoModes({ portrait: "nesmysl" as never, kenBurns: "x" as never })).toEqual(DEFAULT_MODES);
  });

  it("způsob zobrazení podle orientace a nastavení", () => {
    const m = (portrait: "blur" | "pair" | "black" | "crop", landscape: "crop" | "blur" | "black" = "crop") => ({ portrait, landscape, kenBurns: "on" as const });
    expect(chooseFit(3000, 4000, m("blur"), false)).toBe("blur");
    expect(chooseFit(3000, 4000, m("black"), false)).toBe("black");
    expect(chooseFit(3000, 4000, m("crop"), false)).toBe("crop");
    expect(chooseFit(3000, 4000, m("pair"), true)).toBe("pair");
    expect(chooseFit(3000, 4000, m("pair"), false)).toBe("blur");
    expect(chooseFit(4000, 3000, m("blur", "crop"), false)).toBe("crop");
    expect(chooseFit(4000, 3000, m("blur", "blur"), false)).toBe("blur");
    expect(chooseFit(4000, 3000, m("pair", "black"), true)).toBe("black");
  });

  it("přesun druhé fotky těsně za první", () => {
    expect(moveAfter(["a", "b", "c", "d", "e"], 3, 0)).toEqual(["a", "d", "b", "c", "e"]);
    expect(moveAfter(["a", "b", "c", "d"], 1, 0)).toEqual(["a", "b", "c", "d"]);
    expect(moveAfter(["a", "b", "c"], 0, 0)).toEqual(["a", "b", "c"]);
    expect(moveAfter(["a", "b", "c"], 9, 0)).toEqual(["a", "b", "c"]);
  });
});

describe("fotorámeček – historie pro listování", () => {
  it("přidávání, vracení zpět a vpřed", () => {
    let h = emptyHistory();
    expect(canGoBack(h)).toBe(false);
    h = pushSlide(h, ["a"]);
    h = pushSlide(h, ["b", "c"]);
    h = pushSlide(h, ["d"]);
    expect(h.items).toEqual([["a"], ["b", "c"], ["d"]]);
    expect(h.pos).toBe(2);
    expect(canGoBack(h)).toBe(true);
    expect(canGoForwardInHistory(h)).toBe(false);
    // vrátit se o dva snímky zpět → za aktuální pozicí je „budoucnost“
    h = { ...h, pos: 0 };
    expect(canGoBack(h)).toBe(false);
    expect(canGoForwardInHistory(h)).toBe(true);
  });

  it("nový snímek po návratu zpět zahodí starou budoucnost", () => {
    let h = pushSlide(pushSlide(pushSlide(emptyHistory(), ["a"]), ["b"]), ["c"]);
    h = { ...h, pos: 1 };
    h = pushSlide(h, ["x"]);
    expect(h.items).toEqual([["a"], ["b"], ["x"]]);
    expect(h.pos).toBe(2);
  });

  it("historie je omezená", () => {
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = pushSlide(h, [`f${i}`]);
    expect(h.items).toHaveLength(HISTORY_MAX);
    expect(h.items[h.pos]).toEqual([`f${HISTORY_MAX + 9}`]);
  });
});
