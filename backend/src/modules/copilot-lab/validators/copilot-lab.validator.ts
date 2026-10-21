import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

const labPointSchema = z.object({
  label: z.string().trim().max(120).optional(),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

const labActionBodySchema = z
  .object({
    action: z.enum(["create", "update-active", "send-while-busy", "cancel-lab-trips"]),
    origin: labPointSchema.optional(),
    destination: labPointSchema.optional(),
    fuelMode: z.enum(["none", "manual", "recommendation"]).optional().default("none"),
    fuelStops: z.array(labPointSchema).max(8).optional().default([]),
  })
  .superRefine((body, ctx) => {
    const needsEnds = body.action === "create" || body.action === "send-while-busy";
    if (needsEnds && !body.origin) {
      ctx.addIssue({ code: "custom", path: ["origin"], message: "Origin is required" });
    }
    if (needsEnds && !body.destination) {
      ctx.addIssue({ code: "custom", path: ["destination"], message: "Destination is required" });
    }
    if (body.fuelMode === "manual" && body.action !== "cancel-lab-trips" && body.fuelStops.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["fuelStops"],
        message: "Add at least one fuel stop",
      });
    }
  });

export const copilotLabActionSchema = z.object({
  body: labActionBodySchema,
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const validateCopilotLabAction = validateRequest(copilotLabActionSchema);

const copilotLabAutomationSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
    watchedLoad: z.string().trim().max(40).optional(),
  }),
  params: z.object({}).optional().default({}),
  query: z.object({}).optional().default({}),
});

export const validateCopilotLabAutomation = validateRequest(copilotLabAutomationSchema);
