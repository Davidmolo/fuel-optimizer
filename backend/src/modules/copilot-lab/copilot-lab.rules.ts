import { isTestCopilotAssetId } from "../fleet/services/copilot-asset-matching";
import { deriveDriverAcceptLabel } from "../fleet/services/dispatcher-fleet-scope";
import {
  isActiveTabletTripStatus,
  toTabletTripCandidate,
} from "../tms/services/tablet-trip-match";
import type { TripManagementTripResponse } from "../../integrations/trip-management";
import { HttpError } from "../../utils/http-error";

/** In-house CoPilot vehicle. Production Send to CoPilot refuses this id. */
export const LAB_TABLET_ID = "999";

/** Prefix that separates lab trips from production `fo-{loadId}` trips. */
export const LAB_TMS_TRIP_PREFIX = "fo-lab-";

const ACTIVE_RANK: Record<string, number> = {
  InProgress: 0,
  Dispatched: 1,
  ReceivedByClient: 2,
};

const TERMINAL_STATUSES = new Set(["Completed", "Canceled", "Deleted"]);

const RECEIVED_STATUSES = new Set(["Dispatched", "ReceivedByClient", "InProgress"]);

const PRODUCTION_LABEL_TEXT: Record<ReturnType<typeof deriveDriverAcceptLabel>, string> = {
  accepted: "Accepted",
  declined: "Declined",
  waiting: "Waiting",
  not_sent: "Not sent",
  completed: "Completed",
  canceled: "Canceled",
  unknown: "Unknown",
};

export type LabAction = "create" | "update-active" | "send-while-busy" | "cancel-lab-trips";

export type LabFuelMode = "none" | "manual" | "recommendation";

export type LabPoint = {
  label?: string;
  lat: number;
  lon: number;
};

export type LabStopView = {
  stopType: string;
  label?: string;
  lat: number;
  lon: number;
};

export type LabTripView = {
  alkTripId: string;
  tmsTripId: string | null;
  name?: string;
  tripStatus: string;
  tspDriverId: string | null;
  isLabTrip: boolean;
  isActive: boolean;
  productionLabel: ReturnType<typeof deriveDriverAcceptLabel>;
  stops: LabStopView[];
  fuelStopCount: number;
  hasFuelStop: boolean;
};

export function isLabTmsTripId(tmsTripId: string | null | undefined) {
  return Boolean(tmsTripId && tmsTripId.startsWith(LAB_TMS_TRIP_PREFIX));
}

export function buildLabTmsTripId(now = Date.now()) {
  return `${LAB_TMS_TRIP_PREFIX}${now}`;
}

export type WatchedLoadForAutoSend = {
  found: boolean;
  openroadLoadId?: number;
  geocodedStopCount: number;
  tspDriverId?: string | null;
  /** True when the stored trip belongs to OpenRoad or another system. */
  ownedByOtherSystem: boolean;
};

export type Tablet999AutoSendDecision =
  | "waiting"
  | "not-ready"
  | "already-on-lab"
  | "blocked-fleet"
  | "blocked-other-system"
  | "busy"
  | "send";

/**
 * Decide whether the one load named in the lab should be dispatched to tablet 999.
 * A fleet tablet id is never a send target. The caller must pass LAB_TABLET_ID itself.
 */
export function decideTablet999AutoSend(input: {
  load: WatchedLoadForAutoSend;
  tabletBusy: boolean;
}): Tablet999AutoSendDecision {
  const load = input.load;
  if (!load.found) {
    return "waiting";
  }
  if (load.ownedByOtherSystem) {
    return "blocked-other-system";
  }

  const assigned = load.tspDriverId?.trim() ?? "";
  if (assigned) {
    if (isTestCopilotAssetId(assigned)) {
      return "already-on-lab";
    }
    return "blocked-fleet";
  }

  if (load.geocodedStopCount < 2) {
    return "not-ready";
  }
  if (input.tabletBusy) {
    return "busy";
  }
  return "send";
}

export function countGeocodedLoadStops(
  destinations: Array<{ lat?: number | null; lng?: number | null }>,
) {
  return destinations.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)).length;
}

export function assertLabTablet(tspDriverId: string) {
  const id = tspDriverId.trim();
  if (!isTestCopilotAssetId(id) || id !== LAB_TABLET_ID) {
    throw new HttpError(`CoPilot lab only dispatches to tablet ${LAB_TABLET_ID}.`, 409);
  }
}

export function formatProductionLabel(label: ReturnType<typeof deriveDriverAcceptLabel>) {
  return PRODUCTION_LABEL_TEXT[label] ?? "Unknown";
}

