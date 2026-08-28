import { z } from "zod";

export const updateSamsaraConfigSchema = z.object({
  body: z.object({
    apiBaseUrl: z.string().trim().url("Valid API base URL is required"),
    telemetryStaleMinutes: z.coerce.number().int().positive("Stale minutes must be positive"),
    apiToken: z.string().optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
