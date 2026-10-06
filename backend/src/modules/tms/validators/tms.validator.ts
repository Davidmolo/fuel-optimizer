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

export const planTrimbleTripSchema = z.object({
  body: z
    .object({
      force: z.boolean().optional(),
    })
    .optional()
    .default({}),
  query: z
    .object({
      force: z.string().optional(),
    })
    .optional()
    .default({}),
  params: z.object({
    loadId: z.string().trim().min(1),
  }),
});

export const dispatchTrimbleTripSchema = z.object({
  body: z
    .object({
      tspDriverId: z.string().trim().min(1).optional(),
      allowTestTablet: z.boolean().optional(),
    })
    .optional()
    .default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    loadId: z.string().trim().min(1),
  }),
});

const relayAccountSchema = z.enum(["blue_stallion", "azfs"]).optional();

export const attachFuelStopSchema = z.object({
  body: z
    .object({
      customerSlug: z.string().trim().min(1).optional(),
      relayAccount: relayAccountSchema,
    })
    .optional()
    .default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    loadId: z.string().trim().min(1),
  }),
});

export const dispatchWithFuelStopSchema = z.object({
  body: z
    .object({
      tspDriverId: z.string().trim().min(1).optional(),
      allowTestTablet: z.boolean().optional(),
      useReplanDispatch: z.boolean().optional(),
      customerSlug: z.string().trim().min(1).optional(),
      relayAccount: relayAccountSchema,
    })
    .optional()
    .default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    loadId: z.string().trim().min(1),
  }),
});

export const updateInProgressFuelStopSchema = z.object({
  body: z
    .object({
      customerSlug: z.string().trim().min(1).optional(),
      relayAccount: relayAccountSchema,
    })
    .optional()
    .default({}),
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
export const validatePlanTrimbleTrip = validateRequest(planTrimbleTripSchema);
export const validateDispatchTrimbleTrip = validateRequest(dispatchTrimbleTripSchema);
export const validateAttachFuelStop = validateRequest(attachFuelStopSchema);
export const validateDispatchWithFuelStop = validateRequest(dispatchWithFuelStopSchema);
export const validateUpdateInProgressFuelStop = validateRequest(updateInProgressFuelStopSchema);
export const validateGetTripContext = validateRequest(tripContextParamSchema);
