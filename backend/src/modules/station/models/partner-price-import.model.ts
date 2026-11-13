import { model, Schema } from "mongoose";
import { PARTNER_PRICE_PARTNERS, type PartnerPricePartner } from "./fuel-station.model";

export type PartnerPriceImportDocument = {
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
  createdAt: Date;
  updatedAt: Date;
};

const partnerPriceImportSchema = new Schema<PartnerPriceImportDocument>(
  {
    partner: { type: String, required: true, enum: PARTNER_PRICE_PARTNERS, index: true },
    fileName: { type: String, required: true, trim: true },
    effectiveOn: { type: String, required: true },
    stationCount: { type: Number, required: true },
    createdCount: { type: Number, required: true },
    updatedCount: { type: Number, required: true },
    deactivatedCount: { type: Number, required: true },
    rejectedCount: { type: Number, required: true },
    missingLocationCount: { type: Number, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

partnerPriceImportSchema.index({ partner: 1, effectiveOn: -1, uploadedAt: -1 });

export const PartnerPriceImportModel = model<PartnerPriceImportDocument>(
  "PartnerPriceImport",
  partnerPriceImportSchema,
);
