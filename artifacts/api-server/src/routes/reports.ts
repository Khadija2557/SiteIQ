import { Router } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, reportsTable, tasksTable, alertsTable, workersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/reports", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const reports = await db.select().from(reportsTable).where(eq(reportsTable.tenantId, tenantId));
  res.json(reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

router.post("/reports/generate", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { type } = req.body as { type?: string };
  const reportType = type ?? "daily";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [allTasks, allAlerts, allWorkers] = await Promise.all([
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), gte(tasksTable.createdAt, today))),
    db.select().from(alertsTable).where(and(eq(alertsTable.tenantId, tenantId), gte(alertsTable.createdAt, today))),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
  ]);
  const completedTasks = allTasks.filter((t) => t.status === "complete");
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress");
  const criticalAlerts = allAlerts.filter((a) => a.severity === "critical");
  const unresolvedAlerts = allAlerts.filter((a) => !a.acknowledged);
  const avgPpeScore = allWorkers.length > 0 ? allWorkers.reduce((s, w) => s + w.ppeScore, 0) / allWorkers.length : 0;
  const avgFatigue = allWorkers.length > 0 ? allWorkers.reduce((s, w) => s + w.fatigueScore, 0) / allWorkers.length : 0;
  const sosWorkers = allWorkers.filter((w) => w.status === "sos");
  const dataJson = {
    generatedAt: new Date().toISOString(),
    reportType,
    date: today.toISOString(),
    tasks: {
      totalToday: allTasks.length,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      completionRate: allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0,
    },
    safety: {
      totalAlerts: allAlerts.length,
      criticalAlerts: criticalAlerts.length,
      unresolvedAlerts: unresolvedAlerts.length,
      sosActivations: sosWorkers.length,
      avgPpeScore: Math.round(avgPpeScore * 10) / 10,
    },
    workforce: {
      totalWorkers: allWorkers.length,
      activeWorkers: allWorkers.filter((w) => w.status === "active").length,
      avgFatigueScore: Math.round(avgFatigue * 10) / 10,
      highFatigueWorkers: allWorkers.filter((w) => w.fatigueScore >= 7).length,
    },
    incidents: criticalAlerts.map((a) => ({
      id: a.id, type: a.type, message: a.message, zone: a.zone, createdAt: a.createdAt,
    })),
  };
  const [report] = await db.insert(reportsTable).values({
    tenantId,
    type: reportType,
    date: new Date(),
    dataJson,
  }).returning();
  res.status(201).json(report);
});

router.get("/reports/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [report] = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), eq(reportsTable.tenantId, tenantId))).limit(1);
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(report);
});

export default router;
