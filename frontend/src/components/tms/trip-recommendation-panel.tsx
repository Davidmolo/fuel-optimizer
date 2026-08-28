"use client";

import { useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Spinner from "@/components/common/spinner";
import CorridorStationsModal from "@/components/tms/corridor-stations-modal";
import { formatPricePerGallon } from "@/lib/station-utils";
import { cn } from "@/lib/utils";
import type { FuelPlanStop, FuelRangeEstimate, Recommendation } from "@/types/recommendation";

type TripRecommendationPanelProps = {
  recommendation: Recommendation | null;
  loading: boolean;
  error: string | null;
  demoMode?: boolean;
  embedded?: boolean;
};

function formatLocation(stop: Pick<FuelPlanStop, "name" | "city" | "state" | "merchantDisplayName">) {
  const place = [stop.city, stop.state].filter(Boolean).join(", ");
  if (place && stop.name && stop.name !== stop.merchantDisplayName) {
    return `${stop.name} · ${place}`;
  }
  return place || stop.name || stop.merchantDisplayName;
}

function displayMessage(message: string) {
  return message.replace(/^\[Demo\]\s*/i, "").trim();
}

function RangeStat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className={cn("text-sm font-semibold tabular-nums", warning ? "text-amber-700" : "text-foreground")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">{label}</p>
    </div>
  );
}

function FuelRangeStrip({ fuelRange, isLowFuel }: { fuelRange: FuelRangeEstimate; isLowFuel?: boolean }) {
  const low = Boolean(isLowFuel || fuelRange.fuelPercent <= 25);

  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-surface px-1 py-2">
      <RangeStat label="Fuel" value={`${fuelRange.fuelPercent}%`} warning={low} />
      <RangeStat label="Range" value={`${fuelRange.usableRangeMiles.toFixed(0)} mi`} />
      <RangeStat label="Usable" value={`${fuelRange.usableGallons.toFixed(0)} gal`} />
    </div>
  );
}

function FuelPlanStopCard({
  label,
  stop,
  featured = false,
}: {
  label: string;
  stop: FuelPlanStop;
  featured?: boolean;
}) {
  const place = formatLocation(stop);

  if (!featured) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-2.5">
        <p className="section-label">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">{stop.merchantDisplayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{place}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-semibold text-success">{formatPricePerGallon(stop.effectivePricePerGallon)}</span>
          <span>{stop.distanceAlongRouteMiles.toFixed(0)} mi ahead</span>
          {stop.suggestedGallons ? <span>~{stop.suggestedGallons} gal</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-surface shadow-[0_8px_20px_rgba(5,150,105,0.08)]">
      <div className="flex items-center justify-between gap-2 bg-emerald-600 px-3 py-2 text-white">
        <p className="text-[11px] font-semibold tracking-wide uppercase">{label}</p>
        <p className="text-sm font-bold tabular-nums">{formatPricePerGallon(stop.effectivePricePerGallon)}</p>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">{stop.merchantDisplayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{place}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {stop.distanceAlongRouteMiles.toFixed(0)} mi
            </p>
            <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Ahead</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {stop.suggestedGallons ? `~${stop.suggestedGallons}` : "—"}
            </p>
            <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Gallons</p>
          </div>
        </div>
        {stop.reason ? <p className="mt-2 text-xs leading-snug text-muted">{stop.reason}</p> : null}
      </div>
    </div>
  );
}

function RecommendedStops({ recommendation }: { recommendation: Recommendation }) {
  const { status, fuelPlan } = recommendation;
  const twoStep = Boolean(fuelPlan?.now && fuelPlan?.then && !fuelPlan.canReachCheapestDirectly);

  if (!fuelPlan || status !== "ready") {
    return null;
  }

  if (twoStep && fuelPlan.now && fuelPlan.then) {
    return (
      <div className="space-y-2">
        <FuelPlanStopCard label="Fuel now" stop={fuelPlan.now} featured />
        <FuelPlanStopCard label="Then fill here" stop={fuelPlan.then} />
      </div>
    );
  }

  if (fuelPlan.now) {
    return <FuelPlanStopCard label="Recommended stop" stop={fuelPlan.now} featured />;
  }

  return null;
}

