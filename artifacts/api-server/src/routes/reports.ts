import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/reports", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const reports = await db.select().from(reportsTable).where(eq(reportsTable.tenantId, tenantId));
  res.json(reports);
});

export default router;
