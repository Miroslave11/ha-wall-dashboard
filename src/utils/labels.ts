import type { LabelPos } from "../config/types";

/** Popisek mimo dlaždici (nad / pod místností)? */
export function isOutsideLabel(pos: LabelPos | undefined): pos is "above" | "below" {
  return pos === "above" || pos === "below";
}

/** Všechny polohy s českým názvem – pro výběr v Nastavení. */
export const LABEL_POSITIONS: Array<{ id: LabelPos; label: string }> = [
  { id: "top-left", label: "Vlevo nahoře (výchozí)" },
  { id: "top-right", label: "Vpravo nahoře" },
  { id: "bottom-left", label: "Vlevo dole" },
  { id: "bottom-right", label: "Vpravo dole" },
  { id: "center", label: "Uprostřed" },
  { id: "above", label: "Nad místností (mimo plochu)" },
  { id: "below", label: "Pod místností (mimo plochu)" },
];
