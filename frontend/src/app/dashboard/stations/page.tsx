"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Spinner from "@/components/common/spinner";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import RelayDriverTable from "@/components/station/relay-driver-table";
import StationSummaryCards from "@/components/station/station-summary-cards";
import StationTable from "@/components/station/station-table";
import SyncStatusLine from "@/components/jobs/sync-status-line";
import { apiRequest } from "@/lib/api";
import { summarizeStationDiscounts } from "@/lib/station-utils";
import { applyStationFilters, defaultStationFilters } from "@/components/station/station-filters";
import type {
  RelayDriverListResponse,
  StationListResponse,
  StationSyncResponse,
} from "@/types/station";

export default function StationsPage() {
  const [stationData, setStationData] = useState<StationListResponse | null>(null);
  const [driverData, setDriverData] = useState<RelayDriverListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [transactionsUnavailable, setTransactionsUnavailable] = useState(false);
  const [filters, setFilters] = useState(defaultStationFilters);
  const [activeTab, setActiveTab] = useState<"stations" | "drivers">("stations");

  const loadStations = useCallback(async () => {
    const response = await apiRequest<StationListResponse>("/api/v1/stations?activeOnly=true");
    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to load stations");
    }
    setStationData(response.data);
  }, []);

  const loadDrivers = useCallback(async () => {
    const response = await apiRequest<RelayDriverListResponse>("/api/v1/stations/drivers?activeOnly=true");
    if (!response.success || !response.data) {
      throw new Error(response.message || "Failed to load Relay drivers");
    }
    setDriverData(response.data);
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      await Promise.all([loadStations(), loadDrivers()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Relay station data");
    } finally {
      setLoading(false);
    }
  }, [loadDrivers, loadStations]);

  const syncStations = useCallback(async () => {
    setError(null);
    setSyncing(true);

    try {
      const response = await apiRequest<StationSyncResponse>("/api/v1/stations/sync", { method: "POST", body: "{}" });
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to sync stations from Relay");
      }

      const latestDriverSync = response.data.accounts
        .map((account) => account.driversSyncedAt)
        .filter(Boolean)
        .sort()
        .at(-1);

      setLastSyncedAt(latestDriverSync ?? response.data.accounts[0]?.stationsSyncedAt ?? null);
      setTransactionsUnavailable(
        response.data.totalTransactionCount === 0 &&
          response.data.accounts.some((account) => account.transactionsUnavailable),
      );
      await loadData();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync stations from Relay");
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stations = useMemo(() => stationData?.items ?? [], [stationData]);
  const discountSummary = useMemo(() => summarizeStationDiscounts(stations), [stations]);
  const filteredStations = useMemo(() => applyStationFilters(stations, filters), [stations, filters]);
  const drivers = useMemo(() => driverData?.items ?? [], [driverData]);

  return (
    <DashboardShell
      title="Stations & pricing"
      subtitle="Relay fuel station catalog with merchant pricing for Paul's Assets contracts"
    >
      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted">
              {driverData
                ? `${driverData.driverCount} Relay drivers · ${stationData?.summary.stationCount ?? 0} stations cached`
                : "Sync to pull Relay drivers and last 30 days of station pricing"}
            </p>
            <SyncStatusLine jobIds={["relay.transactions", "relay.drivers"]} lastManualSyncAt={lastSyncedAt} />
          </div>

          <Button type="button" onClick={() => void syncStations()} disabled={syncing}>
            {syncing ? (
              <>
                <Spinner className="h-4 w-4" />
                Syncing...
              </>
            ) : (
              "Sync from Relay"
            )}
          </Button>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            <StationSummaryCards
              stationSummary={stationData?.summary}
              driverSummary={driverData ?? undefined}
              discountSummary={discountSummary}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeTab === "stations" ? "primary" : "outline"}
                onClick={() => setActiveTab("stations")}
              >
                Stations
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTab === "drivers" ? "primary" : "outline"}
                onClick={() => setActiveTab("drivers")}
              >
                Relay drivers
              </Button>
            </div>

            {activeTab === "stations" ? (
              <StationTable
                stations={filteredStations}
                allStations={stations}
                filters={filters}
                onFiltersChange={setFilters}
                onSync={() => void syncStations()}
                syncing={syncing}
                transactionsUnavailable={transactionsUnavailable}
              />
            ) : (
              <RelayDriverTable drivers={drivers} onSync={() => void syncStations()} syncing={syncing} />
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
