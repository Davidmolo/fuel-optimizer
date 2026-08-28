import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEncodedPolyline } from "./decode-polyline";
import { metersToMiles, parseDurationMinutes } from "./routing.config";

describe("decodeEncodedPolyline", () => {
  it("decodes a known Google encoded polyline", () => {
    const points = decodeEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    assert.equal(points.length, 3);
    assert.ok(points.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)));
  });
});

describe("routing helpers", () => {
  it("converts meters to miles", () => {
    assert.ok(Math.abs(metersToMiles(1609.344) - 1) < 0.001);
  });

  it("parses Google duration strings", () => {
    assert.equal(parseDurationMinutes("165s"), 2.8);
    assert.equal(parseDurationMinutes("3600s"), 60);
  });
});
