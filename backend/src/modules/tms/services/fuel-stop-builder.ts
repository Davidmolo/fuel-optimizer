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
  /** When set, shown on the CoPilot FuelStop label so the driver knows how much to take. */
  suggestedGallons?: number;
};

export function formatStationLabel(station: FuelStopStationInput) {
  const place = [station.city, station.state].filter(Boolean).join(", ");
  let base: string;
  if (station.merchantName && place) {
    base = `${station.merchantName} — ${place}`;
  } else if (station.merchantName) {
    base = station.merchantName;
  } else if (station.name && place) {
    base = `${station.name} — ${place}`;
  } else {
    base = station.name || place || "Fuel stop";
  }

  const gallons = station.suggestedGallons;
  if (typeof gallons === "number" && Number.isFinite(gallons) && gallons > 0) {
    const rounded = Math.round(gallons * 10) / 10;
    return `${base} (~${rounded} gal)`;
  }

  return base;
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

export type BuiltFuelStopIndex = {
  stationIndex: number;
  stopIndex: number;
};

/**
 * Inserts one or more FuelStops into the load stop list, ordered by along-route miles.
 * Never replaces Origin or Destination.
 */
export function buildTripStopsWithFuelStops(
  loadDestinations: GeocodedLoadStop[],
  recommendedStations: FuelStopStationInput[],
  routePolyline: GeoPoint[],
): { stops: TripManagementStopInput[]; fuelStopIndexes: BuiltFuelStopIndex[] } {
  const base = mapLoadDestinationsToTripStops(loadDestinations);
  if (base.length < 2 || recommendedStations.length === 0) {
    return { stops: base, fuelStopIndexes: [] };
  }

  const orderedStations = [...recommendedStations].sort((left, right) => {
    if (!routePolyline.length) {
      return 0;
    }
    const leftAlong = distanceAlongPolylineMiles(
      { lat: left.latitude, lng: left.longitude },
      routePolyline,
    );
    const rightAlong = distanceAlongPolylineMiles(
      { lat: right.latitude, lng: right.longitude },
      routePolyline,
    );
    return leftAlong - rightAlong;
  });

  let stops = base;
  const fuelStopIndexes: BuiltFuelStopIndex[] = [];

  for (let stationIndex = 0; stationIndex < orderedStations.length; stationIndex += 1) {
    const station = orderedStations[stationIndex];
    if (!station) continue;

    const fuel = buildFuelStopStopInput(station);
    const insertIndex = computeFuelStopInsertionIndex(
      stops,
      { lat: fuel.lat, lng: fuel.lon },
      routePolyline,
    );
    stops = [...stops.slice(0, insertIndex), fuel, ...stops.slice(insertIndex)];
    fuelStopIndexes.push({ stationIndex, stopIndex: insertIndex });
  }

  return { stops, fuelStopIndexes };
}

/** @deprecated Prefer buildTripStopsWithFuelStops for multi-stop chains. */
export function buildTripStopsWithFuelStop(
  loadDestinations: GeocodedLoadStop[],
  recommendedStation: FuelStopStationInput,
  routePolyline: GeoPoint[],
): { stops: TripManagementStopInput[]; fuelStopIndex: number } {
  const built = buildTripStopsWithFuelStops(loadDestinations, [recommendedStation], routePolyline);
  return {
    stops: built.stops,
    fuelStopIndex: built.fuelStopIndexes[0]?.stopIndex ?? -1,
  };
}

/**
 * Replace existing FuelStops in an open stop list with a new planned chain.
 * Freight stops (non-FuelStop) are preserved in order.
 */
export function replaceOpenFuelStops(
  openStops: TripManagementStopInput[],
  fuelStations: FuelStopStationInput[],
  routePolyline: GeoPoint[],
): { stops: TripManagementStopInput[]; fuelStopIndexes: BuiltFuelStopIndex[] } {
  const freightStops = openStops.filter((stop) => stop.stopType !== "FuelStop");
  if (freightStops.length < 1) {
    return { stops: openStops, fuelStopIndexes: [] };
  }

  if (fuelStations.length === 0) {
    return { stops: freightStops, fuelStopIndexes: [] };
  }

  const orderedStations = [...fuelStations].sort((left, right) => {
    if (!routePolyline.length) {
      return 0;
    }
    const leftAlong = distanceAlongPolylineMiles(
      { lat: left.latitude, lng: left.longitude },
      routePolyline,
    );
    const rightAlong = distanceAlongPolylineMiles(
      { lat: right.latitude, lng: right.longitude },
      routePolyline,
    );
    return leftAlong - rightAlong;
  });

  let stops = freightStops;
  const fuelStopIndexes: BuiltFuelStopIndex[] = [];

  for (let stationIndex = 0; stationIndex < orderedStations.length; stationIndex += 1) {
    const station = orderedStations[stationIndex];
    if (!station) continue;

    const fuel = buildFuelStopStopInput(station);
    let insertIndex = computeFuelStopInsertionIndex(
      stops,
      { lat: fuel.lat, lng: fuel.lon },
      routePolyline,
    );

    // computeFuelStopInsertionIndex assumes Origin/Destination clamping for load lists.
    // For in-progress lists without Origin, still avoid placing after Destination.
    if (stops[0]?.stopType !== "Origin" && insertIndex === 0 && stops.length > 1) {
      insertIndex = 0;
    }
    if (stops[stops.length - 1]?.stopType === "Destination" && insertIndex >= stops.length) {
      insertIndex = Math.max(0, stops.length - 1);
    }

    stops = [...stops.slice(0, insertIndex), fuel, ...stops.slice(insertIndex)];
    fuelStopIndexes.push({ stationIndex, stopIndex: insertIndex });
  }

  return { stops, fuelStopIndexes };
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
