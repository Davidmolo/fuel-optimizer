import { model, Schema } from "mongoose";

export type TwilioConfigDocument = {
  key: string;
  accountSid: string;
  authToken: string;
  fromNumber: string;
  createdAt: Date;
  updatedAt: Date;
};

const twilioConfigSchema = new Schema<TwilioConfigDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    accountSid: { type: String, required: true, trim: true },
    authToken: { type: String, required: true },
    fromNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const TwilioConfigModel = model<TwilioConfigDocument>("TwilioConfig", twilioConfigSchema);
