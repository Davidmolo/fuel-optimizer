import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type RequestSchema = ZodType<{
  body: unknown;
  params: unknown;
  query: unknown;
}>;

type ValidatedRequest = Request & {
  validated: {
    body: unknown;
    params: unknown;
    query: unknown;
  };
};

export function validateRequest(schema: RequestSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    req.body = parsed.data.body as Request["body"];
    (req as ValidatedRequest).validated = parsed.data;

    return next();
  };
}
