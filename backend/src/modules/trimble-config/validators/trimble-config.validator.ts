import { z } from "zod";

export const updateTrimbleConfigSchema = z.object({
  body: z.object({
    apiBaseUrl: z.string().trim().url("Valid API base URL is required"),
    apiKey: z.string().optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const testTrimbleConnectionSchema = z.object({
  body: z
    .object({
      apiBaseUrl: z.string().trim().url("Valid API base URL is required").optional(),
      apiKey: z.string().optional(),
    })
    .optional()
    .default({}),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
