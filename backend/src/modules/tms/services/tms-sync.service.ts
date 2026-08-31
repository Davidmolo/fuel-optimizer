import {
  listOpenRoadActiveLoads,
  listOpenRoadAssignments,
  listOpenRoadDrivers,
  listOpenRoadTrucks,
} from "../../../integrations/openroad";
import {
  getSamsaraDriverVehicleAssignments,
  isSamsaraConfigured,
} from "../../../integrations/samsara";
import { ensureDatabaseConnected } from "../../../config/database";
import { HttpError } from "../../../utils/http-error";
import { TmsAssignmentModel } from "../models/tms-assignment.model";
import { TmsDriverModel } from "../models/tms-driver.model";
import { TmsLoadModel } from "../models/tms-load.model";
import { mapOpenRoadLoadFields } from "../mappers/tms-load.mapper";
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

export async function syncTmsDrivers() {
  const drivers = await listOpenRoadDrivers();
  const syncedAt = new Date();

  if (drivers.length > 0) {
    await TmsDriverModel.bulkWrite(
      drivers.map((driver) => ({
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
              isActive: isOpenRoadDriverActive(driver.status),
              syncedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  return {
    driverCount: drivers.length,
    driversSyncedAt: syncedAt.toISOString(),
  };
}

export async function syncTmsAssignments() {
  const assignments = await listOpenRoadAssignments({ assignmentType: "Truck" });
  const syncedAt = new Date();
  const currentAssignmentIds = assignments.map((assignment) => assignment.id);

  if (assignments.length > 0) {
    await TmsAssignmentModel.bulkWrite(
      assignments.map((assignment) => ({
        updateOne: {
          filter: { openroadAssignmentId: assignment.id },
          update: {
            $set: {
              openroadAssignmentId: assignment.id,
              openroadDriverId: assignment.driver_id,
              driverName: assignment.driver_name,
              driverNr: assignment.driver_nr,
              driverPhone: assignment.driver_phone,
              driverTeam: assignment.driver_team,
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
      })),
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
  const trucks = await listOpenRoadTrucks("active");
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
  const loads = await listOpenRoadActiveLoads();
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
