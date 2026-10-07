import { HttpError } from "../../../utils/http-error";
import { getSamsaraTelemetryStaleMs } from "../../../integrations/samsara";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";
import { buildFleetSummary, toFleetVehicleView } from "../mappers/fleet-vehicle.mapper";
import { normalizeVin } from "../../../utils/fleet-identifiers";
import {
  resolveDispatcherFleetScope,
  type FleetScopeActor,
} from "./dispatcher-fleet-scope";

type ListFleetVehiclesOptions = {
  activeOnly?: boolean;
  actor?: FleetScopeActor | null;
};

export async function listFleetVehicles(options: ListFleetVehiclesOptions = {}) {
  const filter: Record<string, unknown> = options.activeOnly ? { isActive: true } : {};
  const scope = await resolveDispatcherFleetScope(options.actor);
  const staleThresholdMs = getSamsaraTelemetryStaleMs();

  if (scope.mode === "none") {
    return {
      summary: buildFleetSummary([], staleThresholdMs),
      items: [],
      fleetScope: { mode: scope.mode, reason: scope.reason },
    };
  }

  if (scope.mode === "dispatcher") {
    filter.dispatcherName = { $regex: `^${escapeRegex(scope.dispatcherName)}$`, $options: "i" };
  }

  const vehicles = await FleetVehicleModel.find(filter).sort({ unitNumber: 1 }).lean();
  const items = vehicles.map((vehicle) => toFleetVehicleView(vehicle, staleThresholdMs));

  return {
    summary: buildFleetSummary(items, staleThresholdMs),
    items,
    fleetScope:
      scope.mode === "dispatcher"
        ? { mode: scope.mode, dispatcherName: scope.dispatcherName }
        : { mode: "all" as const },
  };
}

export async function getFleetVehicle(identifier: string, actor?: FleetScopeActor | null) {
  const staleThresholdMs = getSamsaraTelemetryStaleMs();
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

  const scope = await resolveDispatcherFleetScope(actor);
  if (scope.mode === "none") {
    throw new HttpError(scope.reason, 403);
  }
  if (
    scope.mode === "dispatcher" &&
    !scope.unitNumbers.includes(String(vehicle.unitNumber).trim())
  ) {
    throw new HttpError("This truck is outside your assigned dispatcher fleet", 403);
  }

  return toFleetVehicleView(vehicle, staleThresholdMs);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
