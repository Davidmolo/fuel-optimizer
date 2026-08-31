"use client";

import Alert from "@/components/common/alert";
import Card from "@/components/common/card";
import Spinner from "@/components/common/spinner";
import { TripWorkspaceHeader } from "@/components/tms/trip-context-detail-panel";
import TripRecommendationPanel from "@/components/tms/trip-recommendation-panel";
import { formatPricePerGallon } from "@/lib/station-utils";
import { getTripLinkageIssues } from "@/lib/trip-linkage-status";
import type { InspectedMapStation } from "@/lib/trip-route-map-markers";
import type { Recommendation } from "@/types/recommendation";
import type { TripContext } from "@/types/tms";

type TmsTripSidePanelProps = {
  trip: TripContext | null;
  recommendation: Recommendation | null;
  loading: boolean;
  error: string | null;
  demoMode: boolean;
  inspectedStation: InspectedMapStation | null;
  onClearInspectedStation: () => void;
};

function inspectedKindLabel(kind?: InspectedMapStation["kind"]) {
  switch (kind) {
    case "fill-now":
      return "Recommended on map";
    case "fill-then":
      return "Next fill";
    case "cheapest":
      return "Cheapest on route";
    case "in-range":
      return "In range";
    case "out-of-range":
      return "Ahead, out of range";
    default:
      return "Selected pin";
  }
}

function InspectedStationCard({
  station,
  onClear,
}: {
  station: InspectedMapStation;
  onClear: () => void;
}) {
  const place = [station.city, station.state].filter(Boolean).join(", ");

  return (
    <div className="rounded-[var(--radius-lg)] border border-primary/20 bg-primary-muted/60 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="section-label text-primary">{inspectedKindLabel(station.kind)}</p>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium text-muted transition hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{station.merchantDisplayName}</p>
      {place ? <p className="mt-0.5 truncate text-xs text-muted">{place}</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className="font-semibold text-success">{formatPricePerGallon(station.effectivePricePerGallon)}</span>
        {station.distanceAlongRouteMiles != null ? (
          <span>{station.distanceAlongRouteMiles.toFixed(0)} mi ahead</span>
        ) : null}
      </div>
    </div>
  );
}

export default function TmsTripSidePanel({
  trip,
  recommendation,
  loading,
  error,
  demoMode,
  inspectedStation,
  onClearInspectedStation,
}: TmsTripSidePanelProps) {
  const recommendedId = recommendation?.fuelPlan?.now?.relayLocationId;
  const showInspected = Boolean(inspectedStation && inspectedStation.relayLocationId !== recommendedId);
  const primaryIssue = trip ? getTripLinkageIssues(trip)[0] : undefined;
  const notReadyMessage = primaryIssue ? `${primaryIssue.title}. ${primaryIssue.action}` : undefined;

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0 lg:h-full">
      <div className="shrink-0 border-b border-border bg-surface">
        <TripWorkspaceHeader trip={trip} compact />
      </div>

      {showInspected && inspectedStation ? (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <InspectedStationCard station={inspectedStation} onClear={onClearInspectedStation} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-muted/40">
        {loading ? (
          <div className="flex flex-1 items-center justify-center px-4 py-6">
            <Spinner label="Calculating fuel plan..." />
          </div>
        ) : error ? (
          <div className="space-y-2 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Fuel plan</p>
            <Alert variant="error">{error}</Alert>
          </div>
        ) : (
          <TripRecommendationPanel
            recommendation={recommendation}
            loading={false}
            error={null}
            demoMode={demoMode}
            embedded
            notReadyMessage={notReadyMessage}
          />
        )}
      </div>
    </Card>
  );
}
