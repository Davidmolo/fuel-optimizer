import { z } from "zod";

export const updateTwilioConfigSchema = z.object({
  body: z.object({
    accountSid: z.string().trim().min(1, "Account SID is required"),
    fromNumber: z.string().trim().min(1, "From number is required"),
    authToken: z.string().optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
