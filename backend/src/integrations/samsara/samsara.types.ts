export type SamsaraPagination = {
  endCursor: string;
  hasNextPage: boolean;
};

export type SamsaraPaginatedResponse<T> = {
  data: T[];
  pagination: SamsaraPagination;
};

export type SamsaraVehicle = {
  id: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  licensePlate?: string;
  externalIds?: Record<string, string>;
  tags?: Array<{ id: string; name: string }>;
  createdAtTime?: string;
  updatedAtTime?: string;
};

export type SamsaraGpsStat = {
  time: string;
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedMilesPerHour?: number;
  reverseGeo?: {
    formattedLocation?: string;
  };
  address?: {
    id?: string;
    name?: string;
  };
  isEcuSpeed?: boolean;
};

export type SamsaraFuelPercentStat = {
  time: string;
  value: number;
};

export type SamsaraVehicleStats = {
  id: string;
  name: string;
  externalIds?: Record<string, string>;
  gps?: SamsaraGpsStat;
  fuelPercent?: SamsaraFuelPercentStat;
};
