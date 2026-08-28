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

export type RelayDriver = {
  relayAccount: RelayAccount;
  relayDriverId: string;
  integrationId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  driverNumber?: string;
  truckNumber?: string;
  companyName?: string;
  isActive: boolean;
  syncedAt?: string;
};

export type RelayDriverListResponse = {
  driverCount: number;
  items: RelayDriver[];
};

export type StationSyncAccountResult = {
  account: RelayAccount;
  driverCount?: number;
  driversSyncedAt?: string;
  transactionCount?: number;
  transactionWindowCount?: number;
  stationCount?: number;
  transactionsUnavailable?: boolean;
  stationsSyncedAt?: string;
};

export type StationSyncResponse = {
  accounts: StationSyncAccountResult[];
  totalDriverCount: number;
  window?: {
    dtstart: string;
    dtend: string;
  };
  totalTransactionCount: number;
  totalStationCount: number;
};
