import type { TripContext, TmsLoadDestination } from "@/types/tms";

export type TripLinkageIssue = {
  key: string;
  title: string;
  detail: string;
  action: string;
};

function isValidCoordinate(lat?: number, lng?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function geocodedStops(destinations: TmsLoadDestination[]) {
  return destinations.filter((destination) => isValidCoordinate(destination.lat, destination.lng));
}

function incompleteGeocodedStops(destinations: TmsLoadDestination[]) {
  return geocodedStops(destinations).filter((destination) => !destination.completed);
}

function hasTruckGps(trip: TripContext) {
  return Boolean(
    trip.vehicle?.gps &&
      isValidCoordinate(trip.vehicle.gps.latitude, trip.vehicle.gps.longitude),
  );
}

export function hasLiveGps(trip: TripContext) {
  return hasTruckGps(trip) && trip.vehicle?.gps?.freshness === "live";
}

export function hasLiveFuel(trip: TripContext) {
  return Boolean(trip.vehicle?.fuel && trip.vehicle.fuel.freshness === "live");
}

export function hasPartialTelemetry(trip: TripContext) {
  const gpsLive = hasLiveGps(trip);
  const fuelLive = hasLiveFuel(trip);
  return (gpsLive || fuelLive) && !(gpsLive && fuelLive);
}

export function canEstimateDrivingRoute(trip: TripContext) {
  const openStops = incompleteGeocodedStops(trip.load.destinations).length;

  if (hasTruckGps(trip) && openStops >= 1) {
    return true;
  }

  return openStops >= 2;
}

export function getTripLinkageIssues(trip: TripContext): TripLinkageIssue[] {
  const issues: TripLinkageIssue[] = [];
  const { load, driver, vehicle, linkage } = trip;

  if (!linkage.hasDriver) {
    issues.push({
      key: "no-driver",
      title: "No driver on load",
      detail: "Open Road TMS does not have a driver assigned to this load.",
      action: "Assign a driver in Open Road TMS, then run TMS sync.",
    });
  } else if (!linkage.hasTruckAssignment) {
    issues.push({
      key: "no-truck-assignment",
      title: "Driver has no truck assignment",
      detail: `${driver?.displayName || "The driver"} is on the load, but Open Road has no current truck assignment for them.`,
      action: "Assign a truck to this driver in Open Road TMS, then run TMS sync.",
    });
  }

  if (linkage.hasTruckAssignment && !linkage.hasFleetVehicle) {
    issues.push({
      key: "no-fleet-link",
      title: "Truck not linked to Samsara",
      detail: `Truck ${load.truckUnit} is not matched to a Samsara vehicle in this app.`,
      action: "Run TMS sync and Fleet sync. Confirm the truck VIN matches between Open Road and Samsara.",
    });
  }

  if (vehicle?.mappingStatus === "conflict") {
    issues.push({
      key: "mapping-conflict",
      title: "Fleet mapping conflict",
      detail: "Multiple Samsara vehicles match this Open Road truck VIN.",
      action: "Resolve duplicate VIN matches in fleet records before using telemetry.",
    });
  }

  if (vehicle && !vehicle.gps) {
    issues.push({
      key: "no-gps",
      title: "No GPS from Samsara",
      detail: "Fleet sync has not stored a GPS position for this truck yet.",
      action: "Run Fleet sync and confirm the Samsara ELD device is online.",
    });
  } else if (vehicle?.gps?.freshness === "stale") {
    issues.push({
      key: "stale-gps",
      title: "GPS is stale",
      detail: "The last Samsara position is older than the freshness threshold.",
      action: "Run Fleet sync to refresh GPS.",
    });
  }

  if (vehicle && !vehicle.fuel) {
    issues.push({
      key: "no-fuel",
      title: "No fuel level from Samsara",
      detail: "This truck is not reporting fuelPercents in Samsara.",
      action: "Check the Samsara device configuration or run Fleet sync.",
    });
  } else if (vehicle?.fuel?.freshness === "stale") {
    issues.push({
      key: "stale-fuel",
      title: "Fuel reading is stale",
      detail: "The last Samsara fuel update is older than the freshness threshold.",
      action: "Run Fleet sync to refresh fuel telemetry.",
    });
  }

  const openStops = incompleteGeocodedStops(load.destinations).length;
  const geocodedCount = geocodedStops(load.destinations).length;

  if (geocodedCount === 0) {
    issues.push({
      key: "no-geocoded-stops",
      title: "Stops are not geocoded",
      detail: "Open Road TMS has not provided lat/lng for any stop on this load.",
      action: "Run TMS sync after stop coordinates are available in Open Road.",
    });
  } else if (!canEstimateDrivingRoute(trip)) {
    if (openStops === 0) {
      issues.push({
        key: "route-all-stops-done",
        title: "All stops are complete",
        detail: "Every geocoded stop is marked done and there is no truck GPS to route from.",
        action: "Assign a truck with live GPS for the next leg, or close the load in Open Road if finished.",
      });
    } else {
      issues.push({
        key: "route-not-enough-waypoints",
        title: "Not enough data for a driving route",
        detail: hasTruckGps(trip)
          ? "Truck GPS is available, but there are no remaining open stops to route toward."
          : "Only one open stop remains and there is no truck GPS to start the route from.",
        action: "Assign a truck with Samsara GPS, or wait until a second open stop is available.",
      });
    }
  }

  return issues;
}

export function getTripFuelColumnMessage(trip: TripContext): string | null {
  if (trip.vehicle?.fuel) {
    return null;
  }

  if (!trip.linkage.hasDriver) {
    return "Assign a driver in Open Road TMS";
  }

  if (!trip.linkage.hasTruckAssignment) {
    return "Driver has no truck assignment in Open Road";
  }

  if (!trip.linkage.hasFleetVehicle) {
    return "Truck not linked to Samsara — sync TMS + Fleet";
  }

  return "Samsara is not reporting fuel for this truck";
}

export function getTripRouteMapHint(
  trip: TripContext | null,
  options: {
    hasMapData: boolean;
    hasDrivingRoute: boolean;
    routeLoading: boolean;
    routeError?: string | null;
  },
): string | null {
  if (!trip || options.routeLoading || options.hasDrivingRoute) {
    return null;
  }

  if (!options.hasMapData) {
    return "No stop coordinates yet. Run TMS sync after Open Road provides lat/lng on stops.";
  }

  const openStops = incompleteGeocodedStops(trip.load.destinations).length;

  if (!trip.linkage.hasTruckAssignment) {
    if (!trip.linkage.hasDriver) {
      return "Dashed line shows geocoded stops only. Assign a driver and truck in Open Road TMS, then sync, to add Samsara GPS and a road route.";
    }

    return "Dashed line shows geocoded stops only. This driver has no truck assignment in Open Road — assign a truck and sync to enable GPS.";
  }

  if (!trip.linkage.hasFleetVehicle) {
    return "Dashed line shows geocoded stops only. Truck is assigned in Open Road but not linked to Samsara — run TMS sync and Fleet sync.";
  }

  if (!hasTruckGps(trip)) {
    return "Dashed line shows geocoded stops only. Run Fleet sync to pull Samsara GPS for this truck.";
  }

  if (trip.vehicle?.gps?.freshness === "stale") {
    return "Dashed line shows geocoded stops only. Truck GPS is stale — run Fleet sync for a current road route.";
  }

  if (openStops === 0) {
    return "Dashed line shows geocoded stops only. All stops are complete — there is no remaining leg to route.";
  }

  if (openStops === 1) {
    return "Dashed line shows geocoded stops only. One open stop remains — road routing needs truck GPS (sync Fleet) or a second open stop.";
  }

  if (options.routeError) {
    return options.routeError;
  }

  return "Dashed line shows geocoded stops only. Road route could not be calculated — check stop coordinates and sync status.";
}

export function formatLoadStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function getLoadStatusTone(status: string): "warning" | "danger" | "info" | "success" | "neutral" {
  const value = status.toLowerCase().replaceAll("_", " ");

  if (value.includes("delay") || value.includes("late")) {
    return "warning";
  }

  if (value.includes("cancel") || value.includes("problem")) {
    return "danger";
  }

  if (value.includes("deliver") || value.includes("complete") || value.includes("done")) {
    return "success";
  }

  if (
    value.includes("en route") ||
    value.includes("transit") ||
    value.includes("dispatch") ||
    value.includes("shipper") ||
    value.includes("consignee")
  ) {
    return "info";
  }

  return "neutral";
}

export function getTripReadinessMessage(trip: TripContext): string {
  if (trip.linkage.isReadyForRecommendation) {
    return "Ready for fuel recommendations on the TMS page.";
  }

  const issues = getTripLinkageIssues(trip);
  const primary = issues[0];

  if (primary) {
    return primary.action;
  }

  return "Sync fleet telemetry and confirm truck assignment in Open Road TMS.";
}
