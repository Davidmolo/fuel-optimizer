import type { TmsLoadDestinationDocument } from "../../tms/models/tms-load.model";
import type { TripManagementStopInput } from "../../../integrations/trip-management";

export type GeocodedLoadStop = Pick<
  TmsLoadDestinationDocument,
  "position" | "stopType" | "companyName" | "city" | "stateCode" | "lat" | "lng"
>;

function buildStopLabel(stop: GeocodedLoadStop) {
  const parts = [
    stop.companyName,
    [stop.city, stop.stateCode].filter(Boolean).join(", "),
  ].filter(Boolean);

  return parts.join(" — ") || undefined;
}

/**
 * Maps OpenRoad load destinations to Trip Management stops.
 * Only geocoded stops are included. First → Origin, last → Destination, middle → Work.
 */
export function mapLoadDestinationsToTripStops(destinations: GeocodedLoadStop[]): TripManagementStopInput[] {
  const geocoded = [...destinations]
    .filter(
      (stop) =>
        Number.isFinite(stop.lat) &&
        Number.isFinite(stop.lng) &&
        Math.abs(Number(stop.lat)) <= 90 &&
        Math.abs(Number(stop.lng)) <= 180,
    )
    .sort((left, right) => left.position - right.position)
    .map((stop) => ({
      ...stop,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
    }));

  if (geocoded.length < 2) {
    return [];
  }

  return geocoded.map((stop, index) => {
    let stopType: TripManagementStopInput["stopType"] = "Work";
    if (index === 0) {
      stopType = "Origin";
    } else if (index === geocoded.length - 1) {
      stopType = "Destination";
    }

    return {
      stopType,
      lat: stop.lat,
      lon: stop.lng,
      label: buildStopLabel(stop),
    };
  });
}
