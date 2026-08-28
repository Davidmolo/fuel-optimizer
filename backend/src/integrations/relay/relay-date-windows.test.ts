import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS, splitDateRangeIntoWindows } from "./relay-date-windows";

describe("splitDateRangeIntoWindows", () => {
  it("returns a single window when the range fits in one chunk", () => {
    const windows = splitDateRangeIntoWindows(
      "2026-06-25T00:00:00.000Z",
      "2026-06-30T00:00:00.000Z",
      DEFAULT_RELAY_TRANSACTION_CHUNK_DAYS,
    );

    assert.equal(windows.length, 1);
    assert.equal(windows[0]?.dtstart, "2026-06-25T00:00:00.000Z");
    assert.equal(windows[0]?.dtend, "2026-06-30T00:00:00.000Z");
  });

  it("splits a 30-day range into consecutive 7-day windows", () => {
    const windows = splitDateRangeIntoWindows(
      "2026-06-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      7,
    );

    assert.equal(windows.length, 5);
    assert.equal(windows[0]?.dtstart, "2026-06-01T00:00:00.000Z");
    assert.equal(windows[0]?.dtend, "2026-06-08T00:00:00.000Z");
    assert.equal(windows[4]?.dtstart, "2026-06-29T00:00:00.000Z");
    assert.equal(windows[4]?.dtend, "2026-07-01T00:00:00.000Z");

    for (let index = 1; index < windows.length; index += 1) {
      assert.equal(windows[index]?.dtstart, windows[index - 1]?.dtend);
    }
  });

  it("returns the original window for invalid ranges", () => {
    const windows = splitDateRangeIntoWindows("invalid", "2026-07-01T00:00:00.000Z");
    assert.deepEqual(windows, [{ dtstart: "invalid", dtend: "2026-07-01T00:00:00.000Z" }]);
  });
});
