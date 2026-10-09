import { haversineDistanceMiles } from "../../../utils/geo";
import { TmsLoadModel, type TrimbleTripFuelStopRecord } from "../models/tms-load.model";
import { withStickyGpsNearAt } from "./fuel-stop-status";

/** Evidence-only proximity radius for Samsara GPS vs planned fuel stop. */
export const FUEL_STOP_GPS_NEAR_MILES = 0.25;

const ACTIVE_LOAD_STATUSES_FOR_GPS = ["Dispatched", "InProgress", "ReceivedByClient", "Planned"];

export type GpsProximitySample = {
  truckUnit: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
};

function plannedStopsForLoad(fuelStops?: TrimbleTripFuelStopRecord[], fuelStop?: TrimbleTripFuelStopRecord | null) {
  if (fuelStops?.length) {
    return fuelStops;
  }
  return fuelStop ? [fuelStop] : [];
}

/**
 * For each truck GPS sample, sticky-mark planned fuel stops within 0.25 mi on active loads.
 */
export async function markFuelStopGpsProximity(samples: GpsProximitySample[]) {
  const usable = samples.filter(
    (sample) =>
      sample.truckUnit.trim() &&
      Number.isFinite(sample.latitude) &&
      Number.isFinite(sample.longitude),
  );

  if (usable.length === 0) {
    return { samples: 0, loadsUpdated: 0, stopsMarked: 0 };
  }

  const units = [...new Set(usable.map((sample) => sample.truckUnit.trim()))];
  const loads = await TmsLoadModel.find({
    isActive: true,
    truckUnit: { $in: units },
    "trimbleTrip.tripStatus": { $in: ACTIVE_LOAD_STATUSES_FOR_GPS },
    $or: [
      { "trimbleTrip.fuelStops.0": { $exists: true } },
      { "trimbleTrip.fuelStop": { $ne: null } },
    ],
  });

  const sampleByUnit = new Map(usable.map((sample) => [sample.truckUnit.trim(), sample]));
  let loadsUpdated = 0;
  let stopsMarked = 0;

  for (const load of loads) {
    const unit = load.truckUnit?.trim();
    if (!unit) {
      continue;
    }
    const sample = sampleByUnit.get(unit);
    if (!sample || !load.trimbleTrip) {
      continue;
    }

    const previousStops = plannedStopsForLoad(load.trimbleTrip.fuelStops, load.trimbleTrip.fuelStop);
    if (previousStops.length === 0) {
      continue;
    }

    let changed = false;
    const nextStops = previousStops.map((stop) => {
      if (stop.gpsNearAt) {
        return stop;
      }
      const distance = haversineDistanceMiles(
        { lat: sample.latitude, lng: sample.longitude },
        { lat: stop.latitude, lng: stop.longitude },
      );
      if (distance > FUEL_STOP_GPS_NEAR_MILES) {
        return stop;
      }
      changed = true;
      stopsMarked += 1;
      return withStickyGpsNearAt(stop, sample.recordedAt);
    });

    if (!changed) {
      continue;
    }

    load.trimbleTrip.fuelStops = nextStops;
    load.trimbleTrip.fuelStop = nextStops[0] ?? null;
    load.markModified("trimbleTrip");
    await load.save();
    loadsUpdated += 1;
  }

  return {
    samples: usable.length,
    loadsUpdated,
    stopsMarked,
  };
}
