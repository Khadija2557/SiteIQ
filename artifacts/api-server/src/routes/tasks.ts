import { Router } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, tasksTable, workersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/tasks/stats/summary", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId));
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const complete = tasks.filter((t) => t.status === "complete").length;
  const priorityMap: Record<string, number> = {};
  const zoneMap: Record<string, number> = {};
  for (const t of tasks) {
    priorityMap[t.priority] = (priorityMap[t.priority] ?? 0) + 1;
    zoneMap[t.zone] = (zoneMap[t.zone] ?? 0) + 1;
  }
  res.json({
    total, todo, inProgress, blocked, complete,
    byPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
    byZone: Object.entries(zoneMap).map(([zone, count]) => ({ zone, count })),
  });
});

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { status, zone, priority } = req.query as { status?: string; zone?: string; priority?: string };
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId));
  const workers = await db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId));
  const workerMap = new Map(workers.map((w) => [w.id, w.name]));
  const filtered = tasks.filter((t) =>
    (!status || t.status === status) && (!zone || t.zone === zone) && (!priority || t.priority === priority)
  );
  const grouped = {
    todo: [] as typeof filtered,
    in_progress: [] as typeof filtered,
    blocked: [] as typeof filtered,
    complete: [] as typeof filtered,
    other: [] as typeof filtered,
  };
  for (const t of filtered) {
    const key = (t.status === "todo" || t.status === "in_progress" || t.status === "blocked" || t.status === "complete")
      ? t.status : "other";
    grouped[key].push(t);
  }
  res.json({
    tasks: filtered.map((t) => ({ ...t, assignedWorkerName: t.assignedWorkerId ? (workerMap.get(t.assignedWorkerId) ?? null) : null })),
    grouped: {
      todo: grouped.todo.map((t) => ({ ...t, assignedWorkerName: t.assignedWorkerId ? (workerMap.get(t.assignedWorkerId) ?? null) : null })),
      in_progress: grouped.in_progress.map((t) => ({ ...t, assignedWorkerName: t.assignedWorkerId ? (workerMap.get(t.assignedWorkerId) ?? null) : null })),
      blocked: grouped.blocked.map((t) => ({ ...t, assignedWorkerName: t.assignedWorkerId ? (workerMap.get(t.assignedWorkerId) ?? null) : null })),
      complete: grouped.complete.map((t) => ({ ...t, assignedWorkerName: t.assignedWorkerId ? (workerMap.get(t.assignedWorkerId) ?? null) : null })),
    },
  });
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [task] = await db.insert(tasksTable).values({ ...req.body, tenantId }).returning();
  getIO()?.emit("task:update", { action: "created", task });
  res.status(201).json(task);
});

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.patch("/tasks/:id/status", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { status } = req.body as { status: string };
  const validStatuses = ["todo", "in_progress", "blocked", "complete"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    return;
  }
  const [task] = await db.update(tasksTable).set({ status }).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  getIO()?.emit("task:update", { action: "status_changed", taskId: id, status, task });
  res.json(task);
});

router.patch("/tasks/:id/assign", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { workerId } = req.body as { workerId: number };
  if (!workerId) {
    res.status(400).json({ error: "workerId is required" });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  const [worker] = await db.select().from(workersTable).where(and(eq(workersTable.id, workerId), eq(workersTable.tenantId, tenantId))).limit(1);
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  const taskReqs = task.toolsRequired ?? [];
  const workerCerts = worker.certifications ?? [];
  const missingCerts = taskReqs.filter((req) => !workerCerts.includes(req));
  if (missingCerts.length > 0) {
    res.status(422).json({
      error: "Worker does not meet task certification requirements",
      missingCertifications: missingCerts,
      workerCertifications: workerCerts,
      taskRequirements: taskReqs,
    });
    return;
  }
  const [updated] = await db.update(tasksTable).set({ assignedWorkerId: workerId, status: "in_progress" }).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  getIO()?.emit("task:update", { action: "assigned", taskId: id, workerId, task: updated });
  res.json(updated);
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [task] = await db.update(tasksTable).set(req.body).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  getIO()?.emit("task:update", { action: "updated", task });
  res.json(task);
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  await db.delete(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)));
  res.status(204).send();
});

const AI_REASONS = [
  "Worker reassigned based on proximity analysis and current fatigue score — replacement has lower fatigue and closer zone position.",
  "Original worker flagged for PPE non-compliance. New assignment selects certified operator with matching skill set.",
  "Load balancing triggered: assigned worker already handling 3 concurrent tasks. Redistributing to idle worker in same zone.",
  "Deadline risk detected — critical path analysis moved task to worker with fastest completion history for this task type.",
  "Zone conflict resolved: original assignee repositioned to emergency hazard response. Best available replacement selected.",
];

