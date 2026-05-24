import { type Request, type Response, type NextFunction } from "express";

export function rbacMiddleware(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: `Access denied. Required roles: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}
