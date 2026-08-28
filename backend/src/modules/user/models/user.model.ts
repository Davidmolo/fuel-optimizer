import { model, Schema, Types } from "mongoose";

export type UserDocument = {
  email: string;
  password: string;
  roleId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, trim: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>("User", userSchema);
