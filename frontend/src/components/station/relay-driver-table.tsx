import Button from "@/components/common/button";
import Card from "@/components/common/card";
import { formatRelayAccount, formatStationTimestamp } from "@/lib/station-utils";
import type { RelayDriver } from "@/types/station";

type RelayDriverTableProps = {
  drivers: RelayDriver[];
  onSync: () => void;
  syncing: boolean;
};

const headerClass =
  "whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";

const sectionPadding = "px-5 py-3 sm:px-6";

export default function RelayDriverTable({ drivers, onSync, syncing }: RelayDriverTableProps) {
  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className={`border-b border-border ${sectionPadding}`}>
        <h2 className="text-sm font-semibold text-foreground">Relay drivers</h2>
        <p className="text-xs text-muted">Driver registry synced per merchant account for truck and driver mapping</p>
      </div>

      {drivers.length === 0 ? (
        <div className={`${sectionPadding} py-10 text-center`}>
          <p className="text-sm text-muted">No Relay drivers cached yet.</p>
          <Button className="mt-4" onClick={onSync} disabled={syncing}>
            Sync from Relay
          </Button>
        </div>
      ) : (
        <div className="fleet-table-scroll max-h-[520px]">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted/95 backdrop-blur">
              <tr>
                <th className={headerClass}>Driver</th>
                <th className={headerClass}>Account</th>
                <th className={headerClass}>Driver #</th>
                <th className={headerClass}>Truck #</th>
                <th className={headerClass}>Phone</th>
                <th className={headerClass}>Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {drivers.map((driver) => (
                <tr key={`${driver.relayAccount}-${driver.relayDriverId}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-foreground">{driver.displayName || driver.relayDriverId}</div>
                    {driver.companyName ? <div className="mt-0.5 text-xs text-muted">{driver.companyName}</div> : null}
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{formatRelayAccount(driver.relayAccount)}</td>
                  <td className="px-4 py-3 align-top tabular-nums">{driver.driverNumber || "—"}</td>
                  <td className="px-4 py-3 align-top tabular-nums">{driver.truckNumber || "—"}</td>
                  <td className="px-4 py-3 align-top text-muted">{driver.phone || "—"}</td>
                  <td className="px-4 py-3 align-top text-xs text-muted">{formatStationTimestamp(driver.syncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
