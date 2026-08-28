import type { OpenRoadTruck } from "../../../integrations/openroad";
import { FleetVehicleModel } from "../../fleet/models/fleet-vehicle.model";
import type { FleetMappingStatus, FleetVehicleDocument } from "../../fleet/models/fleet-vehicle.model";
import { isOpenRoadTruckActive, normalizeVin } from "../utils/tms-normalize";

type LinkFleetVehiclesResult = {
  linkedCount: number;
  openroadOnlyCount: number;
  samsaraOnlyCount: number;
  conflictCount: number;
};

type FleetVehicleLean = FleetVehicleDocument & { _id: unknown };

type PlannedLink = {
  truck: OpenRoadTruck;
  candidate: FleetVehicleLean;
  conflict: boolean;
  mappingStatus: FleetMappingStatus;
};

function resolveMappingStatus(hasSamsara: boolean, hasOpenRoad: boolean, conflict: boolean): FleetMappingStatus {
  if (conflict) {
    return "conflict";
  }

  if (hasSamsara && hasOpenRoad) {
    return "linked";
  }

  if (hasSamsara) {
    return "samsara_only";
  }

  return "openroad_only";
}

function hasVinLinkConflict(vinMatches: FleetVehicleLean[]) {
  return vinMatches.length > 1;
}

function findFleetCandidateByVin(truck: OpenRoadTruck, byVin: Map<string, FleetVehicleLean[]>) {
  const vinKey = normalizeVin(truck.vin);
  const vinMatches = vinKey ? (byVin.get(vinKey) ?? []) : [];

  return {
    candidate: vinMatches[0],
    vinMatches,
  };
}

export async function linkFleetVehiclesToOpenRoad(trucks: OpenRoadTruck[], syncedAt: Date): Promise<LinkFleetVehiclesResult> {
  const fleetVehicles = (await FleetVehicleModel.find().lean()) as FleetVehicleLean[];
  const byVin = new Map<string, FleetVehicleLean[]>();

  for (const vehicle of fleetVehicles) {
    const vinKey = normalizeVin(vehicle.vin);
    if (vinKey) {
      const existing = byVin.get(vinKey) ?? [];
      existing.push(vehicle);
      byVin.set(vinKey, existing);
    }
  }

  let linkedCount = 0;
  let openroadOnlyCount = 0;
  let conflictCount = 0;
  const plannedLinks: PlannedLink[] = [];

  for (const truck of trucks) {
    const { candidate, vinMatches } = findFleetCandidateByVin(truck, byVin);

    if (candidate) {
      const conflict = hasVinLinkConflict(vinMatches);
      const mappingStatus = resolveMappingStatus(Boolean(candidate.samsaraId), true, conflict);
      plannedLinks.push({ truck, candidate, conflict, mappingStatus });

      if (mappingStatus === "conflict") {
        conflictCount += 1;
      } else {
        linkedCount += 1;
      }
      continue;
    }

    openroadOnlyCount += 1;
  }

  const truckIdsToAssign = plannedLinks.filter((link) => !link.conflict).map((link) => link.truck.id);

  if (truckIdsToAssign.length > 0) {
    await FleetVehicleModel.updateMany(
      { openroadTruckId: { $in: truckIdsToAssign } },
      { $unset: { openroadTruckId: 1, openroadStatus: 1 } },
    );
  }

  const bulkOps: Parameters<typeof FleetVehicleModel.bulkWrite>[0] = plannedLinks.map((link) => {
    if (link.conflict) {
      return {
        updateOne: {
          filter: { _id: link.candidate._id },
          update: {
            $set: {
              mappingStatus: link.mappingStatus,
              registrySyncedAt: syncedAt,
            },
          },
        },
      };
    }

    return {
      updateOne: {
        filter: { _id: link.candidate._id },
        update: {
          $set: {
            openroadTruckId: link.truck.id,
            unitNumber: link.truck.unit,
            vin: normalizeVin(link.truck.vin ?? link.candidate.vin) || undefined,
            make: link.truck.make ?? link.candidate.make,
            model: link.truck.model ?? link.candidate.model,
            year: link.truck.year ? String(link.truck.year) : link.candidate.year,
            licensePlate: link.truck.license_plate ?? link.candidate.licensePlate,
            fuelTankCapacityGallons:
              link.truck.fuel_tank_capacity_gallons ?? link.candidate.fuelTankCapacityGallons,
            openroadStatus: link.truck.status,
            mappingStatus: link.mappingStatus,
            isActive: link.candidate.samsaraId ? link.candidate.isActive : isOpenRoadTruckActive(link.truck.status),
            registrySyncedAt: syncedAt,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await FleetVehicleModel.bulkWrite(bulkOps, { ordered: false });
  }

  const samsaraOnlyResult = await FleetVehicleModel.updateMany(
    {
      samsaraId: { $exists: true, $ne: null },
      $or: [{ openroadTruckId: { $exists: false } }, { openroadTruckId: null }],
      mappingStatus: { $ne: "conflict" },
    },
    {
      $set: {
        mappingStatus: "samsara_only",
      },
    },
  );

  return {
    linkedCount,
    openroadOnlyCount,
    samsaraOnlyCount: samsaraOnlyResult.modifiedCount,
    conflictCount,
  };
}
