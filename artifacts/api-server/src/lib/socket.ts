import { Server } from "socket.io";
import http from "http";
import { db, workersTable, machinesTable, alertsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let io: Server | null = null;

const ZONE_BOUNDS: Record<string, { minX: number; maxX: number; minY: number; maxY: number }> = {
  "Zone A": { minX: 10, maxX: 40, minY: 10, maxY: 40 },
  "Zone B": { minX: 60, maxX: 90, minY: 10, maxY: 40 },
  "Zone C": { minX: 10, maxX: 40, minY: 60, maxY: 90 },
  "Zone D": { minX: 60, maxX: 90, minY: 60, maxY: 90 },
};

const ZONES = Object.keys(ZONE_BOUNDS);

function jitter(val: number, range = 2): number {
  return Math.max(0, Math.min(100, val + (Math.random() - 0.5) * range));
}

function defaultPos(zone: string, id: number) {
  const bounds = ZONE_BOUNDS[zone] ?? { minX: 10, maxX: 90, minY: 10, maxY: 90 };
  const seed = id * 7.3;
  return {
    x: bounds.minX + ((seed * 13.7) % (bounds.maxX - bounds.minX)),
    y: bounds.minY + ((seed * 11.3) % (bounds.maxY - bounds.minY)),
  };
}

const AI_EVENTS = [
  { type: "worker_rerouted", message: "Worker Marcus Chen rerouted — PPE violation in Zone B" },
  { type: "task_reassigned", message: "Task #14 reassigned: fatigue threshold exceeded by original assignee" },
  { type: "machine_flagged", message: "Crane #2 flagged for maintenance — vibration anomaly detected" },
  { type: "hazard_detected", message: "New chemical spill risk detected in Zone C by CV model" },
  { type: "load_balanced", message: "Load balanced: 3 tasks redistributed across Zone A workers" },
  { type: "delivery_optimized", message: "Delivery route optimized — Gate C congestion avoided" },
  { type: "alert_cleared", message: "All-clear issued for Zone D — hazard fully resolved" },
  { type: "shift_warning", message: "Fatigue alert: 4 workers approaching max shift duration" },
];

const CV_EVENT_TYPES = ["ppe_violation", "proximity_breach", "heat_exposure", "slip_hazard", "unauthorized_zone"];

export function createSocketServer(httpServer: http.Server): Server {
  io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket.IO client connected");
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket.IO client disconnected");
    });
  });

  // Every 5 seconds: broadcast worker/machine positions, randomly mutate statuses, emit CV detection
  setInterval(async () => {
    if (!io) return;
    try {
      const workers = await db.select().from(workersTable);
      const machines = await db.select().from(machinesTable);

      // Slightly randomize worker positions and occasionally update them in DB
      const workerUpdates: Array<{ id: number; x: number; y: number; status: string; ppeScore: number; fatigueScore: number }> = [];
      for (const w of workers) {
        const def = defaultPos(w.zone, w.id);
        const newX = jitter(w.locationX ?? def.x);
        const newY = jitter(w.locationY ?? def.y);
        workerUpdates.push({
          id: w.id,
          x: newX,
          y: newY,
          status: w.status,
          ppeScore: w.ppeScore,
          fatigueScore: w.fatigueScore,
        });
        if (Math.random() < 0.1) {
          await db.update(workersTable).set({ locationX: newX, locationY: newY }).where(eq(workersTable.id, w.id));
        }
      }

      // Occasionally change machine status
      const machineUpdates: Array<{ id: number; x: number; y: number; status: string; utilizationPct: number }> = [];
      for (const m of machines) {
        const def = defaultPos(m.zone, m.id + 100);
        const newX = jitter(m.locationX ?? def.x, 0.5);
        const newY = jitter(m.locationY ?? def.y, 0.5);
        let newStatus = m.status;
        if (Math.random() < 0.05) {
          const transitions: Record<string, string[]> = {
            idle: ["operating", "idle"],
            operating: ["operating", "operating", "idle", "maintenance"],
            maintenance: ["idle", "maintenance"],
            offline: ["offline", "idle"],
          };
          const options = transitions[m.status] ?? [m.status];
          newStatus = options[Math.floor(Math.random() * options.length)]!;
          if (newStatus !== m.status) {
            await db.update(machinesTable).set({ status: newStatus }).where(eq(machinesTable.id, m.id));
            io.emit("machine:update", { action: "status_changed", machineId: m.id, status: newStatus });
          }
        }
        const newUtilization = newStatus === "operating" ? Math.min(100, (m.utilizationPct ?? 0) + Math.floor(Math.random() * 5 - 2)) : 0;
        machineUpdates.push({ id: m.id, x: newX, y: newY, status: newStatus, utilizationPct: newUtilization });
      }

      io.emit("positions", { workers: workerUpdates, machines: machineUpdates, timestamp: new Date().toISOString() });
      io.emit("worker:update", { action: "positions_batch", workers: workerUpdates });
      io.emit("machine:update", { action: "positions_batch", machines: machineUpdates });

      // Randomly generate a simulated CV detection event (~20% chance each tick)
      if (Math.random() < 0.2 && workers.length > 0) {
        const randomWorker = workers[Math.floor(Math.random() * workers.length)]!;
        const eventType = CV_EVENT_TYPES[Math.floor(Math.random() * CV_EVENT_TYPES.length)]!;
        const confidence = 0.6 + Math.random() * 0.4;
        const simulatedCvEvent = {
          id: -1,
          cameraId: Math.ceil(Math.random() * 4),
          eventType,
          confidence: Math.round(confidence * 100) / 100,
          workerId: randomWorker.id,
          workerName: randomWorker.name,
          zone: randomWorker.zone,
          timestamp: new Date().toISOString(),
          simulated: true,
        };
        io.emit("cv:detection", { event: simulatedCvEvent });
        if ((eventType === "ppe_violation" || eventType === "proximity_breach") && confidence > 0.8) {
          const tenantId = randomWorker.tenantId;
          const alert = {
            type: eventType,
            severity: confidence > 0.9 ? "critical" : "high",
            message: `[CV Sim] ${eventType.replace("_", " ")} detected for ${randomWorker.name} in ${randomWorker.zone} (${Math.round(confidence * 100)}% confidence)`,
            workerId: randomWorker.id,
            zone: randomWorker.zone,
            tenantId,
            acknowledged: false,
          };
          try {
            const { alertsTable: at } = await import("@workspace/db");
            const [inserted] = await db.insert(at).values(alert).returning();
            io.emit("alert:new", inserted);
          } catch {
            io.emit("alert:new", { ...alert, id: -1, createdAt: new Date().toISOString() });
          }
        }
      }

      // Emit AI event occasionally
      if (Math.random() < 0.3) {
        const event = AI_EVENTS[Math.floor(Math.random() * AI_EVENTS.length)]!;
        io.emit("ai_event", { ...event, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      logger.error({ err }, "Error in Socket.IO simulation tick");
    }
  }, 5000);

  // Broadcast alert count every 15 seconds
  setInterval(async () => {
    if (!io) return;
    try {
      const alerts = await db.select().from(alertsTable);
      const unacknowledged = alerts.filter((a) => !a.acknowledged);
      io.emit("alerts_update", {
        total: alerts.length,
        unacknowledged: unacknowledged.length,
        recent: unacknowledged.slice(0, 5).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      });
    } catch (err) {
      logger.error({ err }, "Error emitting alerts update");
    }
  }, 15000);

  return io;
}

export function getIO(): Server | null {
  return io;
}
