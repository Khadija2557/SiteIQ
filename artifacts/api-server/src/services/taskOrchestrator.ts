import { db, workersTable, tasksTable, hazardsTable, machinesTable, alertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getIO } from "../lib/socket";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Worker {
  id: number;
  name: string;
  trade: string;
  certifications: string[];
  zone: string;
  status: string;
  ppeScore: number;
  fatigueScore: number;
  locationX: number | null;
  locationY: number | null;
  shiftStart: Date | null;
  tenantId: number;
}

export interface Task {
  id: number;
  title: string;
  status: string;
  priority: string;
  zone: string;
  toolsRequired: string[];
  assignedWorkerId: number | null;
  deadline: Date | null;
  estimatedMinutes: number | null;
  dependencies: number[];
  tenantId: number;
  createdAt: Date;
}

export interface Hazard {
  id: number;
  type: string;
  severity: string;
  zone: string;
  locationX: number | null;
  locationY: number | null;
  active: boolean;
  tenantId: number;
}

export interface Machine {
  id: number;
  name: string;
  type: string;
  status: string;
  zone: string;
  locationX: number | null;
  locationY: number | null;
  tenantId: number;
}

export interface ScoredWorker {
  worker: Worker;
  score: number;
  reasons: string[];
}

export interface Assignment {
  task: Task;
  worker: Worker;
  score: number;
  reasoning: string;
}

export interface BulkResult {
  assignments: Assignment[];
  conflicts: Array<{ description: string; taskIds: number[]; machineId?: number }>;
  unassigned: Task[];
  summary: string;
}

export interface DisruptionResult {
  affectedTasks: Task[];
  newAssignments: Assignment[];
  supervisorNotifications: string[];
  explanation: string;
  unresolvable: Task[];
}

export interface AiDecision {
  id: string;
  timestamp: string;
  type: string;
  tenantId: number;
  taskId?: number;
  workerId?: number;
  explanation: string;
  score?: number;
  candidates?: ScoredWorker[];
}

// ─── In-memory decision log (circular buffer, last 200 per tenant) ─────────────

const decisionLog: AiDecision[] = [];
const MAX_LOG = 200;

export function logDecision(decision: AiDecision): void {
  decisionLog.unshift(decision);
  if (decisionLog.length > MAX_LOG) decisionLog.length = MAX_LOG;
  getIO()?.emit("ai:decision", decision);
  logger.info({ aiDecision: decision.type, taskId: decision.taskId }, decision.explanation.slice(0, 120));
}

export function getRecentDecisions(tenantId: number, limit = 10): AiDecision[] {
  return decisionLog.filter((d) => d.tenantId === tenantId).slice(0, limit);
}

// ─── ZONE ADJACENCY ──────────────────────────────────────────────────────────

const ZONE_ADJACENCY: Record<string, string[]> = {
  "Zone A": ["Zone B", "Zone C"],
  "Zone B": ["Zone A", "Zone D"],
  "Zone C": ["Zone A", "Zone D"],
  "Zone D": ["Zone B", "Zone C"],
};

function zoneProximityScore(workerZone: string, taskZone: string): { points: number; reason: string } {
  if (workerZone === taskZone) return { points: 30, reason: `same zone as task (${taskZone})` };
  if ((ZONE_ADJACENCY[workerZone] ?? []).includes(taskZone)) return { points: 15, reason: `adjacent zone to task (${workerZone} → ${taskZone})` };
  return { points: 0, reason: `distant zone from task (${workerZone} vs ${taskZone})` };
}

// ─── 1. WORKER SCORING ───────────────────────────────────────────────────────

