import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveContractPricing,
  type MerchantContractRule,
} from "./contract-pricing.engine";
import { normalizeMerchantKey } from "../utils/merchant-key";

const relayContracts: MerchantContractRule[] = [
  {
    merchantKey: "loves",
    merchantDisplayName: "Love's",
    isActive: true,
  },
  {
    merchantKey: "pilot",
    merchantDisplayName: "Pilot",
    isActive: true,
  },
];

describe("normalizeMerchantKey", () => {
  it("normalizes Love's merchant aliases", () => {
    assert.equal(normalizeMerchantKey("Love's"), "loves");
    assert.equal(normalizeMerchantKey("Love's Travel Stop"), "loves");
  });

  it("normalizes Pilot merchant aliases", () => {
    assert.equal(normalizeMerchantKey("Pilot"), "pilot");
    assert.equal(normalizeMerchantKey("Pilot Flying J"), "pilot");
  });
});

describe("resolveContractPricing", () => {
  const relayStation = {
    relayLocationId: "loc-100",
    discountedPricePerUnit: 3.669,
    retailPricePerUnit: 3.994,
  };

  it("uses Relay discounted price as effective price when no extra adjustment is configured", () => {
    const result = resolveContractPricing(
      { ...relayStation, merchantName: "Pilot" },
      relayContracts,
    );

    assert.equal(result.available, true);
    if (result.available) {
      assert.equal(result.effectivePricePerGallon, 3.669);
      assert.equal(result.relayDiscountedPricePerGallon, 3.669);
      assert.equal(result.retailPricePerGallon, 3.994);
      assert.equal(result.rateAdjustmentPerGallon, 0);
      assert.equal(result.basePriceSource, "relay_discounted");
    }
  });

  it("applies optional extra adjustment on top of Relay discounted price", () => {
    const contracts: MerchantContractRule[] = [
      {
        merchantKey: "loves",
        merchantDisplayName: "Love's",
        rateAdjustmentPerGallon: -0.06,
        isActive: true,
      },
    ];

    const result = resolveContractPricing(
      { ...relayStation, merchantName: "Love's", discountedPricePerUnit: 3.5 },
      contracts,
    );

    assert.equal(result.available, true);
    if (result.available) {
      assert.equal(result.effectivePricePerGallon, 3.44);
      assert.equal(result.rateAdjustmentPerGallon, -0.06);
      assert.equal(result.basePriceSource, "relay_discounted");
    }
  });

  it("returns not available when merchant has no contract", () => {
    const result = resolveContractPricing(
      { ...relayStation, merchantName: "TA Petro" },
      relayContracts,
    );

    assert.deepEqual(result, {
      available: false,
      reason: "no_contract",
      merchantKey: "ta petro",
    });
  });

  it("returns not available when station has no Relay pricing", () => {
    const result = resolveContractPricing(
      {
        relayLocationId: "loc-200",
        merchantName: "Love's",
      },
      relayContracts,
    );

    assert.deepEqual(result, {
      available: false,
      reason: "no_base_price",
      merchantKey: "loves",
    });
  });

  it("falls back to retail when Relay discounted price is missing", () => {
    const result = resolveContractPricing(
      {
        relayLocationId: "loc-300",
        merchantName: "Pilot",
        retailPricePerUnit: 3.8,
      },
      relayContracts,
    );

    assert.equal(result.available, true);
    if (result.available) {
      assert.equal(result.basePricePerGallon, 3.8);
      assert.equal(result.effectivePricePerGallon, 3.8);
      assert.equal(result.basePriceSource, "retail");
      assert.equal(result.relayDiscountedPricePerGallon, undefined);
    }
  });

  it("excludes stations outside covered relay location list", () => {
    const contracts: MerchantContractRule[] = [
      {
        merchantKey: "loves",
        merchantDisplayName: "Love's",
        coveredRelayLocationIds: ["loc-covered"],
        isActive: true,
      },
    ];

    const result = resolveContractPricing(
      { ...relayStation, merchantName: "Love's", relayLocationId: "loc-other" },
      contracts,
    );

    assert.deepEqual(result, {
      available: false,
      reason: "station_not_covered",
      merchantKey: "loves",
    });
  });

  it("returns contract_inactive when effective dates are outside evaluation window", () => {
    const contracts: MerchantContractRule[] = [
      {
        merchantKey: "loves",
        merchantDisplayName: "Love's",
        effectiveFrom: new Date("2027-01-01"),
        isActive: true,
      },
    ];

    const result = resolveContractPricing(
      { ...relayStation, merchantName: "Love's" },
      contracts,
      { asOf: new Date("2026-06-30") },
    );

    assert.deepEqual(result, {
      available: false,
      reason: "contract_inactive",
      merchantKey: "loves",
    });
  });
});
