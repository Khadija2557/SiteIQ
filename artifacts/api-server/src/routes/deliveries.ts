import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, deliveriesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/deliveries", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { status } = req.query as { status?: string };
  const deliveries = await db.select().from(deliveriesTable).where(eq(deliveriesTable.tenantId, tenantId));
  res.json(status ? deliveries.filter((d) => d.status === status) : deliveries);
});

router.post("/deliveries", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [delivery] = await db.insert(deliveriesTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(delivery);
});

router.patch("/deliveries/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [delivery] = await db.update(deliveriesTable).set(req.body).where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.tenantId, tenantId))).returning();
  if (!delivery) { res.status(404).json({ error: "Delivery not found" }); return; }
  res.json(delivery);
});

export default router;
