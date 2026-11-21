import type { HassEntity } from "home-assistant-js-websocket";
import { describe, expect, it } from "vitest";
import type { RoomConfig } from "../config/types";
import {
  applyAffine,
  buildVacuumMapping,
  currentPlanRoom,
  fitAffine,
  parseVacuumPosition,
  parseVacuumRooms,
  showsLivePosition,
  parseVacuumImage,
  roomPixelRect,
  suggestVacuumSensors,
  vacuumPlanPosition,
} from "./vacuumMap";

const ent = (state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id: "sensor.x",
  state,
  attributes,
  last_changed: "",
  last_updated: "",
  context: { id: "", user_id: null, parent_id: null },
});

const room = (id: string, x: number, y: number, w: number, h: number): RoomConfig => ({ id, name: id, x, y, w, h, lights: [] });

/** Půdorys 640×460 z konfigurace dashboardu. */
const PLAN = {
  width: 640,
  height: 460,
  rooms: [
    room("loznice", 0, 0, 300, 300),
    room("obyvak", 300, 0, 340, 300),
    room("pokoj", 0, 300, 210, 160),
    room("wc", 210, 300, 90, 160),
    room("chodba", 300, 300, 120, 160),
    room("koupelna", 420, 300, 220, 160),
  ],
};

/** Ukázkové obdélníky místností (formát sensor.robot_rooms). Mapa je vůči půdorysu otočená o 90°. */
const VAC_ROOMS = {
  "1": { x0: 23200, y0: 22400, x1: 25000, y1: 25600 },
  "2": { x0: 25400, y0: 22350, x1: 30200, y1: 26500 },
  "3": { x0: 23150, y0: 25450, x1: 25400, y1: 26550 },
  "4": { x0: 25550, y0: 26550, x1: 30100, y1: 31150 },
  "5": { x0: 21950, y0: 26600, x1: 24950, y1: 28000 },
  "6": { x0: 22850, y0: 27900, x1: 25700, y1: 31150 },
  "7": { x0: 22000, y0: 29000, x1: 23950, y1: 31300 },
};
const ROOM_MAP = { "1": "koupelna", "2": "obyvak", "3": "chodba", "4": "loznice", "5": "wc", "6": "pokoj", "7": "pokoj" };

describe("parseVacuumPosition", () => {
  it("čte atributy x, y", () => {
    expect(parseVacuumPosition(ent("cokoli", { x: 25626, y: 25389, a: -83 }))).toEqual({ x: 25626, y: 25389 });
  });
  it("jinak čte JSON ve stavu", () => {
    expect(parseVacuumPosition(ent('{"x": 1, "y": 2, "a": 0}'))).toEqual({ x: 1, y: 2 });
  });
  it("neznámý stav = null", () => {
    expect(parseVacuumPosition(ent("unknown"))).toBeNull();
    expect(parseVacuumPosition(undefined)).toBeNull();
  });
});

describe("parseVacuumRooms", () => {
  it("vezme jen atributy s obdélníkem a srovná rohy", () => {
    const rooms = parseVacuumRooms(ent("2", { "1": { x0: 10, y0: 40, x1: 0, y1: 20, number: 1 }, "2": { x0: 1 }, unit_of_measurement: "rooms" }));
    expect(rooms).toEqual({ "1": { x0: 0, y0: 20, x1: 10, y1: 40 } });
  });
});

describe("fitAffine", () => {
  it("najde přesný převod se záměnou os a zrcadlením", () => {
    const f = (p: { x: number; y: number }) => ({ x: -0.5 * p.y + 100, y: 2 * p.x - 3 });
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 7, y: 3 }];
    const t = fitAffine(pts.map((p) => ({ from: p, to: f(p) })))!;
    const q = applyAffine(t, { x: 4, y: 8 });
    expect(q.x).toBeCloseTo(96);
    expect(q.y).toBeCloseTo(5);
  });
  it("body na přímce ani málo bodů nestačí", () => {
    const line = [0, 1, 2].map((i) => ({ from: { x: i, y: i }, to: { x: i, y: 0 } }));
    expect(fitAffine(line)).toBeNull();
    expect(fitAffine(line.slice(0, 2))).toBeNull();
  });
});

describe("buildVacuumMapping", () => {
  const mapping = buildVacuumMapping(VAC_ROOMS, ROOM_MAP, PLAN.rooms)!;

  it("pozná otočení skutečné mapy o 90°", () => {
    // osa x půdorysu odpovídá klesající ose y vysavače, osa y půdorysu klesající ose x
    expect(mapping.orientation).toEqual({ swap: true, flipX: true, flipY: true });
  });

  it("sloučí místnosti vysavače, které vedou do jedné místnosti", () => {
    expect(mapping.boxes.pokoj).toEqual({ x0: 22000, y0: 27900, x1: 25700, y1: 31300 });
  });

  it("přeskočí neznámé místnosti; bez spárování vrátí null", () => {
    expect(buildVacuumMapping(VAC_ROOMS, { "9": "obyvak", "1": "neni" }, PLAN.rooms)).toBeNull();
    expect(buildVacuumMapping(VAC_ROOMS, undefined, PLAN.rooms)).toBeNull();
  });

  it("s méně než 3 místnostmi použije výchozí orientaci a nemá převod celé mapy", () => {
    const m = buildVacuumMapping(VAC_ROOMS, { "2": "obyvak" }, PLAN.rooms)!;
    expect(m.transform).toBeNull();
    expect(m.orientation).toEqual({ swap: false, flipX: false, flipY: true });
  });
});

