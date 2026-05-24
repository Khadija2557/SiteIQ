import { useState } from "react";
import { ArrowLeft, MapPin, Clock, Wrench, AlertTriangle, CheckSquare, Square, CheckCircle2, XCircle, ShieldAlert, HelpCircle } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  zone: string;
  tools_required: string[];
  estimated_minutes?: number;
}

interface TaskDetailProps {
  task: Task;
  workerName: string;
  onBack: () => void;
  onSOS: () => void;
}

const ZONE_COLORS: Record<string, string> = {
  "Zone A": "#06b6d4", "Zone B": "#f59e0b", "Zone C": "#8b5cf6", "Zone D": "#ef4444",
};

const BLOCK_REASONS = [
  "Missing materials",
  "Equipment unavailable",
  "Unsafe conditions",
  "Need supervisor",
  "Weather conditions",
];

function ZoneMap({ zone }: { zone: string }) {
  const zones = ["Zone A", "Zone B", "Zone C", "Zone D"];
  const positions = [
    { x: 10, y: 10, w: 35, h: 35 },
    { x: 55, y: 10, w: 35, h: 35 },
    { x: 10, y: 55, w: 35, h: 35 },
    { x: 55, y: 55, w: 35, h: 35 },
  ];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect width="100" height="100" fill="#0d1117" />
      {zones.map((z, i) => {
        const p = positions[i];
        const isTarget = z === zone;
        const color = ZONE_COLORS[z] || "#374151";
        return (
          <g key={z}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h}
              fill={isTarget ? color + "33" : "#111827"}
              stroke={isTarget ? color : "#1f2937"}
              strokeWidth={isTarget ? 2 : 1}
              rx={2}
            />
            {isTarget && (
              <rect x={p.x} y={p.y} width={p.w} height={p.h}
                fill="none" stroke={color} strokeWidth={1}
                strokeDasharray="3,2" rx={2} opacity={0.5}
              />
            )}
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 4} textAnchor="middle"
              fill={isTarget ? color : "#6b7280"} fontSize="5" fontFamily="monospace" fontWeight={isTarget ? "bold" : "normal"}>
              {z}
            </text>
            {isTarget && (
              <>
                <circle cx={p.x + p.w / 2} cy={p.y + p.h / 2 + 5} r={3} fill={color} />
                <circle cx={p.x + p.w / 2} cy={p.y + p.h / 2 + 5} r={5} fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function TaskDetail({ task, workerName, onBack, onSOS }: TaskDetailProps) {
  const [checkedTools, setCheckedTools] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("siteiq_token") || localStorage.getItem("siteiq_worker_token");

  const toggleTool = (tool: string) =>
    setCheckedTools(s => { const n = new Set(s); n.has(tool) ? n.delete(tool) : n.add(tool); return n; });

  const isCritical = task.priority === "critical";

  const patchStatus = async (status: string, reason?: string) => {
    setLoading(true);
    const body: Record<string, string> = { status };
    if (reason) body.block_reason = reason;
    try {
      const resp = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error();
      setActionDone(status);
    } catch {
      // Queue offline
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      queue.push({ type: "task_status", taskId: task.id, status, reason, ts: Date.now() });
      localStorage.setItem("offline_queue", JSON.stringify(queue));
      setActionDone(status + "_offline");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsafe = async () => {
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition | null>(res =>
        navigator.geolocation?.getCurrentPosition(res, () => res(null), { timeout: 3000 })
      );
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "unsafe_condition",
          severity: "critical",
          message: `UNSAFE: ${workerName} reported unsafe condition on task "${task.title}" in ${task.zone}`,
          zone: task.zone,
          acknowledged: false,
        }),
      });
    } catch {}
    setActionDone("unsafe");
    setLoading(false);
  };

  if (actionDone) {
    const messages: Record<string, { icon: React.ReactNode; title: string; sub: string; color: string }> = {
      done:            { icon: <CheckCircle2 className="w-12 h-12 text-green-400" />, title: "Task Complete!", sub: "Well done. Moving to next task.", color: "text-green-400" },
      done_offline:    { icon: <CheckCircle2 className="w-12 h-12 text-green-400" />, title: "Saved offline", sub: "Will sync when connected.", color: "text-green-400" },
      blocked:         { icon: <AlertTriangle className="w-12 h-12 text-amber-400" />, title: "Reported Blocked", sub: "Supervisor notified.", color: "text-amber-400" },
      blocked_offline: { icon: <AlertTriangle className="w-12 h-12 text-amber-400" />, title: "Saved offline", sub: "Will sync when connected.", color: "text-amber-400" },
      unsafe:          { icon: <ShieldAlert className="w-12 h-12 text-red-400" />, title: "Alert Sent!", sub: "Supervisors have been notified.", color: "text-red-400" },
    };
    const m = messages[actionDone] || messages.done;
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center gap-4 px-6">
        {m.icon}
        <h2 className={`font-mono font-bold text-xl ${m.color}`}>{m.title}</h2>
        <p className="text-gray-400 font-mono text-sm text-center">{m.sub}</p>
        <button onClick={onBack} className="mt-4 h-14 w-full max-w-xs bg-[#111827] border border-[#1f2937] rounded-xl font-mono text-white uppercase tracking-wider active:scale-95 transition-all">
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white pb-32">
      {/* Header */}
      <div className="bg-[#0d1117] border-b border-[#1f2937] px-4 pt-10 pb-4 sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-cyan-400 font-mono text-sm mb-3 active:opacity-70">
          <ArrowLeft className="w-4 h-4" /> Tasks
        </button>
        <div className="flex items-start gap-2">
          <div>
            <h1 className="font-mono font-bold text-white text-lg leading-tight">{task.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-mono text-gray-400">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />{task.zone}
              </span>
              {task.estimated_minutes && (
                <span className="flex items-center gap-1 text-xs font-mono text-gray-400">
                  <Clock className="w-3.5 h-3.5" />{task.estimated_minutes} min
                </span>
              )}
            </div>
          </div>
          {isCritical && (
            <span className="shrink-0 text-[10px] font-mono bg-red-900/50 border border-red-500/40 text-red-400 rounded-full px-2 py-0.5 uppercase tracking-wider">
              Critical
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Description */}
        {task.description && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Task Details</p>
            <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Zone map */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Site Map — Target Zone</p>
          <div className="h-40 rounded-lg overflow-hidden border border-[#1f2937]">
            <ZoneMap zone={task.zone} />
          </div>
          <p className="text-xs font-mono text-cyan-400 mt-2 text-center">You are assigned to <strong>{task.zone}</strong></p>
        </div>

        {/* Tools checklist */}
        {task.tools_required.length > 0 && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5" /> Tools Required
              <span className="text-cyan-400 ml-auto">{checkedTools.size}/{task.tools_required.length}</span>
            </p>
            <div className="space-y-3">
              {task.tools_required.map(tool => {
                const checked = checkedTools.has(tool);
                return (
                  <button key={tool} onClick={() => toggleTool(tool)}
                    className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-all">
                    {checked
                      ? <CheckSquare className="w-5 h-5 text-green-400 shrink-0" />
                      : <Square className="w-5 h-5 text-gray-600 shrink-0" />}
                    <span className={`font-mono text-sm ${checked ? "line-through text-gray-500" : "text-white"}`}>{tool}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Safety notes */}
        {isCritical && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4">
            <p className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Safety Warning
            </p>
            <p className="text-sm text-red-300 font-semibold leading-relaxed">
              This is a CRITICAL priority task. Ensure all PPE is worn and site conditions are safe before proceeding. 
              Report any unsafe conditions immediately using the UNSAFE button below.
            </p>
          </div>
        )}

        {/* Block reason picker */}
        {blocking && (
          <div className="bg-[#111827] border border-amber-500/30 rounded-xl p-4">
            <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-3">Why are you blocked?</p>
            <div className="space-y-2">
              {BLOCK_REASONS.map(r => (
                <button key={r} onClick={() => setBlockReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-lg font-mono text-sm border transition-all active:scale-[0.98] ${
                    blockReason === r
                      ? "bg-amber-900/30 border-amber-500/60 text-amber-300"
                      : "bg-[#0d1117] border-[#1f2937] text-gray-300"
                  }`}>{r}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setBlocking(false); setBlockReason(""); }}
                className="flex-1 h-12 border border-[#1f2937] rounded-lg font-mono text-gray-400 text-sm active:scale-95 transition-all">
                Cancel
              </button>
              <button onClick={() => { patchStatus("blocked", blockReason); setBlocking(false); }}
                disabled={!blockReason}
                className="flex-1 h-12 bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-mono font-bold text-sm uppercase active:scale-95 transition-all">
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons — fixed bottom */}
      {!blocking && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0d14]/95 backdrop-blur border-t border-[#1f2937] p-4 grid grid-cols-2 gap-3">
          <button onClick={() => patchStatus("done")} disabled={loading}
            className="h-14 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-xl font-mono font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            <CheckCircle2 className="w-5 h-5" /> Done
          </button>
          <button onClick={() => setBlocking(true)} disabled={loading}
            className="h-14 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 rounded-xl font-mono font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            <AlertTriangle className="w-5 h-5" /> Blocked
          </button>
          <button onClick={handleUnsafe} disabled={loading}
            className="h-14 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 rounded-xl font-mono font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            <ShieldAlert className="w-5 h-5" /> Unsafe
          </button>
          <button onClick={onSOS}
            className="h-14 bg-blue-700 hover:bg-blue-600 rounded-xl font-mono font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            <HelpCircle className="w-5 h-5" /> Help
          </button>
        </div>
      )}
    </div>
  );
}
