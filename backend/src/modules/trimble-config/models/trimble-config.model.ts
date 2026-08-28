import { model, Schema } from "mongoose";

export type TrimbleConfigDocument = {
  key: string;
  apiBaseUrl: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
};

const trimbleConfigSchema = new Schema<TrimbleConfigDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    apiBaseUrl: { type: String, required: true, trim: true },
    apiKey: { type: String, required: true, default: "" },
  },
  { timestamps: true },
);

export const TrimbleConfigModel = model<TrimbleConfigDocument>("TrimbleConfig", trimbleConfigSchema);
