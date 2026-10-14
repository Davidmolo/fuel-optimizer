import type { Request, Response } from "express";
import { getRequestUser } from "../../../middlewares/require-authenticated-user";
import { getDriverComplianceReport } from "../services/driver-compliance.service";

export async function getDriverComplianceController(req: Request, res: Response) {
  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  const driverIdRaw = req.query.driverId;
  const driverId =
    typeof driverIdRaw === "string" && driverIdRaw.trim()
      ? Number.parseInt(driverIdRaw, 10)
      : undefined;

  const actor = getRequestUser(req);

  const data = await getDriverComplianceReport({
    from,
    to,
    driverId: Number.isFinite(driverId) ? driverId : undefined,
    actor: actor
      ? {
          id: actor.id,
          email: actor.email,
          role: actor.role,
          dispatcherName: actor.dispatcherName ?? null,
          openroadUserId: actor.openroadUserId ?? null,
        }
      : null,
  });

  return res.status(200).json({
    success: true,
    message: "Driver compliance report fetched successfully",
    data,
  });
}
