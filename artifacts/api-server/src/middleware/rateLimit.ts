import rateLimit from "express-rate-limit";
import type { Request } from "express";

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again after 1 minute" },
  skip: (req: Request) => req.path.startsWith("/internal/"),
});
