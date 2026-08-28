import type { Request, Response } from "express";
import type { RelayAccount } from "../../../integrations/relay";
import { PAULS_ASSETS_SLUG } from "../constants";
import { syncMerchantContractsFromStations } from "../services/contract-merchant-sync.service";
import {
  getStationContractPricing,
  listContractPricing,
  listCustomers,
  listMerchantContracts,
} from "../services/contract-pricing.service";

function parseRelayAccount(value: unknown): RelayAccount | undefined {
  if (value === "blue_stallion" || value === "azfs") {
    return value;
  }

  return undefined;
}

export async function listCustomersController(_req: Request, res: Response) {
  const data = await listCustomers();

  return res.status(200).json({
    success: true,
    message: "Customers fetched successfully",
    data,
  });
}

export async function listMerchantContractsController(req: Request, res: Response) {
  const customerSlug = typeof req.query.customer === "string" ? req.query.customer : PAULS_ASSETS_SLUG;
  const data = await listMerchantContracts(customerSlug);

  return res.status(200).json({
    success: true,
    message: "Merchant contracts fetched successfully",
    data,
  });
}

export async function listContractPricingController(req: Request, res: Response) {
  const data = await listContractPricing({
    customerSlug: typeof req.query.customer === "string" ? req.query.customer : undefined,
    relayAccount: parseRelayAccount(req.query.relayAccount),
    merchant: typeof req.query.merchant === "string" ? req.query.merchant : undefined,
    state: typeof req.query.state === "string" ? req.query.state : undefined,
    activeOnly: req.query.activeOnly !== "false",
  });

  return res.status(200).json({
    success: true,
    message: "Contract pricing fetched successfully",
    data,
  });
}

export async function getStationContractPricingController(req: Request, res: Response) {
  const relayLocationId = String(req.params.relayLocationId);
  const data = await getStationContractPricing(relayLocationId, {
    customerSlug: typeof req.query.customer === "string" ? req.query.customer : undefined,
    relayAccount: parseRelayAccount(req.query.relayAccount),
  });

  return res.status(200).json({
    success: true,
    message: data.station.pricing.available
      ? "Contract pricing calculated successfully"
      : "Station is not available under customer contract",
    data,
  });
}

export async function syncMerchantContractsController(req: Request, res: Response) {
  const customerSlug = typeof req.body?.customer === "string" ? req.body.customer : PAULS_ASSETS_SLUG;
  const data = await syncMerchantContractsFromStations(customerSlug);

  return res.status(200).json({
    success: true,
    message: "Merchant contracts synced from Relay station catalog",
    data,
  });
}
