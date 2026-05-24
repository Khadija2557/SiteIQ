import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, workersTable, tasksTable, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/workers/stats/summary", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const workers = await db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId));
  const total = workers.length;
  const active = workers.filter((w) => w.status === "active").length;
  const onBreak = workers.filter((w) => w.status === "on_break").length;
  const offSite = workers.filter((w) => w.status === "off_site").length;
  const avgPpeScore = total > 0 ? workers.reduce((s, w) => s + w.ppeScore, 0) / total : 0;
  const avgFatigueScore = total > 0 ? workers.reduce((s, w) => s + w.fatigueScore, 0) / total : 0;
  const zoneMap: Record<string, number> = {};
  for (const w of workers) { zoneMap[w.zone] = (zoneMap[w.zone] ?? 0) + 1; }
  const byZone = Object.entries(zoneMap).map(([zone, count]) => ({ zone, count }));
  res.json({ total, active, onBreak, offSite, avgPpeScore: Math.round(avgPpeScore * 10) / 10, avgFatigueScore: Math.round(avgFatigueScore * 10) / 10, byZone });
});

router.get("/workers", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { zone, status } = req.query as { zone?: string; status?: string };
  const workers = await db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId));
  res.json(workers.filter((w) => (!zone || w.zone === zone) && (!status || w.status === status)));
});

router.post("/workers", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [worker] = await db.insert(workersTable).values({ ...req.body, tenantId }).returning();
  getIO()?.emit("worker:update", { action: "created", worker });
  res.status(201).json(worker);
});

router.get("/workers/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [worker] = await db.select().from(workersTable).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).limit(1);
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  const tasks = await db.select().from(tasksTable).where(and(eq(tasksTable.assignedWorkerId, id), eq(tasksTable.tenantId, tenantId)));
  res.json({
    ...worker,
    taskHistory: tasks,
    safetyRecord: {
      ppeScore: worker.ppeScore,
      fatigueScore: worker.fatigueScore,
      tasksCompleted: tasks.filter((t) => t.status === "complete").length,
      tasksInProgress: tasks.filter((t) => t.status === "in_progress").length,
    },
  });
});

router.patch("/workers/:id/location", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { x, y, zone } = req.body as { x: number; y: number; zone?: string };
  if (x == null || y == null) {
    res.status(400).json({ error: "x and y coordinates are required" });
    return;
  }
  const updateData: Record<string, unknown> = { locationX: x, locationY: y };
  if (zone) updateData["zone"] = zone;
  const [worker] = await db.update(workersTable).set(updateData).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).returning();
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  getIO()?.emit("worker:update", { action: "location", workerId: id, x, y, zone: worker.zone });
  res.json(worker);
});

router.patch("/workers/:id/status", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { status } = req.body as { status: string };
  const validStatuses = ["active", "break", "sos", "off-site", "on_break", "off_site"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    return;
  }
  const [worker] = await db.update(workersTable).set({ status }).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).returning();
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  getIO()?.emit("worker:update", { action: "status", workerId: id, status, worker });
  if (status === "sos") {
    getIO()?.emit("alert:new", {
      type: "sos",
      severity: "critical",
      message: `SOS activated by worker ${worker.name} in ${worker.zone}`,
      workerId: id,
      zone: worker.zone,
      createdAt: new Date().toISOString(),
    });
  }
  res.json(worker);
});

router.patch("/workers/:id/ppe-score", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { ppeScore } = req.body as { ppeScore: number };
  if (ppeScore == null || ppeScore < 0 || ppeScore > 100) {
    res.status(400).json({ error: "ppeScore must be a number between 0 and 100" });
    return;
  }
  const [worker] = await db.update(workersTable).set({ ppeScore }).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).returning();
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  if (ppeScore < 60) {
    getIO()?.emit("alert:new", {
      type: "ppe_violation",
      severity: ppeScore < 40 ? "critical" : "medium",
      message: `PPE compliance dropped to ${ppeScore}% for worker ${worker.name} in ${worker.zone}`,
      workerId: id,
      zone: worker.zone,
      createdAt: new Date().toISOString(),
    });
  }
  getIO()?.emit("worker:update", { action: "ppe_score", workerId: id, ppeScore, worker });
  res.json(worker);
});

router.patch("/workers/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [worker] = await db.update(workersTable).set(req.body).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).returning();
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  getIO()?.emit("worker:update", { action: "updated", worker });
  res.json(worker);
});

router.get("/workers/:id/route", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [worker] = await db.select().from(workersTable).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).limit(1);
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  const { targetX, targetY } = req.query as { targetX?: string; targetY?: string };
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const startX = worker.locationX ?? 50;
  const startY = worker.locationY ?? 50;
  const endX = targetX ? parseFloat(targetX) : startX;
  const endY = targetY ? parseFloat(targetY) : startY;
  const waypoints = computeSafeRoute(startX, startY, endX, endY, hazards, "worker");
  res.json({
    workerId: id,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    waypoints,
    hazardsAvoided: hazards.length,
  });
});

router.delete("/workers/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  await db.delete(workersTable).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId)));
  res.status(204).send();
});

function computeSafeRoute(
  startX: number, startY: number,
  endX: number, endY: number,
  hazards: Array<{ locationX: number | null; locationY: number | null; severity: string }>,
  mode: "worker" | "machine",
): Array<{ x: number; y: number }> {
  const clearance = mode === "machine" ? 8 : 5;
  const steps = 10;
  const waypoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x = startX + (endX - startX) * t;
    let y = startY + (endY - startY) * t;
    for (const h of hazards) {
      const hx = h.locationX ?? 50;
      const hy = h.locationY ?? 50;
      const dist = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2);
      if (dist < clearance) {
        const angle = Math.atan2(y - hy, x - hx);
        x = hx + Math.cos(angle) * (clearance + 2);
        y = hy + Math.sin(angle) * (clearance + 2);
      }
    }
    waypoints.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  return waypoints;
}

export { computeSafeRoute };
export default router;
