import type { Request, Response } from "express";
import {
  getTwilioConfigForSettings,
  updateTwilioConfig,
} from "../services/twilio-config.service";

export async function getTwilioConfigController(_req: Request, res: Response) {
  const config = await getTwilioConfigForSettings();

  if (!config) {
    return res.status(404).json({
      success: false,
      message: "Twilio configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Twilio configuration fetched successfully",
    data: config,
  });
}

export async function updateTwilioConfigController(req: Request, res: Response) {
  const updated = await updateTwilioConfig(req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Twilio configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Twilio configuration updated successfully",
    data: updated,
  });
}
