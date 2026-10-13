import type { NextFunction, Request, Response } from "express";
import { isSettingsAccessRole } from "../modules/role/constants";
import { getRequestUser, requireSignedInUser } from "./require-authenticated-user";

export const SETTINGS_ACCESS_DENIED_MESSAGE = "Dispatcher accounts cannot access settings";

/** Returns a 403 message when the role cannot access settings; otherwise null. */
export function settingsAccessDeniedMessage(role: string | null | undefined) {
  if (isSettingsAccessRole(role)) {
    return null;
  }
  return SETTINGS_ACCESS_DENIED_MESSAGE;
}

/**
 * Requires a signed-in admin. Non-admin roles (including dispatcher) get 403.
 * Settings / system-wide config stay admin-only until David approves changes.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireSignedInUser(req, res, (error?: unknown) => {
    if (error) {
      return next(error);
    }

    const user = getRequestUser(req);

    if (!user) {
      return;
    }

    const denied = settingsAccessDeniedMessage(user.role);
    if (denied) {
      res.status(403).json({
        success: false,
        message: denied,
      });
      return;
    }

    return next();
  });
}
