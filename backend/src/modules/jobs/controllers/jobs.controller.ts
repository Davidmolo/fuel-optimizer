import type { Request, Response } from "express";
import { listJobsStatus } from "../jobs.service";

export async function listJobsController(_req: Request, res: Response) {
  const data = await listJobsStatus();

  return res.status(200).json({
    success: true,
    message: "Sync jobs fetched successfully",
    data,
  });
}
