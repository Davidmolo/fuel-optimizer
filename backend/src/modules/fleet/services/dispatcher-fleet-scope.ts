import { isAdminRole } from "../../role/constants";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";
import { HttpError } from "../../../utils/http-error";
import { isTestCopilotAssetId } from "./copilot-asset-matching";

export type FleetScopeActor = {
  id: string;
  role: string;
  dispatcherName?: string | null;
};

export type DispatcherFleetScope =
  | { mode: "all" }
  | { mode: "none"; reason: string }
  | { mode: "dispatcher"; dispatcherName: string; unitNumbers: string[] };

export function normalizeDispatcherName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function dispatcherNamesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = normalizeDispatcherName(left);
  const b = normalizeDispatcherName(right);
  if (!a || !b) {
    return false;
  }
  return a.toLowerCase() === b.toLowerCase();
}

export async function listKnownDispatcherNames() {
  const names = await FleetVehicleModel.distinct("dispatcherName", {
    dispatcherName: { $nin: [null, ""] },
  });

  return names
    .map((name) => String(name).trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export async function resolveDispatcherFleetScope(
  actor: FleetScopeActor | null | undefined,
): Promise<DispatcherFleetScope> {
  if (!actor) {
    return { mode: "all" };
  }

  if (isAdminRole(actor.role)) {
    return { mode: "all" };
  }

  const dispatcherName = normalizeDispatcherName(actor.dispatcherName);
  if (!dispatcherName) {
    return {
      mode: "none",
      reason: "No dispatcher fleet assigned. Ask an admin to assign your Trimble dispatcher name.",
    };
  }

  const vehicles = await FleetVehicleModel.find({
    isActive: true,
    dispatcherName: { $regex: `^${escapeRegex(dispatcherName)}$`, $options: "i" },
  })
    .select({ unitNumber: 1 })
    .lean();

  const unitNumbers = [
    ...new Set(vehicles.map((vehicle) => String(vehicle.unitNumber).trim()).filter(Boolean)),
  ];

  return { mode: "dispatcher", dispatcherName, unitNumbers };
}

export function truckUnitInScope(scope: DispatcherFleetScope, truckUnit: string | null | undefined) {
  if (scope.mode === "all") {
    return true;
  }
  if (scope.mode === "none") {
    return false;
  }
  const unit = truckUnit?.trim();
  if (!unit) {
    return false;
  }
  return scope.unitNumbers.includes(unit);
}

export async function assertLoadInDispatcherScope(args: {
  actor: FleetScopeActor | null | undefined;
  truckUnit?: string | null;
  openroadTruckId?: number | null;
  samsaraVehicleId?: string | null;
}) {
  const scope = await resolveDispatcherFleetScope(args.actor);
  if (scope.mode === "all") {
    return scope;
  }
  if (scope.mode === "none") {
    throw new HttpError(scope.reason, 403);
  }

  if (args.truckUnit && scope.unitNumbers.includes(String(args.truckUnit).trim())) {
    return scope;
  }

  const vehicle = await FleetVehicleModel.findOne({
    isActive: true,
    $or: [
      ...(args.truckUnit ? [{ unitNumber: String(args.truckUnit).trim() }] : []),
      ...(args.openroadTruckId ? [{ openroadTruckId: args.openroadTruckId }] : []),
      ...(args.samsaraVehicleId ? [{ samsaraId: args.samsaraVehicleId }] : []),
    ],
  })
    .select({ unitNumber: 1, dispatcherName: 1 })
    .lean();

  if (vehicle && dispatcherNamesMatch(vehicle.dispatcherName, scope.dispatcherName)) {
    return scope;
  }

  throw new HttpError("This load is outside your assigned dispatcher fleet", 403);
}

export type CopilotSendReadiness = {
  canSend: boolean;
  blockedReason?: string;
  trimbleAssetId?: string;
  tripManagementEnabled: boolean;
  copilotStatus?: string;
  dispatcherName?: string;
  isTestTablet: boolean;
};

export function evaluateCopilotSendReadiness(vehicle: {
  trimbleAssetId?: string | null;
  tripManagementEnabled?: boolean | null;
  copilotStatus?: string | null;
  dispatcherName?: string | null;
} | null): CopilotSendReadiness {
  if (!vehicle) {
    return {
      canSend: false,
      blockedReason: "No linked fleet vehicle for this load's truck",
      tripManagementEnabled: false,
      isTestTablet: false,
    };
  }

  const trimbleAssetId = vehicle.trimbleAssetId?.trim() || undefined;
  const tripManagementEnabled = Boolean(vehicle.tripManagementEnabled);
  const copilotStatus = vehicle.copilotStatus?.trim() || undefined;
  const dispatcherName = normalizeDispatcherName(vehicle.dispatcherName) || undefined;
  const isTestTablet = isTestCopilotAssetId(trimbleAssetId);

  if (!trimbleAssetId) {
    return {
      canSend: false,
      blockedReason: "Truck has no Trimble AssetId (tspDriverId). Sync CoPilot assets first.",
      tripManagementEnabled,
      copilotStatus,
      dispatcherName,
      isTestTablet,
    };
  }

  if (isTestTablet) {
    return {
      canSend: false,
      blockedReason: "Test tablet 999 cannot be used for production Send to CoPilot",
      trimbleAssetId,
      tripManagementEnabled,
      copilotStatus,
      dispatcherName,
      isTestTablet,
    };
  }

  if (!tripManagementEnabled) {
    return {
      canSend: false,
      blockedReason: "Truck does not have the Trip Management add-on",
      trimbleAssetId,
      tripManagementEnabled,
      copilotStatus,
      dispatcherName,
      isTestTablet,
    };
  }

  if (String(copilotStatus || "").toLowerCase() !== "activated") {
    return {
      canSend: false,
      blockedReason: `CoPilot status is ${copilotStatus || "unknown"}; only Activated tablets can be dispatched`,
      trimbleAssetId,
      tripManagementEnabled,
      copilotStatus,
      dispatcherName,
      isTestTablet,
    };
  }

  return {
    canSend: true,
    trimbleAssetId,
    tripManagementEnabled,
    copilotStatus,
    dispatcherName,
    isTestTablet,
  };
}

export function deriveDriverAcceptLabel(tripStatus: string | null | undefined) {
  switch (tripStatus) {
    case "InProgress":
      return "accepted" as const;
    case "Declined":
      return "declined" as const;
    case "Dispatched":
    case "ReceivedByClient":
      return "waiting" as const;
    case "Planned":
      return "not_sent" as const;
    case "Completed":
      return "completed" as const;
    case "Canceled":
    case "Deleted":
      return "canceled" as const;
    default:
      return tripStatus ? ("unknown" as const) : ("not_sent" as const);
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
