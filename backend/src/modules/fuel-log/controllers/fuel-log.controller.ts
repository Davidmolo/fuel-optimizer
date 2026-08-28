import type { Request, Response } from "express";
import { createFuelLog, listFuelLogs } from "../services/fuel-log.service";

export async function createFuelLogController(req: Request, res: Response) {
  const created = await createFuelLog(req.body);

  return res.status(201).json({
    success: true,
    message: "Fuel log created successfully",
    data: created,
  });
}

export async function listFuelLogsController(_req: Request, res: Response) {
  const data = await listFuelLogs();

  return res.status(200).json({
    success: true,
    message: "Fuel logs fetched successfully",
    data,
  });
}
