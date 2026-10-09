import { z } from "zod";
import { validateRequest } from "../../../middlewares/validate-request";

const isoDateString = z
  .string()
  .trim()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid date" });

export const driverComplianceQuerySchema = z.object({
  body: z.object({}).optional().default({}),
  params: z.object({}).optional().default({}),
  query: z
    .object({
      from: isoDateString,
      to: isoDateString,
      driverId: z
        .string()
        .trim()
        .optional()
        .refine((value) => value === undefined || /^\d+$/.test(value), {
          message: "driverId must be a number",
        }),
    })
    .superRefine((query, ctx) => {
      const from = Date.parse(query.from);
      const to = Date.parse(query.to);
      if (from > to) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "`to` must be on or after `from`",
        });
      }
    }),
});

export const validateDriverComplianceQuery = validateRequest(driverComplianceQuerySchema);
