"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import { IconRefresh } from "@/components/common/icons";
import Select, { type SelectOption } from "@/components/common/select";
import Spinner from "@/components/common/spinner";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import TmsLoadListPanel from "@/components/tms/tms-load-list-panel";
import TmsSummaryCards, { type TmsLoadFilter } from "@/components/tms/tms-summary-cards";
import TmsTripSidePanel from "@/components/tms/tms-trip-side-panel";
import TripRouteMap from "@/components/tms/trip-route-map";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getStoredDemoFuelPercent,
  getStoredDemoMode,
  setStoredDemoFuelPercent,
  setStoredDemoMode,
} from "@/lib/demo-mode";
import type { InspectedMapStation } from "@/lib/trip-route-map-markers";
import { usePersistedBoolean } from "@/lib/use-persisted-state";
import type { Recommendation } from "@/types/recommendation";
import type { TripContext, TripContextListResponse, TmsSyncResponse } from "@/types/tms";

function formatTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString();
}

function FuelMark({ percent }: { percent: number }) {
  const fill = percent <= 15 ? "bg-danger" : percent <= 20 ? "bg-warning" : "bg-primary";

  return (
    <span className="relative h-2 w-6 overflow-hidden rounded-full bg-track" aria-hidden>
      <span className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{ width: `${percent}%` }} />
    </span>
  );
}

