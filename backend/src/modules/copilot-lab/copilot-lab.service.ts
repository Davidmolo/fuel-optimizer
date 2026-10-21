import {
  deleteTrip,
  extractRoutePathPolyline,
  getTripByAlkTripId,
  getTripRoutePath,
  isTripManagementConfigured,
  planTrip,
  modifyTrip,
  searchTripsByDriverId,
  type TripManagementStopInput,
} from "../../integrations/trip-management";
import { HttpError } from "../../utils/http-error";
import type { GeoPoint } from "../../utils/geo";
import {
  rebuildTripStopsPreservingCompleted,
  replaceOpenFuelStops,
} from "../tms/services/fuel-stop-builder";
import { resolveLabFuel } from "./copilot-lab.fuel";
import { getTablet999Automation, type CopilotLabAutomationView } from "./copilot-lab-automation.service";
import {
  LAB_TABLET_ID,
  assertCreateAllowed,
  assertLabTablet,
  assertSendWhileBusyAllowed,
  assertUpdateAllowed,
  buildActionVerdict,
  buildCancelVerdict,
  buildInspectSummary,
  buildLabTmsTripId,
  partitionLabTrips,
  pickTabletTrip,
  sortLabTrips,
  toLabTripView,
  type LabAction,
  type LabFuelMode,
  type LabPoint,
  type LabTripView,
} from "./copilot-lab.rules";

export type CopilotLabActionInput = {
  action: LabAction;
  origin?: LabPoint;
  destination?: LabPoint;
  fuelMode?: LabFuelMode;
  fuelStops?: LabPoint[];
};

export type CopilotLabSnapshot = {
  tabletId: typeof LAB_TABLET_ID;
  trips: LabTripView[];
  activeTrip: LabTripView | null;
  productionLabel: LabTripView["productionLabel"];
  summary: string;
  automation: CopilotLabAutomationView;
};

export type CopilotLabActionResult = CopilotLabSnapshot & {
  action: LabAction;
  verdict: string;
  reachedTablet: boolean;
  fuelStopCount: number;
  recommendationNote?: string;
  actedTrip: LabTripView | null;
};

function assertConfigured() {
  if (!isTripManagementConfigured()) {
    throw new HttpError("Trimble Trip Management is not configured. Set TRIMBLE_API_KEY.", 503);
  }
}

function requireEnds(input: CopilotLabActionInput) {
  if (!input.origin || !input.destination) {
    throw new HttpError("Origin and destination are required for this action.", 400);
  }
  return { origin: input.origin, destination: input.destination };
}

function buildLabStops(origin: LabPoint, destination: LabPoint, stations: Parameters<typeof replaceOpenFuelStops>[1], polyline: GeoPoint[]) {
  const freight: TripManagementStopInput[] = [
    { stopType: "Origin", lat: origin.lat, lon: origin.lon, label: origin.label },
    { stopType: "Destination", lat: destination.lat, lon: destination.lon, label: destination.label },
  ];
  if (stations.length === 0) {
    return freight;
  }
  return replaceOpenFuelStops(freight, stations, polyline).stops;
}

function freightEnds(trip: LabTripView): { origin: LabPoint; destination: LabPoint } | null {
  const freight = trip.stops.filter((stop) => stop.stopType !== "FuelStop");
  const origin = freight[0];
  const destination = freight[freight.length - 1];
  if (!origin || !destination || freight.length < 2) {
    return null;
  }
  return {
    origin: { label: origin.label, lat: origin.lat, lon: origin.lon },
    destination: { label: destination.label, lat: destination.lat, lon: destination.lon },
  };
}

async function listTabletTrips() {
  assertLabTablet(LAB_TABLET_ID);
  const raw = await searchTripsByDriverId(LAB_TABLET_ID);
  const trips = sortLabTrips(
    raw.flatMap((trip) => {
      const view = toLabTripView(trip);
      return view ? [view] : [];
    }),
  );
  const activeTrip = pickTabletTrip(trips);
  return { trips, activeTrip };
}

function snapshotFrom(
  trips: LabTripView[],
  activeTrip: LabTripView | null,
  automation: CopilotLabAutomationView,
): CopilotLabSnapshot {
  return {
    tabletId: LAB_TABLET_ID,
    trips,
    activeTrip,
    productionLabel: activeTrip?.productionLabel ?? "not_sent",
    summary: buildInspectSummary(trips, activeTrip),
    automation,
  };
}

async function loadRoutePolyline(alkTripId: string, fallback: GeoPoint[]) {
  try {
    const path = await getTripRoutePath(alkTripId);
    const line = extractRoutePathPolyline(path);
    if (line.length >= 2) {
      return line;
    }
  } catch {
    // A missing route path still allows a fuel edit from the stop list.
  }
  return fallback;
}

async function planAssignedLabTrip(input: {
  origin: LabPoint;
  destination: LabPoint;
  fuelMode: LabFuelMode;
  manualStops: LabPoint[];
}) {
  const fuel = await resolveLabFuel({
    origin: input.origin,
    destination: input.destination,
    fuelMode: input.fuelMode,
    manualStops: input.manualStops,
  });
  const stops = buildLabStops(input.origin, input.destination, fuel.stations, fuel.polyline);
  if (stops.length < 2) {
    throw new HttpError("A lab trip needs a pickup and a delivery.", 400);
  }

  const tmsTripId = buildLabTmsTripId();
  const planned = await planTrip({
    storeTrip: true,
    tmsTripId,
    name: `CoPilot lab ${tmsTripId}`,
    stops,
    routingType: 0,
    assignTablet: true,
    tspDriverId: LAB_TABLET_ID,
  });

  if (planned.alkTripId == null || String(planned.alkTripId).trim() === "") {
    throw new HttpError("Trimble did not return a trip id for the lab trip.", 502);
  }

  const refreshed = await getTripByAlkTripId(planned.alkTripId);
  const view = toLabTripView({
    ...refreshed,
    tmsTripId: refreshed.tmsTripId || planned.tmsTripId || tmsTripId,
    tspDriverId: refreshed.tspDriverId || LAB_TABLET_ID,
  });
  if (!view) {
    throw new HttpError("Trimble returned a lab trip without an id.", 502);
  }

  return { trip: view, note: fuel.note };
}

