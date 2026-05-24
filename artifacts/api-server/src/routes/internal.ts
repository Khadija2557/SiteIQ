/**
 * Internal service-to-service routes (not protected by user JWT).
 * Used by the CV microservice to push detection events without a user token.
 * Protected by X-CV-Service-Key header.
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, cvEventsTable, alertsTable, workersTable } from "@workspace/db";
import { getIO } from "../lib/socket";

const router = Router();

const CV_SERVICE_KEY = process.env["CV_INTERNAL_KEY"] ?? "cv-internal-key-siteiq";

function checkServiceKey(req: any, res: any): boolean {
  const key = req.headers["x-cv-service-key"];
  if (key !== CV_SERVICE_KEY) {
    res.status(401).json({ error: "Invalid service key" });
    return false;
  }
  return true;
}

router.post("/internal/cv-events", async (req, res): Promise<void> => {
  if (!checkServiceKey(req, res)) return;

  const {
    camera_id,
    event_type,
    confidence,
    bbox,
    worker_id,
    tenant_id = 1,
    detail,
    zone,
  } = req.body as {
    camera_id: number;
    event_type: string;
    confidence: number;
    bbox?: { x: number; y: number; w: number; h: number };
    worker_id?: number;
    tenant_id?: number;
    detail?: string;
    zone?: string;
  };

  if (!camera_id || !event_type || confidence == null) {
    res.status(400).json({ error: "camera_id, event_type, and confidence required" });
    return;
  }

  // Store CV event
  type CvInsert = typeof cvEventsTable.$inferInsert;
  const insertPayload: CvInsert = {
    cameraId: camera_id,
    eventType: event_type,
    confidence,
    workerId: worker_id ?? null,
    tenantId: tenant_id,
    processed: "true",
  };
  if (bbox != null) {
    (insertPayload as CvInsert & { bbox: unknown }).bbox = bbox;
  }
  const [cvEvent] = await db.insert(cvEventsTable).values(insertPayload).returning();

  // Broadcast to dashboard
  getIO()?.emit("cv:detection", { event: cvEvent, detail, zone });

  const alerts: (typeof alertsTable.$inferInsert)[] = [];

  // PPE violation → create alert
  if (event_type === "ppe_violation" && confidence > 0.7) {
    const severity = confidence > 0.9 ? "critical" : "high";
    const msg = detail
      ? `CV Alert — ${detail}`
      : `PPE violation detected by camera ${camera_id} (${Math.round(confidence * 100)}% confidence)${worker_id ? ` — Worker #${worker_id}` : ""}`;

    const [alert] = await db.insert(alertsTable).values({
      type: "ppe_violation", severity, message: msg,
      workerId: worker_id, zone: zone ?? "CV-Detected",
      tenantId: tenant_id, acknowledged: false,
    }).returning();
    alerts.push(alert);
    getIO()?.emit("alert:new", alert);

    if (worker_id) {
      const ppeScore = Math.max(0, 100 - Math.round(confidence * 50));
      await db.update(workersTable).set({ ppeScore })
        .where(and(eq(workersTable.id, worker_id), eq(workersTable.tenantId, tenant_id)));
      getIO()?.emit("worker:update", { action: "ppe_score", workerId: worker_id, ppeScore });
    }
  }

  // Proximity breach → alert
  else if (event_type === "proximity_breach" && confidence > 0.6) {
    const msg = detail
      ? `CV Alert — ${detail}`
      : `Unsafe proximity detected by camera ${camera_id}${worker_id ? ` — Worker #${worker_id} too close to machinery` : ""}`;
    const [alert] = await db.insert(alertsTable).values({
      type: "proximity_breach", severity: "high", message: msg,
      workerId: worker_id, zone: zone ?? "CV-Detected",
      tenantId: tenant_id, acknowledged: false,
    }).returning();
    alerts.push(alert);
    getIO()?.emit("alert:new", alert);
  }

  // Swing zone breach → critical alert
  else if (event_type === "swing_zone_breach") {
    const msg = detail ? `CV Alert — ${detail}` : `Crane swing zone breach detected by camera ${camera_id}`;
    const [alert] = await db.insert(alertsTable).values({
      type: "swing_zone_breach", severity: "critical", message: msg,
      workerId: worker_id, zone: zone ?? "CV-Detected",
      tenantId: tenant_id, acknowledged: false,
    }).returning();
    alerts.push(alert);
    getIO()?.emit("alert:new", alert);
  }

  // Heat exposure → update fatigue + maybe alert
  else if (event_type === "heat_exposure" && worker_id) {
    const [worker] = await db.select().from(workersTable)
      .where(and(eq(workersTable.id, worker_id), eq(workersTable.tenantId, tenant_id))).limit(1);
    if (worker) {
      const newFatigue = Math.min(100, worker.fatigueScore + 2);
      await db.update(workersTable).set({ fatigueScore: newFatigue }).where(eq(workersTable.id, worker_id));
      getIO()?.emit("worker:update", { action: "fatigue", workerId: worker_id, fatigueScore: newFatigue });
      if (newFatigue >= 70) {
        const severity = newFatigue >= 90 ? "critical" : "high";
        const msg = detail
          ? `CV Alert — ${detail}`
          : `Heat exposure warning: Worker #${worker_id} fatigue ${newFatigue}/100`;
        const [alert] = await db.insert(alertsTable).values({
          type: "heat_exposure", severity, message: msg,
          workerId: worker_id, zone: worker.zone,
          tenantId: tenant_id, acknowledged: false,
        }).returning();
        alerts.push(alert);
        getIO()?.emit("alert:new", alert);
      }
    }
  }

  res.status(201).json({ cvEvent, alertsCreated: alerts.length });
});

export default router;
