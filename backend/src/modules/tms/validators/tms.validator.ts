import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

export const listActiveLoadsQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    truckUnit: z.string().trim().min(1).optional(),
  }),
});

export const loadIdParamSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    loadId: z.string().trim().min(1),
  }),
});

export const tripContextParamSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    identifier: z.string().trim().min(1),
  }),
});

export const validateListActiveLoads = validateRequest(listActiveLoadsQuerySchema);
export const validateGetActiveLoad = validateRequest(loadIdParamSchema);
export const validateGetTripContext = validateRequest(tripContextParamSchema);
