import type { Request, Response } from "express";
import {
  getTrimbleConfigForSettings,
  testTrimbleConnection,
  updateTrimbleConfig,
} from "../services/trimble-config.service";

export async function getTrimbleConfigController(_req: Request, res: Response) {
  const config = await getTrimbleConfigForSettings();

  if (!config) {
    return res.status(404).json({
      success: false,
      message: "Trimble configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Trimble configuration fetched successfully",
    data: config,
  });
}

export async function updateTrimbleConfigController(req: Request, res: Response) {
  const updated = await updateTrimbleConfig(req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Trimble configuration not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Trimble configuration updated successfully",
    data: updated,
  });
}

export async function testTrimbleConnectionController(req: Request, res: Response) {
  const result = await testTrimbleConnection({
    apiBaseUrl: req.body?.apiBaseUrl,
    apiKey: req.body?.apiKey,
  });

  return res.status(200).json({
    success: result.ok,
    message: result.message,
    data: result,
  });
}
