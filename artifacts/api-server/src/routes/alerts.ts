import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/alerts", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { acknowledged, severity } = req.query as { acknowledged?: string; severity?: string };
  const alerts = await db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId));
  res.json(alerts
    .filter((a) => {
      if (acknowledged !== undefined && a.acknowledged !== (acknowledged === "true")) return false;
      if (severity && a.severity !== severity) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
});

router.post("/alerts/:id/acknowledge", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [alert] = await db.update(alertsTable).set({ acknowledged: true, acknowledgedBy: req.auth!.userId }).where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId))).returning();
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json(alert);
});

export default router;
