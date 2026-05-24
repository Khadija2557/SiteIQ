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

  // Broadcast live position updates every 5 seconds
  setInterval(async () => {
    if (!io) return;
    try {
      const workers = await db.select().from(workersTable);
      const machines = await db.select().from(machinesTable);

      const workerPositions = workers.map((w) => {
        const def = defaultPos(w.zone, w.id);
        return {
          id: w.id,
          name: w.name,
          zone: w.zone,
          status: w.status,
          ppeScore: w.ppeScore,
          fatigueScore: w.fatigueScore,
          x: jitter(w.locationX ?? def.x),
          y: jitter(w.locationY ?? def.y),
        };
      });

      const machinePositions = machines.map((m) => {
        const def = defaultPos(m.zone, m.id + 100);
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          zone: m.zone,
          status: m.status,
          utilizationPct: m.utilizationPct,
          x: jitter(m.locationX ?? def.x, 0.5),
          y: jitter(m.locationY ?? def.y, 0.5),
        };
      });

      io.emit("positions", { workers: workerPositions, machines: machinePositions });

      // Emit a random AI event occasionally
      if (Math.random() < 0.4) {
        const event = AI_EVENTS[Math.floor(Math.random() * AI_EVENTS.length)]!;
        io.emit("ai_event", { ...event, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      logger.error({ err }, "Error emitting Socket.IO positions");
    }
  }, 5000);

  // Broadcast new alerts every 20 seconds
  setInterval(async () => {
    if (!io) return;
    try {
      const alerts = await db.select().from(alertsTable).limit(5);
      io.emit("alerts_update", alerts);
    } catch (err) {
      logger.error({ err }, "Error emitting alerts");
    }
  }, 20000);

  return io;
}

export function getIO(): Server | null {
  return io;
}