const DEMO_FUEL_OPTIONS: Array<SelectOption<number>> = [
  { value: 15, label: "15%", description: "Very low", leading: <FuelMark percent={15} /> },
  { value: 20, label: "20%", description: "Low", leading: <FuelMark percent={20} /> },
  { value: 40, label: "40%", leading: <FuelMark percent={40} /> },
  { value: 60, label: "60%", leading: <FuelMark percent={60} /> },
];

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
  const [demoMode, setDemoMode] = useState(() => getStoredDemoMode());
  const [demoFuelPercent, setDemoFuelPercent] = useState(() => getStoredDemoFuelPercent());
  const [loadFilter, setLoadFilter] = useState<TmsLoadFilter>("all");
  const [loadSearch, setLoadSearch] = useState("");
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
        throw new Error(response.message || "Failed to sync TMS data from Open Road");
      }

      setLastSyncedAt(response.data.loadsSyncedAt);
      await loadTripContexts();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync TMS data from Open Road");
    } finally {
      setSyncing(false);
    }
  }, [loadTripContexts]);

  useEffect(() => {
    void loadTripContexts();
  }, [loadTripContexts]);

  const loadRecommendation = useCallback(async (trip: TripContext | null, options: { demo: boolean; fuelPercent: number }) => {
    if (!trip) {
      setRecommendation(null);
      setRecommendationError(null);
      setRecommendationLoading(false);
      return;
    }

    if (!options.demo && (!trip.load.truckUnit || !trip.linkage.isReadyForRecommendation)) {
      setRecommendation(null);
      setRecommendationError(null);
      setRecommendationLoading(false);
      return;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);

    try {
      const identifier = options.demo ? trip.load.id : trip.load.truckUnit!;
      const query = options.demo
        ? `?demo=true&fuelPercent=${encodeURIComponent(String(options.fuelPercent))}`
        : "";
      const response = await apiRequest<Recommendation>(
        `/api/v1/recommendations/${encodeURIComponent(identifier)}${query}`,
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
    void loadRecommendation(selectedTrip, { demo: demoMode, fuelPercent: demoFuelPercent });
  }, [demoFuelPercent, demoMode, loadRecommendation, selectedTrip]);

  const highlightStationIds = useMemo(() => {
    if (!recommendation) {
      return [];
    }

    const ids = new Set<string>();

    if (recommendation.primary?.relayLocationId) {
      ids.add(recommendation.primary.relayLocationId);
    }

    for (const stop of [recommendation.fuelPlan?.now, recommendation.fuelPlan?.then]) {
      if (stop?.relayLocationId) {
        ids.add(stop.relayLocationId);
      }
    }

    return [...ids];
  }, [recommendation]);

  const trips = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary;
  const visibleTrips = useMemo(() => {
    const query = loadSearch.trim().toLowerCase();

    return trips.filter((trip) => {
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
    });
  }, [loadFilter, loadSearch, trips]);

  const displayTrip = useMemo(() => {
    if (!selectedTrip) {
      return null;
    }

    if (!demoMode || !recommendation?.tripContext.vehicle) {
      return selectedTrip;
    }

    return {
      ...selectedTrip,
      load: {
        ...selectedTrip.load,
        truckUnit: recommendation.tripContext.load.truckUnit ?? selectedTrip.load.truckUnit,
      },
      vehicle: recommendation.tripContext.vehicle,
      linkage: {
        ...selectedTrip.linkage,
        hasTruckAssignment: true,
        hasFleetVehicle: true,
        hasTelemetry: true,
        isReadyForRecommendation: true,
      },
    } satisfies TripContext;
  }, [demoMode, recommendation, selectedTrip]);

  function handleSelectTrip(trip: TripContext) {
    setInspectedStation(null);
    setSelectedTrip(trip);
  }

  function toggleDemoMode() {
    const next = !demoMode;
    setDemoMode(next);
    setStoredDemoMode(next);
  }

  function updateDemoFuelPercent(value: number) {
    const next = Math.max(5, Math.min(95, value));
    setDemoFuelPercent(next);
    setStoredDemoFuelPercent(next);
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
                ? `Last Open Road sync ${formatTimestamp(lastSyncedAt)}`
                : "Sync Open Road TMS, then select a load to plan fuel."}
            </p>
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1">
              <button
                type="button"
                role="switch"
                aria-checked={demoMode}
                title={demoMode ? "Demo uses synthetic GPS and fuel for the selected load." : "Enable demo GPS and fuel"}
                onClick={toggleDemoMode}
                className="inline-flex items-center gap-2 text-xs font-medium text-foreground"
              >
                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    demoMode ? "bg-primary" : "bg-track",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      demoMode && "translate-x-4",
                    )}
                  />
                </span>
                Demo
              </button>

              {demoMode ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <span id="demo-fuel-label" className="whitespace-nowrap">
                    Fuel
                  </span>
                  <Select
                    size="sm"
                    align="end"
                    value={demoFuelPercent}
                    onChange={updateDemoFuelPercent}
                    aria-labelledby="demo-fuel-label"
                    options={DEMO_FUEL_OPTIONS}
                  />
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => void syncTms()}
              disabled={syncing}
              title={
                lastSyncedAt
                  ? `Last Open Road sync ${formatTimestamp(lastSyncedAt)}`
                  : "Sync Open Road TMS, then select a load to plan fuel."
              }
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
          </div>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

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
              collapsed={!loadListOpen}
              onToggleCollapsed={() => setLoadListOpen((open) => !open)}
            />

            <div className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:min-h-0">
              <div className="min-h-0 flex-1">
                <TripRouteMap
                  fill
                  trip={displayTrip}
                  corridorStations={recommendation?.corridorStations}
                  highlightStationIds={highlightStationIds}
                  demoMode={demoMode}
                  corridorBufferMiles={recommendation?.corridor?.bufferMiles}
                  fuelPlan={recommendation?.fuelPlan}
                  primaryStationId={recommendation?.primary?.relayLocationId}
                  selectedStationId={inspectedStation?.relayLocationId}
                  onStationSelect={setInspectedStation}
                />
              </div>
            </div>

            <TmsTripSidePanel
              trip={displayTrip}
              recommendation={recommendation}
              loading={recommendationLoading}
              error={recommendationError}
              demoMode={demoMode}
              inspectedStation={inspectedStation}
              onClearInspectedStation={() => setInspectedStation(null)}
            />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
