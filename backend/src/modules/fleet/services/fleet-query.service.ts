import { HttpError } from "../../../utils/http-error";
import { getSamsaraTelemetryStaleMs } from "../../samsara-config/services/samsara-config.service";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";
import { buildFleetSummary, toFleetVehicleView } from "../mappers/fleet-vehicle.mapper";
import { normalizeVin } from "../../../utils/fleet-identifiers";

type ListFleetVehiclesOptions = {
  activeOnly?: boolean;
};

export async function listFleetVehicles(options: ListFleetVehiclesOptions = {}) {
  const filter = options.activeOnly ? { isActive: true } : {};
  const staleThresholdMs = await getSamsaraTelemetryStaleMs();

  const vehicles = await FleetVehicleModel.find(filter).sort({ unitNumber: 1 }).lean();
  const items = vehicles.map((vehicle) => toFleetVehicleView(vehicle, staleThresholdMs));

  return {
    summary: buildFleetSummary(items, staleThresholdMs),
    items,
  };
}

export async function getFleetVehicle(identifier: string) {
  const staleThresholdMs = await getSamsaraTelemetryStaleMs();
  const numericId = Number(identifier);

  const normalizedVin = normalizeVin(identifier);

  const vehicle = await FleetVehicleModel.findOne({
    $or: [
      { samsaraId: identifier },
      { unitNumber: identifier },
      ...(normalizedVin ? [{ vin: normalizedVin }] : []),
      ...(Number.isFinite(numericId) ? [{ openroadTruckId: numericId }] : []),
    ],
  }).lean();

  if (!vehicle) {
    throw new HttpError("Fleet vehicle not found", 404);
  }

  return toFleetVehicleView(vehicle, staleThresholdMs);
}
