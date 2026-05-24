import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cameraFeedsTable, cvEventsTable, alertsTable, workersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../lib/socket";

const router = Router();

router.get("/cameras", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const cameras = await db.select().from(cameraFeedsTable).where(eq(cameraFeedsTable.tenantId, tenantId));
  res.json(cameras);
});

router.post("/cv-events", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const { camera_id, event_type, confidence, bbox, worker_id } = req.body as {
    camera_id: number;
    event_type: string;
    confidence: number;
    bbox?: { x: number; y: number; w: number; h: number };
    worker_id?: number;
  };
  if (!camera_id || !event_type || confidence == null) {
    res.status(400).json({ error: "camera_id, event_type, and confidence are required" });
    return;
  }

  type CvInsert = typeof cvEventsTable.$inferInsert;
  const insertPayload: CvInsert = {
    cameraId: camera_id,
    eventType: event_type,
    confidence,
    workerId: worker_id ?? null,
    tenantId,
    processed: "true",
  };
  if (bbox != null) {
    (insertPayload as CvInsert & { bbox: unknown }).bbox = bbox;
  }

  const [cvEvent] = await db.insert(cvEventsTable).values(insertPayload).returning();
  getIO()?.emit("cv:detection", { event: cvEvent });
  const alerts: typeof alertsTable.$inferInsert[] = [];
  if (event_type === "ppe_violation" && confidence > 0.7) {
    const alertData = {
      type: "ppe_violation",
      severity: confidence > 0.9 ? "critical" : "high",
      message: `PPE violation detected by camera ${camera_id} with ${Math.round(confidence * 100)}% confidence${worker_id ? ` — Worker #${worker_id}` : ""}`,
      workerId: worker_id,
      zone: "CV-Detected",
      tenantId,
      acknowledged: false,
    };
    const [alert] = await db.insert(alertsTable).values(alertData).returning();
    alerts.push(alert);
    getIO()?.emit("alert:new", alert);
    if (worker_id) {
      const ppeScore = Math.max(0, 100 - Math.round(confidence * 50));
      await db.update(workersTable).set({ ppeScore }).where(and(eq(workersTable.id, worker_id), eq(workersTable.tenantId, tenantId)));
      getIO()?.emit("worker:update", { action: "ppe_score", workerId: worker_id, ppeScore });
    }
  } else if (event_type === "proximity_breach" && confidence > 0.6) {
    const alertData = {
      type: "proximity_breach",
      severity: "high",
      message: `Unsafe proximity detected by camera ${camera_id}${worker_id ? ` — Worker #${worker_id} too close to machinery` : " — Workers/machines too close"}`,
      workerId: worker_id,
      zone: "CV-Detected",
      tenantId,
      acknowledged: false,
    };
    const [alert] = await db.insert(alertsTable).values(alertData).returning();
    alerts.push(alert);
    getIO()?.emit("alert:new", alert);
  } else if (event_type === "heat_exposure" && worker_id) {
    const [worker] = await db.select().from(workersTable).where(and(eq(workersTable.id, worker_id), eq(workersTable.tenantId, tenantId))).limit(1);
    if (worker) {
      const newFatigue = Math.min(10, worker.fatigueScore + 1);
      await db.update(workersTable).set({ fatigueScore: newFatigue }).where(eq(workersTable.id, worker_id));
      if (newFatigue >= 7) {
        const alertData = {
          type: "fatigue_risk",
          severity: newFatigue >= 9 ? "critical" : "high",
          message: `Heat exposure fatigue warning: Worker #${worker_id} fatigue score ${newFatigue}/10`,
          workerId: worker_id,
          zone: worker.zone,
          tenantId,
          acknowledged: false,
        };
        const [alert] = await db.insert(alertsTable).values(alertData).returning();
        alerts.push(alert);
        getIO()?.emit("alert:new", alert);
      }
      getIO()?.emit("worker:update", { action: "fatigue", workerId: worker_id, fatigueScore: newFatigue });
    }
  }
  res.status(201).json({ cvEvent, alertsCreated: alerts.length, alerts });
});

router.get("/cv-events/recent", requireAuth, async (req, res): Promise<void> => {
  const tenantId = req.auth!.tenantId;
  const events = await db
    .select()
    .from(cvEventsTable)
    .where(eq(cvEventsTable.tenantId, tenantId))
    .orderBy(desc(cvEventsTable.createdAt))
    .limit(50);
  res.json(events);
});

export default router;
