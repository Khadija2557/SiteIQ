import { Router } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, workersTable, machinesTable, tasksTable, hazardsTable, alertsTable, deliveriesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [workers, machines, tasks, hazards, alerts, deliveries] = await Promise.all([
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(eq(hazardsTable.tenantId, tenantId)),
    db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId)),
    db.select().from(deliveriesTable).where(eq(deliveriesTable.tenantId, tenantId)),
  ]);

  const activeWorkers = workers.filter((w) => w.status === "active").length;
  const activeMachines = machines.filter((m) => m.status === "operating").length;
  const openTasks = tasks.filter((t) => t.status !== "complete").length;
  const completedTasks = tasks.filter((t) => t.status === "complete").length;
  const activeHazards = hazards.filter((h) => h.active).length;
  const criticalHazards = hazards.filter((h) => h.active && h.severity === "critical").length;
  const unresolvedAlerts = alerts.filter((a) => !a.acknowledged).length;
  const pendingDeliveries = deliveries.filter((d) => d.status === "pending" || d.status === "in_transit").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tasksCompletedToday = tasks.filter((t) => t.status === "complete" && t.createdAt >= today).length;

  const safetyScore = Math.max(0, 100 - (criticalHazards * 15) - (activeHazards * 5) - (unresolvedAlerts * 2));

  res.json({
    activeWorkers,
    totalWorkers: workers.length,
    activeMachines,
    totalMachines: machines.length,
    openTasks,
    completedTasks,
    activeHazards,
    unresolvedAlerts,
    pendingDeliveries,
    siteHealthScore: safetyScore,
    criticalHazards,
    tasksCompletedToday,
  });
});

router.get("/dashboard/activity", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const alerts = await db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId));
  const activity = alerts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      severity: a.severity,
      zone: a.zone,
      createdAt: a.createdAt,
    }));
  res.json(activity);
});

router.get("/dashboard/zones", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [workers, machines, hazards, tasks] = await Promise.all([
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true))),
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
  ]);

  const zones = new Set([
    ...workers.map((w) => w.zone),
    ...machines.map((m) => m.zone),
    ...hazards.map((h) => h.zone),
    ...tasks.map((t) => t.zone),
  ]);

  const zoneStatuses = Array.from(zones).map((zone) => {
    const wCount = workers.filter((w) => w.zone === zone).length;
    const mCount = machines.filter((m) => m.zone === zone).length;
    const hCount = hazards.filter((h) => h.zone === zone).length;
    const tCount = tasks.filter((t) => t.zone === zone && t.status !== "complete").length;
    const criticalHazards = hazards.filter((h) => h.zone === zone && h.severity === "critical").length;
    const status = criticalHazards > 0 ? "critical" : hCount > 0 ? "warning" : "safe";
    return { zone, workerCount: wCount, machineCount: mCount, hazardCount: hCount, taskCount: tCount, status };
  });

  res.json(zoneStatuses);
});

export default router;
