import mongoose from "mongoose";
import { connectDatabase } from "../src/config/database";
import { FleetVehicleModel } from "../src/modules/fleet/models/fleet-vehicle.model";
import { toCopilotAssetMatch } from "../src/modules/fleet/services/copilot-asset-matching";
import { loadCopilotAssetExport } from "../src/modules/fleet/services/copilot-assets-sync.service";

async function main() {
  await connectDatabase();

  const rows = await loadCopilotAssetExport();
  const matches = rows.map(toCopilotAssetMatch);
  const exportByUnit = new Map(matches.filter((m) => m.unitNumber).map((m) => [m.unitNumber!, m]));

  const vehicles = await FleetVehicleModel.find({ isActive: true }).lean();
  const fleetByUnit = new Map(vehicles.map((v) => [String(v.unitNumber), v]));

  const noAsset = [];
  for (const v of vehicles) {
    const unit = String(v.unitNumber);
    if (v.trimbleAssetId) {
      continue;
    }

    const exp = exportByUnit.get(unit);
    noAsset.push({
      unit,
      reason: !exp
        ? "not_in_copilot_export_as_unit"
        : !exp.dispatchable
          ? exp.skipReason || "not_dispatchable"
          : "export_ok_but_not_synced",
      exportAssetId: exp?.assetId ?? null,
      exportName: exp?.externalName ?? null,
      exportStatus: exp?.status ?? null,
    });
  }

  const exportOnly = [];
  for (const m of matches) {
    if (!m.unitNumber || fleetByUnit.has(m.unitNumber)) {
      continue;
    }
    exportOnly.push({
      assetId: m.assetId,
      unit: m.unitNumber,
      name: m.externalName,
      dispatchable: m.dispatchable,
      skipReason: m.skipReason ?? null,
      dispatcher: m.dispatcherName ?? null,
    });
  }

  const confusingAssetIds = matches
    .filter((m) => m.unitNumber && m.assetId !== m.unitNumber && /^\d+$/.test(m.assetId))
    .map((m) => ({
      assetId: m.assetId,
      mapsToUnit: m.unitNumber,
      name: m.externalName,
    }));

  const skippedExport = matches
    .filter((m) => !m.dispatchable)
    .map((m) => ({
      assetId: m.assetId,
      unit: m.unitNumber,
      name: m.externalName,
      reason: m.skipReason ?? "not_dispatchable",
      status: m.status,
    }));

  noAsset.sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
  exportOnly.sort((a, b) => a.unit.localeCompare(b.unit, undefined, { numeric: true }));
  confusingAssetIds.sort((a, b) => a.assetId.localeCompare(b.assetId, undefined, { numeric: true }));

  const cleanNumeric = noAsset.filter((m) => /^\d+$/.test(m.unit));
  const dirtyLabels = noAsset.filter((m) => !/^\d+$/.test(m.unit));
  const missingByReason: Record<string, number> = {};
  for (const m of noAsset) {
    missingByReason[m.reason] = (missingByReason[m.reason] ?? 0) + 1;
  }
  const cleanMissingByReason: Record<string, number> = {};
  for (const m of cleanNumeric) {
    cleanMissingByReason[m.reason] = (cleanMissingByReason[m.reason] ?? 0) + 1;
  }

  const report = {
    summary: {
      activeFleet: vehicles.length,
      withTrimbleAssetId: vehicles.filter((v) => v.trimbleAssetId).length,
      withoutTrimbleAssetId: noAsset.length,
      cleanNumericUnitsMissing: cleanNumeric.length,
      dirtyUnitLabelsMissing: dirtyLabels.length,
      exportRows: rows.length,
      exportUnitsMissingFromFleet: exportOnly.length,
      skippedExportAssets: skippedExport.length,
      numericAssetIdNotEqualUnit: confusingAssetIds.length,
      missingByReason,
      cleanMissingByReason,
    },
    fleetTrucksMissingAssetId: noAsset,
    cleanNumericUnitsMissingAssetId: cleanNumeric,
    dirtyUnitLabelsMissingAssetId: dirtyLabels.map((m) => m.unit),
    exportAssetsSkipped: skippedExport,
    exportAssetsWithNoFleetUnit: exportOnly,
    assetIdLooksLikeUnitButMapsElsewhere: confusingAssetIds,
  };

  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const outPath = resolve(process.cwd(), "copilot-asset-gaps.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(
    "cleanNumericUnits:",
    cleanNumeric
      .map((m) =>
        m.reason === "not_in_copilot_export_as_unit"
          ? m.unit
          : `${m.unit} [${m.reason}${m.exportAssetId ? ` asset ${m.exportAssetId}` : ""}]`,
      )
      .join(", "),
  );
  console.log("skippedExport:", JSON.stringify(skippedExport));
  console.log(
    "confusingExample: AssetId 212 maps to unit 278; FO truck unit 212 has no CoPilot #212 row",
  );

  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