export function scoreWorkerForTask(
  worker: Worker,
  task: Task,
  hazards: Hazard[],
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Certification gate — hard disqualify
  const required = task.toolsRequired ?? [];
  const certs = worker.certifications ?? [];
  const missing = required.filter((r) => !certs.includes(r));
  if (missing.length > 0) {
    return {
      score: 0,
      reasons: [`DISQUALIFIED — missing certification(s): ${missing.join(", ")}`],
    };
  }
  if (required.length > 0) {
    reasons.push(`holds all required certifications: ${required.join(", ")}`);
  }

  // Skill match
  const taskTrade = (task as unknown as { required_trade?: string }).required_trade ?? "";
  if (taskTrade) {
    if (worker.trade === taskTrade) {
      score += 40;
      reasons.push(`trade match: ${worker.trade} (exact) +40`);
    } else if (worker.trade && taskTrade && (worker.trade.includes(taskTrade) || taskTrade.includes(worker.trade))) {
      score += 20;
      reasons.push(`trade partial match: ${worker.trade} ~ ${taskTrade} +20`);
    } else {
      reasons.push(`trade mismatch: worker is ${worker.trade || "unspecified"}, task needs ${taskTrade}`);
    }
  } else {
    // No trade requirement — assign partial skill points based on experience
    score += 20;
    reasons.push("no specific trade required — general worker applicable +20");
  }

  // Distance / zone score
  const { points: zonePoints, reason: zoneReason } = zoneProximityScore(worker.zone, task.zone);
  score += zonePoints;
  reasons.push(`zone proximity: ${zoneReason} +${zonePoints}`);

  // Fatigue score
  const fatigue = worker.fatigueScore;
  if (fatigue < 3) {
    score += 20;
    reasons.push(`fatigue score ${fatigue}/10 (well-rested) +20`);
  } else if (fatigue < 5) {
    score += 10;
    reasons.push(`fatigue score ${fatigue}/10 (acceptable) +10`);
  } else if (fatigue > 9) {
    score -= 30;
    reasons.push(`fatigue score ${fatigue}/10 (critically fatigued) -30`);
  } else if (fatigue > 7) {
    score -= 10;
    reasons.push(`fatigue score ${fatigue}/10 (elevated fatigue) -10`);
  } else {
    reasons.push(`fatigue score ${fatigue}/10 (moderate) ±0`);
  }

  // PPE compliance
  const ppe = worker.ppeScore;
  if (ppe > 90) {
    score += 10;
    reasons.push(`PPE compliance ${ppe}% (exemplary) +10`);
  } else if (ppe > 70) {
    reasons.push(`PPE compliance ${ppe}% (acceptable) ±0`);
  } else {
    score -= 20;
    reasons.push(`PPE compliance ${ppe}% (non-compliant) -20`);
  }

  // Hazard proximity penalty
  const wx = worker.locationX ?? 50;
  const wy = worker.locationY ?? 50;
  const criticalNearby = hazards.filter((h) => {
    if (!h.active || h.severity !== "critical") return false;
    const hx = h.locationX ?? 50;
    const hy = h.locationY ?? 50;
    return Math.sqrt((wx - hx) ** 2 + (wy - hy) ** 2) < 10;
  });
  if (criticalNearby.length > 0) {
    score -= 15;
    reasons.push(`currently within 10 units of ${criticalNearby.length} critical hazard(s) -15`);
  }

  return { score: Math.max(0, score), reasons };
}

// ─── 2. OPTIMAL ASSIGNMENT ────────────────────────────────────────────────────

