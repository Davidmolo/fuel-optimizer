import type { Request, Response } from "express";
import type { RelayAccount } from "../../../integrations/relay";
import { PAULS_ASSETS_SLUG } from "../../contract/constants";
import { getRecommendationByQuery, getRecommendationForTruck, isRecommendationDemoAllowed } from "../services/recommendation.service";

function parseRelayAccount(value: unknown): RelayAccount | undefined {
  if (value === "blue_stallion" || value === "azfs") {
    return value;
  }

  return undefined;
}

function parseDemoFlag(value: unknown) {
  return value === "true" || value === "1";
}

function parseDemoFuelPercent(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function buildRecommendationOptions(req: Request) {
  const demo = parseDemoFlag(req.query.demo);

  if (demo && !isRecommendationDemoAllowed()) {
    return { demoBlocked: true as const };
  }

  return {
    customerSlug: typeof req.query.customer === "string" ? req.query.customer : PAULS_ASSETS_SLUG,
    relayAccount: parseRelayAccount(req.query.relayAccount),
    demo,
    demoFuelPercent: parseDemoFuelPercent(req.query.fuelPercent),
  };
}

export async function getRecommendationByTruckIdController(req: Request, res: Response) {
  const truckId = typeof req.query.truckId === "string" ? req.query.truckId : "";
  const options = buildRecommendationOptions(req);

  if ("demoBlocked" in options) {
    return res.status(403).json({
      success: false,
      message: "Recommendation demo mode is disabled in this environment.",
    });
  }

  const data = await getRecommendationByQuery({
    truckId,
    ...options,
  });

  return res.status(200).json({
    success: true,
    message: data.message,
    data,
  });
}

export async function getRecommendationController(req: Request, res: Response) {
  const identifier = String(req.params.identifier);
  const options = buildRecommendationOptions(req);

  if ("demoBlocked" in options) {
    return res.status(403).json({
      success: false,
      message: "Recommendation demo mode is disabled in this environment.",
    });
  }

  const data = await getRecommendationForTruck(identifier, options);

  return res.status(200).json({
    success: true,
    message: data.message,
    data,
  });
}
