import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, machinesTable, workersTable, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";
import { computeSafeRoute } from "./workers";

const router = Router();

router.get("/machines", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { zone, status } = req.query as { zone?: string; status?: string };
  const machines = await db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId));
  res.json(machines.filter((m) => (!zone || m.zone === zone) && (!status || m.status === status)));
});

router.post("/machines", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [machine] = await db.insert(machinesTable).values({ ...req.body, tenantId }).returning();
  getIO()?.emit("machine:update", { action: "created", machine });
  res.status(201).json(machine);
});

router.get("/machines/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.select().from(machinesTable).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).limit(1);
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  res.json(machine);
});

router.patch("/machines/:id/status", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { status } = req.body as { status: string };
  const validStatuses = ["idle", "operating", "maintenance", "offline", "moving"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
    return;
  }
  const [machine] = await db.update(machinesTable).set({ status }).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).returning();
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  getIO()?.emit("machine:update", { action: "status_changed", machineId: id, status, machine });
  res.json(machine);
});

router.patch("/machines/:id/location", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const { x, y, zone } = req.body as { x: number; y: number; zone?: string };
  if (x == null || y == null) {
    res.status(400).json({ error: "x and y coordinates are required" });
    return;
  }
  const updateData: Record<string, unknown> = { locationX: x, locationY: y };
  if (zone) updateData["zone"] = zone;
  const [machine] = await db.update(machinesTable).set(updateData).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).returning();
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  getIO()?.emit("machine:update", { action: "location", machineId: id, x, y, zone: machine.zone });
  res.json(machine);
});

router.patch("/machines/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.update(machinesTable).set(req.body).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).returning();
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  getIO()?.emit("machine:update", { action: "updated", machine });
  res.json(machine);
});

router.post("/machines/:id/route", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.select().from(machinesTable).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).limit(1);
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  const { targetX, targetY, targetZone } = req.body as { targetX: number; targetY: number; targetZone?: string };
  if (targetX == null || targetY == null) {
    res.status(400).json({ error: "targetX and targetY are required" });
    return;
  }
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const startX = machine.locationX ?? 50;
  const startY = machine.locationY ?? 50;
  const waypoints = computeSafeRoute(startX, startY, targetX, targetY, hazards, "machine");
  const estimatedDistance = waypoints.reduce((total, wp, i) => {
    if (i === 0) return 0;
    const prev = waypoints[i - 1]!;
    return total + Math.sqrt((wp.x - prev.x) ** 2 + (wp.y - prev.y) ** 2);
  }, 0);
  res.json({
    machineId: id,
    start: { x: startX, y: startY },
    end: { x: targetX, y: targetY, zone: targetZone },
    waypoints,
    estimatedDistance: Math.round(estimatedDistance * 10) / 10,
    hazardsAvoided: hazards.length,
  });
});

router.get("/machines/:id/conflicts", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [machine] = await db.select().from(machinesTable).where(and(eq(machinesTable.id, id), eq(machinesTable.tenantId, tenantId))).limit(1);
  if (!machine) { res.status(404).json({ error: "Machine not found" }); return; }
  const [otherMachines, workers] = await Promise.all([
    db.select().from(machinesTable).where(and(eq(machinesTable.tenantId, tenantId), eq(machinesTable.status, "operating"))),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
  ]);
  const mx = machine.locationX ?? 50;
  const my = machine.locationY ?? 50;
  const machineConflicts = otherMachines
    .filter((m) => m.id !== id && m.locationX != null && m.locationY != null)
    .filter((m) => {
      const dist = Math.sqrt((mx - m.locationX!) ** 2 + (my - m.locationY!) ** 2);
      return dist < 15;
    })
    .map((m) => ({ type: "machine", id: m.id, name: m.name, distance: Math.sqrt((mx - m.locationX!) ** 2 + (my - m.locationY!) ** 2) }));
  const workerConflicts = workers
    .filter((w) => w.locationX != null && w.locationY != null)
    .filter((w) => {
      const dist = Math.sqrt((mx - w.locationX!) ** 2 + (my - w.locationY!) ** 2);
      return dist < 10;
    })
    .map((w) => ({ type: "worker", id: w.id, name: w.name, distance: Math.sqrt((mx - w.locationX!) ** 2 + (my - w.locationY!) ** 2) }));
  const allConflicts = [...machineConflicts, ...workerConflicts];
  res.json({
    machineId: id,
    hasConflicts: allConflicts.length > 0,
    conflicts: allConflicts,
    machineConflictCount: machineConflicts.length,
    workerConflictCount: workerConflicts.length,
  });
});

export default router;
