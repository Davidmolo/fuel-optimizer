import type { GeoPoint } from "../../../utils/geo";
import type { TripContextView, TmsLoadDestinationView } from "../../tms/mappers/trip-context.mapper";
const DEFAULT_DEMO_FUEL_PERCENT = 20;
const DEFAULT_DEMO_TANK_GALLONS = 150;

type GeocodedDestination = TmsLoadDestinationView & { lat: number; lng: number };

function hasCoordinates(destination: TmsLoadDestinationView): destination is GeocodedDestination {
  return (
    destination.lat !== undefined &&
    destination.lng !== undefined &&
    Number.isFinite(destination.lat) &&
    Number.isFinite(destination.lng)
  );
}

function toGeoPoint(destination: GeocodedDestination): GeoPoint {
  return { lat: destination.lat, lng: destination.lng };
}

function interpolatePoint(start: GeoPoint, end: GeoPoint, fraction: number): GeoPoint {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  };
}

export function resolveDemoFuelPercent(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DEMO_FUEL_PERCENT;
  }

  return Math.max(5, Math.min(95, parsed));
}

export function resolveDemoTruckPosition(tripContext: TripContextView): GeoPoint | null {
  const openStops = [...tripContext.load.destinations]
    .filter((destination) => !destination.completed)
    .filter(hasCoordinates)
    .sort((left, right) => left.position - right.position);
  if (openStops.length >= 2) {
    return interpolatePoint(toGeoPoint(openStops[0]), toGeoPoint(openStops[1]), 0.2);
  }

  if (openStops.length === 1) {
    const stop = toGeoPoint(openStops[0]);
    return {
      lat: stop.lat,
      lng: stop.lng - 0.2,
    };
  }

  const geocodedStops = [...tripContext.load.destinations]
    .filter(hasCoordinates)
    .sort((left, right) => left.position - right.position);

  if (geocodedStops.length >= 2) {
    return interpolatePoint(toGeoPoint(geocodedStops[0]), toGeoPoint(geocodedStops[1]), 0.35);
  }

  if (geocodedStops.length === 1) {
    const stop = toGeoPoint(geocodedStops[0]);
    return {
      lat: stop.lat,
      lng: stop.lng - 0.2,
    };
  }

  return null;
}

export function buildDemoTripContext(tripContext: TripContextView, fuelPercent: number): TripContextView | null {
  const truckPosition = resolveDemoTruckPosition(tripContext);

  if (!truckPosition) {
    return null;
  }

  const demoTruckUnit = tripContext.load.truckUnit || `DEMO-${tripContext.load.openroadLoadId}`;
  const locationLabel = [tripContext.load.originCity, tripContext.load.originStateCode]
    .filter(Boolean)
    .join(", ");

  return {
    ...tripContext,
    load: {
      ...tripContext.load,
      truckUnit: demoTruckUnit,
    },
    driver: tripContext.driver ?? {
      openroadDriverId: tripContext.load.primaryDriverId ?? 0,
      displayName: "Demo driver",
      team: "Demo",
      status: "active",
    },
    vehicle: {
      fleetVehicleId: "demo-fleet-vehicle",
      samsaraId: "demo-samsara",
      unitNumber: demoTruckUnit,
      mappingStatus: "linked",
      fuelTankCapacityGallons: DEFAULT_DEMO_TANK_GALLONS,
      gps: {
        latitude: truckPosition.lat,
        longitude: truckPosition.lng,
        formattedLocation: locationLabel ? `Demo position near ${locationLabel}` : "Demo truck position",
        freshness: "live",
        recordedAt: new Date(),
      },
      fuel: {
        percent: fuelPercent,
        freshness: "live",
        isLow: fuelPercent < 25,
        recordedAt: new Date(),
      },
    },
    linkage: {
      hasDriver: true,
      hasTruckAssignment: true,
      hasFleetVehicle: true,
      hasTelemetry: true,
      isReadyForRecommendation: Boolean(tripContext.load.originCity && tripContext.load.destinationCity),
    },
  };
}

export function getDemoNotReadyMessage(tripContext: TripContextView) {
  if (!tripContext.load.originCity || !tripContext.load.destinationCity) {
    return "Demo mode needs route origin and destination on the load.";
  }

  return "Demo mode needs at least one geocoded stop on this load. Run TMS sync after stop coordinates are available.";
}
