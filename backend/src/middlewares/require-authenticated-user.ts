import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { RoleModel } from "../modules/role/models/role.model";
import { UserModel } from "../modules/user/models/user.model";

export type RequestUser = {
  id: string;
  email: string;
  roleId: string;
  role: string;
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

export function getRequestUser(req: Request): RequestUser | undefined {
  return (req as AuthenticatedRequest).user;
}

async function attachSignedInUser(req: Request, res: Response) {
  const emailHeader = req.header("X-User-Email");

  if (!emailHeader?.trim()) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return null;
  }

  const email = emailHeader.trim().toLowerCase();
  const user = await UserModel.findOne({ email }).lean();

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return null;
  }

  const role = await RoleModel.findById(user.roleId).lean();

  (req as AuthenticatedRequest).user = {
    id: String(user._id),
    email: user.email,
    roleId: String(user.roleId),
    role: role?.name ?? "",
  };

  return (req as AuthenticatedRequest).user;
}

export async function requireSignedInUser(req: Request, res: Response, next: NextFunction) {
  const user = await attachSignedInUser(req, res);

  if (!user) {
    return;
  }

  return next();
}

export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  if (!env.API_AUTH_REQUIRED) {
    return next();
  }

  return requireSignedInUser(req, res, next);
}
