"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import { IconRefresh } from "@/components/common/icons";
import Spinner from "@/components/common/spinner";
import Tooltip from "@/components/common/tooltip";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import TmsLoadListPanel from "@/components/tms/tms-load-list-panel";
import TmsSummaryCards, { type TmsLoadFilter } from "@/components/tms/tms-summary-cards";
import TmsTripSidePanel from "@/components/tms/tms-trip-side-panel";
import TripRouteMap from "@/components/tms/trip-route-map";
import SyncStatusLine from "@/components/jobs/sync-status-line";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InspectedMapStation } from "@/lib/trip-route-map-markers";
import {
  EMPTY_TMS_LOAD_FILTERS,
  normalizeLoadFilters,
  tripMatchesLoadFilters,
} from "@/lib/tms-load-filters";
import { usePersistedBoolean, usePersistedJson } from "@/lib/use-persisted-state";
import type { Recommendation } from "@/types/recommendation";
import type { TripContext, TripContextListResponse, TmsSyncResponse } from "@/types/tms";

function formatTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString();
}

export default function TmsPage() {
  const [data, setData] = useState<TripContextListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripContext | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [loadFilter, setLoadFilter] = useState<TmsLoadFilter>("all");
  const [loadSearch, setLoadSearch] = useState("");
  const [storedLoadFilters, setStoredLoadFilters] = usePersistedJson(
    "tms:load-list-filters",
    EMPTY_TMS_LOAD_FILTERS,
  );
  const loadListFilters = useMemo(() => normalizeLoadFilters(storedLoadFilters), [storedLoadFilters]);
  const [inspectedStation, setInspectedStation] = useState<InspectedMapStation | null>(null);
  const [loadListOpen, setLoadListOpen] = usePersistedBoolean("tms:load-list-open", true);

  const loadTripContexts = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<TripContextListResponse>("/api/v1/tms/trip-context");
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load trip contexts");
      }

      setData(response.data);
      setSelectedTrip((current) => {
        if (!current) {
          return response.data?.items[0] ?? null;
        }

        return response.data?.items.find((item) => item.load.id === current.load.id) ?? response.data?.items[0] ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load trip contexts");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncTms = useCallback(async () => {
    setError(null);
    setSyncing(true);

    try {
      const response = await apiRequest<TmsSyncResponse>("/api/v1/tms/sync", { method: "POST" });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to refresh loads and live truck data");
      }

      setLastSyncedAt(response.data.loadsSyncedAt || response.data.telemetrySyncedAt || null);
      await loadTripContexts();

      if (response.data.telemetryError) {
        setError(response.data.telemetryError);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to refresh loads and live truck data");
    } finally {
      setSyncing(false);
    }
  }, [loadTripContexts]);

  useEffect(() => {
    void loadTripContexts();
  }, [loadTripContexts]);

  const loadRecommendation = useCallback(async (trip: TripContext | null) => {
    if (!trip) {
      setRecommendation(null);
      setRecommendationError(null);
      setRecommendationLoading(false);
      return;
    }

    if (!trip.load.truckUnit || !trip.linkage.isReadyForRecommendation) {
      setRecommendation(null);
      setRecommendationError(null);
      setRecommendationLoading(false);
      return;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);

    try {
      const identifier = trip.load.id;
      const response = await apiRequest<Recommendation>(
        `/api/v1/recommendations/${encodeURIComponent(identifier)}`,
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load fuel recommendation");
      }

      setRecommendation(response.data);
    } catch (loadError) {
      setRecommendation(null);
      setRecommendationError(loadError instanceof Error ? loadError.message : "Failed to load fuel recommendation");
    } finally {
      setRecommendationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendation(selectedTrip);
  }, [loadRecommendation, selectedTrip]);

  const highlightStationIds = useMemo(() => {
    if (!recommendation) {
      return [];
    }

    const ids = new Set<string>();

    if (recommendation.primary?.relayLocationId) {
      ids.add(recommendation.primary.relayLocationId);
    }

    const planStops = recommendation.fuelPlan?.stops?.length
      ? recommendation.fuelPlan.stops
      : [recommendation.fuelPlan?.now, recommendation.fuelPlan?.then];
    for (const stop of planStops) {
      if (stop?.relayLocationId) {
        ids.add(stop.relayLocationId);
      }
    }

    return [...ids];
  }, [recommendation]);

  const trips = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary;

  const matchesReadinessAndSearch = useCallback(
    (trip: TripContext) => {
      if (loadFilter === "truck" && !trip.linkage.hasTruckAssignment) {
        return false;
      }

      if (loadFilter === "telemetry" && !trip.linkage.hasTelemetry) {
        return false;
      }

      if (loadFilter === "ready" && !trip.linkage.isReadyForRecommendation) {
        return false;
      }

      if (loadFilter === "attention" && trip.linkage.isReadyForRecommendation) {
        return false;
      }

      const query = loadSearch.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const haystack = [
        trip.load.routeLabel,
        trip.load.companyLoad,
        trip.load.customerLoad,
        trip.load.customerName,
        trip.load.truckUnit,
        trip.load.commodity,
        trip.load.status,
        trip.driver?.displayName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    },
    [loadFilter, loadSearch],
  );

  const visibleTrips = useMemo(
    () => trips.filter((trip) => matchesReadinessAndSearch(trip) && tripMatchesLoadFilters(trip, loadListFilters)),
    [loadListFilters, matchesReadinessAndSearch, trips],
  );

  useEffect(() => {
    if (visibleTrips.length === 0) {
      if (selectedTrip) {
        setSelectedTrip(null);
      }
      return;
    }

    if (!selectedTrip || !visibleTrips.some((trip) => trip.load.id === selectedTrip.load.id)) {
      setSelectedTrip(visibleTrips[0]);
    }
  }, [selectedTrip, visibleTrips]);

  function handleSelectTrip(trip: TripContext) {
    setInspectedStation(null);
    setSelectedTrip(trip);
  }

  return (
    <DashboardShell
      fill
      title="Active loads"
      subtitle="Pick a load, check the route, then take the fuel plan"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center">
          {summary ? (
            <TmsSummaryCards
              summary={summary}
              activeFilter={loadFilter}
              onFilterChange={setLoadFilter}
              className="min-w-0 flex-1"
            />
          ) : (
            <p className="min-w-0 flex-1 text-xs text-muted">
              {lastSyncedAt
                ? `Last sync ${formatTimestamp(lastSyncedAt)}`
                : "Sync loads and live truck GPS/fuel, then select a load to plan fuel."}
            </p>
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Tooltip
              id="tms-sync-tooltip"
              className="relative z-20"
              content="Refreshes active loads from Open Road and live GPS/fuel from Samsara. Station prices stay on their own schedule."
            >
              <Button
                type="button"
                size="sm"
                onClick={() => void syncTms()}
                disabled={syncing}
                aria-describedby="tms-sync-tooltip"
              >
                {syncing ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden="true"
                    />
                    Syncing...
                  </>
                ) : (
                  <>
                    <IconRefresh className="h-3.5 w-3.5" />
                    Sync
                  </>
                )}
              </Button>
            </Tooltip>
          </div>
        </div>

        <SyncStatusLine
          jobIds={["samsara.telemetry", "openroad.loads", "openroad.assignments"]}
          lastManualSyncAt={lastSyncedAt}
        />

        {error ? <Alert variant="error">{error}</Alert> : null}

        {data?.fleetScope?.mode === "dispatcher" && data.fleetScope.dispatcherName ? (
          <Alert variant="info">Showing loads for dispatcher fleet “{data.fleetScope.dispatcherName}” only.</Alert>
        ) : null}

        {data?.fleetScope?.mode === "none" && data.fleetScope.reason ? (
          <Alert variant="info">{data.fleetScope.reason}</Alert>
        ) : null}

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner label="Loading active loads..." />
          </div>
        ) : (
          <div
            className={cn(
              "grid min-h-0 flex-1 items-stretch gap-2 lg:overflow-hidden",
              loadListOpen
                ? "lg:grid-cols-[17.5rem_minmax(0,1fr)_20.5rem]"
                : "lg:grid-cols-[2.75rem_minmax(0,1fr)_20.5rem]",
            )}
          >
            <TmsLoadListPanel
              trips={trips}
              visibleTrips={visibleTrips}
              selectedTripId={selectedTrip?.load.id}
              onSelect={handleSelectTrip}
              search={loadSearch}
              onSearchChange={setLoadSearch}
              filters={loadListFilters}
              onFiltersChange={setStoredLoadFilters}
              extraFilterPredicate={matchesReadinessAndSearch}
              collapsed={!loadListOpen}
              onToggleCollapsed={() => setLoadListOpen((open) => !open)}
            />

            <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0">
              <div className="min-h-0 flex-1">
                <TripRouteMap
                  fill
                  trip={selectedTrip}
                  corridorStations={recommendation?.corridorStations}
                  highlightStationIds={highlightStationIds}
                  corridorBufferMiles={recommendation?.corridor?.bufferMiles}
                  fuelPlan={recommendation?.fuelPlan}
                  primaryStationId={recommendation?.primary?.relayLocationId}
                  selectedStationId={inspectedStation?.relayLocationId}
                  onStationSelect={setInspectedStation}
                />
              </div>
            </div>

            <TmsTripSidePanel
              trip={selectedTrip}
              recommendation={recommendation}
              loading={recommendationLoading}
              error={recommendationError}
              inspectedStation={inspectedStation}
              onClearInspectedStation={() => setInspectedStation(null)}
              onCopilotSent={loadTripContexts}
            />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
