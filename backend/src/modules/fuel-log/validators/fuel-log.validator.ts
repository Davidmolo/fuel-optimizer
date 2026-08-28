import { z } from "zod";

export const createFuelLogSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(1),
    liters: z.number().positive(),
    cost: z.number().positive(),
    odometer: z.number().nonnegative(),
    filledAt: z.coerce.date(),
    note: z.string().max(300).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});
