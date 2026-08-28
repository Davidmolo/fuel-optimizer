import { model, Schema } from "mongoose";

export type SamsaraConfigDocument = {
  key: string;
  apiBaseUrl: string;
  apiToken: string;
  telemetryStaleMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

const samsaraConfigSchema = new Schema<SamsaraConfigDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    apiBaseUrl: { type: String, required: true, trim: true },
    apiToken: { type: String, required: true },
    telemetryStaleMinutes: { type: Number, required: true, min: 1, default: 30 },
  },
  { timestamps: true },
);

export const SamsaraConfigModel = model<SamsaraConfigDocument>("SamsaraConfig", samsaraConfigSchema);
