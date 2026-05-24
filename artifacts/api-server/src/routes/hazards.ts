import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/hazards", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { active, severity, zone } = req.query as { active?: string; severity?: string; zone?: string };
  const hazards = await db.select().from(hazardsTable).where(eq(hazardsTable.tenantId, tenantId));
  res.json(hazards.filter((h) => {
    if (active !== undefined && h.active !== (active === "true")) return false;
    if (severity && h.severity !== severity) return false;
    if (zone && h.zone !== zone) return false;
    return true;
  }));
});

router.post("/hazards", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const [hazard] = await db.insert(hazardsTable).values({ ...req.body, tenantId }).returning();
  res.status(201).json(hazard);
});

router.patch("/hazards/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [hazard] = await db.update(hazardsTable).set(req.body).where(and(eq(hazardsTable.id, id), eq(hazardsTable.tenantId, tenantId))).returning();
  if (!hazard) { res.status(404).json({ error: "Hazard not found" }); return; }
  res.json(hazard);
});

router.post("/hazards/:id/resolve", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [hazard] = await db.update(hazardsTable).set({ active: false, resolvedAt: new Date() }).where(and(eq(hazardsTable.id, id), eq(hazardsTable.tenantId, tenantId))).returning();
  if (!hazard) { res.status(404).json({ error: "Hazard not found" }); return; }
  res.json(hazard);
});

export default router;
