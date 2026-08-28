import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    message: "Backend service is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
}
