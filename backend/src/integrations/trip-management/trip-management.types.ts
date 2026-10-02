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
  /** Account Manager Vehicle Routing Profile name (e.g. "XXII Century"). */
  routingProfileName?: string;
  /**
   * When true, Plan Trip may include tspDriverId so Trimble can create a Dispatched trip.
   * Phase 1 planning must leave this false/undefined.
   */
  assignTablet?: boolean;
  tspDriverId?: string;
  /** Optional Trimble identity fields. Filled from env by the client. */
  tspId?: string;
  tmsCustomerId?: string;
  tmsId?: 0 | 1 | 2;
  tmsUserId?: string;
};

export type TripManagementModifyTripRequest = {
  alkTripId: string;
  tspDriverId?: string;
  /** Full stop list. Trimble's public schema marks stops as required on modify;
   * the spike in Phase 2 confirms whether a dispatch-only modify can omit them. */
  stops?: TripManagementStopInput[];
  routingType?: 0 | 1 | 2;
  /** Account Manager Vehicle Routing Profile name (e.g. "XXII Century"). */
  routingProfileName?: string;
  /** Optional Trimble identity fields. Filled from env by the client. */
  tspId?: string;
  tmsCustomerId?: string;
  tmsId?: 0 | 1 | 2;
  tmsUserId?: string;
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
