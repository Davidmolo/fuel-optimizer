import type { GeoPoint } from "../../utils/geo";

export type DrivingRouteResult = {
  polyline: GeoPoint[];
  distanceMiles: number;
  durationMinutes: number;
};

export type DrivingDistanceResult = {
  distanceMiles: number;
  durationMinutes: number;
};

export type StationDrivingDistance = DrivingDistanceResult & {
  relayLocationId: string;
};
