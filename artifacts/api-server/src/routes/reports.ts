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

router.post("/reports/generate", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { type } = req.body as { type: string };
  const reportType = type ?? "daily_safety";
  const [report] = await db.insert(reportsTable).values({
    tenantId,
    type: reportType,
    date: new Date(),
    dataJson: {
      generatedAt: new Date().toISOString(),
      type: reportType,
      summary: `Auto-generated ${reportType} report`,
      recordCount: Math.floor(Math.random() * 200) + 50,
    },
  }).returning();
  res.status(201).json(report);
});

export default router;
