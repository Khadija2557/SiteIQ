import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, workersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/workers/stats/summary", requireAuth, async (req, res) => {
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

router.get("/workers", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { zone, status } = req.query as { zone?: string; status?: string };
  const workers = await db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId));
  res.json(workers.filter((w) => (!zone || w.zone === zone) && (!status || w.status === status)));
});

router.post("/workers", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [worker] = await db.insert(workersTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(worker);
});

router.get("/workers/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [worker] = await db.select().from(workersTable).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).limit(1);
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  res.json(worker);
});

router.patch("/workers/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [worker] = await db.update(workersTable).set(req.body).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId))).returning();
  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }
  res.json(worker);
});

router.delete("/workers/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  await db.delete(workersTable).where(and(eq(workersTable.id, id), eq(workersTable.tenantId, tenantId)));
  res.status(204).send();
});

export default router;
