import type { FleetVehicle } from "@/types/fleet";
import { formatFleetTimestamp } from "./fleet-utils";

function escapeCsvValue(value: string | number | boolean | undefined | null) {
  const normalized = value === undefined || value === null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function vehicleToCsvRow(vehicle: FleetVehicle) {
  return [
    vehicle.unitNumber,
    vehicle.samsaraId,
    vehicle.isActive ? "Active" : "Inactive",
    vehicle.make ?? "",
    vehicle.model ?? "",
    vehicle.year ?? "",
    vehicle.vin ?? "",
    vehicle.licensePlate ?? "",
    vehicle.fuel?.percent ?? "",
    vehicle.fuel?.freshness ?? "",
    vehicle.fuel?.isLow ?? "",
    vehicle.fuel?.recordedAt ? formatFleetTimestamp(vehicle.fuel.recordedAt) : "",
    vehicle.gps?.formattedLocation ?? vehicle.gps?.addressName ?? "",
    vehicle.gps?.latitude ?? "",
    vehicle.gps?.longitude ?? "",
    vehicle.gps?.speedMilesPerHour ?? "",
    vehicle.gps?.headingDegrees ?? "",
    vehicle.gps?.freshness ?? "",
    vehicle.gps?.recordedAt ? formatFleetTimestamp(vehicle.gps.recordedAt) : "",
    vehicle.registrySyncedAt ? formatFleetTimestamp(vehicle.registrySyncedAt) : "",
    vehicle.telemetrySyncedAt ? formatFleetTimestamp(vehicle.telemetrySyncedAt) : "",
    formatFleetTimestamp(vehicle.updatedAt),
  ].map(escapeCsvValue);
}

const CSV_HEADERS = [
  "Unit Number",
  "Samsara ID",
  "Status",
  "Make",
  "Model",
  "Year",
  "VIN",
  "License Plate",
  "Fuel %",
  "Fuel Freshness",
  "Low Fuel",
  "Fuel Recorded At",
  "Location",
  "Latitude",
  "Longitude",
  "Speed (mph)",
  "Heading",
  "GPS Freshness",
  "GPS Recorded At",
  "Registry Synced At",
  "Telemetry Synced At",
  "Updated At",
];

export function exportFleetToCsv(vehicles: FleetVehicle[], filename = "fleet-snapshot.csv") {
  const rows = [CSV_HEADERS.map(escapeCsvValue).join(","), ...vehicles.map((v) => vehicleToCsvRow(v).join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
