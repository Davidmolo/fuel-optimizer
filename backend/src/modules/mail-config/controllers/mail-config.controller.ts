import type { Request, Response } from "express";
import {
  getEmailConfigForSettings,
  updateEmailConfig,
} from "../services/mail-config.service";

export async function getMailConfigController(_req: Request, res: Response) {
  const config = await getEmailConfigForSettings();

  if (!config) {
    return res.status(404).json({
      success: false,
      message: "Email configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Email configuration fetched successfully",
    data: config,
  });
}

export async function updateMailConfigController(req: Request, res: Response) {
  const updated = await updateEmailConfig(req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Email configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Email configuration updated successfully",
    data: updated,
  });
}
