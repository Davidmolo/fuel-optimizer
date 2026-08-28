import { z } from "zod";

export const getProfileSchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z.object({
    email: z.string().email("Valid email is required"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
