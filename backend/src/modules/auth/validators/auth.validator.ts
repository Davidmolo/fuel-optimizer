import { z } from "zod";

const otpCodeSchema = z.preprocess(
  (value) => String(value ?? "").replace(/\D/g, ""),
  z.string().length(6, "OTP must be 6 digits"),
);

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(1, "Password is required"),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    otp: otpCodeSchema,
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const forgotPasswordSchema = resendOtpSchema;

export const resetPasswordWithOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
    otp: otpCodeSchema,
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});
