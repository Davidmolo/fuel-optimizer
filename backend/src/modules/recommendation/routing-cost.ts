/**
 * Google Routes API billing estimates for one fuel recommendation request.
 *
 * Pricing source (USD, global):
 * https://developers.google.com/maps/billing-and-pricing/pricing
 *
 * Our integration uses TRAFFIC_AWARE routing, which bills at the Pro SKU:
 * - Routes: Compute Routes Pro (1 request per recommendation)
 * - Routes: Compute Route Matrix Pro (1 origin × N destinations per recommendation)
 */

/** Must match `ROUTE_MATRIX_BATCH_SIZE` in integrations/routing/routing.config.ts */
export const ROUTE_MATRIX_BATCH_SIZE = 25;

/** Google Maps Platform list price for the first paid tier (5,001–100,000 events/month). */
export const GOOGLE_ROUTES_PRO_PRICE_PER_1000_USD = 10;

/** Free monthly billable events per Pro SKU (separate caps for Routes and Matrix). */
export const GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP = 5_000;

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
    freeMonthlyCapPerSku: number;
    pricingDocUrl: string;
  };
  costUsd: {
    computeRoutes: number;
    computeRouteMatrix: number;
    perRequestWorstCase: number;
  };
  freeTier: {
    fullyFreeRecommendationsPerMonth: number;
    limitingSku: "computeRoutes" | "computeRouteMatrix";
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

/**
 * Worst-case paid cost for one recommendation when the shortlist fills every
 * routing lookup slot. Actual cost is lower when fewer stations pass filters
 * or when monthly usage is still inside Google's free tier.
 */
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

  const freeByRoutes = Math.floor(GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP / computeRoutesEvents);
  const freeByMatrix = Math.floor(GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP / computeRouteMatrixEvents);
  const fullyFreeRecommendationsPerMonth = Math.min(freeByRoutes, freeByMatrix);

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
      freeMonthlyCapPerSku: GOOGLE_ROUTES_PRO_FREE_MONTHLY_CAP,
      pricingDocUrl: "https://developers.google.com/maps/billing-and-pricing/pricing",
    },
    costUsd: {
      computeRoutes: computeRoutesCost,
      computeRouteMatrix: computeRouteMatrixCost,
      perRequestWorstCase: roundUsd(computeRoutesCost + computeRouteMatrixCost),
    },
    freeTier: {
      fullyFreeRecommendationsPerMonth,
      limitingSku: freeByMatrix <= freeByRoutes ? "computeRouteMatrix" : "computeRoutes",
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
