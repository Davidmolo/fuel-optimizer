import { z } from "zod";

export const updateMailConfigSchema = z.object({
  body: z.object({
    service: z.string().trim().min(1, "Service is required"),
    host: z.string().trim().min(1, "Host is required"),
    username: z.string().trim().email("Valid username email is required"),
    fromName: z.string().trim().min(1, "From name is required"),
    password: z.string().optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
