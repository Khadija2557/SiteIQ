import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: error, url: req.url, method: req.method }, "Unhandled error");
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { status?: number; statusCode?: number }).statusCode
    ?? 500;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
}
