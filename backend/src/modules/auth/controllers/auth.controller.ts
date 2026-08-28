import type { Request, Response } from "express";
import {
  loginWithEmailAndPassword,
  requestPasswordReset,
  resendLoginOtp,
  resetPasswordWithOtp,
  verifyLoginOtp,
} from "../services/auth.service";

export async function loginController(req: Request, res: Response) {
  const user = await loginWithEmailAndPassword(req.body);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  return res.status(200).json({
    success: true,
    message: "OTP sent to your email",
    data: user,
  });
}

export async function verifyOtpController(req: Request, res: Response) {
  const user = await verifyLoginOtp(req.body);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully",
    data: user,
  });
}

export async function resendOtpController(req: Request, res: Response) {
  const sent = await resendLoginOtp(req.body);

  if (!sent) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "OTP resent to your email",
  });
}

export async function forgotPasswordController(req: Request, res: Response) {
  await requestPasswordReset(req.body);

  return res.status(200).json({
    success: true,
    message: "If an account exists, a verification code was sent.",
  });
}

export async function resetPasswordController(req: Request, res: Response) {
  const reset = await resetPasswordWithOtp(req.body);

  if (!reset) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
}
