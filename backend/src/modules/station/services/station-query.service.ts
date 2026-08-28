import { HttpError } from "../../../utils/http-error";
import type { RelayAccount } from "../../../integrations/relay";
import { FuelStationModel } from "../models/fuel-station.model";
import { RelayDriverModel } from "../models/relay-driver.model";
import {
  buildStationSummary,
  toFuelStationView,
  toRelayDriverView,
} from "../mappers/fuel-station.mapper";

type ListStationsOptions = {
  relayAccount?: RelayAccount;
  merchant?: string;
  state?: string;
  activeOnly?: boolean;
};

export async function listFuelStations(options: ListStationsOptions = {}) {
  const filter: Record<string, unknown> = {};

  if (options.relayAccount) {
    filter.relayAccount = options.relayAccount;
  }

  if (options.merchant) {
    filter.merchantName = new RegExp(options.merchant, "i");
  }

  if (options.state) {
    filter.state = options.state.toUpperCase();
  }

  if (options.activeOnly) {
    filter.isActive = true;
  }

  const stations = await FuelStationModel.find(filter)
    .sort({ merchantName: 1, state: 1, name: 1 })
    .lean();

  const items = stations.map(toFuelStationView);

  return {
    summary: buildStationSummary(items),
    items,
  };
}

export async function getFuelStation(relayLocationId: string, relayAccount?: RelayAccount) {
  const filter: Record<string, unknown> = { relayLocationId };

  if (relayAccount) {
    filter.relayAccount = relayAccount;
  }

  const station = await FuelStationModel.findOne(filter).lean();

  if (!station) {
    throw new HttpError("Fuel station not found", 404);
  }

  return toFuelStationView(station);
}

export async function listStoredRelayDrivers(options: { relayAccount?: RelayAccount; activeOnly?: boolean } = {}) {
  const filter: Record<string, unknown> = {};

  if (options.relayAccount) {
    filter.relayAccount = options.relayAccount;
  }

  if (options.activeOnly) {
    filter.isActive = true;
  }

  const drivers = await RelayDriverModel.find(filter).sort({ displayName: 1 }).lean();

  return {
    driverCount: drivers.length,
    items: drivers.map(toRelayDriverView),
  };
}
