import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractUnitNumberFromExternalName,
  isDispatchableCopilotAsset,
  toCopilotAssetMatch,
} from "./copilot-asset-matching";

describe("extractUnitNumberFromExternalName", () => {
  it("reads the unit after #", () => {
    assert.equal(extractUnitNumberFromExternalName("Lyndon Smith #239"), "239");
    assert.equal(extractUnitNumberFromExternalName("Thomas Torres #210 (438335)"), "210");
  });

  it("reads a leading unit when ExternalName is like 244 (Eric)", () => {
    assert.equal(extractUnitNumberFromExternalName("244 (Eric)"), "244");
  });

  it("returns null when there is no unit", () => {
    assert.equal(extractUnitNumberFromExternalName("999"), null);
  });
});

describe("isDispatchableCopilotAsset", () => {
  it("accepts an Activated Trip Management asset with a unit", () => {
    const result = isDispatchableCopilotAsset({
      assetId: "1002",
      externalName: "Lyndon Smith #239",
      dispatcherName: "Alex M",
      status: "Activated",
      productAddons: "TripManagement",
    });

    assert.deepEqual(result, { ok: true, unitNumber: "239" });
  });

  it("rejects the test tablet", () => {
    const result = isDispatchableCopilotAsset({
      assetId: "999",
      externalName: "999",
      status: "Activated",
      productAddons: "TripManagement",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "test_tablet");
    }
  });

  it("rejects CoPilot-only assets without Trip Management", () => {
    const result = isDispatchableCopilotAsset({
      assetId: "GOXXII_066",
      externalName: "Cheryl Day #623",
      status: "Activated",
      productAddons: "",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "missing_trip_management");
    }
  });

  it("rejects Assigned (not Activated) assets", () => {
    const match = toCopilotAssetMatch({
      assetId: "1020",
      externalName: "Joseph Wimmer #187",
      status: "Assigned",
      productAddons: "TripManagement",
    });

    assert.equal(match.dispatchable, false);
    assert.equal(match.skipReason, "not_activated");
  });
});