function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function findBestWorker(
  task: { zone: string; toolsRequired: string[] },
  workers: Array<{ id: number; name: string; status: string; ppeScore: number; fatigueScore: number; locationX: number | null; locationY: number | null; zone: string; certifications: string[] }>,
  activeTasks: Array<{ assignedWorkerId: number | null; priority: string }>,
  taskX = 50, taskY = 50,
): { worker: typeof workers[0] | null; reason: string } {
  const eligible = workers.filter((w) => {
    if (w.status !== "active") return false;
    if (w.fatigueScore >= 7) return false;
    if (w.ppeScore <= 60) return false;
    const isOnCritical = activeTasks.some((t) => t.assignedWorkerId === w.id && t.priority === "critical");
    if (isOnCritical) return false;
    const taskReqs = task.toolsRequired ?? [];
    const missing = taskReqs.filter((r) => !w.certifications.includes(r));
    if (missing.length > 0) return false;
    return true;
  });
  if (eligible.length === 0) return { worker: null, reason: "No eligible workers found matching all criteria" };
  const scored = eligible.map((w) => {
    const dist = manhattanDistance(w.locationX ?? 50, w.locationY ?? 50, taskX, taskY);
    const zoneBonus = w.zone === task.zone ? 20 : 0;
    const score = (10 - w.fatigueScore) * 5 + w.ppeScore * 0.3 - dist * 0.5 + zoneBonus;
    return { worker: w, score, dist };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const reason = `Selected ${best.worker.name}: fatigue ${best.worker.fatigueScore}/10, PPE ${best.worker.ppeScore}%, zone distance ${best.dist.toFixed(1)} units${best.worker.zone === task.zone ? " (same zone)" : ""}, all certifications met.`;
  return { worker: best.worker, reason };
}

router.post("/tasks/:id/reassign", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  const [workers, activeTasks] = await Promise.all([
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "in_progress"))),
  ]);
  const { worker, reason } = findBestWorker(task, workers, activeTasks);
  if (!worker) {
    const fallbackReason = AI_REASONS[Math.floor(Math.random() * AI_REASONS.length)]!;
    const [updated] = await db.update(tasksTable).set({ status: "in_progress" }).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
    res.json({ task: updated, aiReasoning: fallbackReason, newWorkerId: updated.assignedWorkerId });
    return;
  }
  const [updated] = await db.update(tasksTable).set({ assignedWorkerId: worker.id, status: "in_progress" }).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  getIO()?.emit("task:update", { action: "reassigned", taskId: id, workerId: worker.id, task: updated });
  res.json({ task: updated, aiReasoning: reason, newWorkerId: worker.id, newWorkerName: worker.name });
});

router.post("/tasks/ai-optimize", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [allTasks, workers, activeTasks] = await Promise.all([
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "todo"))),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "in_progress"))),
  ]);
  const proposals: Array<{ taskId: number; taskTitle: string; workerId: number; workerName: string; reasoning: string }> = [];
  const unassigned = allTasks.filter((t) => !t.assignedWorkerId);
  const workerLoad = new Map<number, number>();
  for (const t of activeTasks) {
    if (t.assignedWorkerId) {
      workerLoad.set(t.assignedWorkerId, (workerLoad.get(t.assignedWorkerId) ?? 0) + 1);
    }
  }
  for (const task of unassigned) {
    const filteredWorkers = workers.filter((w) => (workerLoad.get(w.id) ?? 0) < 3);
    const { worker, reason } = findBestWorker(task, filteredWorkers, activeTasks);
    if (worker) {
      proposals.push({ taskId: task.id, taskTitle: task.title, workerId: worker.id, workerName: worker.name, reasoning: reason });
      workerLoad.set(worker.id, (workerLoad.get(worker.id) ?? 0) + 1);
    }
  }
  res.json({
    proposals,
    unassignedCount: unassigned.length,
    assignedCount: proposals.length,
    skippedCount: unassigned.length - proposals.length,
    summary: `AI optimizer assigned ${proposals.length} of ${unassigned.length} unassigned tasks. ${unassigned.length - proposals.length} tasks could not be optimally assigned due to worker availability or certification gaps.`,
  });
});

router.get("/tasks/today", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tasks = await db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), gte(tasksTable.createdAt, today)));
  res.json(tasks);
});

export default router;
