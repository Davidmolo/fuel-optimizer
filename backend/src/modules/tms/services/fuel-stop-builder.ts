import type { TripManagementStopInput } from "../../../integrations/trip-management";
import { distanceAlongPolylineMiles, type GeoPoint } from "../../../utils/geo";
import type { TrimbleTripStopRecord } from "../models/tms-load.model";
import { mapLoadDestinationsToTripStops, type GeocodedLoadStop } from "./map-load-to-trip-stops";

export type FuelStopStationInput = {
  latitude: number;
  longitude: number;
  merchantName?: string;
  name?: string;
  city?: string;
  state?: string;
};

export function formatStationLabel(station: FuelStopStationInput) {
  const place = [station.city, station.state].filter(Boolean).join(", ");
  if (station.merchantName && place) {
    return `${station.merchantName} — ${place}`;
  }
  if (station.merchantName) {
    return station.merchantName;
  }
  if (station.name && place) {
    return `${station.name} — ${place}`;
  }
  return station.name || place || "Fuel stop";
}

export function buildFuelStopStopInput(station: FuelStopStationInput): TripManagementStopInput {
  return {
    stopType: "FuelStop",
    lat: station.latitude,
    lon: station.longitude,
    label: formatStationLabel(station),
  };
}

/**
 * Insert index into the load stop list for a FuelStop.
 * Clamped to [1, loadStops.length - 1] so FuelStop never becomes Origin or Destination.
 */
export function computeFuelStopInsertionIndex(
  loadStops: TripManagementStopInput[],
  fuelStop: GeoPoint,
  routePolyline: GeoPoint[],
): number {
  if (loadStops.length < 2) {
    return 0;
  }

  const maxIndex = loadStops.length - 1;

  if (!routePolyline.length) {
    return Math.max(1, maxIndex);
  }

  const fuelAlong = distanceAlongPolylineMiles(fuelStop, routePolyline);

  for (let index = 1; index < loadStops.length; index += 1) {
    const stop = loadStops[index];
    if (!stop) continue;
    const stopAlong = distanceAlongPolylineMiles({ lat: stop.lat, lng: stop.lon }, routePolyline);
    if (stopAlong > fuelAlong) {
      return index;
    }
  }

  return Math.max(1, maxIndex);
}

export function buildTripStopsWithFuelStop(
  loadDestinations: GeocodedLoadStop[],
  recommendedStation: FuelStopStationInput,
  routePolyline: GeoPoint[],
): { stops: TripManagementStopInput[]; fuelStopIndex: number } {
  const base = mapLoadDestinationsToTripStops(loadDestinations);
  if (base.length < 2) {
    return { stops: base, fuelStopIndex: -1 };
  }

  const fuel = buildFuelStopStopInput(recommendedStation);
  const fuelStopIndex = computeFuelStopInsertionIndex(base, { lat: fuel.lat, lng: fuel.lon }, routePolyline);
  const stops = [...base.slice(0, fuelStopIndex), fuel, ...base.slice(fuelStopIndex)];

  return { stops, fuelStopIndex };
}

export function toTrimbleTripStopRecord(stop: TripManagementStopInput): TrimbleTripStopRecord {
  return {
    stopType: stop.stopType as TrimbleTripStopRecord["stopType"],
    lat: stop.lat,
    lon: stop.lon,
    label: stop.label,
  };
}

export function recordsToTripManagementStops(records: TrimbleTripStopRecord[]): TripManagementStopInput[] {
  return records.map((stop) => ({
    stopType: stop.stopType,
    lat: stop.lat,
    lon: stop.lon,
    label: stop.label,
  }));
}
