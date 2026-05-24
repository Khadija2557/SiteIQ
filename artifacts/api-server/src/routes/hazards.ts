import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/hazards", requireAuth, async (req, res): Promise<void> => {
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

router.post("/hazards", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const [hazard] = await db.insert(hazardsTable).values({ ...req.body, tenantId }).returning();
  getIO()?.emit("hazard:new", { hazard });
  res.status(201).json(hazard);
});

router.get("/hazards/zone/:zone", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const zone = String(req.params["zone"]);
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.zone, zone)));
  res.json(hazards);
});

router.post("/hazards/check-proximity", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { x, y, radius } = req.body as { x: number; y: number; radius?: number };
  if (x == null || y == null) {
    res.status(400).json({ error: "x and y coordinates are required" });
    return;
  }
  const searchRadius = radius ?? 10;
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const nearby = hazards
    .filter((h) => h.locationX != null && h.locationY != null)
    .map((h) => {
      const dist = Math.sqrt((x - h.locationX!) ** 2 + (y - h.locationY!) ** 2);
      return { ...h, distance: Math.round(dist * 10) / 10 };
    })
    .filter((h) => h.distance <= searchRadius)
    .sort((a, b) => a.distance - b.distance);
  res.json({
    x, y, radius: searchRadius,
    count: nearby.length,
    hazards: nearby,
    nearestHazard: nearby[0] ?? null,
    isSafe: nearby.length === 0,
  });
});

router.patch("/hazards/:id/resolve", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [hazard] = await db.update(hazardsTable).set({ active: false, resolvedAt: new Date() }).where(and(eq(hazardsTable.id, id), eq(hazardsTable.tenantId, tenantId))).returning();
  if (!hazard) { res.status(404).json({ error: "Hazard not found" }); return; }
  res.json(hazard);
});

router.patch("/hazards/:id", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const id = parseInt(String(req.params["id"]));
  const [hazard] = await db.update(hazardsTable).set(req.body).where(and(eq(hazardsTable.id, id), eq(hazardsTable.tenantId, tenantId))).returning();
  if (!hazard) { res.status(404).json({ error: "Hazard not found" }); return; }
  res.json(hazard);
});

export default router;
