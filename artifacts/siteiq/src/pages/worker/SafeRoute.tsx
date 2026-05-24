import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Navigation, AlertTriangle } from "lucide-react";

interface SafeRouteProps {
  workerZone: string;
  targetZone: string;
  onBack: () => void;
}

const ZONE_DEFS = [
  { id: "Zone A", x: 20,  y: 20,  w: 130, h: 130, color: "#06b6d4" },
  { id: "Zone B", x: 170, y: 20,  w: 130, h: 130, color: "#f59e0b" },
  { id: "Zone C", x: 20,  y: 170, w: 130, h: 130, color: "#8b5cf6" },
  { id: "Zone D", x: 170, y: 170, w: 130, h: 130, color: "#ef4444" },
];

const HAZARD_ZONES = [
  { x: 95, y: 85, r: 18, label: "Swing Zone" },
  { x: 160, y: 160, r: 14, label: "Hazard" },
];

const ROUTE_INSTRUCTIONS: Record<string, Record<string, string[]>> = {
  "Zone A": {
    "Zone B": ["Head east along Path 1", "Pass through gate checkpoint", "Turn right at marker B2", "Arrive at Zone B"],
    "Zone C": ["Head south along Path 2", "Turn left at staircase C", "Follow corridor to Zone C", "Arrive at Zone C"],
    "Zone D": ["Head south to Path 2", "Turn right, continue east", "Pass Zone B/C junction", "Arrive at Zone D"],
  },
  "Zone B": {
    "Zone A": ["Head west along Path 1", "Pass gate checkpoint", "Turn left at marker A1", "Arrive at Zone A"],
    "Zone C": ["Head southwest via central path", "Pass Zone A/C junction", "Turn south at marker C1", "Arrive at Zone C"],
    "Zone D": ["Head south along east corridor", "Pass through gate D1", "Arrive at Zone D"],
  },
  "Zone C": {
    "Zone A": ["Head north along Path 2", "Turn right at staircase B", "Follow path to Zone A", "Arrive at Zone A"],
    "Zone B": ["Head northeast via central path", "Turn right at marker B3", "Arrive at Zone B"],
    "Zone D": ["Head east along Path 3", "Continue past Zone C east wall", "Arrive at Zone D"],
  },
  "Zone D": {
    "Zone A": ["Head north along east corridor", "Turn west at junction J2", "Continue through Zone B", "Head west to Zone A", "Arrive at Zone A"],
    "Zone B": ["Head north along gate D1", "Turn left at junction J1", "Arrive at Zone B"],
    "Zone C": ["Head west along Path 3", "Pass Zone D west boundary", "Arrive at Zone C"],
  },
};

function getCenterXY(zone: string): { x: number; y: number } {
  const z = ZONE_DEFS.find(z => z.id === zone);
  if (!z) return { x: 150, y: 150 };
  return { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}

function getSafeRoutePoints(from: string, to: string): { x: number; y: number }[] {
  const start = getCenterXY(from);
  const end = getCenterXY(to);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const jog = from === to ? [] : [{ x: midX + 5, y: midY - 10 }];
  return [start, ...jog, end];
}

export default function SafeRoute({ workerZone, targetZone, onBack }: SafeRouteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentZone, setCurrentZone] = useState(workerZone);
  const [destZone, setDestZone] = useState(targetZone);
  const [newHazard, setNewHazard] = useState(false);

  const instructions = ROUTE_INSTRUCTIONS[currentZone]?.[destZone] || [
    `Navigate from ${currentZone} to ${destZone}`,
    "Follow site safety signs",
    "Stay on marked paths",
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < W; gx += 20) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 20) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Zones
    ZONE_DEFS.forEach(z => {
      const isTarget  = z.id === destZone;
      const isCurrent = z.id === currentZone;
      ctx.fillStyle = isCurrent ? z.color + "22" : isTarget ? z.color + "33" : "#111827";
      ctx.strokeStyle = isTarget || isCurrent ? z.color : "#374151";
      ctx.lineWidth = isTarget || isCurrent ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(z.x, z.y, z.w, z.h, 4);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = isTarget ? z.color : isCurrent ? z.color + "cc" : "#6b7280";
      ctx.font = `bold ${isTarget ? 13 : 11}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(z.id, z.x + z.w / 2, z.y + z.h / 2);
    });

    // Hazard zones (red translucent circles)
    HAZARD_ZONES.forEach(h => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ef444433";
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ef4444";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚠", h.x, h.y + 3);
    });

    // Safe route
    if (currentZone !== destZone) {
      const pts = getSafeRoutePoints(currentZone, destZone);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Worker (blue dot)
    const wc = getCenterXY(currentZone);
    ctx.beginPath();
    ctx.arc(wc.x, wc.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("YOU", wc.x, wc.y + 3.5);

    // Destination (green flag)
    if (currentZone !== destZone) {
      const dc = getCenterXY(destZone);
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#86efac";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DEST", dc.x, dc.y + 3.5);
    }
  }, [currentZone, destZone, newHazard]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white pb-6">
      <div className="bg-[#0d1117] border-b border-[#1f2937] px-4 pt-10 pb-4 sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-cyan-400 font-mono text-sm mb-3 active:opacity-70">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="font-mono font-bold text-white">Safe Route</h1>
        <p className="text-xs font-mono text-gray-400 mt-0.5">{currentZone} → {destZone}</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Zone selectors */}
        <div className="grid grid-cols-2 gap-3">
          {(["From", "To"] as const).map((label, i) => {
            const val = i === 0 ? currentZone : destZone;
            const setter = i === 0 ? setCurrentZone : setDestZone;
            return (
              <div key={label}>
                <p className="text-xs font-mono text-gray-500 mb-1">{label}</p>
                <select value={val} onChange={e => setter(e.target.value)}
                  className="w-full h-10 px-3 bg-[#111827] border border-[#1f2937] rounded-lg text-white font-mono text-sm focus:border-cyan-500 focus:outline-none">
                  {ZONE_DEFS.map(z => <option key={z.id} value={z.id}>{z.id}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        {/* Canvas map */}
        <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl overflow-hidden">
          <canvas ref={canvasRef} width={320} height={320} className="w-full" />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> You</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Destination</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500 inline-block" /> Hazard</span>
        </div>

        {/* Turn-by-turn directions */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-4 h-4 text-cyan-400" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Directions</p>
          </div>
          <ol className="space-y-2">
            {instructions.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-300 font-mono leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* New hazard alert simulation */}
        <button onClick={() => setNewHazard(h => !h)}
          className="w-full h-12 border border-amber-500/40 rounded-xl font-mono text-amber-400 text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
          <AlertTriangle className="w-4 h-4" />
          {newHazard ? "Hazard cleared — route updated" : "Simulate new hazard on route"}
        </button>
      </div>
    </div>
  );
}
