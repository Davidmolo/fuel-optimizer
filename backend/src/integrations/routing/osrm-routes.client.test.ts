import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOsrmCoordinatePath } from "./osrm-routes.client";

describe("buildOsrmCoordinatePath", () => {
  it("formats waypoints as lng,lat pairs separated by semicolons", () => {
    const path = buildOsrmCoordinatePath([
      { lat: 39.7555, lng: -105.2211 },
      { lat: 44.0805, lng: -103.231 },
    ]);

    assert.equal(path, "-105.2211,39.7555;-103.231,44.0805");
  });
});
