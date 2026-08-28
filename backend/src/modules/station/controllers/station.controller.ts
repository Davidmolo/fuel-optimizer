import type { Request, Response } from "express";
import type { RelayAccount } from "../../../integrations/relay";
import { runManualJob } from "../../jobs/jobs.service";
import {
  getFuelStation,
  listFuelStations,
  listStoredRelayDrivers,
} from "../services/station-query.service";

function parseRelayAccount(value: unknown): RelayAccount | undefined {
  if (value === "blue_stallion" || value === "azfs") {
    return value;
  }

  return undefined;
}

function relaySyncPayload(body: { relayAccount?: unknown; dtstart?: unknown; dtend?: unknown }) {
  const relayAccount = parseRelayAccount(body.relayAccount);

  return {
    dtstart: typeof body.dtstart === "string" ? body.dtstart : undefined,
    dtend: typeof body.dtend === "string" ? body.dtend : undefined,
    accounts: relayAccount ? [relayAccount] : undefined,
  };
}

export async function syncStationsController(req: Request, res: Response) {
  const result = await runManualJob("relay.full", relaySyncPayload(req.body ?? {}));

  return res.status(200).json({
    success: true,
    message: "Stations synced from Relay",
    data: result,
  });
}

export async function syncStationDriversController(req: Request, res: Response) {
  const result = await runManualJob("relay.drivers", relaySyncPayload(req.body ?? {}));

  return res.status(200).json({
    success: true,
    message: "Relay drivers synced",
    data: result,
  });
}

export async function syncStationTransactionsController(req: Request, res: Response) {
  const result = await runManualJob("relay.transactions", relaySyncPayload(req.body ?? {}));

  return res.status(200).json({
    success: true,
    message: "Relay transactions synced",
    data: result,
  });
}

export async function listStationsController(req: Request, res: Response) {
  const data = await listFuelStations({
    relayAccount: parseRelayAccount(req.query.relayAccount),
    merchant: typeof req.query.merchant === "string" ? req.query.merchant : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    activeOnly: req.query.activeOnly === "true",
  });

  return res.status(200).json({
    success: true,
    message: "Fuel stations fetched successfully",
    data,
  });
}

export async function getStationController(req: Request, res: Response) {
  const relayLocationId = String(req.params.relayLocationId);
  const data = await getFuelStation(relayLocationId, parseRelayAccount(req.query.relayAccount));

  return res.status(200).json({
    success: true,
    message: "Fuel station fetched successfully",
    data,
  });
}

export async function listRelayDriversController(req: Request, res: Response) {
  const data = await listStoredRelayDrivers({
    relayAccount: parseRelayAccount(req.query.relayAccount),
    activeOnly: req.query.activeOnly === "true",
  });

  return res.status(200).json({
    success: true,
    message: "Relay drivers fetched successfully",
    data,
  });
}
