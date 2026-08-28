import mongoose from "mongoose";
import { HttpError } from "../utils/http-error";
import { env } from "./env";

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function ensureDatabaseConnected() {
  const { readyState } = mongoose.connection;

  if (readyState === 1) {
    return;
  }

  if (readyState === 2) {
    throw new HttpError("Database is still connecting. Try the sync again in a few seconds.", 503);
  }

  throw new HttpError(
    `Database is not connected (${env.MONGODB_URI}). Start MongoDB and restart the backend.`,
    503,
  );
}