function AlternateStops({ recommendation }: { recommendation: Recommendation }) {
  const { alternates, fuelPlan } = recommendation;
  if (alternates.length === 0) {
    return null;
  }

  const plannedIds = new Set(
    [fuelPlan?.now?.relayLocationId, fuelPlan?.then?.relayLocationId].filter(Boolean),
  );
  const extras = alternates.filter((stop) => !plannedIds.has(stop.relayLocationId)).slice(0, 3);

  if (extras.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="section-label">Other nearby options</p>
      <ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {extras.map((stop, index) => (
          <li key={`${stop.relayLocationId}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{stop.merchantDisplayName}</p>
              <p className="mt-0.5 text-[11px] text-muted">{stop.distanceAlongRouteMiles.toFixed(0)} mi ahead</p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-success">
              {formatPricePerGallon(stop.effectivePricePerGallon)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CorridorCompareButton({
  count,
  bufferMiles,
  onClick,
}: {
  count: number;
  bufferMiles?: number;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" fullWidth onClick={onClick}>
      Compare all {count} stops
      {bufferMiles != null ? ` · ${bufferMiles} mi` : ""}
    </Button>
  );
}

function FuelPlanExtras({
  recommendation,
  demoMode,
  showHeader = true,
  includeRecommended = false,
  compactCopy = false,
  showRange = true,
  showCorridorCta = true,
  onOpenCorridorStops,
}: {
  recommendation: Recommendation;
  demoMode: boolean;
  showHeader?: boolean;
  includeRecommended?: boolean;
  compactCopy?: boolean;
  showRange?: boolean;
  showCorridorCta?: boolean;
  onOpenCorridorStops?: () => void;
}) {
  const { status, message, fuelRange, corridor, primary, corridorStations, fuelPlan } = recommendation;
  const plannedIds = new Set(
    [fuelPlan?.now?.relayLocationId, fuelPlan?.then?.relayLocationId].filter(Boolean),
  );
  const showPrimary = Boolean(primary && status === "ready" && !plannedIds.has(primary.relayLocationId));
  const copy = displayMessage(message);
  const hasRecommended = Boolean(fuelPlan?.now && status === "ready");
  const showMessage = status !== "ready" || (!hasRecommended && Boolean(copy));
  const twoStep = Boolean(fuelPlan?.now && fuelPlan?.then && !fuelPlan.canReachCheapestDirectly);

  return (
    <>
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Fuel plan</p>
            {recommendation.isDemo || demoMode ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100 ring-inset">
                Demo
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {showRange && fuelRange ? (
        <FuelRangeStrip fuelRange={fuelRange} isLowFuel={fuelPlan?.isLowFuel} />
      ) : null}

      {includeRecommended ? <RecommendedStops recommendation={recommendation} /> : null}

      {status !== "ready" ? (
        <Alert variant="info">{copy}</Alert>
      ) : twoStep && compactCopy ? (
        <p className="text-xs leading-snug text-muted">Add fuel now, then fill at the cheapest stop ahead.</p>
      ) : showMessage ? (
        <p className="text-sm leading-relaxed text-foreground">{copy}</p>
      ) : null}

      {showPrimary && primary ? (
        <p className="text-xs text-muted">
          Best price in range:{" "}
          <span className="font-medium text-foreground">{primary.merchantDisplayName}</span>
          {" · "}
          <span className="font-semibold text-success">{formatPricePerGallon(primary.effectivePricePerGallon)}</span>
        </p>
      ) : null}

      <AlternateStops recommendation={recommendation} />

      {showCorridorCta && corridorStations.length > 0 && onOpenCorridorStops ? (
        <CorridorCompareButton
          count={corridorStations.length}
          bufferMiles={corridor?.bufferMiles}
          onClick={onOpenCorridorStops}
        />
      ) : null}
    </>
  );
}

export default function TripRecommendationPanel({
  recommendation,
  loading,
  error,
  demoMode = false,
  embedded = false,
}: TripRecommendationPanelProps) {
  const [corridorOpen, setCorridorOpen] = useState(false);

  if (loading) {
    return (
      <Card className="flex min-h-[88px] items-center justify-center py-4">
        <Spinner label="Calculating fuel plan..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Fuel plan</p>
        <Alert variant="error">{error}</Alert>
      </Card>
    );
  }

  if (!recommendation) {
    const empty = (
      <>
        <p className="text-sm font-semibold text-foreground">Fuel plan</p>
        <p className="mt-1 text-sm text-muted">
          {demoMode
            ? "Select a load with mapped stops to preview a demo fuel plan."
            : "Pick a load with live truck telemetry to see where to fuel."}
        </p>
      </>
    );

    if (embedded) {
      return <div className="px-4 py-4">{empty}</div>;
    }

    return <Card>{empty}</Card>;
  }

  if (embedded) {
    const isDemo = recommendation.isDemo || demoMode;
    const corridorCount = recommendation.corridorStations.length;

    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pt-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Fuel plan</p>
              {isDemo ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100 ring-inset">
                  Demo
                </span>
              ) : null}
            </div>
            {recommendation.fuelRange ? (
              <FuelRangeStrip
                fuelRange={recommendation.fuelRange}
                isLowFuel={recommendation.fuelPlan?.isLowFuel}
              />
            ) : null}
            <RecommendedStops recommendation={recommendation} />
            <FuelPlanExtras
              recommendation={recommendation}
              demoMode={demoMode}
              showHeader={false}
              compactCopy
              showRange={false}
              showCorridorCta={false}
            />
          </div>
          {corridorCount > 0 ? (
            <div className="shrink-0 border-t border-border bg-surface px-3 pt-2.5 pb-4">
              <CorridorCompareButton
                count={corridorCount}
                bufferMiles={recommendation.corridor?.bufferMiles}
                onClick={() => setCorridorOpen(true)}
              />
            </div>
          ) : null}
        </div>
        <CorridorStationsModal
          open={corridorOpen}
          onClose={() => setCorridorOpen(false)}
          stations={recommendation.corridorStations}
          corridor={recommendation.corridor}
          fuelPlan={recommendation.fuelPlan}
        />
      </>
    );
  }

  return (
    <>
      <Card className="space-y-3">
        <FuelPlanExtras
          recommendation={recommendation}
          demoMode={demoMode}
          includeRecommended
          onOpenCorridorStops={() => setCorridorOpen(true)}
        />
      </Card>
      <CorridorStationsModal
        open={corridorOpen}
        onClose={() => setCorridorOpen(false)}
        stations={recommendation.corridorStations}
        corridor={recommendation.corridor}
        fuelPlan={recommendation.fuelPlan}
      />
    </>
  );
}
