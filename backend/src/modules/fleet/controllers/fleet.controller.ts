import type { Request, Response } from "express";
import { getFleetVehicle, listFleetVehicles } from "../services/fleet-query.service";
import {
  syncFleetFromSamsara,
  syncFleetRegistry,
  syncFleetTelemetry,
} from "../services/fleet-sync.service";

export async function syncFleetController(_req: Request, res: Response) {
  const result = await syncFleetFromSamsara();

  return res.status(200).json({
    success: true,
    message: "Fleet synced from Samsara",
    data: result,
  });
}

export async function syncFleetRegistryController(_req: Request, res: Response) {
  const result = await syncFleetRegistry();

  return res.status(200).json({
    success: true,
    message: "Fleet registry synced from Samsara",
    data: result,
  });
}

export async function syncFleetTelemetryController(_req: Request, res: Response) {
  const result = await syncFleetTelemetry();

  return res.status(200).json({
    success: true,
    message: "Fleet telemetry synced from Samsara",
    data: result,
  });
}

export async function listFleetVehiclesController(req: Request, res: Response) {
  const activeOnly = req.query.activeOnly === "true";
  const data = await listFleetVehicles({ activeOnly });

  return res.status(200).json({
    success: true,
    message: "Fleet vehicles fetched successfully",
    data,
  });
}

export async function getFleetVehicleController(req: Request, res: Response) {
  const identifier = String(req.params.identifier);
  const data = await getFleetVehicle(identifier);

  return res.status(200).json({
    success: true,
    message: "Fleet vehicle fetched successfully",
    data,
  });
}