describe("vacuumPlanPosition", () => {
  const mapping = buildVacuumMapping(VAC_ROOMS, ROOM_MAP, PLAN.rooms)!;

  it("dok (místnost 2) je v obýváku vlevo dole, u chodby", () => {
    const pos = vacuumPlanPosition({ x: 25675, y: 25267 }, VAC_ROOMS, ROOM_MAP, mapping, PLAN, { vacRoomId: "2" })!;
    expect(pos.roomId).toBe("obyvak");
    expect(pos.x).toBeGreaterThan(300);
    expect(pos.x).toBeLessThan(420);
    expect(pos.y).toBeGreaterThan(250);
  });

  it("tečka zůstane uvnitř místnosti i s okrajem", () => {
    const pos = vacuumPlanPosition({ x: 99999, y: -99999 }, VAC_ROOMS, ROOM_MAP, mapping, PLAN, { vacRoomId: "4", margin: 12 })!;
    expect(pos.roomId).toBe("loznice");
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.x).toBeLessThanOrEqual(288);
    expect(pos.y).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeLessThanOrEqual(288);
  });

  it("bez senzoru místnosti se místnost pozná z obdélníku (nejmenší, který bod obsahuje)", () => {
    expect(currentPlanRoom({ x: 24000, y: 26000 }, VAC_ROOMS, ROOM_MAP, mapping)).toBe("chodba");
    expect(currentPlanRoom({ x: 28000, y: 29000 }, VAC_ROOMS, ROOM_MAP, mapping)).toBe("loznice");
  });

  it("mimo místnosti použije převod celé mapy oříznutý na půdorys", () => {
    const pos = vacuumPlanPosition({ x: 40000, y: 20000 }, VAC_ROOMS, ROOM_MAP, mapping, PLAN, { margin: 10 })!;
    expect(pos.roomId).toBeNull();
    expect(pos.x).toBeGreaterThanOrEqual(10);
    expect(pos.x).toBeLessThanOrEqual(630);
    expect(pos.y).toBeGreaterThanOrEqual(10);
    expect(pos.y).toBeLessThanOrEqual(450);
  });
});

describe("suggestVacuumSensors", () => {
  it("najde trojici senzorů se stejnou předponou", () => {
    const entities = {
      "sensor.robot_vacuum_position": ent("{}", { x: 1, y: 2 }),
      "sensor.robot_rooms": ent("1", { "1": { x0: 0, y0: 0, x1: 1, y1: 1 } }),
      "sensor.robot_vacuum_room_id": ent("1"),
      "sensor.jiny_rooms": ent("0"),
    };
    expect(suggestVacuumSensors(entities)).toEqual({
      positionEntity: "sensor.robot_vacuum_position",
      roomsEntity: "sensor.robot_rooms",
      roomEntity: "sensor.robot_vacuum_room_id",
    });
  });
  it("navrhne i obrázek mapy (image.<předpona>_live_map)", () => {
    const entities = {
      "sensor.robot_vacuum_position": ent("{}", { x: 1, y: 2 }),
      "sensor.robot_rooms": ent("1", { "1": { x0: 0, y0: 0, x1: 1, y1: 1 } }),
      "image.robot_live_map": ent("x"),
    };
    expect(suggestVacuumSensors(entities).mapEntity).toBe("image.robot_live_map");
  });
  it("bez senzorů nic nenavrhne", () => {
    expect(suggestVacuumSensors({ "sensor.teplota": ent("21") })).toEqual({});
  });
});

describe("showsLivePosition", () => {
  it("v doku se tečka neukazuje", () => {
    expect(showsLivePosition("docked")).toBe(false);
    expect(showsLivePosition("cleaning")).toBe(true);
    expect(showsLivePosition("returning")).toBe(true);
    expect(showsLivePosition(undefined)).toBe(false);
  });
});

describe("parseVacuumImage / roomPixelRect", () => {
  // skutečná kalibrace extractoru: 10 000 jednotek = 200 px, osa y obrácená
  const image = (over: Record<string, unknown> = {}) =>
    ({
      state: "x",
      attributes: {
        entity_picture: "/api/image_proxy/image.r?token=abc",
        calibration_points: [
          { vacuum: { x: 25500, y: 25500 }, map: { x: 174, y: 219 } },
          { vacuum: { x: 35500, y: 25500 }, map: { x: 374, y: 219 } },
          { vacuum: { x: 25500, y: 35500 }, map: { x: 174, y: 19 } },
        ],
        rooms: { "2": { x0: 25550, y0: 22350, x1: 30200, y1: 27200, number: 2 } },
        ...over,
      },
    }) as unknown as HassEntity;

  it("přečte adresu, kalibraci a místnosti", () => {
    const m = parseVacuumImage(image());
    expect(m?.picture).toContain("image_proxy");
    expect(Object.keys(m!.rooms)).toEqual(["2"]);
    expect(applyAffine(m!.toPixels, { x: 35500, y: 35500 })).toEqual({ x: expect.closeTo(374), y: expect.closeTo(19) });
  });
  it("obdélník místnosti v pixelech (osa y se obrátí)", () => {
    const m = parseVacuumImage(image())!;
    const r = roomPixelRect(m.toPixels, m.rooms["2"]);
    expect(r.x).toBeCloseTo(175);
    expect(r.w).toBeCloseTo(93);
    expect(r.y).toBeCloseTo(185);
    expect(r.h).toBeCloseTo(97);
  });
  it("neúplná entita → null", () => {
    expect(parseVacuumImage(undefined)).toBeNull();
    expect(parseVacuumImage(image({ entity_picture: undefined }))).toBeNull();
    expect(parseVacuumImage(image({ calibration_points: [] }))).toBeNull();
    expect(parseVacuumImage(image({ rooms: {} }))).toBeNull();
  });
});
