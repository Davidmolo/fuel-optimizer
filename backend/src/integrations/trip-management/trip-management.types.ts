export type TripManagementStopType =
  | "Origin"
  | "Work"
  | "Waypoint"
  | "FuelStop"
  | "Destination"
  | "Delivery"
  | "Pickup";

export type TripManagementStopInput = {
  stopType: TripManagementStopType;
  lat: number;
  lon: number;
  label?: string;
};

export type TripManagementPlanTripRequest = {
  storeTrip?: boolean;
  tmsTripId?: string;
  name?: string;
  stops: TripManagementStopInput[];
  routingType?: 0 | 1 | 2;
};

export type TripManagementStopResponse = {
  stopType?: string;
  location?: {
    label?: string;
    coords?: {
      lat?: string | number;
      lon?: string | number;
    };
  };
};

export type TripManagementTripResponse = {
  alkTripId?: number | string;
  tmsTripId?: string;
  tripStatus?: string | number;
  tspDriverId?: string | null;
  name?: string;
  tripDistance?: number;
  tripDriveDuration?: number;
  tripDuration?: number;
  url?: string;
  stops?: TripManagementStopResponse[];
};

export type TripManagementRoutePathResponse = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: Array<Array<[number, number]>>;
  };
  tMinutes?: number;
  TMinutes?: number;
  tDistance?: number;
  TDistance?: number;
};
