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

function getDataFieldValue(fields: RelayDataField[] | undefined, fieldName: string) {
  const match = fields?.find((field) => field.field_name.toLowerCase() === fieldName.toLowerCase());
  return match?.field_value?.trim() || undefined;
}

function pickPrimaryFuelItem(fuelItems?: RelayFuelItem[]) {
  if (!fuelItems?.length) {
    return undefined;
  }

  const dieselItem =
    fuelItems.find((item) => item.fuel_type?.toLowerCase() === "diesel") ||
    fuelItems.find((item) => item.fuel_type_description?.toLowerCase().includes("diesel"));

  return dieselItem || fuelItems[0];
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
    fuelType: fuelItem?.fuel_type,
    fuelTypeDescription: fuelItem?.fuel_type_description,
    retailPricePerUnit: parsePrice(fuelItem?.retail_price_per_unit),
    discountedPricePerUnit: parsePrice(fuelItem?.discounted_price_per_unit),
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
    retailPricePerUnit: station.retailPricePerUnit,
    discountedPricePerUnit: station.discountedPricePerUnit,
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
