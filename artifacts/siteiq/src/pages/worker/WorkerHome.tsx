import { useState, useEffect } from "react";
import { WifiOff, ChevronRight, Clock, MapPin, Wrench, AlertTriangle, CheckCircle2, User } from "lucide-react";

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

interface WorkerHomeProps {
  workerId: number;
  workerName: string;
  onSelectTask: (task: Task) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "border-l-red-500 bg-red-900/10",
  high:     "border-l-amber-500 bg-amber-900/10",
  medium:   "border-l-cyan-500 bg-cyan-900/5",
  low:      "border-l-gray-600 bg-gray-900/5",
};
const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-900/50 text-red-400 border-red-500/40",
  high:     "bg-amber-900/50 text-amber-400 border-amber-500/40",
  medium:   "bg-cyan-900/50 text-cyan-400 border-cyan-500/40",
  low:      "bg-gray-800 text-gray-400 border-gray-600/40",
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  done:        <CheckCircle2 className="w-4 h-4 text-green-400" />,
  "in-progress":<div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />,
  todo:        <div className="w-4 h-4 rounded-full border-2 border-gray-600" />,
  blocked:     <AlertTriangle className="w-4 h-4 text-amber-400" />,
};

export default function WorkerHome({ workerId, workerName, onSelectTask }: WorkerHomeProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState<{ trade?: string; zone?: string }>({});
  const token = localStorage.getItem("siteiq_token") || localStorage.getItem("siteiq_worker_token");

  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchWorker();
  }, [workerId]);

  const fetchWorker = async () => {
    try {
      const resp = await fetch(`/api/workers/${workerId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) { const d = await resp.json(); setWorker(d); }
    } catch {}
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/tasks?assigned_worker_id=${workerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const myTasks = (data.tasks ?? data).filter((t: Task) => t.status !== "done");
        setTasks(myTasks);
        localStorage.setItem("worker_tasks_cache", JSON.stringify(myTasks));
      } else throw new Error();
    } catch {
      const cached = localStorage.getItem("worker_tasks_cache");
      if (cached) setTasks(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  const currentTask = tasks.find(t => t.status === "in-progress");
  const otherTasks  = tasks.filter(t => t.status !== "in-progress");

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white pb-8">
      {/* Header */}
      <div className="bg-[#0d1117] border-b border-[#1f2937] px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-mono font-semibold text-sm">{workerName}</p>
              <p className="text-xs text-gray-400 font-mono">{worker.trade || "Worker"} · {worker.zone || "On Site"}</p>
            </div>
          </div>
          {isOffline && (
            <div className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-500/40 rounded-full px-3 py-1">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono text-amber-400">OFFLINE</span>
            </div>
          )}
        </div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"short" })}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Current task */}
            {currentTask && (
              <div>
                <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-2">Current Task</p>
                <button
                  onClick={() => onSelectTask(currentTask)}
                  className="w-full text-left bg-[#111827] border-l-4 border-l-cyan-500 border border-cyan-500/20 rounded-xl p-4 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-mono font-semibold text-white text-base leading-tight">{currentTask.title}</h3>
                    <ChevronRight className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{currentTask.zone}</span>
                    {currentTask.estimated_minutes && (
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{currentTask.estimated_minutes}min</span>
                    )}
                    <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />{currentTask.tools_required.length} tools</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: "45%" }} />
                  </div>
                  <p className="text-xs font-mono text-cyan-400/70 mt-1">In progress — 45%</p>
                </button>
              </div>
            )}

            {/* Other tasks */}
            {otherTasks.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Up Next</p>
                <div className="space-y-3">
                  {otherTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`w-full text-left border-l-4 border border-[#1f2937]/60 rounded-xl p-4 active:scale-[0.98] transition-all ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.low}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {STATUS_ICON[task.status] || STATUS_ICON.todo}
                          <h3 className="font-mono font-medium text-white text-sm leading-tight">{task.title}</h3>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${PRIORITY_BADGE[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{task.zone}
                        </span>
                        {task.estimated_minutes && (
                          <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{task.estimated_minutes}min
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="font-mono text-white font-semibold">All done for today</p>
                <p className="text-sm text-gray-500 font-mono mt-1">No pending tasks assigned</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
