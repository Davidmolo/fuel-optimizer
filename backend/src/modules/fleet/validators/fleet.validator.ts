import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

export const listFleetVehiclesSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    activeOnly: z.enum(["true", "false"]).optional(),
  }),
});

export const getFleetVehicleSchema = z.object({
  body: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
  params: z.object({
    identifier: z.string().trim().min(1, "Vehicle identifier is required"),
  }),
});

export const validateListFleetVehicles = validateRequest(listFleetVehiclesSchema);
export const validateGetFleetVehicle = validateRequest(getFleetVehicleSchema);
