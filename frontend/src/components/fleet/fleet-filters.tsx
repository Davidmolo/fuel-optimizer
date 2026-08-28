import Input from "@/components/common/input";
import Select from "@/components/common/select";
import type { FleetFilterState } from "@/lib/fleet-filters";

type FleetFiltersProps = {
  filters: FleetFilterState;
  onChange: (filters: FleetFilterState) => void;
  resultCount: number;
  totalCount: number;
};

export default function FleetFilters({ filters, onChange, resultCount, totalCount }: FleetFiltersProps) {
  const update = (patch: Partial<FleetFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-3 border-b border-border px-5 py-3 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="fleet-search">
            Search
          </label>
          <Input
            id="fleet-search"
            placeholder="Unit, VIN, make, model, location..."
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="fleet-status">
              Status
            </label>
            <Select<FleetFilterState["status"]>
              id="fleet-status"
              fullWidth
              value={filters.status}
              onChange={(status) => update({ status })}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active only" },
                { value: "inactive", label: "Inactive only" },
              ]}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="fleet-fuel">
              Fuel
            </label>
            <Select<FleetFilterState["fuel"]>
              id="fleet-fuel"
              fullWidth
              value={filters.fuel}
              onChange={(fuel) => update({ fuel })}
              options={[
                { value: "all", label: "All fuel levels" },
                { value: "low", label: "Low fuel" },
                { value: "normal", label: "Normal fuel" },
                { value: "missing", label: "No fuel data" },
              ]}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="fleet-telemetry">
              Telemetry
            </label>
            <Select<FleetFilterState["telemetry"]>
              id="fleet-telemetry"
              fullWidth
              value={filters.telemetry}
              onChange={(telemetry) => update({ telemetry })}
              options={[
                { value: "all", label: "All telemetry" },
                { value: "live", label: "Live" },
                { value: "stale", label: "Stale" },
                { value: "missing", label: "Missing" },
                { value: "attention", label: "Needs attention" },
              ]}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted">
        Showing {resultCount} of {totalCount} trucks
      </p>
    </div>
  );
}
