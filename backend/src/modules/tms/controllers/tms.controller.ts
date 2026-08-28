import type { Request, Response } from "express";
import {
  getActiveLoad,
  getTripContext,
  listActiveLoads,
  listAssignments,
  listTripContexts,
} from "../services/tms-query.service";
import { getTripDrivingRoute } from "../services/trip-route.service";
import {
  syncTmsActiveLoads,
  syncTmsFleet,
  syncTmsFromOpenRoad,
} from "../services/tms-sync.service";

export async function syncTmsController(_req: Request, res: Response) {
  const result = await syncTmsFromOpenRoad();

  return res.status(200).json({
    success: true,
    message: "TMS data synced from Open Road",
    data: result,
  });
}

export async function syncTmsFleetController(_req: Request, res: Response) {
  const result = await syncTmsFleet();

  return res.status(200).json({
    success: true,
    message: "TMS fleet data synced from Open Road",
    data: result,
  });
}

export async function syncTmsLoadsController(_req: Request, res: Response) {
  const result = await syncTmsActiveLoads();

  return res.status(200).json({
    success: true,
    message: "Active loads synced from Open Road",
    data: result,
  });
}

export async function listActiveLoadsController(req: Request, res: Response) {
  const truckUnit = typeof req.query.truckUnit === "string" ? req.query.truckUnit : undefined;
  const data = await listActiveLoads({ truckUnit });

  return res.status(200).json({
    success: true,
    message: "Active loads fetched successfully",
    data,
  });
}

export async function getActiveLoadController(req: Request, res: Response) {
  const loadId = String(req.params.loadId);
  const data = await getActiveLoad(loadId);

  return res.status(200).json({
    success: true,
    message: "Active load fetched successfully",
    data,
  });
}

export async function listTripContextsController(_req: Request, res: Response) {
  const data = await listTripContexts();

  return res.status(200).json({
    success: true,
    message: "Trip contexts fetched successfully",
    data,
  });
}

export async function getTripContextController(req: Request, res: Response) {
  const identifier = String(req.params.identifier);
  const data = await getTripContext(identifier);

  return res.status(200).json({
    success: true,
    message: "Trip context fetched successfully",
    data,
  });
}

export async function getTripRouteController(req: Request, res: Response) {
  const identifier = String(req.params.identifier);
  const data = await getTripDrivingRoute(identifier);

  return res.status(200).json({
    success: true,
    message: "Trip driving route fetched successfully",
    data,
  });
}

export async function listAssignmentsController(_req: Request, res: Response) {
  const data = await listAssignments();

  return res.status(200).json({
    success: true,
    message: "Truck assignments fetched successfully",
    data,
  });
}
