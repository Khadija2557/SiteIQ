import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, workersTable, machinesTable, hazardsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { computeSafeRoute } from "./workers";

const router = Router();

router.post("/routes/worker", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { workerId, startX, startY, endX, endY } = req.body as {
    workerId?: number;
    startX: number; startY: number;
    endX: number; endY: number;
  };
  if (startX == null || startY == null || endX == null || endY == null) {
    res.status(400).json({ error: "startX, startY, endX, endY are required" });
    return;
  }
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const machines = await db.select().from(machinesTable).where(and(eq(machinesTable.tenantId, tenantId), eq(machinesTable.status, "operating")));
  const allObstacles = [
    ...hazards.map((h) => ({ locationX: h.locationX, locationY: h.locationY, severity: h.severity })),
    ...machines.map((m) => ({ locationX: m.locationX, locationY: m.locationY, severity: "machine" })),
  ];
  const waypoints = computeSafeRoute(startX, startY, endX, endY, allObstacles, "worker");
  const totalDistance = waypoints.reduce((total, wp, i) => {
    if (i === 0) return 0;
    const prev = waypoints[i - 1]!;
    return total + Math.sqrt((wp.x - prev.x) ** 2 + (wp.y - prev.y) ** 2);
  }, 0);
  res.json({
    workerId: workerId ?? null,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    waypoints,
    totalDistance: Math.round(totalDistance * 10) / 10,
    hazardsAvoided: hazards.length,
    machineAreasAvoided: machines.length,
    estimatedWalkTimeSeconds: Math.round(totalDistance * 2),
  });
});

router.post("/routes/machine", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { machineId, startX, startY, endX, endY } = req.body as {
    machineId?: number;
    startX: number; startY: number;
    endX: number; endY: number;
  };
  if (startX == null || startY == null || endX == null || endY == null) {
    res.status(400).json({ error: "startX, startY, endX, endY are required" });
    return;
  }
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const workers = await db.select().from(workersTable).where(and(eq(workersTable.tenantId, tenantId), eq(workersTable.status, "active")));
  const allObstacles = [
    ...hazards.map((h) => ({ locationX: h.locationX, locationY: h.locationY, severity: h.severity })),
    ...workers.map((w) => ({ locationX: w.locationX, locationY: w.locationY, severity: "pedestrian" })),
  ];
  const waypoints = computeSafeRoute(startX, startY, endX, endY, allObstacles, "machine");
  const totalDistance = waypoints.reduce((total, wp, i) => {
    if (i === 0) return 0;
    const prev = waypoints[i - 1]!;
    return total + Math.sqrt((wp.x - prev.x) ** 2 + (wp.y - prev.y) ** 2);
  }, 0);
  res.json({
    machineId: machineId ?? null,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    waypoints,
    totalDistance: Math.round(totalDistance * 10) / 10,
    hazardsAvoided: hazards.length,
    pedestrianAreasAvoided: workers.length,
    estimatedTravelTimeSeconds: Math.round(totalDistance * 3),
  });
});

router.post("/routes/check", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { startX, startY, endX, endY } = req.body as {
    startX: number; startY: number;
    endX: number; endY: number;
  };
  if (startX == null || startY == null || endX == null || endY == null) {
    res.status(400).json({ error: "startX, startY, endX, endY are required" });
    return;
  }
  const hazards = await db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true)));
  const pathLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const sampleCount = Math.max(10, Math.round(pathLength));
  const intersections: Array<{ hazardId: number; type: string; severity: string; distance: number }> = [];
  for (const hazard of hazards) {
    if (hazard.locationX == null || hazard.locationY == null) continue;
    const clearance = 5;
    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const px = startX + (endX - startX) * t;
      const py = startY + (endY - startY) * t;
      const dist = Math.sqrt((px - hazard.locationX) ** 2 + (py - hazard.locationY) ** 2);
      if (dist < clearance) {
        intersections.push({ hazardId: hazard.id, type: hazard.type, severity: hazard.severity, distance: Math.round(dist * 10) / 10 });
        break;
      }
    }
  }
  res.json({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    isSafe: intersections.length === 0,
    hazardIntersections: intersections,
    pathDistance: Math.round(pathLength * 10) / 10,
    recommendation: intersections.length === 0
      ? "Direct path is clear. Safe to proceed."
      : `Direct path passes through ${intersections.length} hazard zone(s). Use /routes/worker or /routes/machine to get a safe rerouted path.`,
  });
});

export default router;
