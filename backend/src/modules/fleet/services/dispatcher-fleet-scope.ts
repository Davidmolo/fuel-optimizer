import {
  isOpenRoadExtConfigured,
  listOpenRoadExtUsers,
} from "../../../integrations/openroad";
import { HttpError } from "../../../utils/http-error";
import { isAdminRole } from "../../role/constants";
import { TmsAssignmentModel } from "../../tms/models/tms-assignment.model";
import { TmsDriverModel } from "../../tms/models/tms-driver.model";
import { UserModel } from "../../user/models/user.model";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";
import { isTestCopilotAssetId } from "./copilot-asset-matching";

export type FleetScopeActor = {
  id: string;
  email?: string;
  role: string;
  dispatcherName?: string | null;
  openroadUserId?: number | null;
};

export type DispatcherFleetScope =
  | { mode: "all" }
  | { mode: "none"; reason: string }
  | {
      mode: "dispatcher";
      dispatcherName: string;
      unitNumbers: string[];
      openroadDriverIds: number[];
      openroadUserId?: number;
      source: "openroad_manager" | "trimble_firstname";
    };

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

/**
 * Resolves the OpenRoad user id for a FO actor: stored id first, then email
 * match against OpenRoad `/users` (persisted back onto the FO user).
 */
export async function resolveOpenRoadUserIdForActor(
  actor: FleetScopeActor,
): Promise<number | null> {
  if (typeof actor.openroadUserId === "number" && Number.isFinite(actor.openroadUserId)) {
    return actor.openroadUserId;
  }

  const email = actor.email?.trim().toLowerCase();
  if (!email || !isOpenRoadExtConfigured()) {
    return null;
  }

  const users = await listOpenRoadExtUsers({ status: "active" });
  const match = users.find((user) => user.email?.trim().toLowerCase() === email);
  if (!match?.id) {
    return null;
  }

  await UserModel.updateOne({ _id: actor.id }, { $set: { openroadUserId: match.id } });
  return match.id;
}

/** Pure helper: truck units currently assigned to the given OpenRoad driver ids. */
export function unitNumbersForManagedDrivers(
  openroadDriverIds: number[],
  assignments: Array<{ openroadDriverId: number; truckUnit?: string | null; isCurrent?: boolean }>,
) {
  const managed = new Set(openroadDriverIds);
  return [
    ...new Set(
      assignments
        .filter(
          (row) =>
            row.isCurrent !== false &&
            managed.has(row.openroadDriverId) &&
            Boolean(row.truckUnit?.trim()),
        )
        .map((row) => String(row.truckUnit).trim()),
    ),
  ];
}

async function resolveScopeFromOpenRoadManager(
  openroadUserId: number,
  label: string,
): Promise<DispatcherFleetScope> {
  const drivers = await TmsDriverModel.find({
    openroadManagerId: openroadUserId,
    isActive: true,
  })
    .select({ openroadDriverId: 1 })
    .lean();

  const openroadDriverIds = drivers.map((driver) => driver.openroadDriverId);

  if (openroadDriverIds.length === 0) {
    return {
      mode: "dispatcher",
      dispatcherName: label,
      unitNumbers: [],
      openroadDriverIds: [],
      openroadUserId,
      source: "openroad_manager",
    };
  }

  const assignments = await TmsAssignmentModel.find({
    isCurrent: true,
    assignmentType: "Truck",
    openroadDriverId: { $in: openroadDriverIds },
  })
    .select({ truckUnit: 1, openroadDriverId: 1, isCurrent: 1 })
    .lean();

  const unitNumbers = unitNumbersForManagedDrivers(openroadDriverIds, assignments);

  return {
    mode: "dispatcher",
    dispatcherName: label,
    unitNumbers,
    openroadDriverIds,
    openroadUserId,
    source: "openroad_manager",
  };
}

async function resolveScopeFromTrimbleDispatcherName(
  dispatcherName: string,
): Promise<DispatcherFleetScope> {
  const vehicles = await FleetVehicleModel.find({
    isActive: true,
    dispatcherName: { $regex: `^${escapeRegex(dispatcherName)}$`, $options: "i" },
  })
    .select({ unitNumber: 1 })
    .lean();

  const unitNumbers = [
    ...new Set(vehicles.map((vehicle) => String(vehicle.unitNumber).trim()).filter(Boolean)),
  ];

  return {
    mode: "dispatcher",
    dispatcherName,
    unitNumbers,
    openroadDriverIds: [],
    source: "trimble_firstname",
  };
}

/**
 * Resolves fleet visibility for the signed-in actor.
 * Admins see all units. Dispatchers prefer OpenRoad `manager_id` → current
 * truck assignments (source of truth for who owns which drivers). Falls back
 * to Trimble CoPilot FirstName on `FleetVehicle.dispatcherName` when the FO
 * user cannot be linked to an OpenRoad user.
 */
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
  const openroadUserId = await resolveOpenRoadUserIdForActor(actor);

  if (openroadUserId != null) {
    const label = dispatcherName || actor.email || `OpenRoad user ${openroadUserId}`;
    return resolveScopeFromOpenRoadManager(openroadUserId, label);
  }

  if (!dispatcherName) {
    return {
      mode: "none",
      reason:
        "No dispatcher fleet assigned. Ask an admin to link your account to OpenRoad (email match) or a Trimble dispatcher name.",
    };
  }

  return resolveScopeFromTrimbleDispatcherName(dispatcherName);
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
