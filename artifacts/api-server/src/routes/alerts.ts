import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/alerts", requireAuth, async (req, res): Promise<void> => {
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

router.post("/alerts", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { type, severity, message, workerId, machineId, zone } = req.body as {
    type: string; severity: string; message: string;
    workerId?: number; machineId?: number; zone?: string;
  };
  if (!type || !severity || !message) {
    res.status(400).json({ error: "type, severity, and message are required" });
    return;
  }
  const [alert] = await db.insert(alertsTable).values({
    type, severity, message, workerId, machineId, zone, tenantId, acknowledged: false,
  }).returning();
  getIO()?.emit("alert:new", alert);
  res.status(201).json(alert);
});

router.post("/alerts/acknowledge-all", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const userId = req.auth!.userId;
  const alerts = await db.select().from(alertsTable).where(and(eq(alertsTable.tenantId, tenantId), eq(alertsTable.acknowledged, false)));
  const ids = alerts.map((a) => a.id);
  let updatedCount = 0;
  for (const id of ids) {
    await db.update(alertsTable).set({ acknowledged: true, acknowledgedBy: userId }).where(eq(alertsTable.id, id));
    updatedCount++;
  }
  res.json({ acknowledged: updatedCount, message: `${updatedCount} alerts acknowledged` });
});

router.patch("/alerts/:id/acknowledge", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [alert] = await db.update(alertsTable)
    .set({ acknowledged: true, acknowledgedBy: req.auth!.userId })
    .where(and(eq(alertsTable.id, id), eq(alertsTable.tenantId, tenantId)))
    .returning();
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json(alert);
});

export default router;
