import { model, Schema } from "mongoose";

export type OtpDocument = {
  email: string;
  code: string;
  expiresAt: Date;
  isUsed: boolean;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const otpSchema = new Schema<OtpDocument>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    code: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true, index: true },
    isUsed: { type: Boolean, required: true, default: false, index: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);

export const OtpModel = model<OtpDocument>("Otp", otpSchema);
