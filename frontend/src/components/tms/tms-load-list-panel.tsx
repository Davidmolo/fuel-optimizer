import { useState } from "react";
import Card from "@/components/common/card";
import { IconChevronLeft, IconFilter, IconSearch } from "@/components/common/icons";
import Input from "@/components/common/input";
import TmsLoadFiltersModal from "@/components/tms/tms-load-filters-modal";
import TripContextRow from "@/components/tms/trip-context-row";
import { countActiveLoadFilters, EMPTY_TMS_LOAD_FILTERS, type TmsLoadListFilters } from "@/lib/tms-load-filters";
import { cn } from "@/lib/utils";
import type { TripContext } from "@/types/tms";

type TmsLoadListPanelProps = {
  trips: TripContext[];
  visibleTrips: TripContext[];
  selectedTripId?: string;
  onSelect: (trip: TripContext) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: TmsLoadListFilters;
  onFiltersChange: (filters: TmsLoadListFilters) => void;
  extraFilterPredicate?: (trip: TripContext) => boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export default function TmsLoadListPanel({
  trips,
  visibleTrips,
  selectedTripId,
  onSelect,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  extraFilterPredicate,
  collapsed,
  onToggleCollapsed,
}: TmsLoadListPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = countActiveLoadFilters(filters);

  if (collapsed) {
    return (
      <Card className="flex h-12 flex-row items-center justify-between gap-2 p-0 lg:h-full lg:min-h-0 lg:flex-col lg:justify-start lg:py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-primary-muted hover:text-primary lg:mx-auto"
          aria-label="Expand load list"
          title="Expand load list"
        >
          <IconChevronLeft className="h-4 w-4 rotate-180" />
        </button>
        <p className="pr-3 text-xs font-semibold text-foreground lg:hidden">
          Loads · {visibleTrips.length}
        </p>
        <p
          className="mt-3 hidden text-[11px] font-semibold tracking-wide text-muted uppercase lg:block"
          style={{ writingMode: "vertical-rl" }}
        >
          Loads · {visibleTrips.length}
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0 lg:h-full">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Loads</h2>
          <p className="text-xs text-muted">
            {visibleTrips.length} of {trips.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            aria-label={activeFilterCount > 0 ? `Filter loads, ${activeFilterCount} active` : "Filter loads"}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium transition",
              activeFilterCount > 0
                ? "bg-primary-muted text-primary"
                : "text-muted hover:bg-primary-muted hover:text-primary",
            )}
          >
            <IconFilter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-px text-[10px] leading-4 font-semibold text-white tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-primary-muted hover:text-primary"
            aria-label="Collapse load list"
            title="Collapse load list"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Route, load, driver..."
            className="h-8 pl-8 text-xs"
            aria-label="Search loads"
          />
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-sm text-muted">No active loads cached yet.</p>
          <p className="mt-1 text-xs text-muted">Run a sync to pull Open Road TMS data.</p>
        </div>
      ) : visibleTrips.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-sm text-muted">No loads match this search or filter.</p>
          {activeFilterCount > 0 || search.trim() ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                onFiltersChange(EMPTY_TMS_LOAD_FILTERS);
              }}
              className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
            >
              Clear search and filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="max-h-[40vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {visibleTrips.map((trip) => (
            <TripContextRow
              key={trip.load.id}
              trip={trip}
              selected={selectedTripId === trip.load.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      <TmsLoadFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        trips={trips}
        filters={filters}
        onApply={onFiltersChange}
        extraPredicate={extraFilterPredicate}
      />
    </Card>
  );
}
