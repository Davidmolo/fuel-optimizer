import Button from "@/components/common/button";
import Card from "@/components/common/card";
import StationDiscountBadge from "@/components/station/station-discount-badge";
import StationPricingCell from "@/components/station/station-pricing-cell";
import {
  formatRelayAccount,
  formatStationLocation,
  formatStationTimestamp,
} from "@/lib/station-utils";
import StationFilters, { type StationFilterState } from "@/components/station/station-filters";
import type { FuelStation } from "@/types/station";

type StationTableProps = {
  stations: FuelStation[];
  allStations: FuelStation[];
  filters: StationFilterState;
  onFiltersChange: (filters: StationFilterState) => void;
  onSync: () => void;
  syncing: boolean;
  transactionsUnavailable?: boolean;
};

const headerClass =
  "whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";

const sectionPadding = "px-5 py-3 sm:px-6";

export default function StationTable({
  stations,
  allStations,
  filters,
  onFiltersChange,
  onSync,
  syncing,
  transactionsUnavailable,
}: StationTableProps) {
  const availableStates = [...new Set(allStations.map((station) => station.state).filter(Boolean) as string[])].sort();

  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className={`border-b border-border ${sectionPadding}`}>
        <h2 className="text-sm font-semibold text-foreground">Station catalog</h2>
        <p className="text-xs text-muted">
          Merchant locations with retail and Relay contract diesel pricing from fuel transactions
        </p>
        {transactionsUnavailable ? (
          <p className="mt-2 text-xs text-amber-700">
            No fuel transactions were returned for the synced date window. Try a wider range via the API, or confirm
            the Relay account has recent fuel activity.
          </p>
        ) : null}
      </div>

      {allStations.length > 0 ? (
        <StationFilters
          filters={filters}
          onChange={onFiltersChange}
          resultCount={stations.length}
          totalCount={allStations.length}
          availableStates={availableStates}
        />
      ) : null}

      {allStations.length === 0 ? (
        <div className={`${sectionPadding} py-10 text-center`}>
          <p className="text-sm text-muted">No stations cached yet.</p>
          <p className="mt-1 text-xs text-muted">Run a Relay sync to pull drivers and transaction-based station pricing.</p>
          <Button className="mt-4" onClick={onSync} disabled={syncing}>
            Sync from Relay
          </Button>
        </div>
      ) : stations.length === 0 ? (
        <div className={`${sectionPadding} py-10 text-center`}>
          <p className="text-sm text-muted">No stations match the current filters.</p>
        </div>
      ) : (
        <div className="fleet-table-scroll">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-muted/60">
              <tr>
                <th className={headerClass}>Station</th>
                <th className={headerClass}>Merchant</th>
                <th className={headerClass}>Account</th>
                <th className={headerClass}>Price &amp; discount</th>
                <th className={headerClass}>Last txn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {stations.map((station) => (
                <tr key={`${station.relayAccount}-${station.relayLocationId}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-foreground">{station.name || station.relayLocationId}</div>
                    <StationDiscountBadge station={station} />
                    <div className="mt-0.5 text-xs text-muted">{formatStationLocation(station)}</div>
                    {station.latitude !== undefined && station.longitude !== undefined ? (
                      <div className="mt-0.5 text-xs text-muted tabular-nums">
                        {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{station.merchantName || "—"}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{formatRelayAccount(station.relayAccount)}</td>
                  <td className="px-4 py-3 align-top">
                    <StationPricingCell station={station} />
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted">
                    {formatStationTimestamp(station.lastTransactionAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
