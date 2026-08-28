import { formatLoadStatus } from "@/lib/trip-linkage-status";
import type { TripContext } from "@/types/tms";

export type TmsLoadFuelFilter = "all" | "low" | "live" | "missing";

export type TmsLoadListFilters = {
  hotOnly: boolean;
  fuel: TmsLoadFuelFilter;
  statuses: string[];
  originStates: string[];
  destinationStates: string[];
  customers: string[];
  equipment: string[];
};

export type LoadFilterOption = {
  value: string;
  label: string;
  count: number;
};

export const EMPTY_TMS_LOAD_FILTERS: TmsLoadListFilters = {
  hotOnly: false,
  fuel: "all",
  statuses: [],
  originStates: [],
  destinationStates: [],
  customers: [],
  equipment: [],
};

export function normalizeLoadFilters(value: Partial<TmsLoadListFilters> | null | undefined): TmsLoadListFilters {
  return {
    hotOnly: Boolean(value?.hotOnly),
    fuel: value?.fuel === "low" || value?.fuel === "live" || value?.fuel === "missing" ? value.fuel : "all",
    statuses: Array.isArray(value?.statuses) ? value.statuses.filter(Boolean) : [],
    originStates: Array.isArray(value?.originStates) ? value.originStates.filter(Boolean) : [],
    destinationStates: Array.isArray(value?.destinationStates) ? value.destinationStates.filter(Boolean) : [],
    customers: Array.isArray(value?.customers) ? value.customers.filter(Boolean) : [],
    equipment: Array.isArray(value?.equipment) ? value.equipment.filter(Boolean) : [],
  };
}

export function countActiveLoadFilters(filters: TmsLoadListFilters) {
  const normalized = normalizeLoadFilters(filters);
  return (
    (normalized.hotOnly ? 1 : 0) +
    (normalized.fuel === "all" ? 0 : 1) +
    normalized.statuses.length +
    normalized.originStates.length +
    normalized.destinationStates.length +
    normalized.customers.length +
    normalized.equipment.length
  );
}

export function toggleFilterValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function countBy(trips: TripContext[], pick: (trip: TripContext) => string | undefined, label = (value: string) => value) {
  const counts = new Map<string, number>();

  for (const trip of trips) {
    const value = pick(trip)?.trim();
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function collectLoadFilterOptions(trips: TripContext[]) {
  return {
    statuses: countBy(trips, (trip) => trip.load.status, formatLoadStatus),
    originStates: countBy(trips, (trip) => trip.load.originStateCode),
    destinationStates: countBy(trips, (trip) => trip.load.destinationStateCode),
    customers: countBy(trips, (trip) => trip.load.customerName),
    equipment: countBy(trips, (trip) => trip.load.equipment),
    hotCount: trips.filter((trip) => trip.load.hot).length,
    lowFuelCount: trips.filter((trip) => trip.vehicle?.fuel?.isLow).length,
    liveFuelCount: trips.filter((trip) => trip.vehicle?.fuel?.freshness === "live").length,
    missingFuelCount: trips.filter((trip) => !trip.vehicle?.fuel).length,
  };
}

export function tripMatchesLoadFilters(trip: TripContext, filters: TmsLoadListFilters) {
  const normalized = normalizeLoadFilters(filters);

  if (normalized.hotOnly && !trip.load.hot) {
    return false;
  }

  if (normalized.fuel === "low" && !trip.vehicle?.fuel?.isLow) {
    return false;
  }

  if (normalized.fuel === "live" && trip.vehicle?.fuel?.freshness !== "live") {
    return false;
  }

  if (normalized.fuel === "missing" && trip.vehicle?.fuel) {
    return false;
  }

  if (normalized.statuses.length > 0 && !normalized.statuses.includes(trip.load.status)) {
    return false;
  }

  if (normalized.originStates.length > 0 && !normalized.originStates.includes(trip.load.originStateCode ?? "")) {
    return false;
  }

  if (
    normalized.destinationStates.length > 0 &&
    !normalized.destinationStates.includes(trip.load.destinationStateCode ?? "")
  ) {
    return false;
  }

  if (normalized.customers.length > 0 && !normalized.customers.includes(trip.load.customerName ?? "")) {
    return false;
  }

  if (normalized.equipment.length > 0 && !normalized.equipment.includes(trip.load.equipment ?? "")) {
    return false;
  }

  return true;
}
