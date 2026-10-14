import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenRoadManagerLabelMap } from "./openroad-manager-label";

describe("buildOpenRoadManagerLabelMap", () => {
  it("uses first name alone when unique", () => {
    const labels = buildOpenRoadManagerLabelMap([
      { id: 1, name: "Dylan", lastname: "Ristic" },
      { id: 2, name: "Andre", lastname: "Colton" },
    ]);
    assert.equal(labels.get(1), "Dylan");
    assert.equal(labels.get(2), "Andre");
  });

  it("disambiguates duplicate first names with last initial", () => {
    const labels = buildOpenRoadManagerLabelMap([
      { id: 30576, name: "Alex", lastname: "Mladenovski" },
      { id: 29532, name: "Alex", lastname: "V" },
    ]);
    assert.equal(labels.get(30576), "Alex M");
    assert.equal(labels.get(29532), "Alex V");
  });
});
