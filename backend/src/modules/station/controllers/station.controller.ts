import type { Request, Response } from "express";
import type { RelayAccount } from "../../../integrations/relay";
import {
  getFuelStation,
  listFuelStations,
  listStoredRelayDrivers,
} from "../services/station-query.service";
import {
  syncRelayDrivers,
  syncRelayTransactions,
  syncStationsFromRelay,
} from "../services/station-sync.service";

function parseRelayAccount(value: unknown): RelayAccount | undefined {
  if (value === "blue_stallion" || value === "azfs") {
    return value;
  }

  return undefined;
}

export async function syncStationsController(req: Request, res: Response) {
  const relayAccount = parseRelayAccount(req.body?.relayAccount);
  const accounts = relayAccount ? [relayAccount] : undefined;

  const result = await syncStationsFromRelay({
    dtstart: typeof req.body?.dtstart === "string" ? req.body.dtstart : undefined,
    dtend: typeof req.body?.dtend === "string" ? req.body.dtend : undefined,
    accounts,
  });

  return res.status(200).json({
    success: true,
    message: "Stations synced from Relay",
    data: result,
  });
}

export async function syncStationDriversController(req: Request, res: Response) {
  const relayAccount = parseRelayAccount(req.body?.relayAccount);
  const accounts = relayAccount ? [relayAccount] : undefined;
  const result = await syncRelayDrivers(accounts);

  return res.status(200).json({
    success: true,
    message: "Relay drivers synced",
    data: result,
  });
}

export async function syncStationTransactionsController(req: Request, res: Response) {
  const relayAccount = parseRelayAccount(req.body?.relayAccount);

  const result = await syncRelayTransactions({
    dtstart: typeof req.body?.dtstart === "string" ? req.body.dtstart : undefined,
    dtend: typeof req.body?.dtend === "string" ? req.body.dtend : undefined,
    accounts: relayAccount ? [relayAccount] : undefined,
  });

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
