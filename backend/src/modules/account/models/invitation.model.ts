import { model, Schema, Types } from "mongoose";
import { ACCOUNT_ROLES, type AccountRole } from "../../role/constants";

export type InvitationDocument = {
  email: string;
  role: AccountRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const invitationSchema = new Schema<InvitationDocument>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    role: { type: String, required: true, enum: ACCOUNT_ROLES },
    tokenHash: { type: String, required: true, unique: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invitationSchema.index({ email: 1, acceptedAt: 1, revokedAt: 1 });

export const InvitationModel = model<InvitationDocument>("Invitation", invitationSchema);