export function tripReachedTablet(tripStatus: string) {
  return RECEIVED_STATUSES.has(tripStatus);
}

export function toLabTripView(trip: TripManagementTripResponse): LabTripView | null {
  const candidate = toTabletTripCandidate(trip);
  if (!candidate) {
    return null;
  }

  const fuelStopCount = candidate.stops.filter((stop) => stop.stopType === "FuelStop").length;

  return {
    alkTripId: candidate.alkTripId,
    tmsTripId: candidate.tmsTripId,
    name: trip.name,
    tripStatus: candidate.tripStatus,
    tspDriverId: candidate.tspDriverId,
    isLabTrip: isLabTmsTripId(candidate.tmsTripId),
    isActive: isActiveTabletTripStatus(candidate.tripStatus),
    productionLabel: deriveDriverAcceptLabel(candidate.tripStatus),
    stops: candidate.stops.map((stop) => ({
      stopType: stop.stopType || "Work",
      label: stop.label,
      lat: stop.lat,
      lon: stop.lon,
    })),
    fuelStopCount,
    hasFuelStop: fuelStopCount > 0,
  };
}

export function pickTabletTrip(trips: LabTripView[]): LabTripView | null {
  const active = trips.filter((trip) => trip.isActive);
  active.sort(
    (left, right) => (ACTIVE_RANK[left.tripStatus] ?? 99) - (ACTIVE_RANK[right.tripStatus] ?? 99),
  );
  return active[0] ?? null;
}

export function sortLabTrips(trips: LabTripView[]) {
  return [...trips].sort((left, right) => {
    const leftRank = left.isActive ? (ACTIVE_RANK[left.tripStatus] ?? 50) : 100;
    const rightRank = right.isActive ? (ACTIVE_RANK[right.tripStatus] ?? 50) : 100;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return (left.tmsTripId ?? left.alkTripId).localeCompare(right.tmsTripId ?? right.alkTripId);
  });
}

export function assertCreateAllowed(active: LabTripView | null) {
  if (!active) {
    return;
  }

  throw new HttpError(
    `Tablet ${LAB_TABLET_ID} is already ${active.tripStatus} on ${active.tmsTripId ?? active.alkTripId}. Update that lab trip, send a second route while it is busy, or clear lab trips first.`,
    409,
  );
}

export function assertUpdateAllowed(active: LabTripView | null) {
  if (!active) {
    throw new HttpError(`Tablet ${LAB_TABLET_ID} has no active trip to update.`, 409);
  }

  if (!active.isLabTrip) {
    throw new HttpError(
      `Trip ${active.tmsTripId ?? active.alkTripId} was not created by the lab and will not be modified.`,
      409,
    );
  }

  return active;
}

export function assertSendWhileBusyAllowed(active: LabTripView | null) {
  if (!active) {
    throw new HttpError(
      `Tablet ${LAB_TABLET_ID} has no active trip. Create a trip first, then send a different route while it is busy.`,
      409,
    );
  }

  return active;
}

export function partitionLabTrips(trips: LabTripView[]) {
  const deletable: LabTripView[] = [];
  const finishedLab: LabTripView[] = [];
  const protectedTrips: LabTripView[] = [];

  for (const trip of trips) {
    if (!trip.isLabTrip) {
      protectedTrips.push(trip);
      continue;
    }
    if (TERMINAL_STATUSES.has(trip.tripStatus)) {
      finishedLab.push(trip);
      continue;
    }
    deletable.push(trip);
  }

  return { deletable, finishedLab, protectedTrips };
}

export function buildInspectSummary(trips: LabTripView[], active: LabTripView | null) {
  if (!active) {
    if (trips.length === 0) {
      return `Tablet ${LAB_TABLET_ID} has no trips. A new send can reach the tablet.`;
    }
    return `Tablet ${LAB_TABLET_ID} has no active trip. ${trips.length} assigned trip(s) are not on the tablet. A new send can stay Planned until the tablet is clear.`;
  }

  const others = trips.filter((trip) => trip.alkTripId !== active.alkTripId).length;
  const owner = active.isLabTrip ? "a lab trip" : "a trip this lab did not create";
  const extra =
    others > 0 ? ` ${others} other assigned trip(s) are not the one on the tablet.` : "";

  return `Tablet ${LAB_TABLET_ID} is ${active.tripStatus} on ${owner} (${active.tmsTripId ?? active.alkTripId}). Production would show ${formatProductionLabel(active.productionLabel)}.${extra}`;
}

