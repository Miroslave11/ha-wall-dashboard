import { describe, expect, it } from "vitest";
import { selectedSegments, vacuumRoomChoices } from "./vacuumRooms";

const rooms = [
  { id: "obyvak", name: "Obývák" },
  { id: "pokoj", name: "Pokoj" },
  { id: "koupelna", name: "Koupelna" },
];

describe("vacuumRoomChoices", () => {
  it("sloučí segmenty do jedné místnosti, názvy z půdorysu, pořadí podle čísla", () => {
    const c = vacuumRoomChoices({ roomMap: { "6": "pokoj", "2": "obyvak", "7": "pokoj", "1": "koupelna" } }, rooms);
    expect(c).toEqual([
      { roomId: "koupelna", name: "Koupelna", segments: [1] },
      { roomId: "obyvak", name: "Obývák", segments: [2] },
      { roomId: "pokoj", name: "Pokoj", segments: [6, 7] },
    ]);
  });
  it("neznámá místnost pod svým id, neplatné číslo se přeskočí, bez roomMap prázdné", () => {
    expect(vacuumRoomChoices({ roomMap: { "3": "chodba", x: "obyvak", "0": "obyvak" } }, rooms)).toEqual([{ roomId: "chodba", name: "chodba", segments: [3] }]);
    expect(vacuumRoomChoices({}, rooms)).toEqual([]);
    expect(vacuumRoomChoices(undefined, rooms)).toEqual([]);
  });
});

describe("selectedSegments", () => {
  const c = vacuumRoomChoices({ roomMap: { "1": "koupelna", "2": "obyvak", "6": "pokoj", "7": "pokoj" } }, rooms);
  it("segmenty vybraných místností vzestupně", () => expect(selectedSegments(c, new Set(["pokoj", "koupelna"]))).toEqual([1, 6, 7]));
  it("nic nevybráno = prázdné", () => expect(selectedSegments(c, new Set())).toEqual([]));
});
