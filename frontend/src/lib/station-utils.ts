import type { FuelStation } from "@/types/station";

export function formatPricePerGallon(value?: number) {
  if (value === undefined || value === null) {
    return "—";
  }

  return `$${value.toFixed(3)}/gal`;
}

export function hasStationCoordinates(
  station: FuelStation,
): station is FuelStation & { latitude: number; longitude: number } {
  return (
    typeof station.latitude === "number" &&
    typeof station.longitude === "number" &&
    Number.isFinite(station.latitude) &&
    Number.isFinite(station.longitude)
  );
}

export function getMappableFuelStations(stations: FuelStation[]) {
  return stations.filter(hasStationCoordinates);
}