function withNote(verdict: string, note?: string) {
  const extra = note?.trim();
  return extra ? `${verdict} ${extra}` : verdict;
}

export function buildActionVerdict(input: {
  action: Exclude<LabAction, "cancel-lab-trips">;
  activeBefore: LabTripView | null;
  actedTrip: LabTripView | null;
  activeAfter: LabTripView | null;
  recommendationNote?: string;
}) {
  const acted = input.actedTrip;
  const fuelCount = acted?.fuelStopCount ?? 0;

  if (input.action === "send-while-busy") {
    const before = input.activeBefore;
    const stillOnPrevious = Boolean(
      before && input.activeAfter && input.activeAfter.alkTripId === before.alkTripId,
    );
    const replaced =
      Boolean(acted) &&
      input.activeAfter?.alkTripId === acted?.alkTripId &&
      tripReachedTablet(acted?.tripStatus ?? "");

    if (!before) {
      return {
        verdict: withNote("There was no active trip to compare this send against.", input.recommendationNote),
        reachedTablet: false,
        productionLabel: acted?.productionLabel ?? ("not_sent" as const),
      };
    }

    if (replaced && acted) {
      return {
        verdict: withNote(
          `The new trip is ${acted.tripStatus} and is now the trip on tablet ${LAB_TABLET_ID}. Production would show ${formatProductionLabel(acted.productionLabel)}.`,
          input.recommendationNote,
        ),
        reachedTablet: true,
        productionLabel: acted.productionLabel,
      };
    }

    const newStatus = acted?.tripStatus ?? "Unknown";
    const still = stillOnPrevious ? "is still" : "was";
    return {
      verdict: withNote(
        `Tablet ${LAB_TABLET_ID} ${still} on the ${before.tripStatus} trip (${before.tmsTripId ?? before.alkTripId}). The new trip is ${newStatus} and was not accepted. Production would show ${formatProductionLabel(before.productionLabel)} from the trip already on the tablet, so this send must not be read as Accepted.`,
        input.recommendationNote,
      ),
      reachedTablet: false,
      productionLabel: before.productionLabel,
    };
  }

  if (!acted) {
    return {
      verdict: withNote("Trimble did not return the lab trip.", input.recommendationNote),
      reachedTablet: false,
      productionLabel: "not_sent" as const,
    };
  }

  const label = formatProductionLabel(acted.productionLabel);
  const reachedTablet = tripReachedTablet(acted.tripStatus);

  if (input.action === "update-active") {
    const plannedNote = reachedTablet ? "" : " The tablet does not currently have this trip in progress.";
    return {
      verdict: withNote(
        `Updated lab trip ${acted.tmsTripId ?? acted.alkTripId} in place. Status is ${acted.tripStatus}. Fuel stops on the trip: ${fuelCount}. Production would show ${label} for this same trip.${plannedNote}`,
        input.recommendationNote,
      ),
      reachedTablet,
      productionLabel: acted.productionLabel,
    };
  }

  if (acted.tripStatus === "Planned") {
    return {
      verdict: withNote(
        "This trip stayed Planned. The tablet did not receive it, so it must not be read as Accepted. Production would show Not sent.",
        input.recommendationNote,
      ),
      reachedTablet: false,
      productionLabel: acted.productionLabel,
    };
  }

  return {
    verdict: withNote(
      `Tablet ${LAB_TABLET_ID} received this trip (${acted.tripStatus}). Fuel stops on the trip: ${fuelCount}. Production would show ${label}.`,
      input.recommendationNote,
    ),
    reachedTablet,
    productionLabel: acted.productionLabel,
  };
}

export function buildCancelVerdict(input: {
  deletedCount: number;
  finishedLabCount: number;
  protectedCount: number;
  activeAfter: LabTripView | null;
}) {
  const finished =
    input.finishedLabCount > 0
      ? ` ${input.finishedLabCount} finished lab trip(s) were left in Trimble.`
      : "";
  const protectedNote =
    input.protectedCount > 0
      ? ` ${input.protectedCount} other trip(s) on tablet ${LAB_TABLET_ID} were left unchanged.`
      : "";

  const verdict =
    input.deletedCount === 0
      ? `No open lab trips to clear.${protectedNote}${finished}`
      : `Deleted ${input.deletedCount} lab trip(s) on tablet ${LAB_TABLET_ID}.${protectedNote}${finished}`;

  return {
    verdict: verdict.trim(),
    reachedTablet: false,
    productionLabel: input.activeAfter?.productionLabel ?? ("not_sent" as const),
  };
}
