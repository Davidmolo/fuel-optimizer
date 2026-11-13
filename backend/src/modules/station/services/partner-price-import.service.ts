import { syncMerchantContractsFromStations } from "../../contract/services/contract-merchant-sync.service";
import { arizonaDayStart, arizonaTodayIso, formatMmddyy } from "../../../utils/app-time";
import { HttpError } from "../../../utils/http-error";
import { FuelStationModel, PARTNER_PRICE_PARTNERS, type PartnerPricePartner } from "../models/fuel-station.model";
import { PartnerPriceImportModel } from "../models/partner-price-import.model";
import {
  matchStationCoordinates,
  parsePartnerPriceFile,
  partnerPriceLabel,
  type StationCoordinateCandidate,
} from "./partner-price-file";

const DIESEL_FUEL_TYPE = "diesel";
const DIESEL_FUEL_DESCRIPTION = "ULSD";

export async function importPartnerPriceFile(input: { fileName: string; buffer: Buffer }) {
  const parsed = parsePartnerPriceFile(input.fileName, input.buffer);
  const previous = await PartnerPriceImportModel.findOne({ partner: parsed.partner })
    .sort({ effectiveOn: -1, uploadedAt: -1 })
    .lean();

  const today = arizonaTodayIso();
  if (!today || parsed.effectiveOn > today) {
    throw new HttpError(
      `This ${partnerPriceLabel(parsed.partner)} file is dated ${formatMmddyy(parsed.effectiveOn)}, which is after today in Arizona.`,
      400,
    );
  }

  if (previous && previous.effectiveOn > parsed.effectiveOn) {
    throw new HttpError(
      `This ${partnerPriceLabel(parsed.partner)} file is dated ${formatMmddyy(parsed.effectiveOn)}, which is older than the prices already loaded for ${formatMmddyy(previous.effectiveOn)}.`,
      409,
    );
  }

  const candidates = await FuelStationModel.find({
    latitude: { $gte: -90, $lte: 90 },
    longitude: { $gte: -180, $lte: 180 },
  })
    .select({ name: 1, merchantName: 1, city: 1, state: 1, latitude: 1, longitude: 1 })
    .lean();

  const syncedAt = new Date();
  const externalIds = parsed.rows.map((row) => row.externalStationId);
  const existing = await FuelStationModel.find({
    partner: parsed.partner,
    externalStationId: { $in: externalIds },
  })
    .select({ externalStationId: 1 })
    .lean();
  const existingIds = new Set(existing.map((station) => station.externalStationId));
  let missingLocationCount = 0;

  await FuelStationModel.bulkWrite(
    parsed.rows.map((row) => {
      const coordinates = matchStationCoordinates(row, candidates as StationCoordinateCandidate[]);
      if (!coordinates) {
        missingLocationCount += 1;
      }

      return {
        updateOne: {
          filter: {
            partner: parsed.partner,
            externalStationId: row.externalStationId,
          },
          update: {
            $set: {
              relayAccount: "blue_stallion" as const,
              relayLocationId: `${parsed.partner}:${row.externalStationId}`,
              priceSource: "partner_file" as const,
              partner: parsed.partner,
              externalStationId: row.externalStationId,
              priceEffectiveOn: parsed.effectiveOn,
              merchantName: row.merchantName,
              merchantNumber: row.cardStationCode,
              name: row.name,
              address: row.address,
              city: row.city,
              state: row.state,
              ...(coordinates
                ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
                : {}),
              opisId: row.opisId,
              fuelType: DIESEL_FUEL_TYPE,
              fuelTypeDescription: DIESEL_FUEL_DESCRIPTION,
              retailPricePerUnit: row.retailPricePerUnit,
              discountedPricePerUnit: row.discountedPricePerUnit,
              lastTransactionAt: arizonaDayStart(parsed.effectiveOn),
              isActive: true,
              syncedAt,
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );

  const deactivated = await FuelStationModel.updateMany(
    {
      partner: parsed.partner,
      priceSource: "partner_file",
      isActive: true,
      externalStationId: { $nin: externalIds },
    },
    { $set: { isActive: false, syncedAt } },
  );

  const createdCount = parsed.rows.filter((row) => !existingIds.has(row.externalStationId)).length;
  const uploadedAt = new Date();
  const record = await PartnerPriceImportModel.create({
    partner: parsed.partner,
    fileName: input.fileName,
    effectiveOn: parsed.effectiveOn,
    stationCount: parsed.rows.length,
    createdCount,
    updatedCount: parsed.rows.length - createdCount,
    deactivatedCount: deactivated.modifiedCount,
    rejectedCount: parsed.rejectedCount,
    missingLocationCount,
    uploadedAt,
  });

  await syncMerchantContractsFromStations();

  return toPartnerPriceImportView(record.toObject());
}

export async function listLatestPartnerPriceImports() {
  const imports = await Promise.all(
    PARTNER_PRICE_PARTNERS.map((partner) =>
      PartnerPriceImportModel.findOne({ partner }).sort({ uploadedAt: -1 }).lean(),
    ),
  );

  return {
    items: imports.filter((record) => record !== null).map((record) => toPartnerPriceImportView(record)),
  };
}

function toPartnerPriceImportView(record: {
  partner: PartnerPricePartner;
  fileName: string;
  effectiveOn: string;
  stationCount: number;
  createdCount: number;
  updatedCount: number;
  deactivatedCount: number;
  rejectedCount: number;
  missingLocationCount: number;
  uploadedAt: Date;
}) {
  return {
    partner: record.partner,
    partnerLabel: partnerPriceLabel(record.partner),
    fileName: record.fileName,
    effectiveOn: record.effectiveOn,
    stationCount: record.stationCount,
    createdCount: record.createdCount,
    updatedCount: record.updatedCount,
    deactivatedCount: record.deactivatedCount,
    rejectedCount: record.rejectedCount,
    missingLocationCount: record.missingLocationCount,
    uploadedAt: record.uploadedAt.toISOString(),
  };
}
