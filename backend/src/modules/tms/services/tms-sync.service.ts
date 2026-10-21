import type { OpenRoadLoad } from "../../../integrations/openroad";
import {
  isOpenRoadExtConfigured,
  listOpenRoadExtActiveLoads,
  listOpenRoadExtAssignments,
  listOpenRoadExtDrivers,
  listOpenRoadExtTrucks,
  listOpenRoadExtUsers,
  listOpenRoadDrivers,
} from "../../../integrations/openroad";
import {
  getSamsaraDriverVehicleAssignments,
  isSamsaraConfigured,
} from "../../../integrations/samsara";
import { ensureDatabaseConnected } from "../../../config/database";
import { HttpError } from "../../../utils/http-error";
import { UserModel } from "../../user/models/user.model";
import { TmsAssignmentModel } from "../models/tms-assignment.model";
import { TmsDriverModel } from "../models/tms-driver.model";
import { TmsLoadModel } from "../models/tms-load.model";
import { mapOpenRoadLoadFields } from "../mappers/tms-load.mapper";
import { buildOpenRoadManagerLabelMap } from "../utils/openroad-manager-label";
import {
  getPrimaryDriverIdFromDestinations,
  isDemoDriver,
  isOpenRoadDriverActive,
  normalizeDriverName,
} from "../utils/tms-normalize";
import { linkFleetVehiclesToOpenRoad } from "./fleet-linking.service";

