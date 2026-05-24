import { useState, useEffect } from "react";
import WorkerLogin from "./WorkerLogin";
import WorkerHome from "./WorkerHome";
import TaskDetail from "./TaskDetail";
import SafeRoute from "./SafeRoute";
import ZoneBriefing from "./ZoneBriefing";
import WorkerSOS from "./WorkerSOS";

type Screen = "login" | "home" | "task" | "route" | "briefing" | "sos";

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

interface WorkerSession {
  id: number;
  name: string;
  zone: string;
}

export default function WorkerApp() {
  const [screen, setScreen] = useState<Screen>("login");
  const [session, setSession] = useState<WorkerSession | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<unknown[]>([]);

  // Restore session from localStorage
  useEffect(() => {
    const remId = localStorage.getItem("worker_remembered_id");
    const remPin = localStorage.getItem("worker_remembered_pin");
    if (remId && remPin) {
      const name = localStorage.getItem(`worker_name_${remId}`) || `Worker ${remId}`;
      setSession({ id: parseInt(remId), name, zone: "Zone A" });
      setScreen("home");
    }
  }, []);

  // Sync offline queue when back online
  useEffect(() => {
    const syncQueue = async () => {
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      if (queue.length === 0) return;
      const token = localStorage.getItem("siteiq_token") || localStorage.getItem("siteiq_worker_token");
      const remaining: unknown[] = [];
      for (const item of queue as Record<string, unknown>[]) {
        try {
          if (item.type === "task_status") {
            const resp = await fetch(`/api/tasks/${item.taskId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: item.status, block_reason: item.reason }),
            });
            if (!resp.ok) remaining.push(item);
          } else if (item.type === "sos") {
            await fetch("/api/alerts", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                type: "sos", severity: "critical",
                message: `SOS (synced offline): ${item.workerName} in ${item.zone}`,
                zone: item.zone, acknowledged: false,
              }),
            });
          }
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem("offline_queue", JSON.stringify(remaining));
      setOfflineQueue(remaining);
    };

    window.addEventListener("online", syncQueue);
    syncQueue();
    return () => window.removeEventListener("online", syncQueue);
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const handleLogin = (workerId: number, workerName: string) => {
    setSession({ id: workerId, name: workerName, zone: "Zone A" });
    setScreen("home");
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setScreen("task");
  };

  const handleLogout = () => {
    localStorage.removeItem("worker_remembered_id");
    localStorage.removeItem("worker_remembered_pin");
    setSession(null);
    setScreen("login");
  };

  // Offline banner (shown on all screens except login)
  const OfflineBanner = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 border-b border-amber-500/60 px-4 py-2 flex items-center justify-center gap-2 text-xs font-mono text-amber-300">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      You are offline — actions will sync when connected
      {offlineQueue.length > 0 && <span className="text-amber-400">({offlineQueue.length} queued)</span>}
    </div>
  );

  switch (screen) {
    case "login":
      return <WorkerLogin onLogin={handleLogin} />;

    case "home":
      return (
        <div>
          {!navigator.onLine && <OfflineBanner />}
          <div style={!navigator.onLine ? { paddingTop: "36px" } : {}}>
            <WorkerHome
              workerId={session!.id}
              workerName={session!.name}
              onSelectTask={handleSelectTask}
            />
            {/* Quick nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0d1117]/95 backdrop-blur border-t border-[#1f2937] px-4 py-3 flex gap-2">
              <button
                onClick={() => setScreen("briefing")}
                className="flex-1 h-12 border border-[#1f2937] rounded-xl font-mono text-xs text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 uppercase tracking-wider transition-all active:scale-95"
              >
                Zone Brief
              </button>
              <button
                onClick={() => setScreen("route")}
                className="flex-1 h-12 border border-[#1f2937] rounded-xl font-mono text-xs text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 uppercase tracking-wider transition-all active:scale-95"
              >
                Safe Route
              </button>
              <button
                onClick={() => setScreen("sos")}
                className="h-12 px-5 bg-red-700 hover:bg-red-600 rounded-xl font-mono text-xs text-white font-bold uppercase tracking-wider transition-all active:scale-95"
              >
                SOS
              </button>
              <button
                onClick={handleLogout}
                className="h-12 px-4 border border-[#1f2937] rounded-xl font-mono text-xs text-gray-600 hover:text-gray-400 uppercase tracking-wider transition-all active:scale-95"
              >
                Out
              </button>
            </div>
          </div>
        </div>
      );

    case "task":
      return (
        <div>
          {!navigator.onLine && <OfflineBanner />}
          <div style={!navigator.onLine ? { paddingTop: "36px" } : {}}>
            <TaskDetail
              task={selectedTask!}
              workerName={session!.name}
              onBack={() => setScreen("home")}
              onSOS={() => setScreen("sos")}
            />
          </div>
        </div>
      );

    case "route":
      return (
        <SafeRoute
          workerZone={session?.zone || "Zone A"}
          targetZone={selectedTask?.zone || "Zone B"}
          onBack={() => setScreen(selectedTask ? "task" : "home")}
        />
      );

    case "briefing":
      return (
        <ZoneBriefing
          zone={selectedTask?.zone || session?.zone || "Zone A"}
          onBack={() => setScreen(selectedTask ? "task" : "home")}
          onConfirm={() => setScreen(selectedTask ? "task" : "home")}
        />
      );

    case "sos":
      return (
        <WorkerSOS
          workerName={session!.name}
          workerZone={selectedTask?.zone || session?.zone || "Zone A"}
          onBack={() => setScreen(selectedTask ? "task" : "home")}
        />
      );

    default:
      return <WorkerLogin onLogin={handleLogin} />;
  }
}
