import { model, Schema } from "mongoose";

export type MailConfigDocument = {
  key: string;
  service: string;
  host: string;
  username: string;
  password: string;
  fromName: string;
  createdAt: Date;
  updatedAt: Date;
};

const mailConfigSchema = new Schema<MailConfigDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    service: { type: String, required: true, trim: true },
    host: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    fromName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const MailConfigModel = model<MailConfigDocument>("MailConfig", mailConfigSchema);
