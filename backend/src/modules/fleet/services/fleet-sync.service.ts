import { getSamsaraVehicleStats, listSamsaraVehicles } from "../../../integrations/samsara";
import { normalizeVin } from "../../../utils/fleet-identifiers";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";

function isVehicleActive(vehicle: { name: string; tags?: Array<{ name: string }> }) {
  if (vehicle.name.trim().toLowerCase().startsWith("deactivated")) {
    return false;
  }

  if (!vehicle.tags?.length) {
    return true;
  }

  const normalized = vehicle.tags.map((tag) => tag.name.trim().toLowerCase());
  if (normalized.includes("inactive") || normalized.includes("retired")) {
    return false;
  }

  return true;
}

function mapGpsTelemetry(stat?: {
  time: string;
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedMilesPerHour?: number;
  reverseGeo?: { formattedLocation?: string };
  address?: { name?: string };
}) {
  if (!stat) {
    return undefined;
  }

  return {
    latitude: stat.latitude,
    longitude: stat.longitude,
    headingDegrees: stat.headingDegrees,
    speedMilesPerHour: stat.speedMilesPerHour,
    formattedLocation: stat.reverseGeo?.formattedLocation,
    addressName: stat.address?.name,
    recordedAt: new Date(stat.time),
  };
}

function mapFuelTelemetry(stat?: { time: string; value: number }) {
  if (!stat) {
    return undefined;
  }

  return {
    percent: stat.value,
    recordedAt: new Date(stat.time),
  };
}

export async function syncFleetRegistry() {
  const vehicles = await listSamsaraVehicles();
  const syncedAt = new Date();

  if (vehicles.length > 0) {
    await FleetVehicleModel.bulkWrite(
      vehicles.map((vehicle) => ({
        updateOne: {
          filter: { samsaraId: vehicle.id },
          update: {
            $set: {
              samsaraId: vehicle.id,
              unitNumber: vehicle.name,
              vin: normalizeVin(vehicle.vin ?? vehicle.externalIds?.["samsara.vin"]) || undefined,
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              licensePlate: vehicle.licensePlate,
              externalIds: vehicle.externalIds ?? {},
              isActive: isVehicleActive(vehicle),
              registrySyncedAt: syncedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  return {
    registryCount: vehicles.length,
    registrySyncedAt: syncedAt.toISOString(),
  };
}

export async function syncFleetTelemetry() {
  const stats = await getSamsaraVehicleStats();
  const syncedAt = new Date();
  const knownIds = new Set(
    (await FleetVehicleModel.find({}, { samsaraId: 1 }).lean()).map((vehicle) => vehicle.samsaraId),
  );

  let missingRegistryCount = 0;

  if (stats.length > 0) {
    await FleetVehicleModel.bulkWrite(
      stats.map((stat) => {
        if (!knownIds.has(stat.id)) {
          missingRegistryCount += 1;
        }

        const gps = mapGpsTelemetry(stat.gps);
        const fuel = mapFuelTelemetry(stat.fuelPercent);
        const update: Record<string, unknown> = {
          unitNumber: stat.name,
          externalIds: stat.externalIds ?? {},
          telemetrySyncedAt: syncedAt,
        };

        const vinFromStats = normalizeVin(stat.externalIds?.["samsara.vin"]);
        if (vinFromStats) {
          update.vin = vinFromStats;
        }

        if (gps) {
          update.gps = gps;
        }

        if (fuel) {
          update.fuel = fuel;
        }

        return {
          updateOne: {
            filter: { samsaraId: stat.id },
            update: {
              $set: update,
              $setOnInsert: {
                samsaraId: stat.id,
                isActive: true,
                registrySyncedAt: syncedAt,
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
    telemetryCount: stats.length,
    missingRegistryCount,
    telemetrySyncedAt: syncedAt.toISOString(),
  };
}

export async function syncFleetFromSamsara() {
  const registry = await syncFleetRegistry();
  const telemetry = await syncFleetTelemetry();

  return {
    ...registry,
    ...telemetry,
  };
}
