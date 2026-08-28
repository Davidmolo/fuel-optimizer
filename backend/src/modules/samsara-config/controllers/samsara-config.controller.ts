import type { Request, Response } from "express";
import {
  getSamsaraConfigForSettings,
  updateSamsaraConfig,
} from "../services/samsara-config.service";

export async function getSamsaraConfigController(_req: Request, res: Response) {
  const config = await getSamsaraConfigForSettings();

  if (!config) {
    return res.status(404).json({
      success: false,
      message: "Samsara configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Samsara configuration fetched successfully",
    data: config,
  });
}

export async function updateSamsaraConfigController(req: Request, res: Response) {
  const updated = await updateSamsaraConfig(req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Samsara configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Samsara configuration updated successfully",
    data: updated,
  });
}
