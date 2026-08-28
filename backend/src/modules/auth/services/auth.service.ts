import { compare, hash } from "bcryptjs";
import { Types } from "mongoose";
import { UserModel } from "../../user/models/user.model";
import { RoleModel } from "../../role/models/role.model";
import { sendOtpToEmail, verifyOtp } from "../../otp/services/otp.service";

type LoginPayload = {
  email: string;
  password: string;
};

type ResendOtpPayload = {
  email: string;
};

export async function loginWithEmailAndPassword(payload: LoginPayload) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail }).lean();

  if (!user) {
    return null;
  }

  const passwordMatched = await compare(payload.password, user.password);

  if (!passwordMatched) {
    return null;
  }

  const role = await RoleModel.findById(user.roleId as Types.ObjectId).lean();

  await sendOtpToEmail(normalizedEmail);

  return {
    id: user._id,
    email: user.email,
    role: role?.name ?? null,
    roleId: user.roleId,
    otpRequired: true,
  };
}

export async function verifyLoginOtp(payload: { email: string; otp: string }) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const isValid = await verifyOtp(normalizedEmail, payload.otp);

  if (!isValid) {
    return null;
  }

  const user = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (!user) {
    return null;
  }

  const role = await RoleModel.findById(user.roleId as Types.ObjectId).lean();

  return {
    id: user._id,
    email: user.email,
    role: role?.name ?? null,
    roleId: user.roleId,
  };
}

export async function resendLoginOtp(payload: ResendOtpPayload) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail }).lean();

  if (!user) {
    return false;
  }

  await sendOtpToEmail(normalizedEmail);
  return true;
}

export async function requestPasswordReset(payload: ResendOtpPayload) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail }).lean();

  if (user) {
    await sendOtpToEmail(normalizedEmail, "reset");
  }

  return true;
}

export async function resetPasswordWithOtp(payload: {
  email: string;
  otp: string;
  newPassword: string;
}) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const isValid = await verifyOtp(normalizedEmail, payload.otp);

  if (!isValid) {
    return false;
  }

  const user = await UserModel.findOne({ email: normalizedEmail });

  if (!user) {
    return false;
  }

  user.password = await hash(payload.newPassword, 10);
  await user.save();
  return true;
}
