import type { RoomConfig, VacuumConfig } from "../config/types";

/** Místnost nabízená v okně vysavače: jedna položka může mít víc segmentů vysavače (např. dva pokoje = jeden „pokoj“). */
export interface VacuumRoomChoice {
  /** id místnosti v půdorysu */
  roomId: string;
  name: string;
  /** čísla segmentů vysavače (klíče `roomMap`) */
  segments: number[];
}

/**
 * Místnosti, do kterých jde vysavač poslat: z `vacuum.roomMap` (číslo segmentu → id místnosti), názvy z půdorysu.
 * Segmenty vedoucí do stejné místnosti se sloučí; pořadí podle nejnižšího čísla segmentu.
 * Neznámé id místnosti se ukáže pod svým id, neplatné číslo segmentu se přeskočí.
 */
export function vacuumRoomChoices(vacuum: Pick<VacuumConfig, "roomMap"> | undefined, rooms: Pick<RoomConfig, "id" | "name">[]): VacuumRoomChoice[] {
  const byRoom = new Map<string, VacuumRoomChoice>();
  const entries = Object.entries(vacuum?.roomMap ?? {})
    .map(([num, roomId]) => ({ num: Number(num), roomId }))
    .filter((e) => Number.isInteger(e.num) && e.num > 0)
    .sort((a, b) => a.num - b.num);
  for (const { num, roomId } of entries) {
    const existing = byRoom.get(roomId);
    if (existing) existing.segments.push(num);
    else byRoom.set(roomId, { roomId, name: rooms.find((r) => r.id === roomId)?.name ?? roomId, segments: [num] });
  }
  return [...byRoom.values()];
}

/** Čísla segmentů vybraných místností (bez duplicit, vzestupně). */
export function selectedSegments(choices: VacuumRoomChoice[], selected: ReadonlySet<string>): number[] {
  return [...new Set(choices.filter((c) => selected.has(c.roomId)).flatMap((c) => c.segments))].sort((a, b) => a - b);
}

/** Český popis stavu vysavače. */
export const VACUUM_STATES: Record<string, string> = {
  cleaning: "Uklízí",
  docked: "V doku",
  returning: "Vrací se do doku",
  idle: "Nečinný",
  paused: "Pozastaven",
  error: "Chyba",
  unavailable: "Nedostupný",
};
