import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveDriverAcceptLabel,
  dispatcherNamesMatch,
  evaluateCopilotSendReadiness,
  normalizeDispatcherName,
  truckUnitInScope,
  unitNumbersForManagedDrivers,
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
      truckUnitInScope(
        {
          mode: "dispatcher",
          dispatcherName: "Dylan",
          unitNumbers: ["100"],
          openroadDriverIds: [],
          source: "trimble_firstname",
        },
        "239",
      ),
      false,
    );
    assert.equal(
      truckUnitInScope(
        {
          mode: "dispatcher",
          dispatcherName: "Dylan",
          unitNumbers: ["239"],
          openroadDriverIds: [],
          source: "trimble_firstname",
        },
        "239",
      ),
      true,
    );
  });

  it("scopes a dispatcher role to only their assigned units", () => {
    const dylanScope = {
      mode: "dispatcher" as const,
      dispatcherName: "Dylan",
      unitNumbers: ["100", "101"],
      openroadDriverIds: [1, 2],
      source: "openroad_manager" as const,
    };
    assert.equal(truckUnitInScope(dylanScope, "100"), true);
    assert.equal(truckUnitInScope(dylanScope, "200"), false);

    const unassignedScope = {
      mode: "none" as const,
      reason:
        "No dispatcher fleet assigned. Ask an admin to link your account to OpenRoad (email match) or a Trimble dispatcher name.",
    };
    assert.equal(truckUnitInScope(unassignedScope, "100"), false);
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

describe("unitNumbersForManagedDrivers", () => {
  it("returns only current truck units for managed OpenRoad drivers", () => {
    const units = unitNumbersForManagedDrivers(
      [10, 20, 30],
      [
        { openroadDriverId: 10, truckUnit: "192", isCurrent: true },
        { openroadDriverId: 20, truckUnit: "266", isCurrent: true },
        { openroadDriverId: 30, truckUnit: "999", isCurrent: false },
        { openroadDriverId: 99, truckUnit: "111", isCurrent: true },
        { openroadDriverId: 10, truckUnit: " 192 ", isCurrent: true },
      ],
    );
    assert.deepEqual(units.sort(), ["192", "266"]);
  });

  it("does not include other managers' trucks", () => {
    const units = unitNumbersForManagedDrivers(
      [30576],
      [{ openroadDriverId: 1, truckUnit: "254", isCurrent: true }],
    );
    assert.deepEqual(units, []);
  });
});
