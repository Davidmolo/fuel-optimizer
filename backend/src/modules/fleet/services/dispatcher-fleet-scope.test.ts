import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveDriverAcceptLabel,
  dispatcherNamesMatch,
  evaluateCopilotSendReadiness,
  normalizeDispatcherName,
  truckUnitInScope,
} from "./dispatcher-fleet-scope";

describe("normalizeDispatcherName", () => {
  it("trims and nulls empty values", () => {
    assert.equal(normalizeDispatcherName("  Dylan  "), "Dylan");
    assert.equal(normalizeDispatcherName("   "), null);
    assert.equal(normalizeDispatcherName(undefined), null);
  });
});

describe("dispatcherNamesMatch", () => {
  it("matches case-insensitively", () => {
    assert.equal(dispatcherNamesMatch("Dylan", "dylan"), true);
    assert.equal(dispatcherNamesMatch("Alex", "Alex M"), false);
  });
});

describe("truckUnitInScope", () => {
  it("allows all units in all mode", () => {
    assert.equal(truckUnitInScope({ mode: "all" }, "239"), true);
  });

  it("blocks when none or unit missing from dispatcher list", () => {
    assert.equal(truckUnitInScope({ mode: "none", reason: "x" }, "239"), false);
    assert.equal(
      truckUnitInScope({ mode: "dispatcher", dispatcherName: "Dylan", unitNumbers: ["100"] }, "239"),
      false,
    );
    assert.equal(
      truckUnitInScope({ mode: "dispatcher", dispatcherName: "Dylan", unitNumbers: ["239"] }, "239"),
      true,
    );
  });
});

describe("evaluateCopilotSendReadiness", () => {
  it("blocks missing vehicle, test tablet, and inactive licenses", () => {
    assert.equal(evaluateCopilotSendReadiness(null).canSend, false);
    assert.equal(
      evaluateCopilotSendReadiness({
        trimbleAssetId: "999",
        tripManagementEnabled: true,
        copilotStatus: "Activated",
      }).canSend,
      false,
    );
    assert.equal(
      evaluateCopilotSendReadiness({
        trimbleAssetId: "1000",
        tripManagementEnabled: false,
        copilotStatus: "Activated",
      }).canSend,
      false,
    );
    assert.equal(
      evaluateCopilotSendReadiness({
        trimbleAssetId: "1000",
        tripManagementEnabled: true,
        copilotStatus: "Assigned",
      }).canSend,
      false,
    );
  });

  it("allows activated Trip Management tablets", () => {
    const readiness = evaluateCopilotSendReadiness({
      trimbleAssetId: "1000",
      tripManagementEnabled: true,
      copilotStatus: "Activated",
      dispatcherName: "Dylan",
    });
    assert.equal(readiness.canSend, true);
    assert.equal(readiness.trimbleAssetId, "1000");
  });
});

describe("deriveDriverAcceptLabel", () => {
  it("maps Trimble statuses to accept labels", () => {
    assert.equal(deriveDriverAcceptLabel("InProgress"), "accepted");
    assert.equal(deriveDriverAcceptLabel("Dispatched"), "waiting");
    assert.equal(deriveDriverAcceptLabel("Declined"), "declined");
    assert.equal(deriveDriverAcceptLabel(undefined), "not_sent");
  });
});
