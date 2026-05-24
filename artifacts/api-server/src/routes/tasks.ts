import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/tasks/stats/summary", requireAuth, async (req, res) => {
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

router.get("/tasks", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { status, zone, priority } = req.query as { status?: string; zone?: string; priority?: string };
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId));
  res.json(tasks.filter((t) => (!status || t.status === status) && (!zone || t.zone === zone) && (!priority || t.priority === priority)));
});

router.post("/tasks", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [task] = await db.insert(tasksTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(task);
});

router.get("/tasks/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).limit(1);
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [task] = await db.update(tasksTable).set(req.body).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/tasks/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  await db.delete(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tenantId)));
  res.status(204).send();
});

export default router;
