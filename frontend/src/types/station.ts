export type RelayAccount = "blue_stallion" | "azfs";

export type FuelStation = {
  relayAccount: RelayAccount;
  relayLocationId: string;
  merchantName?: string;
  merchantNumber?: string;
  name?: string;
  fuelMerchantLocationId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  opisId?: string;
  timezone?: string;
  fuelType?: string;
  fuelTypeDescription?: string;
  retailPricePerUnit?: number;
  discountedPricePerUnit?: number;
  lastTransactionAt?: string;
  lastTransactionId?: string;
  isActive: boolean;
  syncedAt?: string;
};

export type StationSummary = {
  stationCount: number;
  merchantCount: number;
  stateCount: number;
  stationsWithPricing: number;
};

export type StationListResponse = {
  summary: StationSummary;
  items: FuelStation[];
};

