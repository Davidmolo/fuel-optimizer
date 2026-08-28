import { model, Schema, Types } from "mongoose";

export type MerchantContractDocument = {
  customerId: Types.ObjectId;
  merchantKey: string;
  merchantDisplayName: string;
  rateAdjustmentPerGallon?: number;
  coveredRelayLocationIds?: string[];
  effectiveFrom?: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const merchantContractSchema = new Schema<MerchantContractDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    merchantKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    merchantDisplayName: { type: String, required: true, trim: true },
    rateAdjustmentPerGallon: { type: Number, default: 0 },
    coveredRelayLocationIds: { type: [String], default: undefined },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

merchantContractSchema.index({ customerId: 1, merchantKey: 1 }, { unique: true });

export const MerchantContractModel = model<MerchantContractDocument>(
  "MerchantContract",
  merchantContractSchema,
);
