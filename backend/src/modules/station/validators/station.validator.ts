import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

const relayAccountSchema = z.enum(["blue_stallion", "azfs"]);

export const listStationsQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    relayAccount: relayAccountSchema.optional(),
    merchant: z.string().trim().min(1).optional(),
    state: z.string().trim().min(2).max(2).optional(),
    activeOnly: z.enum(["true", "false"]).optional(),
  }),
});

export const stationParamSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({
    relayAccount: relayAccountSchema.optional(),
  }),
  params: z.object({
    relayLocationId: z.string().trim().min(1),
  }),
});

export const syncStationsBodySchema = z.object({
  body: z.object({
    relayAccount: relayAccountSchema.optional(),
    dtstart: z.string().datetime({ offset: true }).optional(),
    dtend: z.string().datetime({ offset: true }).optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const listRelayDriversQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    relayAccount: relayAccountSchema.optional(),
    activeOnly: z.enum(["true", "false"]).optional(),
  }),
});

export const validateListStations = validateRequest(listStationsQuerySchema);
export const validateGetStation = validateRequest(stationParamSchema);
export const validateSyncStations = validateRequest(syncStationsBodySchema);
export const validateListRelayDrivers = validateRequest(listRelayDriversQuerySchema);
