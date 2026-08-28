import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

const relayAccountSchema = z.enum(["blue_stallion", "azfs"]);

export const validateListMerchantContracts = validateRequest(
  z.object({
    body: z.unknown(),
    params: z.unknown(),
    query: z.object({
      customer: z.string().trim().min(1).optional(),
    }),
  }),
);

export const validateListContractPricing = validateRequest(
  z.object({
    body: z.unknown(),
    params: z.unknown(),
    query: z.object({
      customer: z.string().trim().min(1).optional(),
      relayAccount: relayAccountSchema.optional(),
      merchant: z.string().trim().min(1).optional(),
      state: z.string().trim().min(1).optional(),
      activeOnly: z.enum(["true", "false"]).optional(),
    }),
  }),
);

export const validateGetStationContractPricing = validateRequest(
  z.object({
    body: z.unknown(),
    params: z.object({
      relayLocationId: z.string().trim().min(1),
    }),
    query: z.object({
      customer: z.string().trim().min(1).optional(),
      relayAccount: relayAccountSchema.optional(),
    }),
  }),
);
