import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, deliveriesTable, machinesTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { status } = req.query as { status?: string };
  const deliveries = await db.select().from(deliveriesTable).where(eq(deliveriesTable.tenantId, tenantId));
  res.json(status ? deliveries.filter((d) => d.status === status) : deliveries);
});

router.post("/deliveries", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [delivery] = await db.insert(deliveriesTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(delivery);
});

router.patch("/deliveries/:id/arrive", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [delivery] = await db.select().from(deliveriesTable).where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.tenantId, tenantId))).limit(1);
  if (!delivery) { res.status(404).json({ error: "Delivery not found" }); return; }
  const forklifts = await db.select().from(machinesTable).where(and(eq(machinesTable.tenantId, tenantId), eq(machinesTable.status, "idle")));
  const availableForklift = forklifts.find((m) => m.type.toLowerCase().includes("forklift") || m.type.toLowerCase().includes("fork"));
  let assignedForkLiftId: number | null = null;
  if (availableForklift) {
    assignedForkLiftId = availableForklift.id;
    await db.update(machinesTable).set({ status: "operating" }).where(eq(machinesTable.id, availableForklift.id));
    getIO()?.emit("machine:update", { action: "status_changed", machineId: availableForklift.id, status: "operating" });
  }
  const [updatedDelivery] = await db.update(deliveriesTable)
    .set({ status: "arrived", assignedForkLiftId })
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.tenantId, tenantId)))
    .returning();
  const [unloadTask] = await db.insert(tasksTable).values({
    title: `Unload delivery: ${delivery.materialType} (${delivery.quantity} units)`,
    description: `Unload delivery that arrived at gate ${delivery.gate}`,
    status: "todo",
    priority: "high",
    zone: delivery.gate,
    tenantId,
    toolsRequired: [],
    dependencies: [],
  }).returning();
  getIO()?.emit("delivery:arrived", {
    delivery: updatedDelivery,
    assignedForklift: availableForklift ?? null,
    unloadingTask: unloadTask,
  });
  getIO()?.emit("task:update", { action: "created", task: unloadTask });
  res.json({
    delivery: updatedDelivery,
    assignedForklift: availableForklift ?? null,
    unloadingTask: unloadTask,
    message: availableForklift
      ? `Delivery marked arrived. Forklift ${availableForklift.name} auto-assigned. Unloading task #${unloadTask.id} created.`
      : `Delivery marked arrived. No idle forklift available. Unloading task #${unloadTask.id} created.`,
  });
});

router.patch("/deliveries/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [delivery] = await db.update(deliveriesTable).set(req.body).where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.tenantId, tenantId))).returning();
  if (!delivery) { res.status(404).json({ error: "Delivery not found" }); return; }
  res.json(delivery);
});

export default router;
