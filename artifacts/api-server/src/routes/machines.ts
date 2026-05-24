import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, machinesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/machines", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { zone, status } = req.query as { zone?: string; status?: string };
  const machines = await db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId));
  res.json(machines.filter((m) => (!zone || m.zone === zone) && (!status || m.status === status)));
});

router.post("/machines", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [machine] = await db.insert(machinesTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(machine);
});

router.get("/machines/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.select().from(machinesTable).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).limit(1);
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  res.json(machine);
});

router.patch("/machines/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.update(machinesTable).set(req.body).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).returning();
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  res.json(machine);
});

export default router;
