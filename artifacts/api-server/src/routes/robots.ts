import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, robotsTable, tasksTable, workersTable, alertsTable } from "@workspace/db";
import { requireAuth, signToken } from "../middleware/auth";
import { getIO } from "../lib/socket";
import crypto from "crypto";

const router = Router();

router.post("/robots/authenticate", async (req, res): Promise<void> => {
  const { apiKey } = req.body as { apiKey: string };
  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }
  const [robot] = await db.select().from(robotsTable).where(eq(robotsTable.apiKey, apiKey)).limit(1);
  if (!robot) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  const token = signToken({ userId: robot.id, tenantId: robot.tenantId, role: "robot", email: `robot-${robot.id}@siteiq.internal` });
  res.json({ token, robot: { id: robot.id, name: robot.name, type: robot.type, status: robot.status, tenantId: robot.tenantId } });
});

router.get("/robots/tasks", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const tasks = await db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "todo")));
  const queue = tasks
    .filter((t) => !t.assignedWorkerId)
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
  res.json({ queue, count: queue.length });
});

router.get("/robots", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const robots = await db.select().from(robotsTable).where(eq(robotsTable.tenantId, tenantId));
  res.json(robots);
});

router.post("/robots/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [robot] = await db.select().from(robotsTable).where(and(eq(robotsTable.id, id), eq(robotsTable.tenantId, tenantId))).limit(1);
  if (!robot) { res.status(404).json({ error: "Robot not found" }); return; }
  if (!robot.currentTaskId) { res.status(400).json({ error: "Robot has no active task" }); return; }
  const [completedTask] = await db.update(tasksTable)
    .set({ status: "complete" })
    .where(and(eq(tasksTable.id, robot.currentTaskId), eq(tasksTable.tenantId, tenantId)))
    .returning();
  const nextTasks = await db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "todo")));
  const nextTask = nextTasks.filter((t) => !t.assignedWorkerId).sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  })[0];
  let nextAssigned = null;
  if (nextTask) {
    nextAssigned = nextTask;
    await db.update(robotsTable).set({ currentTaskId: nextTask.id, status: "operating" }).where(eq(robotsTable.id, id));
    await db.update(tasksTable).set({ status: "in_progress" }).where(eq(tasksTable.id, nextTask.id));
  } else {
    await db.update(robotsTable).set({ currentTaskId: null, status: "idle" }).where(eq(robotsTable.id, id));
  }
  getIO()?.emit("task:update", { action: "completed", task: completedTask });
  res.json({ completedTask, nextTask: nextAssigned, robotStatus: nextTask ? "operating" : "idle" });
});

router.post("/robots/:id/fail", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { reason } = req.body as { reason?: string };
  const [robot] = await db.select().from(robotsTable).where(and(eq(robotsTable.id, id), eq(robotsTable.tenantId, tenantId))).limit(1);
  if (!robot) { res.status(404).json({ error: "Robot not found" }); return; }
  if (!robot.currentTaskId) { res.status(400).json({ error: "Robot has no active task" }); return; }
  const [failedTask] = await db.update(tasksTable)
    .set({ status: "blocked", assignedWorkerId: null })
    .where(and(eq(tasksTable.id, robot.currentTaskId), eq(tasksTable.tenantId, tenantId)))
    .returning();
  await db.update(robotsTable).set({ currentTaskId: null, status: "idle" }).where(eq(robotsTable.id, id));
  const workers = await db.select().from(workersTable).where(and(eq(workersTable.tenantId, tenantId), eq(workersTable.status, "active")));
  const nearestWorker = workers.length > 0 ? workers[Math.floor(Math.random() * workers.length)] : null;
  let reassignedTask = null;
  if (nearestWorker && failedTask) {
    [reassignedTask] = await db.update(tasksTable)
      .set({ assignedWorkerId: nearestWorker.id, status: "todo" })
      .where(eq(tasksTable.id, failedTask.id))
      .returning();
    const [alert] = await db.insert(alertsTable).values({
      type: "robot_failure",
      severity: "high",
      message: `Robot ${robot.name} failed task "${failedTask.title}". Reason: ${reason ?? "unknown"}. Auto-reassigned to ${nearestWorker.name}.`,
      tenantId,
      acknowledged: false,
    }).returning();
    getIO()?.emit("alert:new", alert);
  }
  getIO()?.emit("task:update", { action: "robot_failed", task: reassignedTask ?? failedTask });
  res.json({
    failedTask,
    reassignedTo: nearestWorker,
    reassignedTask,
    message: nearestWorker
      ? `Task auto-reassigned to ${nearestWorker.name}. Supervisor notified.`
      : "No available workers to reassign. Task set to blocked.",
  });
});

router.patch("/robots/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [robot] = await db.update(robotsTable).set(req.body).where(and(eq(robotsTable.id, id), eq(robotsTable.tenantId, tenantId))).returning();
  if (!robot) { res.status(404).json({ error: "Robot not found" }); return; }
  res.json(robot);
});

export default router;
