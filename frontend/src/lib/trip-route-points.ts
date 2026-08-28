import type { TripContext, TmsLoadDestination } from "@/types/tms";

export type TripRouteMapPoint = {
  lat: number;
  lng: number;
  label: string;
  kind: "stop" | "truck";
  completed?: boolean;
  position?: number;
};

export type TripRouteMapData = {
  points: TripRouteMapPoint[];
  routeLine: Array<{ lat: number; lng: number }>;
  routeLabel: string;
};

function isValidCoordinate(lat?: number, lng?: number): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function formatStopLabel(destination: TmsLoadDestination) {
  const location = [destination.city, destination.stateCode].filter(Boolean).join(", ");
  const stopType = destination.stopType.replaceAll("_", " ");

  if (location) {
    return `${destination.position}. ${stopType} — ${location}`;
  }

  return `${destination.position}. ${stopType}`;
}

export function buildTripRouteMapData(trip: TripContext | null): TripRouteMapData | null {
  if (!trip) {
    return null;
  }

  const stopPoints: TripRouteMapPoint[] = trip.load.destinations
    .filter((destination) => isValidCoordinate(destination.lat, destination.lng))
    .map((destination) => ({
      lat: destination.lat as number,
      lng: destination.lng as number,
      label: formatStopLabel(destination),
      kind: "stop" as const,
      completed: destination.completed,
      position: destination.position,
    }));

  const points = [...stopPoints];

  if (trip.vehicle?.gps && isValidCoordinate(trip.vehicle.gps.latitude, trip.vehicle.gps.longitude)) {
    points.push({
      lat: trip.vehicle.gps.latitude,
      lng: trip.vehicle.gps.longitude,
      label: trip.vehicle.gps.formattedLocation || `Truck ${trip.load.truckUnit || "position"}`,
      kind: "truck",
    });
  }

  if (points.length === 0) {
    return null;
  }

  return {
    points,
    routeLine: stopPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
    routeLabel: trip.load.routeLabel,
  };
}
