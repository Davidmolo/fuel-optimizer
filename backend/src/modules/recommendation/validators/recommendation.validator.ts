import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

const relayAccountSchema = z.enum(["blue_stallion", "azfs"]);

const recommendationQuerySchema = z.object({
  customer: z.string().trim().min(1).optional(),
  relayAccount: relayAccountSchema.optional(),
  demo: z.enum(["true", "false", "1", "0"]).optional(),
  fuelPercent: z.coerce.number().min(5).max(95).optional(),
});

export const validateGetRecommendationByTruckId = validateRequest(
  z.object({
    body: z.unknown(),
    params: z.unknown(),
    query: recommendationQuerySchema.extend({
      truckId: z.string().trim().min(1),
    }),
  }),
);

export const validateGetRecommendation = validateRequest(
  z.object({
    body: z.unknown(),
    params: z.object({
      identifier: z.string().trim().min(1),
    }),
    query: recommendationQuerySchema,
  }),
);
