import { Router } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, workersTable, machinesTable, tasksTable, alertsTable, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/stats/dashboard", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [workers, machines, tasks, alerts, hazards] = await Promise.all([
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
    db.select().from(alertsTable).where(eq(alertsTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(eq(hazardsTable.tenantId, tenantId)),
  ]);
  const activeWorkers = workers.filter((w) => w.status === "active").length;
  const workerCount = workers.length;
  const machineCount = machines.length;
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;
  const avgPpe = workers.length > 0
    ? Math.round(workers.reduce((s, w) => s + w.ppeScore, 0) / workers.length * 10) / 10
    : 0;
  const tasksCompletedToday = tasks.filter((t) => t.status === "complete" && new Date(t.createdAt) >= today).length;
  const tasksInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const criticalHazards = hazards.filter((h) => h.active && h.severity === "critical").length;
  const activeHazards = hazards.filter((h) => h.active).length;
  const safetyScore = parseFloat(
    Math.max(0, Math.min(10, 10 - criticalHazards * 2 - activeHazards * 0.5 - activeAlerts * 0.1)).toFixed(1)
  );
  const productivityScore = Math.min(100, Math.round(
    (tasksCompletedToday / Math.max(1, tasks.length)) * 60
    + (activeWorkers / Math.max(1, workerCount)) * 40
  ));
  res.json({
    worker_count: workerCount,
    active_workers: activeWorkers,
    machine_count: machineCount,
    active_alerts: activeAlerts,
    ppe_compliance_avg: avgPpe,
    tasks_completed_today: tasksCompletedToday,
    tasks_in_progress: tasksInProgress,
    safety_score: safetyScore,
    productivity_score: productivityScore,
  });
});

router.get("/stats/analytics", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [allTasks, allAlerts, allMachines, allWorkers] = await Promise.all([
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), gte(tasksTable.createdAt, thirtyDaysAgo))),
    db.select().from(alertsTable).where(and(eq(alertsTable.tenantId, tenantId), gte(alertsTable.createdAt, thirtyDaysAgo))),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
  ]);
  const taskHistory7Day: Array<{ date: string; completed: number; created: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayTasks = allTasks.filter((t) => new Date(t.createdAt) >= day && new Date(t.createdAt) < nextDay);
    taskHistory7Day.push({
      date: day.toISOString().split("T")[0]!,
      completed: dayTasks.filter((t) => t.status === "complete").length,
      created: dayTasks.length,
    });
  }
  const incidentHistory30Day: Array<{ date: string; incidents: number; critical: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const dayAlerts = allAlerts.filter((a) => new Date(a.createdAt) >= day && new Date(a.createdAt) < nextDay);
    incidentHistory30Day.push({
      date: day.toISOString().split("T")[0]!,
      incidents: dayAlerts.length,
      critical: dayAlerts.filter((a) => a.severity === "critical").length,
    });
  }
  const machineUtilization = allMachines.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    utilizationPct: m.utilizationPct ?? 0,
    status: m.status,
  }));
  const zoneMap: Record<string, number[]> = {};
  for (const w of allWorkers) {
    if (!zoneMap[w.zone]) zoneMap[w.zone] = [];
    zoneMap[w.zone]!.push(w.ppeScore);
  }
  const ppeByZone = Object.entries(zoneMap).map(([zone, scores]) => ({
    zone,
    avgPpeScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10,
    workerCount: scores.length,
  }));
  res.json({
    taskCompletionHistory: taskHistory7Day,
    incidentHistory: incidentHistory30Day,
    machineUtilization,
    ppeByZone,
  });
});

export default router;
