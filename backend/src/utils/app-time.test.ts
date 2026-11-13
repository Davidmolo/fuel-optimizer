import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arizonaTodayIso, formatMmddyy, isoDateFromParts } from "./app-time";

describe("app time", () => {
  it("rejects calendar dates that are not real", () => {
    assert.equal(isoDateFromParts(2026, 2, 31), undefined);
    assert.equal(isoDateFromParts(2026, 13, 1), undefined);
    assert.equal(isoDateFromParts(2024, 2, 29), "2024-02-29");
  });

  it("formats a calendar date as mmddyy", () => {
    assert.equal(formatMmddyy("2026-11-11"), "111126");
  });

  it("reads today in Arizona", () => {
    assert.equal(arizonaTodayIso(new Date("2026-11-14T06:30:00.000Z")), "2026-11-13");
    assert.equal(arizonaTodayIso(new Date("2026-11-14T07:00:00.000Z")), "2026-11-14");
  });
});
