import type { Request, Response } from "express";
import { HttpError } from "../../../utils/http-error";
import { getEmailConfigForSettings, verifyEmailTransport } from "../services/mail-config.service";

export async function getMailConfigController(_req: Request, res: Response) {
  const config = getEmailConfigForSettings();

  return res.status(200).json({
    success: true,
    message: config.configured
      ? "Email configuration fetched successfully"
      : "Email is not configured in the environment",
    data: config,
  });
}

export async function verifyMailConfigController(_req: Request, res: Response) {
  try {
    const result = await verifyEmailTransport();

    return res.status(200).json({
      success: true,
      message: "SMTP connection verified",
      data: result,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "SMTP connection failed";
    throw new HttpError(message, 502);
  }
}
