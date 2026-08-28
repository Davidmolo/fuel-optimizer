"use client";

import { useEffect, useState } from "react";
import Button from "@/components/common/button";
import { IconCircleDollar } from "@/components/common/icons";
import {
  estimateRecommendationRoutingCost,
  formatMonthlyCostUsd,
  formatRoutingCostUsd,
} from "@/lib/recommendation-routing-cost";

type RecommendationRoutingCostEstimatorProps = {
  maxRoutingLookups: string;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-muted/40 px-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function RoutingCostEstimateContent({ maxRoutingLookups }: RecommendationRoutingCostEstimatorProps) {
  const estimate = estimateRecommendationRoutingCost(Number(maxRoutingLookups));
  const perEventUsd = estimate.pricing.pricePerThousandUsd / 1000;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted">
          Production estimate when all {estimate.maxRoutingLookups} routing slots are used. Actual cost is usually lower
          when fewer stations pass filters.
        </p>
        <p className="shrink-0 text-lg font-semibold text-foreground">
          {formatRoutingCostUsd(estimate.costUsd.perRequestWorstCase)}
          <span className="ml-1 text-sm font-normal text-muted">/ request</span>
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat
          label="Route cost"
          value={`${estimate.billableEvents.computeRoutes} event × ${formatRoutingCostUsd(perEventUsd)} = ${formatRoutingCostUsd(estimate.costUsd.computeRoutes)}`}
        />
        <Stat
          label="Distance matrix cost"
          value={`${estimate.billableEvents.computeRouteMatrix} events × ${formatRoutingCostUsd(perEventUsd)} = ${formatRoutingCostUsd(estimate.costUsd.computeRouteMatrix)}`}
        />
        <Stat
          label="100 recommendations"
          value={formatRoutingCostUsd(estimate.costUsd.perRequestWorstCase * 100)}
        />
        <Stat
          label="1,000 recommendations"
          value={formatRoutingCostUsd(estimate.costUsd.perRequestWorstCase * 1_000)}
        />
      </dl>

      <div className="space-y-2 text-xs text-muted">
        <p>
          Based on Google Maps Platform list pricing for traffic-aware routing (
          {formatRoutingCostUsd(perEventUsd)} per billable event). Your bill may vary with volume discounts.
        </p>
        <p>
          Monthly production examples if every request uses the full shortlist: 50 recs/day ≈{" "}
          {formatMonthlyCostUsd(1_500, estimate.costUsd.perRequestWorstCase)}, 100 recs/day ≈{" "}
          {formatMonthlyCostUsd(3_000, estimate.costUsd.perRequestWorstCase)}, 500 recs/day ≈{" "}
          {formatMonthlyCostUsd(15_000, estimate.costUsd.perRequestWorstCase)}.
        </p>
        <p>
          <a
            href={estimate.pricing.pricingDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Google Maps Platform pricing
          </a>
        </p>
      </div>
    </div>
  );
}

export default function RecommendationRoutingCostEstimator({
  maxRoutingLookups,
}: RecommendationRoutingCostEstimatorProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
        title="Estimate Google routing cost"
      >
        <IconCircleDollar className="h-4 w-4" />
        Estimate cost
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 sm:p-8">
          <div className="absolute inset-0" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="routing-cost-title"
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Production cost</p>
                <h2 id="routing-cost-title" className="mt-1 text-lg font-semibold text-foreground">
                  Google routing estimate
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-lg)] px-2 py-1 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 sm:px-6">
              <RoutingCostEstimateContent maxRoutingLookups={maxRoutingLookups} />
            </div>

            <div className="flex shrink-0 justify-end border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
