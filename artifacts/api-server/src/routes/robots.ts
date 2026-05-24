import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, robotsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/robots", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const robots = await db.select().from(robotsTable).where(eq(robotsTable.tenantId, tenantId));
  res.json(robots);
});

router.patch("/robots/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [robot] = await db.update(robotsTable).set(req.body).where(and(eq(robotsTable.id, id), eq(robotsTable.tenantId, tenantId))).returning();
  if (!robot) { res.status(404).json({ error: "Robot not found" }); return; }
  res.json(robot);
});

export default router;
