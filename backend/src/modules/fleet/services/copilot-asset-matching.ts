export type CopilotAssetExportRow = {
  assetId: string;
  externalName: string;
  dispatcherName?: string;
  status: string;
  productAddons?: string;
};

export type CopilotAssetMatch = {
  assetId: string;
  externalName: string;
  unitNumber: string | null;
  dispatcherName?: string;
  status: string;
  tripManagementEnabled: boolean;
  dispatchable: boolean;
  skipReason?: string;
};

const TEST_ASSET_IDS = new Set(["999"]);

/**
 * Pulls the truck unit from Account Manager ExternalName values like:
 * - "Lyndon Smith #239" → "239"
 * - "Thomas Torres #210 (438335)" → "210"
 * - "244 (Eric)" → "244"
 * - "999" → null (no unit)
 */
export function extractUnitNumberFromExternalName(externalName: string): string | null {
  const trimmed = externalName.trim();
  if (!trimmed) {
    return null;
  }

  const hashMatch = trimmed.match(/#(\d+)\b/);
  if (hashMatch?.[1]) {
    return hashMatch[1];
  }

  const leadingUnitMatch = trimmed.match(/^(\d+)\s*\(/);
  if (leadingUnitMatch?.[1]) {
    return leadingUnitMatch[1];
  }

  return null;
}

export function hasTripManagementAddon(productAddons: string | null | undefined) {
  return Boolean(productAddons && /trip\s*management/i.test(productAddons));
}

export function isDispatchableCopilotAsset(row: CopilotAssetExportRow) {
  if (TEST_ASSET_IDS.has(row.assetId)) {
    return { ok: false as const, reason: "test_tablet" };
  }

  if (!hasTripManagementAddon(row.productAddons)) {
    return { ok: false as const, reason: "missing_trip_management" };
  }

  if (String(row.status).toLowerCase() !== "activated") {
    return { ok: false as const, reason: "not_activated" };
  }

  const unitNumber = extractUnitNumberFromExternalName(row.externalName);
  if (!unitNumber) {
    return { ok: false as const, reason: "missing_unit_number" };
  }

  return { ok: true as const, unitNumber };
}

export function toCopilotAssetMatch(row: CopilotAssetExportRow): CopilotAssetMatch {
  const unitNumber = extractUnitNumberFromExternalName(row.externalName);
  const tripManagementEnabled = hasTripManagementAddon(row.productAddons);
  const dispatchableCheck = isDispatchableCopilotAsset(row);

  return {
    assetId: row.assetId,
    externalName: row.externalName,
    unitNumber,
    dispatcherName: row.dispatcherName?.trim() || undefined,
    status: row.status,
    tripManagementEnabled,
    dispatchable: dispatchableCheck.ok,
    skipReason: dispatchableCheck.ok ? undefined : dispatchableCheck.reason,
  };
}
