import type { Request } from "express";

export type RequestWithParsedBody<T> = Request<unknown, unknown, T>;
