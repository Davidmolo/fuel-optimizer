import type { Request, Response } from "express";
import { setTablet999Automation } from "../copilot-lab-automation.service";
import { inspectCopilotLab, runCopilotLabAction, type CopilotLabActionInput } from "../copilot-lab.service";

export async function inspectCopilotLabController(_req: Request, res: Response) {
  const data = await inspectCopilotLab();
  return res.status(200).json({
    success: true,
    message: data.summary,
    data,
  });
}

export async function setCopilotLabAutomationController(req: Request, res: Response) {
  const enabled = req.body?.enabled === true;
  const watchedLoad = typeof req.body?.watchedLoad === "string" ? req.body.watchedLoad : undefined;
  const data = await setTablet999Automation({ enabled, watchedLoad });
  return res.status(200).json({
    success: true,
    message: data.lastMessage,
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
