import type { Request, Response } from "express";
import { HttpError } from "../../../utils/http-error";
import {
  getRecommendationConfigForSettings,
  updateRecommendationConfig,
} from "../services/recommendation-config.service";

export async function getRecommendationConfigController(_req: Request, res: Response) {
  const config = await getRecommendationConfigForSettings();

  if (!config) {
    return res.status(404).json({
      success: false,
      message: "Recommendation configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Recommendation configuration fetched successfully",
    data: config,
  });
}

export async function updateRecommendationConfigController(req: Request, res: Response) {
  try {
    const updated = await updateRecommendationConfig(req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Recommendation configuration not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Recommendation configuration updated successfully",
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid recommendation configuration";
    throw new HttpError(message, 400);
  }
}