function buildDriverDisplayName(driver: {
  first_name?: string;
  last_name?: string;
  employee_nr?: string;
}) {
  const name = [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim();
  if (name) {
    return name;
  }

  return driver.employee_nr ? `Driver ${driver.employee_nr}` : "Unknown driver";
}

async function loadOpenRoadManagerLabels() {
  const labels = new Map<number, string>();
  if (!isOpenRoadExtConfigured()) {
    return labels;
  }

  const [extUsers, foUsers] = await Promise.all([
    listOpenRoadExtUsers({ status: "active" }),
    UserModel.find({ openroadUserId: { $nin: [null] } })
      .select({ openroadUserId: 1, dispatcherName: 1 })
      .lean(),
  ]);

  for (const [id, label] of buildOpenRoadManagerLabelMap(extUsers)) {
    labels.set(id, label);
  }

  // Prefer the Trimble-style label already assigned on a FO account when present
  // (e.g. alex.m@ → "Alex M" instead of a freshly computed variant).
  for (const user of foUsers) {
    const openroadUserId = user.openroadUserId;
    const dispatcherName = user.dispatcherName?.trim();
    if (typeof openroadUserId === "number" && dispatcherName) {
      labels.set(openroadUserId, dispatcherName);
    }
  }

  return labels;
}

export async function syncTmsDrivers() {
  const drivers = await listOpenRoadDrivers();
  const syncedAt = new Date();

  // External API v1 carries manager_id (dispatcher → driver). Legacy V2 does not.
  const managerByDriverId = new Map<number, number | null>();
  let managerLabels = new Map<number, string>();
  if (isOpenRoadExtConfigured()) {
    const [extDrivers, labels] = await Promise.all([
      listOpenRoadExtDrivers(),
      loadOpenRoadManagerLabels(),
    ]);
    managerLabels = labels;
    for (const driver of extDrivers) {
      managerByDriverId.set(
        driver.id,
        typeof driver.manager_id === "number" ? driver.manager_id : null,
      );
    }
  }

  if (drivers.length > 0) {
    await TmsDriverModel.bulkWrite(
      drivers.map((driver) => {
        const managerId = managerByDriverId.get(driver.id);
        const managerName =
          typeof managerId === "number" ? managerLabels.get(managerId) ?? null : null;
        return {
          updateOne: {
            filter: { openroadDriverId: driver.id },
            update: {
              $set: {
                openroadDriverId: driver.id,
                employeeNr: driver.employee_nr,
                firstName: driver.first_name,
                lastName: driver.last_name,
                displayName: buildDriverDisplayName(driver),
                phone: driver.phone,
                email: driver.email ?? undefined,
                status: driver.status,
                position: driver.position,
                terminal: driver.terminal,
                team: driver.team,
                ...(managerByDriverId.has(driver.id)
                  ? {
                      openroadManagerId: managerId ?? null,
                      openroadManagerName: managerName,
                    }
                  : {}),
                isActive: isOpenRoadDriverActive(driver.status),
                syncedAt,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  return {
    driverCount: drivers.length,
    managersSynced: managerByDriverId.size,
    managerLabels: managerLabels.size,
    driversSyncedAt: syncedAt.toISOString(),
  };
}

export async function syncTmsAssignments() {
  const assignments = await listOpenRoadExtAssignments({ assignmentType: "Truck" });
  const syncedAt = new Date();
  const currentAssignmentIds = assignments.map((assignment) => assignment.id);

  // The External API assignments endpoint no longer carries driver phone/team,
  // so backfill both from the driver roster (synced from the legacy V2 API).
  const driverIds = [...new Set(assignments.map((assignment) => assignment.driver_id))];
  const rosterDrivers = await TmsDriverModel.find({ openroadDriverId: { $in: driverIds } }).lean();
  const rosterDriverById = new Map(rosterDrivers.map((driver) => [driver.openroadDriverId, driver]));

  if (assignments.length > 0) {
    await TmsAssignmentModel.bulkWrite(
      assignments.map((assignment) => {
        const rosterDriver = rosterDriverById.get(assignment.driver_id);

        return {
          updateOne: {
            filter: { openroadAssignmentId: assignment.id },
            update: {
              $set: {
                openroadAssignmentId: assignment.id,
                openroadDriverId: assignment.driver_id,
                driverName: assignment.driver_name,
                driverNr: assignment.driver_nr,
                driverPhone: assignment.driver_phone ?? rosterDriver?.phone,
                driverTeam: assignment.driver_team ?? rosterDriver?.team,
                openroadTruckId: assignment.assignment_id,
                truckUnit: assignment.assignment_unit,
                assignmentType: assignment.assignment_type,
                startDate: assignment.start_date ? new Date(assignment.start_date) : undefined,
                endDate: assignment.end_date ? new Date(assignment.end_date) : null,
                isCurrent: !assignment.end_date,
                syncedAt,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  await TmsAssignmentModel.updateMany(
    {
      assignmentType: "Truck",
      openroadAssignmentId: { $nin: currentAssignmentIds },
      isCurrent: true,
    },
    {
      $set: {
        isCurrent: false,
        endDate: syncedAt,
        syncedAt,
      },
    },
  );

  return {
    assignmentCount: assignments.length,
    assignmentsSyncedAt: syncedAt.toISOString(),
  };
}

export async function syncTmsTrucksAndFleetLink() {
  const trucks = await listOpenRoadExtTrucks("active");
  const syncedAt = new Date();
  const linking = await linkFleetVehiclesToOpenRoad(trucks, syncedAt);

  return {
    truckCount: trucks.length,
    trucksSyncedAt: syncedAt.toISOString(),
    linking,
  };
}

export async function syncTmsFleetRoster() {
  const trucks = await syncTmsTrucksAndFleetLink();
  const drivers = await syncTmsDrivers();

  return {
    ...trucks,
    ...drivers,
  };
}

export async function syncTmsFleet() {
  const roster = await syncTmsFleetRoster();
  const assignments = await syncTmsAssignments();

  return {
    ...roster,
    ...assignments,
  };
}

export async function syncTmsActiveLoads() {
  const loads = await listOpenRoadExtActiveLoads();
  const syncedAt = new Date();
  const driverIds = loads
    .map((load) => getPrimaryDriverIdFromDestinations(load.destinations))
    .filter((id): id is number => Boolean(id));
  const drivers = await TmsDriverModel.find({ openroadDriverId: { $in: driverIds } }).lean();
  const driversById = new Map(drivers.map((driver) => [driver.openroadDriverId, driver]));

  const assignments = await TmsAssignmentModel.find({ isCurrent: true, assignmentType: "Truck" }).lean();
  const assignmentByDriverId = new Map(assignments.map((assignment) => [assignment.openroadDriverId, assignment]));
  const samsaraAssignmentsByDriverName = new Map<
    string,
    Awaited<ReturnType<typeof getSamsaraDriverVehicleAssignments>>[number]
  >();

  if (isSamsaraConfigured()) {
    try {
      const samsaraAssignments = await getSamsaraDriverVehicleAssignments();
      for (const assignment of samsaraAssignments) {
        const driverName = normalizeDriverName(assignment.driver?.name);
        if (driverName) {
          samsaraAssignmentsByDriverName.set(driverName, assignment);
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown Samsara assignment error";
      console.warn(`Samsara driver-vehicle assignments were unavailable: ${detail}`);
    }
  }

  const eligibleLoads = loads.filter((load) => {
    const primaryDriverId = getPrimaryDriverIdFromDestinations(load.destinations);
    const driver = primaryDriverId ? driversById.get(primaryDriverId) : undefined;

    return !driver || (driver.isActive && !isDemoDriver(driver));
  });
  const activeLoadIds = eligibleLoads.map((load) => load.id);

  if (eligibleLoads.length > 0) {
    await TmsLoadModel.bulkWrite(
      eligibleLoads.map((load) => {
        const mapped = mapOpenRoadLoadFields(load);
        const primaryDriverId = getPrimaryDriverIdFromDestinations(load.destinations);
        const openRoadAssignment = primaryDriverId ? assignmentByDriverId.get(primaryDriverId) : undefined;
        const driver = primaryDriverId ? driversById.get(primaryDriverId) : undefined;
        const samsaraAssignment = driver
          ? samsaraAssignmentsByDriverName.get(normalizeDriverName(driver.displayName))
          : undefined;
        const truckUnit = openRoadAssignment?.truckUnit ?? samsaraAssignment?.vehicle?.name;
        const update: Record<string, unknown> = {
          openroadLoadId: load.id,
          ...mapped,
          primaryDriverId,
          isActive: true,
          syncedAt,
        };
        const unset: Record<string, 1> = {};

        if (truckUnit) {
          update.truckUnit = truckUnit;
        } else {
          unset.truckUnit = 1;
        }

        if (openRoadAssignment) {
          update.openroadTruckId = openRoadAssignment.openroadTruckId;
          unset.samsaraVehicleId = 1;
        } else if (samsaraAssignment?.vehicle?.id) {
          update.samsaraVehicleId = samsaraAssignment.vehicle.id;
          unset.openroadTruckId = 1;
        } else {
          unset.openroadTruckId = 1;
          unset.samsaraVehicleId = 1;
        }

        return {
          updateOne: {
            filter: { openroadLoadId: load.id },
            update: {
              $set: update,
              $unset: unset,
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );
  }

  await TmsLoadModel.updateMany(
    {
      openroadLoadId: { $nin: activeLoadIds },
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        syncedAt,
      },
    },
  );

  const loadsWithTruck = eligibleLoads.filter((load) => {
    const primaryDriverId = getPrimaryDriverIdFromDestinations(load.destinations);
    const openRoadAssignment = primaryDriverId ? assignmentByDriverId.get(primaryDriverId) : undefined;
    const driver = primaryDriverId ? driversById.get(primaryDriverId) : undefined;
    const samsaraAssignment = driver
      ? samsaraAssignmentsByDriverName.get(normalizeDriverName(driver.displayName))
      : undefined;

    return Boolean(openRoadAssignment?.truckUnit || samsaraAssignment?.vehicle?.name);
  }).length;

  return {
    activeLoadCount: eligibleLoads.length,
    sourceActiveLoadCount: loads.length,
    excludedLoadCount: loads.length - eligibleLoads.length,
    loadsWithTruck,
    loadsSyncedAt: syncedAt.toISOString(),
  };
}

/** Store one OpenRoad load so a lab send does not wait for the 10-minute fleet sync. */
export async function upsertSingleOpenRoadLoad(load: OpenRoadLoad) {
  ensureDatabaseConnected();
  const mapped = mapOpenRoadLoadFields(load);
  const primaryDriverId = getPrimaryDriverIdFromDestinations(load.destinations);
  const driver = primaryDriverId
    ? await TmsDriverModel.findOne({ openroadDriverId: primaryDriverId }).lean()
    : null;

  if (driver && (!driver.isActive || isDemoDriver(driver))) {
    return { stored: false as const, openroadLoadId: load.id };
  }

  const assignment = primaryDriverId
    ? await TmsAssignmentModel.findOne({
        isCurrent: true,
        assignmentType: "Truck",
        openroadDriverId: primaryDriverId,
      }).lean()
    : null;

  const update: Record<string, unknown> = {
    openroadLoadId: load.id,
    ...mapped,
    primaryDriverId,
    isActive: true,
    syncedAt: new Date(),
  };
  const unset: Record<string, 1> = {};

  if (assignment?.truckUnit) {
    update.truckUnit = assignment.truckUnit;
    update.openroadTruckId = assignment.openroadTruckId;
    unset.samsaraVehicleId = 1;
  }

  await TmsLoadModel.updateOne(
    { openroadLoadId: load.id },
    {
      $set: update,
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
    { upsert: true },
  );

  return { stored: true as const, openroadLoadId: load.id };
}

export async function syncTmsFromOpenRoad() {
  ensureDatabaseConnected();

  try {
    const fleet = await syncTmsFleet();
    const loads = await syncTmsActiveLoads();

    return {
      ...fleet,
      ...loads,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : "Unknown sync error";
    throw new HttpError(`TMS sync failed: ${detail}`, 500);
  }
}
