import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

function resolveErrorMessage(err: unknown) {
  if (err instanceof HttpError) {
    return err.message;
  }

  if (err instanceof Error) {
    if (err.message.includes("buffering timed out")) {
      return "Database connection timed out. Start MongoDB and restart the backend.";
    }

    if (err.name === "MongoServerSelectionError" || err.name === "MongooseServerSelectionError") {
      return "Unable to reach MongoDB. Start MongoDB and restart the backend.";
    }

    if (err.name === "MongoBulkWriteError") {
      return `Database write failed during sync: ${err.message}`;
    }

    return err.message;
  }

  return "Internal server error";
}

function resolveStatusCode(err: unknown) {
  if (err instanceof HttpError) {
    return err.statusCode;
  }

  if (err instanceof Error) {
    if (
      err.message.includes("buffering timed out") ||
      err.name === "MongoServerSelectionError" ||
      err.name === "MongooseServerSelectionError"
    ) {
      return 503;
    }
  }

  return 500;
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError("Route not found", 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = resolveStatusCode(err);
  const message = resolveErrorMessage(err);

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === "development" && err instanceof Error
      ? { error: { name: err.name, message: err.message } }
      : {}),
  });
}
