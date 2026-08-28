import Button from "@/components/common/button";
import Card from "@/components/common/card";
import FleetFilters from "@/components/fleet/fleet-filters";
import FleetVehicleRow from "@/components/fleet/fleet-vehicle-row";
import { exportFleetToCsv } from "@/lib/fleet-csv";
import type { FleetFilterState } from "@/lib/fleet-filters";
import type { FleetVehicle } from "@/types/fleet";

type FleetVehicleTableProps = {
  vehicles: FleetVehicle[];
  allVehicles: FleetVehicle[];
  filters: FleetFilterState;
  onFiltersChange: (filters: FleetFilterState) => void;
  onViewVehicle: (vehicle: FleetVehicle) => void;
  onSync: () => void;
  syncing: boolean;
};

const headerClass =
  "whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted";

const sectionPadding = "px-5 py-3 sm:px-6";

export default function FleetVehicleTable({
  vehicles,
  allVehicles,
  filters,
  onFiltersChange,
  onViewVehicle,
  onSync,
  syncing,
}: FleetVehicleTableProps) {
  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className={`flex flex-col gap-3 border-b border-border ${sectionPadding} sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Truck snapshot</h2>
          <p className="text-xs text-muted">Sorted by unit number · data stored after each sync</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={vehicles.length === 0}
          onClick={() => exportFleetToCsv(vehicles)}
        >
          Export CSV
        </Button>
      </div>

      {allVehicles.length > 0 ? (
        <FleetFilters
          filters={filters}
          onChange={onFiltersChange}
          resultCount={vehicles.length}
          totalCount={allVehicles.length}
        />
      ) : null}

      {allVehicles.length === 0 ? (
        <div className={`${sectionPadding} py-10 text-center`}>
          <p className="text-sm text-muted">No fleet data yet.</p>
          <Button className="mt-4" onClick={onSync} disabled={syncing}>
            Sync from Samsara
          </Button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className={`${sectionPadding} py-10 text-center`}>
          <p className="text-sm text-muted">No trucks match the current filters.</p>
        </div>
      ) : (
        <>
          <p className={`border-b border-border-subtle py-2 text-xs text-muted ${sectionPadding}`}>
            Scroll horizontally inside the table to view all columns
          </p>
          <div className="fleet-table-scroll">
            <table className="w-full min-w-[76rem] border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-10 bg-surface-muted shadow-[0_1px_0_var(--border)]">
                <tr className="border-b border-border">
                  <th className={`${headerClass} min-w-[8.5rem]`}>Unit</th>
                  <th className={`${headerClass} min-w-[6.5rem]`}>Status</th>
                  <th className={`${headerClass} min-w-[9.5rem]`}>VIN</th>
                  <th className={`${headerClass} min-w-[4.5rem]`}>Year</th>
                  <th className={`${headerClass} min-w-[6rem]`}>Plate</th>
                  <th className={`${headerClass} min-w-[11rem]`}>Fuel</th>
                  <th className={`${headerClass} min-w-[5.5rem]`}>GPS</th>
                  <th className={`${headerClass} min-w-[14rem]`}>Location</th>
                  <th className={`${headerClass} min-w-[7.5rem]`}>Coordinates</th>
                  <th className={`${headerClass} min-w-[5rem]`}>Speed</th>
                  <th className={`${headerClass} min-w-[8.5rem]`}>GPS updated</th>
                  <th className={`${headerClass} min-w-[8.5rem]`}>Synced</th>
                  <th className={`${headerClass} min-w-[5rem]`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle, index) => (
                  <FleetVehicleRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    rowIndex={index}
                    onView={onViewVehicle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
