import type { Request, Response } from "express";
import { inspectCopilotLab, runCopilotLabAction, type CopilotLabActionInput } from "../copilot-lab.service";

export async function inspectCopilotLabController(_req: Request, res: Response) {
  const data = await inspectCopilotLab();
  return res.status(200).json({
    success: true,
    message: data.summary,
    data,
  });
}

export async function runCopilotLabActionController(req: Request, res: Response) {
  const data = await runCopilotLabAction(req.body as CopilotLabActionInput);
  return res.status(200).json({
    success: true,
    message: data.verdict,
    data,
  });
}
