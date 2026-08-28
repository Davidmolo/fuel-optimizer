"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Spinner from "@/components/common/spinner";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import FleetSummaryCards from "@/components/dashboard/fleet-summary-cards";
import FleetVehicleDetailPanel from "@/components/fleet/fleet-vehicle-detail-panel";
import FleetVehicleTable from "@/components/fleet/fleet-vehicle-table";
import { apiRequest } from "@/lib/api";
import { applyFleetFilters, defaultFleetFilters } from "@/lib/fleet-filters";
import { formatFleetTimestamp } from "@/lib/fleet-utils";
import type { FleetListResponse, FleetSyncResponse, FleetVehicle } from "@/types/fleet";

export default function FleetPage() {
  const [data, setData] = useState<FleetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [filters, setFilters] = useState(defaultFleetFilters);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);

  const loadFleet = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<FleetListResponse>("/api/v1/fleet/vehicles?activeOnly=true");
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to load fleet data");
      }
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load fleet data");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncFleet = useCallback(async () => {
    setError(null);
    setSyncing(true);

    try {
      const response = await apiRequest<FleetSyncResponse>("/api/v1/fleet/sync", { method: "POST" });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to sync fleet from Samsara");
      }
      setLastSyncedAt(response.data.telemetrySyncedAt);
      await loadFleet();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync fleet from Samsara");
    } finally {
      setSyncing(false);
    }
  }, [loadFleet]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const vehicles = useMemo(() => data?.items ?? [], [data]);
  const filteredVehicles = useMemo(() => applyFleetFilters(vehicles, filters), [vehicles, filters]);
  const summary = data?.summary;

  return (
    <DashboardShell title="Fleet telemetry" subtitle="Live GPS and fuel levels from Samsara ELD">
      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">
              {summary
                ? `${summary.activeVehicles} active trucks · stale threshold ${summary.staleThresholdMinutes} min`
                : "Sync to load Paul's Assets fleet from Samsara"}
            </p>
            {lastSyncedAt ? (
              <p className="mt-1 text-xs text-muted">Last Samsara sync {formatFleetTimestamp(lastSyncedAt)}</p>
            ) : null}
          </div>
          <Button onClick={() => void syncFleet()} disabled={syncing}>
            {syncing ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden="true"
                />
                Syncing...
              </>
            ) : (
              "Sync from Samsara"
            )}
          </Button>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner label="Loading fleet telemetry..." />
          </div>
        ) : (
          <>
            {summary ? <FleetSummaryCards summary={summary} /> : null}

            <FleetVehicleTable
              vehicles={filteredVehicles}
              allVehicles={vehicles}
              filters={filters}
              onFiltersChange={setFilters}
              onViewVehicle={setSelectedVehicle}
              onSync={() => void syncFleet()}
              syncing={syncing}
            />
          </>
        )}
      </div>

      <FleetVehicleDetailPanel vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
    </DashboardShell>
  );
}
