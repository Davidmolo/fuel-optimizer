import type { FleetVehicle } from "@/types/fleet";

export type FleetFilterState = {
  search: string;
  status: "all" | "active" | "inactive";
  fuel: "all" | "low" | "normal" | "missing";
  telemetry: "all" | "live" | "stale" | "missing" | "attention";
};

export const defaultFleetFilters: FleetFilterState = {
  search: "",
  status: "all",
  fuel: "all",
  telemetry: "all",
};

function matchesTelemetryFilter(vehicle: FleetVehicle, telemetry: FleetFilterState["telemetry"]) {
  if (telemetry === "all") {
    return true;
  }

  const gpsFreshness = vehicle.gps?.freshness ?? "missing";
  const fuelFreshness = vehicle.fuel?.freshness ?? "missing";
  const values = [gpsFreshness, fuelFreshness];

  if (telemetry === "attention") {
    return values.some((value) => value === "stale" || value === "missing");
  }

  return values.includes(telemetry);
}

export function applyFleetFilters(vehicles: FleetVehicle[], filters: FleetFilterState) {
  const query = filters.search.trim().toLowerCase();

  return vehicles.filter((vehicle) => {
    if (query) {
      const searchable = [
        vehicle.unitNumber,
        vehicle.vin,
        vehicle.make,
        vehicle.model,
        vehicle.licensePlate,
        vehicle.gps?.formattedLocation,
        vehicle.gps?.addressName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (filters.status === "active" && !vehicle.isActive) {
      return false;
    }

    if (filters.status === "inactive" && vehicle.isActive) {
      return false;
    }

    if (filters.fuel === "low" && !vehicle.fuel?.isLow) {
      return false;
    }

    if (filters.fuel === "normal" && (!vehicle.fuel || vehicle.fuel.isLow)) {
      return false;
    }

    if (filters.fuel === "missing" && vehicle.fuel) {
      return false;
    }

    if (!matchesTelemetryFilter(vehicle, filters.telemetry)) {
      return false;
    }

    return true;
  });
}