async function updateActiveLabTrip(input: CopilotLabActionInput, active: LabTripView) {
  const fuelMode = input.fuelMode ?? "none";
  const ends = freightEnds(active) ?? (input.origin && input.destination
    ? { origin: input.origin, destination: input.destination }
    : null);
  if (!ends) {
    throw new HttpError("The active lab trip has no pickup and delivery to update.", 409);
  }

  const fallback: GeoPoint[] = [
    { lat: ends.origin.lat, lng: ends.origin.lon },
    { lat: ends.destination.lat, lng: ends.destination.lon },
  ];
  const fuel = await resolveLabFuel({
    origin: ends.origin,
    destination: ends.destination,
    fuelMode,
    manualStops: input.fuelStops ?? [],
  });
  const polyline = await loadRoutePolyline(active.alkTripId, fuel.polyline.length >= 2 ? fuel.polyline : fallback);
  const full = await getTripByAlkTripId(active.alkTripId);
  const rebuilt = rebuildTripStopsPreservingCompleted(full.stops ?? [], fuel.stations, polyline);
  if (rebuilt.stops.length < 2) {
    throw new HttpError("The updated trip needs at least two stops.", 400);
  }

  try {
    await modifyTrip({
      alkTripId: active.alkTripId,
      stops: rebuilt.stops,
      preserveRoutingProfile: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error instanceof HttpError ? error.statusCode : 502;
    throw new HttpError(
      `Could not update the trip already on the tablet. A second trip was not created. ${message}`,
      statusCode,
    );
  }

  const refreshed = await getTripByAlkTripId(active.alkTripId);
  const view = toLabTripView({
    ...refreshed,
    tmsTripId: refreshed.tmsTripId || active.tmsTripId || undefined,
    tspDriverId: refreshed.tspDriverId || LAB_TABLET_ID,
  });
  if (!view) {
    throw new HttpError("Trimble returned the updated trip without an id.", 502);
  }

  return { trip: view, note: fuel.note };
}

export async function inspectCopilotLab(): Promise<CopilotLabSnapshot> {
  assertConfigured();
  const [{ trips, activeTrip }, automation] = await Promise.all([listTabletTrips(), getTablet999Automation()]);
  return snapshotFrom(trips, activeTrip, automation);
}

export async function runCopilotLabAction(input: CopilotLabActionInput): Promise<CopilotLabActionResult> {
  assertConfigured();
  assertLabTablet(LAB_TABLET_ID);

  const fuelMode = input.fuelMode ?? "none";
  const [before, automation] = await Promise.all([listTabletTrips(), getTablet999Automation()]);

  if (input.action === "cancel-lab-trips") {
    const parts = partitionLabTrips(before.trips);
    const failures: string[] = [];
    let deletedCount = 0;

    for (const trip of parts.deletable) {
      try {
        await deleteTrip(trip.alkTripId);
        deletedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${trip.tmsTripId ?? trip.alkTripId}: ${message}`);
      }
    }

    if (failures.length > 0) {
      throw new HttpError(
        `Deleted ${deletedCount} lab trip(s). Could not delete: ${failures.join("; ")}`,
        502,
      );
    }

    const after = await listTabletTrips();
    const verdict = buildCancelVerdict({
      deletedCount,
      finishedLabCount: parts.finishedLab.length,
      protectedCount: parts.protectedTrips.length,
      activeAfter: after.activeTrip,
    });

    return {
      ...snapshotFrom(after.trips, after.activeTrip, automation),
      action: input.action,
      verdict: verdict.verdict,
      reachedTablet: verdict.reachedTablet,
      productionLabel: verdict.productionLabel,
      fuelStopCount: after.activeTrip?.fuelStopCount ?? 0,
      actedTrip: null,
    };
  }

  let acted: { trip: LabTripView; note?: string };

  if (input.action === "create") {
    assertCreateAllowed(before.activeTrip);
    const ends = requireEnds(input);
    acted = await planAssignedLabTrip({
      ...ends,
      fuelMode,
      manualStops: input.fuelStops ?? [],
    });
  } else if (input.action === "update-active") {
    const active = assertUpdateAllowed(before.activeTrip);
    acted = await updateActiveLabTrip(input, active);
  } else {
    assertSendWhileBusyAllowed(before.activeTrip);
    const ends = requireEnds(input);
    acted = await planAssignedLabTrip({
      ...ends,
      fuelMode,
      manualStops: input.fuelStops ?? [],
    });
  }

  const after = await listTabletTrips();
  const verdict = buildActionVerdict({
    action: input.action,
    activeBefore: before.activeTrip,
    actedTrip: acted.trip,
    activeAfter: after.activeTrip,
    recommendationNote: acted.note,
  });

  return {
    ...snapshotFrom(after.trips, after.activeTrip, automation),
    action: input.action,
    verdict: verdict.verdict,
    reachedTablet: verdict.reachedTablet,
    productionLabel: verdict.productionLabel,
    fuelStopCount: acted.trip.fuelStopCount,
    recommendationNote: acted.note,
    actedTrip: acted.trip,
  };
}
