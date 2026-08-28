import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateRecommendationRoutingCost,
  formatRoutingCostUsd,
  GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP,
  GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD,
} from "./routing-cost";

describe("estimateRecommendationRoutingCost", () => {
  it("matches Google Pro SKU billing for default 25 lookups", () => {
    const estimate = estimateRecommendationRoutingCost(25);

    assert.equal(estimate.billableEvents.computeRoutes, 1);
    assert.equal(estimate.billableEvents.computeRouteMatrix, 25);
    assert.equal(estimate.apiCalls.computeRouteMatrix, 1);
    assert.equal(estimate.costUsd.computeRoutes, 0.01);
    assert.equal(estimate.costUsd.computeRouteMatrix, 0.25);
    assert.equal(estimate.costUsd.perRequestWorstCase, 0.26);
    assert.equal(estimate.freeTier.fullyFreeRecommendationsPerMonth, 200);
    assert.equal(estimate.freeTier.limitingSku, "computeRouteMatrix");
  });

  it("batches matrix API calls in groups of 25", () => {
    assert.equal(estimateRecommendationRoutingCost(25).apiCalls.computeRouteMatrix, 1);
    assert.equal(estimateRecommendationRoutingCost(26).apiCalls.computeRouteMatrix, 2);
    assert.equal(estimateRecommendationRoutingCost(100).apiCalls.computeRouteMatrix, 4);
  });

  it("clamps lookups to configured min and max", () => {
    assert.equal(estimateRecommendationRoutingCost(3).maxRoutingLookups, 5);
    assert.equal(estimateRecommendationRoutingCost(150).maxRoutingLookups, 100);
  });

  it("uses official list price constants", () => {
    assert.equal(GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD, 10);
    assert.equal(GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP, 5_000);
  });
});

describe("formatRoutingCostUsd", () => {
  it("formats common amounts", () => {
    assert.equal(formatRoutingCostUsd(0), "$0.00");
    assert.equal(formatRoutingCostUsd(0.01), "$0.01");
    assert.equal(formatRoutingCostUsd(0.26), "$0.26");
    assert.equal(formatRoutingCostUsd(1.01), "$1.01");
  });
});
