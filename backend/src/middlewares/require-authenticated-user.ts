import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { UserModel } from "../modules/user/models/user.model";

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
    roleId: string;
  };
};

export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  if (!env.API_AUTH_REQUIRED) {
    return next();
  }

  const emailHeader = req.header("X-User-Email");

  if (!emailHeader?.trim()) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const email = emailHeader.trim().toLowerCase();
  const user = await UserModel.findOne({ email }).lean();

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  (req as AuthenticatedRequest).user = {
    id: String(user._id),
    email: user.email,
    roleId: String(user.roleId),
  };

  return next();
}
