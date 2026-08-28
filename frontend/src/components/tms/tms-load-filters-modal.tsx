"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/common/button";
import Input from "@/components/common/input";
import Modal from "@/components/common/modal";
import {
  collectLoadFilterOptions,
  countActiveLoadFilters,
  EMPTY_TMS_LOAD_FILTERS,
  normalizeLoadFilters,
  toggleFilterValue,
  tripMatchesLoadFilters,
  type LoadFilterOption,
  type TmsLoadFuelFilter,
  type TmsLoadListFilters,
} from "@/lib/tms-load-filters";
import { cn } from "@/lib/utils";
import type { TripContext } from "@/types/tms";

type TmsLoadFiltersModalProps = {
  open: boolean;
  onClose: () => void;
  trips: TripContext[];
  filters: TmsLoadListFilters;
  onApply: (filters: TmsLoadListFilters) => void;
  extraPredicate?: (trip: TripContext) => boolean;
};

function FilterChip({
  selected,
  onClick,
  children,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition",
        selected
          ? "bg-primary text-white ring-primary"
          : "bg-surface text-muted ring-border hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {children}
      {count != null ? <span className="tabular-nums opacity-80">{count}</span> : null}
    </button>
  );
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function OptionChips({
  options,
  selected,
  onToggle,
}: {
  options: LoadFilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          selected={selected.includes(option.value)}
          count={option.count}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </FilterChip>
      ))}
    </>
  );
}

export default function TmsLoadFiltersModal({
  open,
  onClose,
  trips,
  filters,
  onApply,
  extraPredicate,
}: TmsLoadFiltersModalProps) {
  const [draft, setDraft] = useState<TmsLoadListFilters>(() => normalizeLoadFilters(filters));
  const [customerQuery, setCustomerQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(normalizeLoadFilters(filters));
    setCustomerQuery("");
  }, [filters, open]);

  const scopedTrips = useMemo(
    () => (extraPredicate ? trips.filter(extraPredicate) : trips),
    [extraPredicate, trips],
  );
  const options = useMemo(() => collectLoadFilterOptions(scopedTrips), [scopedTrips]);
  const visibleCustomers = useMemo(() => {
    const needle = customerQuery.trim().toLowerCase();
    if (!needle) {
      return options.customers;
    }

    return options.customers.filter((option) => option.label.toLowerCase().includes(needle));
  }, [customerQuery, options.customers]);

  const matchCount = useMemo(
    () => scopedTrips.filter((trip) => tripMatchesLoadFilters(trip, draft)).length,
    [draft, scopedTrips],
  );

  const activeCount = countActiveLoadFilters(draft);

  function updateDraft(patch: Partial<TmsLoadListFilters>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function applyAndClose() {
    onApply(normalizeLoadFilters(draft));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter loads"
      subtitle="Narrow by the work that matters: hot freight, low fuel, TMS status, and lane."
      className="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraft(EMPTY_TMS_LOAD_FILTERS)}
            disabled={activeCount === 0}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={applyAndClose}>
            Show {matchCount} {matchCount === 1 ? "load" : "loads"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-4 py-4">
        <FilterSection title="Priority" hint="Expedite freight that should be planned first.">
          <FilterChip selected={!draft.hotOnly} count={scopedTrips.length} onClick={() => updateDraft({ hotOnly: false })}>
            Any
          </FilterChip>
          <FilterChip selected={draft.hotOnly} count={options.hotCount} onClick={() => updateDraft({ hotOnly: true })}>
            Hot only
          </FilterChip>
        </FilterSection>

        <FilterSection title="Fuel" hint="Find trucks that need a stop now, or loads still missing a tank reading.">
          {(
            [
              { value: "all", label: "Any", count: scopedTrips.length },
              { value: "low", label: "Low fuel", count: options.lowFuelCount },
              { value: "live", label: "Live fuel", count: options.liveFuelCount },
              { value: "missing", label: "No fuel reading", count: options.missingFuelCount },
            ] satisfies Array<{ value: TmsLoadFuelFilter; label: string; count: number }>
          ).map((option) => (
            <FilterChip
              key={option.value}
              selected={draft.fuel === option.value}
              count={option.count}
              onClick={() => updateDraft({ fuel: option.value })}
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterSection>

        {options.statuses.length > 0 ? (
          <FilterSection title="Load status" hint="Open Road status. Select more than one to include each.">
            <OptionChips
              options={options.statuses}
              selected={draft.statuses}
              onToggle={(value) => updateDraft({ statuses: toggleFilterValue(draft.statuses, value) })}
            />
          </FilterSection>
        ) : null}

        {options.originStates.length > 0 ? (
          <FilterSection title="Pickup state">
            <OptionChips
              options={options.originStates}
              selected={draft.originStates}
              onToggle={(value) => updateDraft({ originStates: toggleFilterValue(draft.originStates, value) })}
            />
          </FilterSection>
        ) : null}

        {options.destinationStates.length > 0 ? (
          <FilterSection title="Delivery state">
            <OptionChips
              options={options.destinationStates}
              selected={draft.destinationStates}
              onToggle={(value) => updateDraft({ destinationStates: toggleFilterValue(draft.destinationStates, value) })}
            />
          </FilterSection>
        ) : null}

        {options.equipment.length > 0 ? (
          <FilterSection title="Equipment" hint="Trailer type can change range and which stops are usable.">
            <OptionChips
              options={options.equipment}
              selected={draft.equipment}
              onToggle={(value) => updateDraft({ equipment: toggleFilterValue(draft.equipment, value) })}
            />
          </FilterSection>
        ) : null}

        {options.customers.length > 0 ? (
          <section className="space-y-2">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">Customer</h3>
              <p className="mt-0.5 text-xs text-muted">Broker or shipper on the load.</p>
            </div>
            {options.customers.length > 8 ? (
              <Input
                value={customerQuery}
                onChange={(event) => setCustomerQuery(event.target.value)}
                placeholder="Search customers"
                className="h-8 text-xs"
                aria-label="Search customers"
              />
            ) : null}
            <div className={cn("flex flex-wrap gap-1.5", options.customers.length > 8 && "max-h-40 overflow-y-auto")}>
              {visibleCustomers.length === 0 ? (
                <p className="text-xs text-muted">No customers match that search.</p>
              ) : (
                <OptionChips
                  options={visibleCustomers}
                  selected={draft.customers}
                  onToggle={(value) => updateDraft({ customers: toggleFilterValue(draft.customers, value) })}
                />
              )}
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
