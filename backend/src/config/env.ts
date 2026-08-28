import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

const envFileName = process.env.APP_ENV === "prod" ? ".env.prod" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFileName) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  OPENROAD_API_BASE_URL: z
    .string()
    .url()
    .default("https://app.openroadtms.com/api/v2"),
  OPENROAD_API_TOKEN: z.string().min(1).optional(),
  RELAY_API_BASE_URL: z
    .string()
    .url()
    .default("https://app.relaypayments.com/api/integrations"),
  RELAY_API_KEY_BLUE_STALLION: z.string().min(1).optional(),
  RELAY_API_KEY_AZFS: z.string().min(1).optional(),
  SAMSARA_API_BASE_URL: z.string().url().default("https://api.samsara.com"),
  SAMSARA_API_TOKEN: z.string().min(1).optional(),
  SAMSARA_TELEMETRY_STALE_MINUTES: z.coerce.number().int().positive().default(30),
  TRIMBLE_API_BASE_URL: z
    .string()
    .url()
    .default("https://pcmiler.alk.com/apis/rest/v1.0/Service.svc"),
  TRIMBLE_API_KEY: z.string().min(1).optional(),
  API_AUTH_REQUIRED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  RECOMMENDATION_DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
