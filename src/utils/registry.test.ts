import { describe, expect, it } from "vitest";
import { buildRegistry } from "./registry";

describe("buildRegistry", () => {
  it("oblast entity: vlastní, jinak podle zařízení; skryté a konfigurační vyřadí", () => {
    const r = buildRegistry(
      [
        { area_id: "pracovna", name: "Pracovna" },
        { area_id: "loznice", name: "Ložnice" },
      ],
      [{ id: "dev1", area_id: "pracovna" }, { id: "dev2" }],
      [
        { entity_id: "switch.vypinac_pracovna", device_id: "dev1" },
        { entity_id: "sensor.teplota", device_id: "dev1", area_id: "loznice" },
        { entity_id: "select.vypinac_pracovna_switch_type", device_id: "dev1", entity_category: "config" },
        { entity_id: "light.skryte", device_id: "dev2", hidden_by: "user" },
      ],
    );
    expect(r.areas.map((a) => a.name)).toEqual(["Ložnice", "Pracovna"]);
    expect(r.entityArea["switch.vypinac_pracovna"]).toBe("pracovna");
    expect(r.entityArea["sensor.teplota"]).toBe("loznice");
    expect(r.entityArea["light.skryte"]).toBeUndefined();
    expect(r.excluded).toEqual(["select.vypinac_pracovna_switch_type", "light.skryte"]);
  });
});
