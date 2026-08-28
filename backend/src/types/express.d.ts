import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roleId: string;
      };
      validated?: {
        body: unknown;
        params: unknown;
        query: unknown;
      };
    }
  }
}
