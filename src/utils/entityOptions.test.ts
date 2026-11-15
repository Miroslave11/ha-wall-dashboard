import type { HassEntities } from "home-assistant-js-websocket";
import { describe, expect, it } from "vitest";
import { fold, listEntityOptions, suggestRoomFromArea, uniqueRoomId } from "./entityOptions";
import type { HaRegistry } from "./registry";

const ent = (state: string, attributes: Record<string, unknown> = {}) => ({ state, attributes }) as unknown as HassEntities[string];

const entities: HassEntities = {
  "switch.vypinac_pracovna": ent("off", { friendly_name: "Světlo v pracovně" }),
  "switch.zasuvka_pracovna": ent("on", { friendly_name: "Zásuvka", device_class: "outlet" }),
  "light.obyvak": ent("on", { friendly_name: "Obývák" }),
  "sensor.teplomer_pracovna_temperature": ent("22.3", { friendly_name: "Teplota pracovna", device_class: "temperature" }),
  "sensor.teplomer_pracovna_humidity": ent("68", { friendly_name: "Vlhkost pracovna", device_class: "humidity" }),
  "sensor.venku": ent("1.7", { friendly_name: "Venku", device_class: "temperature" }),
  "binary_sensor.pir_pracovna_occupancy": ent("off", { friendly_name: "PIR", device_class: "occupancy" }),
  "select.vypinac_pracovna_switch_type": ent("toggle", { friendly_name: "Typ spínače" }),
};

const registry: HaRegistry = {
  areas: [{ id: "pracovna", name: "Pracovna" }],
  entityArea: {
    "switch.vypinac_pracovna": "pracovna",
    "switch.zasuvka_pracovna": "pracovna",
    "sensor.teplomer_pracovna_temperature": "pracovna",
    "sensor.teplomer_pracovna_humidity": "pracovna",
    "binary_sensor.pir_pracovna_occupancy": "pracovna",
    "select.vypinac_pracovna_switch_type": "pracovna",
  },
  excluded: ["select.vypinac_pracovna_switch_type"],
};

describe("listEntityOptions", () => {
  it("filtruje podle domény a řadí oblast místnosti nahoru", () => {
    const opts = listEntityOptions(entities, registry, { domains: ["light", "switch"], areaId: "pracovna" });
    expect(opts.map((o) => o.id)).toEqual(["switch.vypinac_pracovna", "switch.zasuvka_pracovna", "light.obyvak"]);
    expect(opts[0].preferred).toBe(true);
    expect(opts[2].preferred).toBe(false);
  });

  it("device_class posouvá nahoru, hledání ignoruje diakritiku", () => {
    const temps = listEntityOptions(entities, registry, { domains: ["sensor"], deviceClasses: ["temperature"] });
    expect(temps.slice(0, 2).map((o) => o.id).sort()).toEqual(["sensor.teplomer_pracovna_temperature", "sensor.venku"]);
    const found = listEntityOptions(entities, registry, { domains: ["switch"] }, "pracovne");
    expect(found.map((o) => o.id)).toEqual(["switch.vypinac_pracovna"]);
  });

  it("konfigurační entity nabídne jen při hledání", () => {
    expect(listEntityOptions(entities, registry, { domains: ["select"] })).toEqual([]);
    expect(listEntityOptions(entities, registry, { domains: ["select"] }, "typ")).toHaveLength(1);
  });
});

describe("suggestRoomFromArea", () => {
  it("najde vypínač světla (bez zásuvky), teploměr, vlhkoměr a pohyb", () => {
    expect(suggestRoomFromArea("pracovna", entities, registry)).toEqual({
      lights: ["switch.vypinac_pracovna"],
      temperature: "sensor.teplomer_pracovna_temperature",
      humidity: "sensor.teplomer_pracovna_humidity",
      motion: "binary_sensor.pir_pracovna_occupancy",
    });
  });
  it("prázdná oblast nic nevymyslí", () => {
    expect(suggestRoomFromArea("nic", entities, registry)).toEqual({ lights: [] });
  });
});

describe("uniqueRoomId / fold", () => {
  it("ID z názvu bez diakritiky a unikátní", () => {
    expect(fold("Dětský Pokoj")).toBe("detsky pokoj");
    expect(uniqueRoomId("Dětský pokoj", [])).toBe("detsky_pokoj");
    expect(uniqueRoomId("Pracovna", ["pracovna", "pracovna_2"])).toBe("pracovna_3");
    expect(uniqueRoomId("???", [])).toBe("mistnost");
  });
});
