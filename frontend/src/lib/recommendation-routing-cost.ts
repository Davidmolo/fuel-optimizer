/**
 * Keep in sync with backend/src/modules/recommendation/routing-cost.ts
 *
 * Pricing source: https://developers.google.com/maps/billing-and-pricing/pricing
 */

export const ROUTE_MATRIX_BATCH_SIZE = 25;
export const GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD = 10;

export const GOOGLE_ROUTES_PRO_SKU = {
  computeRoutes: "Routes: Compute Routes Pro",
  computeRouteMatrix: "Routes: Compute Route Matrix Pro",
} as const;

export type RecommendationRoutingCostEstimate = {
  maxRoutingLookups: number;
  billableEvents: {
    computeRoutes: number;
    computeRouteMatrix: number;
    total: number;
  };
  apiCalls: {
    computeRoutes: number;
    computeRouteMatrix: number;
    total: number;
  };
  pricing: {
    sku: typeof GOOGLE_ROUTES_PRO_SKU;
    pricePerThousandUsd: number;
    pricingDocUrl: string;
  };
  costUsd: {
    computeRoutes: number;
    computeRouteMatrix: number;
    perRequestWorstCase: number;
  };
};

function roundUsd(amount: number) {
  return Math.round(amount * 1000) / 1000;
}

function costForBillableEvents(events: number, pricePerThousandUsd: number) {
  if (events <= 0) {
    return 0;
  }

  return roundUsd((events / 1000) * pricePerThousandUsd);
}

function clampRoutingLookups(value: number) {
  if (!Number.isFinite(value)) {
    return 25;
  }

  return Math.min(100, Math.max(5, Math.round(value)));
}

export function estimateRecommendationRoutingCost(maxRoutingLookups: number): RecommendationRoutingCostEstimate {
  const lookups = clampRoutingLookups(maxRoutingLookups);
  const computeRoutesEvents = 1;
  const computeRouteMatrixEvents = lookups;
  const matrixApiCalls = Math.ceil(lookups / ROUTE_MATRIX_BATCH_SIZE);

  const computeRoutesCost = costForBillableEvents(computeRoutesEvents, GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD);
  const computeRouteMatrixCost = costForBillableEvents(
    computeRouteMatrixEvents,
    GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD,
  );

  return {
    maxRoutingLookups: lookups,
    billableEvents: {
      computeRoutes: computeRoutesEvents,
      computeRouteMatrix: computeRouteMatrixEvents,
      total: computeRoutesEvents + computeRouteMatrixEvents,
    },
    apiCalls: {
      computeRoutes: 1,
      computeRouteMatrix: matrixApiCalls,
      total: 1 + matrixApiCalls,
    },
    pricing: {
      sku: GOOGLE_ROUTES_PRO_SKU,
      pricePerThousandUsd: GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD,
      pricingDocUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    },
    costUsd: {
      computeRoutes: computeRoutesCost,
      computeRouteMatrix: computeRouteMatrixCost,
      perRequestWorstCase: roundUsd(computeRoutesCost + computeRouteMatrixCost),
    },
  };
}

export function formatRoutingCostUsd(amount: number) {
  if (amount === 0) {
    return "$0.00";
  }

  if (amount < 0.01) {
    return `$${amount.toFixed(3)}`;
  }

  return `$${amount.toFixed(2)}`;
}

export function formatMonthlyCostUsd(recommendationsPerMonth: number, costPerRequestUsd: number) {
  const total = Math.round(recommendationsPerMonth * costPerRequestUsd * 1000) / 1000;
  return formatRoutingCostUsd(total);
}
