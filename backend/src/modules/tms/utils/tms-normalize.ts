export type FleetMappingStatus = "linked" | "samsara_only" | "openroad_only" | "conflict";

export { normalizeUnitNumber, normalizeVin } from "../../../utils/fleet-identifiers";

export function isOpenRoadTruckActive(status?: string) {
  return status?.trim().toLowerCase() === "active";
}

export function isOpenRoadDriverActive(status?: string) {
  const normalized = status?.trim().toLowerCase();
  return normalized === "active" || normalized === "available";
}

export function normalizeDriverName(name?: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isDemoDriver(driver: { displayName?: string; employeeNr?: string }) {
  const name = normalizeDriverName(driver.displayName);
  const employeeNr = normalizeDriverName(driver.employeeNr);

  return name === "accounting example" || employeeNr === "accounting";
}

export function parseOpenRoadCoordinate(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getPrimaryDriverIdFromDestinations(destinations: Array<{ driver_id?: number }>) {
  for (const destination of destinations) {
    if (destination.driver_id) {
      return destination.driver_id;
    }
  }

  return undefined;
}
