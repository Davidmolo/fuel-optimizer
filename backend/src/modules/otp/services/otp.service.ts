import nodemailer from "nodemailer";
import { OtpModel } from "../models/otp.model";
import { getEmailConfig } from "../../mail-config/services/mail-config.service";
import { buildOtpTemplate } from "./otp-template.service";

function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpToEmail(email: string, purpose: "login" | "reset" = "login") {
  const normalizedEmail = email.trim().toLowerCase();
  const emailConfig = await getEmailConfig();

  if (!emailConfig) {
    throw new Error("Email configuration not found in database");
  }

  const otpCode = generateSixDigitOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpModel.create({
    email: normalizedEmail,
    code: otpCode,
    expiresAt,
    isUsed: false,
  });

  const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    host: emailConfig.host,
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
  });

  await transporter.sendMail({
    from: `"${emailConfig.fromName}" <${emailConfig.username}>`,
    to: normalizedEmail,
    subject: purpose === "reset" ? "Your password reset code" : "Your OTP for login",
    html: buildOtpTemplate({ otpCode, fromName: emailConfig.fromName, purpose }),
  });
}

export async function verifyOtp(email: string, code: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.replace(/\D/g, "");
  const otpRecord = await OtpModel.findOne({
    email: normalizedEmail,
    code: normalizedCode,
    isUsed: false,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!otpRecord) {
    return false;
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    return false;
  }

  await OtpModel.updateOne({ _id: otpRecord._id }, { $set: { isUsed: true, consumedAt: new Date() } });
  return true;
}