export function findBestWorkerForTask(
  task: Task,
  allWorkers: Worker[],
  allHazards: Hazard[],
  activeTasks: Task[] = [],
): ScoredWorker[] | null {
  const eligible = allWorkers.filter((w) => {
    if (w.status !== "active") return false;
    const isOnHighPriority = activeTasks.some(
      (t) => t.assignedWorkerId === w.id && (t.priority === "critical" || t.priority === "urgent"),
    );
    if (isOnHighPriority) return false;
    return true;
  });

  const scored: ScoredWorker[] = eligible
    .map((w) => {
      const { score, reasons } = scoreWorkerForTask(w, task, allHazards);
      return { worker: w, score, reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  return scored.slice(0, 3);
}

// ─── 3. BULK OPTIMIZER ────────────────────────────────────────────────────────

export function optimizeFullSchedule(
  tasks: Task[],
  workers: Worker[],
  hazards: Hazard[],
  machines: Machine[],
): BulkResult {
  const PRIORITY_ORDER: Record<string, number> = { critical: 0, urgent: 1, high: 2, medium: 3, low: 4 };
  const unassigned = tasks
    .filter((t) => !t.assignedWorkerId && t.status === "todo")
    .sort((a, b) => {
      const po = (PRIORITY_ORDER[a.priority] ?? 5) - (PRIORITY_ORDER[b.priority] ?? 5);
      if (po !== 0) return po;
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  const activeTasks = tasks.filter((t) => t.status === "in_progress");
  const tentativelyAssigned = new Map<number, number>(); // workerId → task count
  for (const t of activeTasks) {
    if (t.assignedWorkerId) {
      tentativelyAssigned.set(t.assignedWorkerId, (tentativelyAssigned.get(t.assignedWorkerId) ?? 0) + 1);
    }
  }

  const assignments: Assignment[] = [];
  const skipped: Task[] = [];

  for (const task of unassigned) {
    const availableWorkers = workers.filter((w) => (tentativelyAssigned.get(w.id) ?? 0) < 3);
    const candidates = findBestWorkerForTask(task, availableWorkers, hazards, activeTasks);
    if (!candidates || candidates.length === 0) {
      skipped.push(task);
      continue;
    }
    const best = candidates[0]!;
    tentativelyAssigned.set(best.worker.id, (tentativelyAssigned.get(best.worker.id) ?? 0) + 1);
    assignments.push({
      task,
      worker: best.worker,
      score: best.score,
      reasoning: generateExplanation({ task, worker: best.worker, score: best.score, reasoning: "" }, candidates.slice(1)),
    });
  }

  // Detect machine conflicts: two tasks in same zone requiring same machine type at same time
  const conflicts: BulkResult["conflicts"] = [];
  const machinesByZone = new Map<string, Machine[]>();
  for (const m of machines) {
    const list = machinesByZone.get(m.zone) ?? [];
    list.push(m);
    machinesByZone.set(m.zone, list);
  }
  const zoneTaskMap = new Map<string, Task[]>();
  for (const t of tasks.filter((t) => t.status === "in_progress" || t.status === "todo")) {
    const list = zoneTaskMap.get(t.zone) ?? [];
    list.push(t);
    zoneTaskMap.set(t.zone, list);
  }
  for (const [zone, zoneTasks] of zoneTaskMap) {
    const zoneMachines = machinesByZone.get(zone) ?? [];
    const operatingCranes = zoneMachines.filter((m) => m.type === "crane" && m.status === "operating");
    if (operatingCranes.length > 0 && zoneTasks.length > 2) {
      conflicts.push({
        description: `Zone ${zone}: ${zoneTasks.length} concurrent tasks with ${operatingCranes.length} crane(s) operating — potential swing-radius conflict`,
        taskIds: zoneTasks.slice(0, 3).map((t) => t.id),
        machineId: operatingCranes[0]!.id,
      });
    }
  }

  return {
    assignments,
    conflicts,
    unassigned: skipped,
    summary: `Optimized ${unassigned.length} unassigned tasks: ${assignments.length} assigned, ${skipped.length} unresolvable (no eligible worker). ${conflicts.length} machine conflict(s) detected.`,
  };
}

// ─── 4. DISRUPTION HANDLER ───────────────────────────────────────────────────

export async function handleDisruption(
  disruptionEvent: { type: string; entityId: number; tenantId: number },
): Promise<DisruptionResult> {
  const { type, entityId, tenantId } = disruptionEvent;

  const [allTasks, allWorkers, allHazards, allMachines] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tenantId)),
    db.select().from(workersTable).where(eq(workersTable.tenantId, tenantId)),
    db.select().from(hazardsTable).where(and(eq(hazardsTable.tenantId, tenantId), eq(hazardsTable.active, true))),
    db.select().from(machinesTable).where(eq(machinesTable.tenantId, tenantId)),
  ]);

  const activeTasks = allTasks.filter((t) => t.status === "in_progress" || t.status === "todo");
  const supervisorNotifications: string[] = [];
  let affectedTasks: Task[] = [];
  let explanation = "";

  switch (type) {
    case "worker_sos": {
      const worker = allWorkers.find((w) => w.id === entityId);
      if (!worker) break;
      affectedTasks = activeTasks.filter((t) => t.assignedWorkerId === entityId);
      explanation = `SOS activated by ${worker.name} in ${worker.zone}. ${affectedTasks.length} task(s) require immediate reassignment.`;
      supervisorNotifications.push(`🚨 SOS: ${worker.name} triggered emergency in ${worker.zone}. All assigned tasks suspended.`);
      for (const t of affectedTasks) {
        await db.update(tasksTable).set({ assignedWorkerId: null, status: "blocked" }).where(eq(tasksTable.id, t.id));
      }
      break;
    }
    case "machine_breakdown": {
      const machine = allMachines.find((m) => m.id === entityId);
      if (!machine) break;
      affectedTasks = activeTasks.filter((t) => t.zone === machine.zone && (t.toolsRequired ?? []).some((r) =>
        r.toLowerCase().includes(machine.type.toLowerCase()) || machine.name.toLowerCase().includes(r.toLowerCase()),
      ));
      await db.update(machinesTable as typeof machinesTable).set({ status: "maintenance" } as Partial<typeof machinesTable.$inferInsert>).where(eq(machinesTable.id, entityId));
      explanation = `Machine breakdown: ${machine.name} (${machine.type}) in ${machine.zone}. ${affectedTasks.length} task(s) may be impacted. Machine status set to maintenance.`;
      supervisorNotifications.push(`⚠️ Machine breakdown: ${machine.name} offline. Check tasks in ${machine.zone}.`);
      break;
    }
    case "hazard_created": {
      const hazard = allHazards.find((h) => h.id === entityId);
      if (!hazard) break;
      affectedTasks = activeTasks.filter((t) => t.zone === hazard.zone);
      const affectedWorkers = allWorkers.filter((w) => {
        const dist = Math.sqrt(((w.locationX ?? 50) - (hazard.locationX ?? 50)) ** 2 + ((w.locationY ?? 50) - (hazard.locationY ?? 50)) ** 2);
        return dist < 15;
      });
      explanation = `New ${hazard.severity} hazard in ${hazard.zone}. ${affectedTasks.length} active task(s) in zone, ${affectedWorkers.length} worker(s) in proximity.`;
      supervisorNotifications.push(`🔴 ${hazard.severity.toUpperCase()} hazard created in ${hazard.zone}. ${affectedWorkers.length} worker(s) at risk.`);
      break;
    }
    case "delivery_late": {
      affectedTasks = activeTasks.filter((t) =>
        t.title.toLowerCase().includes("unload") || t.title.toLowerCase().includes("delivery"),
      );
      explanation = `Late delivery (ID: ${entityId}) detected. ${affectedTasks.length} downstream unloading task(s) affected. Schedule may need resequencing.`;
      supervisorNotifications.push(`📦 Delivery #${entityId} is late. ${affectedTasks.length} unloading task(s) flagged for rescheduling.`);
      break;
    }
    case "worker_ppe_violation": {
      const worker = allWorkers.find((w) => w.id === entityId);
      if (!worker) break;
      affectedTasks = activeTasks.filter((t) => t.assignedWorkerId === entityId && t.status === "in_progress");
      if (worker.ppeScore < 50) {
        for (const t of affectedTasks) {
          await db.update(tasksTable).set({ status: "blocked" }).where(eq(tasksTable.id, t.id));
        }
        explanation = `PPE violation: ${worker.name} has compliance score ${worker.ppeScore}%. ${affectedTasks.length} active task(s) blocked pending PPE correction.`;
        supervisorNotifications.push(`⛑️ ${worker.name} PPE violation — ${affectedTasks.length} task(s) suspended. Worker must re-equip before resuming.`);
      } else {
        explanation = `PPE warning: ${worker.name} compliance at ${worker.ppeScore}%. Tasks monitored but not suspended.`;
        supervisorNotifications.push(`⛑️ PPE warning for ${worker.name} (${worker.ppeScore}%). Monitor compliance.`);
      }
      break;
    }
    default:
      explanation = `Unknown disruption type: ${type}`;
  }

  // Re-assign affected tasks
  const newAssignments: Assignment[] = [];
  const unresolvable: Task[] = [];
  const otherWorkers = allWorkers.filter((w) => w.id !== entityId && w.status === "active");

  for (const task of affectedTasks) {
    const candidates = findBestWorkerForTask(task as Task, otherWorkers, allHazards as Hazard[], activeTasks as Task[]);
    if (candidates && candidates.length > 0) {
      const best = candidates[0]!;
      newAssignments.push({
        task: task as Task,
        worker: best.worker,
        score: best.score,
        reasoning: generateExplanation({ task: task as Task, worker: best.worker, score: best.score, reasoning: "" }, candidates.slice(1)),
      });
    } else {
      unresolvable.push(task as Task);
    }
  }

  const decisionId = `disruption-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullExplanation = `${explanation} Re-assigned ${newAssignments.length} task(s). ${unresolvable.length} task(s) could not be reassigned.`;

  logDecision({
    id: decisionId,
    timestamp: new Date().toISOString(),
    type: `disruption:${type}`,
    tenantId,
    explanation: fullExplanation,
    candidates: [],
  });

  // Create supervisor alert in DB
  if (supervisorNotifications.length > 0) {
    await db.insert(alertsTable).values({
      type: "ai_disruption",
      severity: type === "worker_sos" ? "critical" : "high",
      message: supervisorNotifications.join(" | "),
      zone: "AI Orchestrator",
      tenantId,
      acknowledged: false,
    });
    getIO()?.emit("alert:new", { type: "ai_disruption", message: supervisorNotifications[0], severity: "high", tenantId });
  }

  return {
    affectedTasks: affectedTasks as Task[],
    newAssignments,
    supervisorNotifications,
    explanation: fullExplanation,
    unresolvable,
  };
}

// ─── 5. EXPLAINABLE AI ───────────────────────────────────────────────────────

export function generateExplanation(
  assignment: { task: Task; worker: Worker; score: number; reasoning: string },
  otherCandidates: ScoredWorker[] = [],
): string {
  const { task, worker, score, reasons } = { ...assignment, reasons: (assignment as unknown as { reasons?: string[] }).reasons ?? [] };

  const positive = reasons.filter((r) => !r.includes("DISQUALIFIED") && !r.includes("mismatch") && !r.includes("-"));
  const mainReasons = positive.slice(0, 4).join("; ");

  let explanation = `${worker.name} was assigned to "${task.title}" (${task.priority} priority, ${task.zone}) because: ${mainReasons || `scored ${score}/100 as best available worker`}.`;

  if (score >= 70) {
    explanation += ` Assignment confidence: HIGH (score ${score}/100).`;
  } else if (score >= 40) {
    explanation += ` Assignment confidence: MEDIUM (score ${score}/100) — no higher-scoring worker available.`;
  } else {
    explanation += ` Assignment confidence: LOW (score ${score}/100) — best available under constraints.`;
  }

  if (otherCandidates.length > 0) {
    const others = otherCandidates.map((c) => {
      const disqualified = c.reasons.find((r) => r.includes("DISQUALIFIED"));
      if (disqualified) return `${c.worker.name} (disqualified — ${disqualified.replace("DISQUALIFIED — ", "")})`;
      return `${c.worker.name} (score ${c.score} — ${c.reasons[0] ?? "lower score"})`;
    });
    explanation += ` ${otherCandidates.length} other candidate(s) considered: ${others.join("; ")}.`;
  }

  return explanation;
}

// ─── 6. A* ROUTE PLANNER ─────────────────────────────────────────────────────

const GRID = 100;

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan
}

function buildBlockedSet(
  hazards: Hazard[],
  machines: Machine[],
): Set<string> {
  const blocked = new Set<string>();
  for (const h of hazards) {
    if (!h.active) continue;
    const r = h.severity === "critical" ? 7 : 5;
    const cx = Math.round(h.locationX ?? 50);
    const cy = Math.round(h.locationY ?? 50);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx * dx + dy * dy <= r * r) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
            blocked.add(`${nx},${ny}`);
          }
        }
      }
    }
  }
  for (const m of machines) {
    if (m.type !== "crane" || m.status !== "operating") continue;
    const r = 8;
    const cx = Math.round(m.locationX ?? 50);
    const cy = Math.round(m.locationY ?? 50);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx * dx + dy * dy <= r * r) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
            blocked.add(`${nx},${ny}`);
          }
        }
      }
    }
  }
  return blocked;
}

export function planSafeRoute(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  hazards: Hazard[],
  machines: Machine[],
): Array<{ x: number; y: number }> | null {
  const sx = Math.round(Math.max(0, Math.min(GRID - 1, startX)));
  const sy = Math.round(Math.max(0, Math.min(GRID - 1, startY)));
  const ex = Math.round(Math.max(0, Math.min(GRID - 1, endX)));
  const ey = Math.round(Math.max(0, Math.min(GRID - 1, endY)));

  if (sx === ex && sy === ey) return [{ x: sx, y: sy }];

  const blocked = buildBlockedSet(hazards, machines);

  // If start or end is blocked, relax slightly
  if (blocked.has(`${sx},${sy}`) || blocked.has(`${ex},${ey}`)) {
    // Fall back to direct route with simple deflection
    return null;
  }

  type Node = { x: number; y: number; g: number; f: number; parent: Node | null };
  const openMap = new Map<string, Node>();
  const closedSet = new Set<string>();

  const startNode: Node = { x: sx, y: sy, g: 0, f: heuristic(sx, sy, ex, ey), parent: null };
  openMap.set(`${sx},${sy}`, startNode);

  const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  let iterations = 0;
  const MAX_ITER = 5000;

  while (openMap.size > 0 && iterations < MAX_ITER) {
    iterations++;

    // Get node with lowest f
    let current: Node | null = null;
    for (const n of openMap.values()) {
      if (!current || n.f < current.f) current = n;
    }
    if (!current) break;

    const key = `${current.x},${current.y}`;
    openMap.delete(key);
    closedSet.add(key);

    if (current.x === ex && current.y === ey) {
      // Reconstruct path
      const path: Array<{ x: number; y: number }> = [];
      let n: Node | null = current;
      while (n) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      // Subsample to at most 20 waypoints
      if (path.length <= 20) return path;
      const step = Math.floor(path.length / 20);
      const sampled: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < path.length; i += step) sampled.push(path[i]!);
      if (sampled[sampled.length - 1]?.x !== ex || sampled[sampled.length - 1]?.y !== ey) {
        sampled.push({ x: ex, y: ey });
      }
      return sampled;
    }

    for (const [dx, dy] of DIRS) {
      const nx = current.x + dx!;
      const ny = current.y + dy!;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      const nk = `${nx},${ny}`;
      if (closedSet.has(nk) || blocked.has(nk)) continue;
      const moveCost = Math.abs(dx!) + Math.abs(dy!) === 2 ? 1.414 : 1;
      const g = current.g + moveCost;
      const existing = openMap.get(nk);
      if (!existing || g < existing.g) {
        openMap.set(nk, { x: nx, y: ny, g, f: g + heuristic(nx, ny, ex, ey), parent: current });
      }
    }
  }

  return null; // No path found
}

// ─── 7. HEAT EXPOSURE TRACKER ────────────────────────────────────────────────

const HEAT_RISK_ZONES: Set<string> = new Set(["Zone B", "Zone D"]);
const HEAT_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 hours in ms

export interface HeatRiskWorker {
  worker: Worker;
  hoursInZone: number;
  zone: string;
  recommendation: string;
}

export function checkHeatExposure(workers: Worker[]): HeatRiskWorker[] {
  const now = Date.now();
  const at_risk: HeatRiskWorker[] = [];

  for (const w of workers) {
    if (!HEAT_RISK_ZONES.has(w.zone)) continue;
    if (!w.shiftStart) continue;
    const elapsed = now - new Date(w.shiftStart).getTime();
    if (elapsed >= HEAT_THRESHOLD_MS) {
      const hoursInZone = Math.round((elapsed / 3600000) * 10) / 10;
      at_risk.push({
        worker: w,
        hoursInZone,
        zone: w.zone,
        recommendation: `Rotate ${w.name} out of ${w.zone} after ${hoursInZone}h. Suggest reassignment to indoor task or break.`,
      });
    }
  }
  return at_risk;
}

// ─── BACKGROUND JOB (60-second interval) ─────────────────────────────────────

let bgJobStarted = false;

export function startOrchestratorBackgroundJob(): void {
  if (bgJobStarted) return;
  bgJobStarted = true;
  logger.info("AI orchestrator background job started (60s interval)");

  setInterval(async () => {
    try {
      // Group workers/tasks by tenant
      const [allWorkers, allTasks, allHazards] = await Promise.all([
        db.select().from(workersTable),
        db.select().from(tasksTable),
        db.select().from(hazardsTable).where(eq(hazardsTable.active, true)),
      ]);

      const tenantIds = [...new Set(allWorkers.map((w) => w.tenantId))];

      for (const tenantId of tenantIds) {
        const workers = allWorkers.filter((w) => w.tenantId === tenantId) as Worker[];
        const tasks = allTasks.filter((t) => t.tenantId === tenantId) as Task[];
        const hazards = allHazards.filter((h) => h.tenantId === tenantId) as Hazard[];

        // 1. Auto-assign unassigned high-priority tasks
        const urgent = tasks.filter(
          (t) => !t.assignedWorkerId && t.status === "todo" && (t.priority === "critical" || t.priority === "high"),
        );
        for (const task of urgent) {
          const candidates = findBestWorkerForTask(task, workers, hazards, tasks);
          if (candidates && candidates.length > 0) {
            const best = candidates[0]!;
            await db.update(tasksTable)
              .set({ assignedWorkerId: best.worker.id, status: "in_progress" })
              .where(and(eq(tasksTable.id, task.id), eq(tasksTable.tenantId, tenantId)));
            const explanation = generateExplanation({ task, worker: best.worker, score: best.score, reasoning: "" }, candidates.slice(1));
            logDecision({
              id: `auto-assign-${task.id}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: "auto_assign",
              tenantId,
              taskId: task.id,
              workerId: best.worker.id,
              explanation,
              score: best.score,
              candidates,
            });
          } else {
            await db.insert(alertsTable).values({
              type: "unassigned_critical",
              severity: task.priority === "critical" ? "critical" : "high",
              message: `No eligible worker found for ${task.priority} task: "${task.title}" in ${task.zone}. Manual intervention required.`,
              zone: task.zone,
              tenantId,
              acknowledged: false,
            });
            getIO()?.emit("alert:new", {
              type: "unassigned_critical",
              severity: task.priority === "critical" ? "critical" : "high",
              message: `AI: No worker available for "${task.title}"`,
              zone: task.zone,
              tenantId,
            });
          }
        }

        // 2. Check heat exposure
        const heatRisk = checkHeatExposure(workers);
        for (const risk of heatRisk) {
          logDecision({
            id: `heat-${risk.worker.id}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "heat_warning",
            tenantId,
            workerId: risk.worker.id,
            explanation: risk.recommendation,
          });
          await db.insert(alertsTable).values({
            type: "heat_exposure",
            severity: risk.hoursInZone > 5 ? "critical" : "high",
            message: risk.recommendation,
            workerId: risk.worker.id,
            zone: risk.zone,
            tenantId,
            acknowledged: false,
          });
          getIO()?.emit("alert:new", { type: "heat_exposure", severity: "high", message: risk.recommendation, workerId: risk.worker.id, zone: risk.zone, tenantId });
        }

        // 3. Check for schedule drift (tasks overdue by > 30 minutes)
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
        const overdue = tasks.filter(
          (t) =>
            t.status === "in_progress" &&
            t.deadline &&
            new Date(t.deadline) < thirtyMinutesAgo,
        );
        for (const task of overdue) {
          const minutesLate = Math.round((now.getTime() - new Date(task.deadline!).getTime()) / 60000);
          const explanation = `Schedule drift detected: "${task.title}" is ${minutesLate} minutes overdue. Assigned to worker #${task.assignedWorkerId ?? "unassigned"}. Consider priority escalation or reassignment.`;
          logDecision({
            id: `drift-${task.id}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "schedule_drift",
            tenantId,
            taskId: task.id,
            workerId: task.assignedWorkerId ?? undefined,
            explanation,
          });
          getIO()?.emit("ai:decision", {
            type: "schedule_drift",
            taskId: task.id,
            explanation,
            tenantId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "AI orchestrator background job error");
    }
  }, 60_000);
}
