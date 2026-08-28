import { compare, hash } from "bcryptjs";
import { Types } from "mongoose";
import { UserModel } from "../../user/models/user.model";
import { RoleModel } from "../../role/models/role.model";

export async function getProfileByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail }).lean();

  if (!user) {
    return null;
  }

  const role = await RoleModel.findById(user.roleId as Types.ObjectId).lean();

  return {
    email: user.email,
    role: role?.name ?? null,
  };
}

export async function resetUserPassword(payload: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail });

  if (!user) {
    return null;
  }

  const passwordMatched = await compare(payload.currentPassword, user.password);

  if (!passwordMatched) {
    return false;
  }

  user.password = await hash(payload.newPassword, 10);
  await user.save();

  return true;
}
