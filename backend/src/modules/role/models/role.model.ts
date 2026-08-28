import { model, Schema } from "mongoose";

export type RoleDocument = {
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

const roleSchema = new Schema<RoleDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true, lowercase: true },
  },
  { timestamps: true },
);

export const RoleModel = model<RoleDocument>("Role", roleSchema);
