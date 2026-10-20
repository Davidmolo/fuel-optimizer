import type { RelayDataField, RelayDriver, RelayFuelItem, RelayTransaction } from "../../../integrations/relay";
import type { FuelStationDocument } from "../models/fuel-station.model";
import type { RelayDriverDocument } from "../models/relay-driver.model";

function parsePrice(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type StationPriceSnapshot = {
  relayLocationId: string;
  fuelType?: string;
  fuelTypeDescription?: string;
  retailPricePerUnit?: number;
  discountedPricePerUnit?: number;
  lastTransactionAt?: Date | string;
};

/**
 * Truck-diesel line items are the station price. DEF and reefer are different products
 * and must not replace the diesel price. Standard diesel outranks auto and #1 diesel
 * when both are on the same transaction.
 */
export function truckDieselPriceQuality(fuelType?: string, fuelTypeDescription?: string) {
  const type = fuelType?.trim().toLowerCase() ?? "";
  const description = fuelTypeDescription?.trim().toLowerCase() ?? "";

  if (
    type === "def" ||
    type.startsWith("reefer") ||
    type.startsWith("gas") ||
    description.startsWith("def") ||
    description.startsWith("reefer")
  ) {
    return 0;
  }

  const dieselLike =
    type === "diesel" ||
    type.startsWith("diesel_") ||
    type.startsWith("biodiesel") ||
    description.includes("diesel");

  if (!dieselLike) {
    return 0;
  }

  if (description.includes("auto") || description === "diesel 1" || description.includes("dyed")) {
    return 1;
  }

  if (description === "diesel" || description.includes("#2") || description.includes("uls")) {
    return 3;
  }

  return 2;
}

function hasUsableDieselPrice(station: StationPriceSnapshot) {
  return (
    truckDieselPriceQuality(station.fuelType, station.fuelTypeDescription) > 0 &&
    (station.discountedPricePerUnit !== undefined || station.retailPricePerUnit !== undefined)
  );
}

function priceTimestamp(station: StationPriceSnapshot) {
  if (!station.lastTransactionAt) {
    return 0;
  }

  const time = new Date(station.lastTransactionAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function relayDieselPriceFields(station: StationPriceSnapshot) {
  if (!hasUsableDieselPrice(station)) {
    return {
      retailPricePerUnit: undefined,
      discountedPricePerUnit: undefined,
    };
  }

  return {
    retailPricePerUnit: station.retailPricePerUnit,
    discountedPricePerUnit: station.discountedPricePerUnit,
  };
}

/** Prefer a diesel price, then the newest purchase, when accounts share a Relay location. */
export function isFresherStationPrice(candidate: StationPriceSnapshot, current: StationPriceSnapshot) {
  const candidateUsable = hasUsableDieselPrice(candidate);
  const currentUsable = hasUsableDieselPrice(current);

  if (candidateUsable !== currentUsable) {
    return candidateUsable;
  }

  return priceTimestamp(candidate) > priceTimestamp(current);
}

/**
 * The incoming snapshot is the latest truck-diesel purchase we have from Relay.
 * Replace a stored price when it is not truck diesel, or when it disagrees with that purchase.
 */
export function shouldReplaceStoredStationPrice(stored: StationPriceSnapshot, incoming: StationPriceSnapshot) {
  if (truckDieselPriceQuality(incoming.fuelType, incoming.fuelTypeDescription) === 0) {
    return false;
  }

  if (truckDieselPriceQuality(stored.fuelType, stored.fuelTypeDescription) === 0) {
    return true;
  }

  return (
    stored.discountedPricePerUnit !== incoming.discountedPricePerUnit ||
    stored.retailPricePerUnit !== incoming.retailPricePerUnit
  );
}

export function selectFreshestStations<T extends StationPriceSnapshot>(stations: T[]) {
  const selected = new Map<string, T>();

  for (const station of stations) {
    const current = selected.get(station.relayLocationId);

    if (!current || isFresherStationPrice(station, current)) {
      selected.set(station.relayLocationId, station);
    }
  }

  return [...selected.values()];
}

function getDataFieldValue(fields: RelayDataField[] | undefined, fieldName: string) {
  const match = fields?.find((field) => field.field_name.toLowerCase() === fieldName.toLowerCase());
  return match?.field_value?.trim() || undefined;
}

export function pickPrimaryFuelItem(fuelItems?: RelayFuelItem[]) {
  let best: RelayFuelItem | undefined;
  let bestQuality = 0;

  for (const item of fuelItems ?? []) {
    const quality = truckDieselPriceQuality(item.fuel_type, item.fuel_type_description);

    if (quality > bestQuality) {
      best = item;
      bestQuality = quality;
    }
  }

  return best;
}

export function buildRelayDriverDisplayName(driver: Pick<RelayDriver, "first_name" | "last_name" | "phone">) {
  const name = [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim();
  if (name) {
    return name;
  }

  return driver.phone || "Unknown driver";
}

export function mapRelayDriverFields(driver: RelayDriver) {
  const dataFields = (driver.data_fields || []).map((field) => ({
    fieldName: field.field_name,
    fieldValue: field.field_value,
  }));

  return {
    integrationId: driver.integration_id,
    firstName: driver.first_name,
    lastName: driver.last_name,
    displayName: buildRelayDriverDisplayName(driver),
    phone: driver.phone,
    email: driver.email ?? undefined,
    dataFields,
    driverNumber: getDataFieldValue(driver.data_fields, "Driver #"),
    truckNumber: getDataFieldValue(driver.data_fields, "Truck #"),
    companyName: getDataFieldValue(driver.data_fields, "Company Name"),
  };
}

export function mapRelayTransactionToStationUpdate(transaction: RelayTransaction) {
  const location = transaction.location;

  if (!location?.id) {
    return null;
  }

  const fuelItem = pickPrimaryFuelItem(transaction.fuel_items);
  const retailPricePerUnit = parsePrice(fuelItem?.retail_price_per_unit);
  const discountedPricePerUnit = parsePrice(fuelItem?.discounted_price_per_unit);

  if (!fuelItem || (retailPricePerUnit === undefined && discountedPricePerUnit === undefined)) {
    return null;
  }

  return {
    relayLocationId: location.id,
    merchantName: transaction.merchant?.name,
    merchantNumber: transaction.merchant?.number,
    name: location.name,
    fuelMerchantLocationId: location.fuel_merchant_location_id,
    address: location.address,
    city: location.city,
    state: location.state,
    zipCode: location.zip_code,
    latitude: location.latitude,
    longitude: location.longitude,
    opisId: location.opis_id,
    timezone: location.timezone,
    fuelType: fuelItem.fuel_type,
    fuelTypeDescription: fuelItem.fuel_type_description,
    retailPricePerUnit,
    discountedPricePerUnit,
    lastTransactionAt: transaction.created_at ? new Date(transaction.created_at) : undefined,
    lastTransactionId: transaction.transaction_id,
  };
}

export function toFuelStationView(station: FuelStationDocument) {
  return {
    relayAccount: station.relayAccount,
    relayLocationId: station.relayLocationId,
    merchantName: station.merchantName,
    merchantNumber: station.merchantNumber,
    name: station.name,
    fuelMerchantLocationId: station.fuelMerchantLocationId,
    address: station.address,
    city: station.city,
    state: station.state,
    zipCode: station.zipCode,
    latitude: station.latitude,
    longitude: station.longitude,
    opisId: station.opisId,
    timezone: station.timezone,
    fuelType: station.fuelType,
    fuelTypeDescription: station.fuelTypeDescription,
    ...relayDieselPriceFields(station),
    lastTransactionAt: station.lastTransactionAt?.toISOString(),
    lastTransactionId: station.lastTransactionId,
    isActive: station.isActive,
    syncedAt: station.syncedAt?.toISOString(),
  };
}

export function toRelayDriverView(driver: RelayDriverDocument) {
  return {
    relayAccount: driver.relayAccount,
    relayDriverId: driver.relayDriverId,
    integrationId: driver.integrationId,
    firstName: driver.firstName,
    lastName: driver.lastName,
    displayName: driver.displayName,
    phone: driver.phone,
    email: driver.email,
    dataFields: driver.dataFields,
    driverNumber: driver.driverNumber,
    truckNumber: driver.truckNumber,
    companyName: driver.companyName,
    isActive: driver.isActive,
    syncedAt: driver.syncedAt?.toISOString(),
  };
}

export function buildStationSummary(stations: ReturnType<typeof toFuelStationView>[]) {
  const merchants = new Set(stations.map((station) => station.merchantName).filter(Boolean));
  const states = new Set(stations.map((station) => station.state).filter(Boolean));
  const withPricing = stations.filter(
    (station) => station.retailPricePerUnit !== undefined || station.discountedPricePerUnit !== undefined,
  ).length;

  return {
    stationCount: stations.length,
    merchantCount: merchants.size,
    stateCount: states.size,
    stationsWithPricing: withPricing,
  };
}
