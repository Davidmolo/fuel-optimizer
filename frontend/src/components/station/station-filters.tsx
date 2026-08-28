import Select from "@/components/common/select";
import type { RelayAccount } from "@/types/station";

export type StationFilterState = {
  search: string;
  relayAccount: "all" | RelayAccount;
  state: string;
};

export const defaultStationFilters: StationFilterState = {
  search: "",
  relayAccount: "all",
  state: "",
};

type StationFiltersProps = {
  filters: StationFilterState;
  onChange: (filters: StationFilterState) => void;
  resultCount: number;
  totalCount: number;
  availableStates: string[];
};

export function applyStationFilters<T extends {
  name?: string;
  merchantName?: string;
  city?: string;
  state?: string;
  relayAccount: RelayAccount;
}>(items: T[], filters: StationFilterState) {
  const search = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.relayAccount !== "all" && item.relayAccount !== filters.relayAccount) {
      return false;
    }

    if (filters.state && item.state?.toUpperCase() !== filters.state.toUpperCase()) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [item.name, item.merchantName, item.city, item.state].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

export default function StationFilters({
  filters,
  onChange,
  resultCount,
  totalCount,
  availableStates,
}: StationFiltersProps) {
  const update = (patch: Partial<StationFilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="border-b border-border px-5 py-4 sm:px-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="station-search">
            Search
          </label>
          <input
            id="station-search"
            type="search"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Station, merchant, city..."
            className="w-full rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-primary/20 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="station-account">
            Relay account
          </label>
          <Select<StationFilterState["relayAccount"]>
            id="station-account"
            fullWidth
            value={filters.relayAccount}
            onChange={(relayAccount) => update({ relayAccount })}
            options={[
              { value: "all", label: "All accounts" },
              { value: "blue_stallion", label: "Blue Stallion" },
              { value: "azfs", label: "AZFS" },
            ]}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted" htmlFor="station-state">
            State
          </label>
          <Select
            id="station-state"
            fullWidth
            value={filters.state}
            onChange={(state) => update({ state })}
            options={[
              { value: "", label: "All states" },
              ...availableStates.map((state) => ({ value: state, label: state })),
            ]}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Showing {resultCount} of {totalCount} stations
      </p>
    </div>
  );
}
