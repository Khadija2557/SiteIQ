import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, workersTable, hazardsTable, machinesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  findBestWorkerForTask,
  optimizeFullSchedule,
  handleDisruption,
  generateExplanation,
  planSafeRoute,
  getRecentDecisions,
  logDecision,
  type Task,
  type Worker,
  type Hazard,
  type Machine,
} from "../services/taskOrchestrator";

const router = Router();

// POST /api/ai/assign-task — find best workers for a task
router.post("/ai/assign-task", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { task_id } = req.body as { task_id: number };
  if (!task_id) { res.status(400).json({ error: "task_id is required" }); return; }

  const [task] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, task_id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const [workers, hazards, activeTasks] = await Promise.all([
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true))),
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tenantId), eq(tasksTable.status, "in_progress"))),
  ]);

  const candidates = findBestWorkerForTask(task as Task, workers as Worker[], hazards as Hazard[], activeTasks as Task[]);

  if (!candidates || candidates.length === 0) {
    // Log the failed assignment attempt
    logDecision({
      id: `assign-fail-${task_id}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "assign_fail",
      tenantId,
      taskId: task_id,
      explanation: `No eligible worker found for task "${task.title}" in ${task.zone}. All workers are either unavailable, fatigued, or missing required certifications.`,
    });
    res.status(200).json({
      taskId: task_id,
      taskTitle: task.title,
      candidates: [],
      message: "No eligible workers found. Consider checking worker availability, fatigue levels, and certifications.",
      supervisorAlertTriggered: true,
    });
    return;
  }

  const best = candidates[0]!;
  const explanation = generateExplanation(
    { task: task as Task, worker: best.worker, score: best.score, reasoning: "" },
    candidates.slice(1),
  );

  logDecision({
    id: `assign-${task_id}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "assign_task",
    tenantId,
    taskId: task_id,
    workerId: best.worker.id,
    explanation,
    score: best.score,
    candidates,
  });

  res.json({
    taskId: task_id,
    taskTitle: task.title,
    taskZone: task.zone,
    taskPriority: task.priority,
    topCandidate: {
      worker: best.worker,
      score: best.score,
      reasons: best.reasons,
    },
    allCandidates: candidates.map((c) => ({
      worker: { id: c.worker.id, name: c.worker.name, trade: c.worker.trade, zone: c.worker.zone, ppeScore: c.worker.ppeScore, fatigueScore: c.worker.fatigueScore },
      score: c.score,
      reasons: c.reasons,
    })),
    explanation,
  });
});

// POST /api/ai/optimize-schedule — full greedy schedule optimization
router.post("/ai/optimize-schedule", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;

  const [tasks, workers, hazards, machines] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true))),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
  ]);

  const result = optimizeFullSchedule(tasks as Task[], workers as Worker[], hazards as Hazard[], machines as Machine[]);

  // Apply assignments to DB if requested
  const { apply = false } = req.body as { apply?: boolean };
  if (apply) {
    for (const { task, worker } of result.assignments) {
      await db.update(tasksTable)
        .set({ assignedWorkerId: worker.id, status: "in_progress" })
        .where(and(eq(tasksTable.id, task.id), eq(tasksTable.tenantId, tenantId)));
    }
  }

  logDecision({
    id: `optimize-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "optimize_schedule",
    tenantId,
    explanation: result.summary,
  });

  res.json({
    ...result,
    applied: apply,
    assignments: result.assignments.map((a) => ({
      task: { id: a.task.id, title: a.task.title, priority: a.task.priority, zone: a.task.zone },
      worker: { id: a.worker.id, name: a.worker.name, trade: a.worker.trade, zone: a.worker.zone },
      score: a.score,
      reasoning: a.reasoning,
    })),
    unassigned: result.unassigned.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      zone: t.zone,
      reason: "No eligible worker with required certifications and availability",
    })),
  });
});

// POST /api/ai/handle-disruption — handle a disruption event
router.post("/ai/handle-disruption", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { type, entity_id } = req.body as { type: string; entity_id: number };

  const validTypes = ["worker_sos", "machine_breakdown", "hazard_created", "delivery_late", "worker_ppe_violation"];
  if (!type || !validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }
  if (!entity_id) {
    res.status(400).json({ error: "entity_id is required" });
    return;
  }

  const result = await handleDisruption({ type, entityId: entity_id, tenantId });

  res.json({
    disruptionType: type,
    entityId: entity_id,
    affectedTaskCount: result.affectedTasks.length,
    newAssignmentCount: result.newAssignments.length,
    unresolvableCount: result.unresolvable.length,
    supervisorNotifications: result.supervisorNotifications,
    explanation: result.explanation,
    affectedTasks: result.affectedTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, zone: t.zone })),
    newAssignments: result.newAssignments.map((a) => ({
      task: { id: a.task.id, title: a.task.title },
      worker: { id: a.worker.id, name: a.worker.name },
      score: a.score,
      reasoning: a.reasoning,
    })),
    unresolvable: result.unresolvable.map((t) => ({ id: t.id, title: t.title, zone: t.zone })),
  });
});

// POST /api/ai/plan-route — A* pathfinding
router.post("/ai/plan-route", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { startX, startY, endX, endY } = req.body as { startX: number; startY: number; endX: number; endY: number };

  if (startX == null || startY == null || endX == null || endY == null) {
    res.status(400).json({ error: "startX, startY, endX, endY are required" });
    return;
  }

  const [hazards, machines] = await Promise.all([
    db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true))),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
  ]);

  const waypoints = planSafeRoute(startX, startY, endX, endY, hazards as Hazard[], machines as Machine[]);

  if (!waypoints) {
    res.status(200).json({
      start: { x: startX, y: startY },
      end: { x: endX, y: endY },
      waypoints: null,
      safe: false,
      message: "No safe path found. Start or destination is blocked by hazards or operating cranes. Supervisor alert triggered.",
      hazardsBlocking: hazards.filter((h) => h.active).length,
    });
    return;
  }

  const totalDist = waypoints.reduce((acc, wp, i) => {
    if (i === 0) return 0;
    const prev = waypoints[i - 1]!;
    return acc + Math.sqrt((wp.x - prev.x) ** 2 + (wp.y - prev.y) ** 2);
  }, 0);

  res.json({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    waypoints,
    waypointCount: waypoints.length,
    estimatedDistance: Math.round(totalDist * 10) / 10,
    safe: true,
    hazardsAvoided: hazards.length,
    cranesAvoided: machines.filter((m) => m.type === "crane" && m.status === "operating").length,
  });
});

// GET /api/ai/decisions/recent — last AI decisions with reasoning
router.get("/ai/decisions/recent", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "10")), 50);
  const decisions = getRecentDecisions(tenantId, limit);
  res.json({ decisions, count: decisions.length });
});

export default router;
