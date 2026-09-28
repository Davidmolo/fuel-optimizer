import { readFile } from "node:fs/promises";
import path from "node:path";
import { FleetVehicleModel } from "../models/fleet-vehicle.model";
import {
  toCopilotAssetMatch,
  type CopilotAssetExportRow,
  type CopilotAssetMatch,
} from "./copilot-asset-matching";

function resolveExportPath() {
  return path.resolve(__dirname, "../data/copilot-assets.export.json");
}

export async function loadCopilotAssetExport(): Promise<CopilotAssetExportRow[]> {
  const filePath = resolveExportPath();
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as CopilotAssetExportRow[];

  if (!Array.isArray(parsed)) {
    throw new Error("CoPilot asset export must be a JSON array");
  }

  return parsed;
}

export type SyncCopilotAssetsResult = {
  exportCount: number;
  matchedCount: number;
  updatedCount: number;
  unmatched: Array<{ assetId: string; externalName: string; unitNumber: string | null; skipReason?: string }>;
  skipped: CopilotAssetMatch[];
  matched: Array<{ assetId: string; unitNumber: string; dispatcherName?: string }>;
};

/**
 * Applies Account Manager export fields onto existing fleet vehicles only.
 * Does not create, delete, or deactivate trucks, and never sends trips.
 */
export async function syncCopilotAssetsFromExport(): Promise<SyncCopilotAssetsResult> {
  const rows = await loadCopilotAssetExport();
  const matches = rows.map(toCopilotAssetMatch);
  const skipped = matches.filter((match) => !match.dispatchable);
  const candidates = matches.filter((match) => match.dispatchable && match.unitNumber);

  const unitNumbers = [...new Set(candidates.map((match) => match.unitNumber!).filter(Boolean))];
  const vehicles = await FleetVehicleModel.find({ unitNumber: { $in: unitNumbers } }).lean();
  const vehicleByUnit = new Map(vehicles.map((vehicle) => [vehicle.unitNumber, vehicle]));

  const matched: SyncCopilotAssetsResult["matched"] = [];
  const unmatched: SyncCopilotAssetsResult["unmatched"] = [];
  let updatedCount = 0;

  for (const match of candidates) {
    const unitNumber = match.unitNumber!;
    const vehicle = vehicleByUnit.get(unitNumber);

    if (!vehicle) {
      unmatched.push({
        assetId: match.assetId,
        externalName: match.externalName,
        unitNumber,
        skipReason: "fleet_vehicle_not_found",
      });
      continue;
    }

    await FleetVehicleModel.updateOne(
      { _id: vehicle._id },
      {
        $set: {
          trimbleAssetId: match.assetId,
          tripManagementEnabled: match.tripManagementEnabled,
          copilotStatus: match.status,
          dispatcherName: match.dispatcherName,
        },
      },
    );

    updatedCount += 1;
    matched.push({
      assetId: match.assetId,
      unitNumber,
      dispatcherName: match.dispatcherName,
    });
  }

  for (const match of skipped) {
    unmatched.push({
      assetId: match.assetId,
      externalName: match.externalName,
      unitNumber: match.unitNumber,
      skipReason: match.skipReason,
    });
  }

  return {
    exportCount: rows.length,
    matchedCount: matched.length,
    updatedCount,
    unmatched,
    skipped,
    matched,
  };
}
