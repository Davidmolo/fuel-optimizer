import type { Request, Response } from "express";
import { getProfileByEmail, resetUserPassword } from "../services/profile.service";

export async function getProfileController(req: Request, res: Response) {
  const email = String(req.query.email ?? "");
  const profile = await getProfileByEmail(email);

  if (!profile) {
    return res.status(404).json({
      success: false,
      message: "Profile not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: profile,
  });
}

export async function resetPasswordController(req: Request, res: Response) {
  const result = await resetUserPassword({
    email: req.body.email,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });

  if (result === null) {
    return res.status(404).json({
      success: false,
      message: "Profile not found",
    });
  }

  if (result === false) {
    return res.status(401).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
}
