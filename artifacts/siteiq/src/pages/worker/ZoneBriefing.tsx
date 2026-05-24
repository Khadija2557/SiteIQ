import { useState } from "react";
import { ArrowLeft, AlertTriangle, Shield, Cpu, DoorOpen, CheckSquare, Square, ChevronRight } from "lucide-react";

interface ZoneBriefingProps {
  zone: string;
  onBack: () => void;
  onConfirm: () => void;
}

const ZONE_DATA: Record<string, {
  hazards: { severity: string; description: string }[];
  ppe: string[];
  machinery: string[];
  exits: { label: string; direction: string; distance: string }[];
}> = {
  "Zone A": {
    hazards: [
      { severity: "critical", description: "Unsecured load above walkway near Crane Alpha" },
      { severity: "critical", description: "Exposed live wires at junction box 3" },
    ],
    ppe: ["Hard Hat (Class E)", "Safety Vest (Class 3)", "Steel-toe boots", "Safety glasses", "Hearing protection"],
    machinery: ["Crane Alpha — operating (85% utilization)", "Risk: swing zone radius 20m"],
    exits: [
      { label: "Exit A", direction: "North", distance: "25m" },
      { label: "Exit B", direction: "West", distance: "40m" },
    ],
  },
  "Zone B": {
    hazards: [
      { severity: "high", description: "Fuel storage proximity to hot-work — fire risk" },
      { severity: "high", description: "Forklift operating in pedestrian corridor" },
    ],
    ppe: ["Hard Hat", "Safety Vest (Class 2)", "Steel-toe boots", "Gloves (heat-resistant)", "Fire-rated clothing"],
    machinery: ["Forklift F1 — operating", "Crane Beta — idle (hydraulic warning active)"],
    exits: [
      { label: "Exit C", direction: "South", distance: "30m" },
      { label: "Exit D", direction: "East", distance: "50m" },
    ],
  },
  "Zone C": {
    hazards: [
      { severity: "high", description: "Water pooling on scaffolding platform level 3" },
      { severity: "high", description: "Workers in unventilated underground section" },
    ],
    ppe: ["Hard Hat", "Safety Vest", "Non-slip boots", "Gloves", "Dust mask (P2)"],
    machinery: ["Forklift F2 — maintenance mode (out of service)", "Mixer M1 — idle"],
    exits: [
      { label: "Exit E", direction: "North", distance: "20m" },
      { label: "Exit F", direction: "West", distance: "35m" },
    ],
  },
  "Zone D": {
    hazards: [
      { severity: "medium", description: "Worker observed without hard hat" },
      { severity: "low",    description: "Noise levels approaching 85dB near excavator" },
    ],
    ppe: ["Hard Hat", "Safety Vest", "Steel-toe boots", "Ear protection (85dB+)", "Gloves"],
    machinery: ["Excavator X1 — operating (90% utilization)", "Keep 10m clearance at all times"],
    exits: [
      { label: "Exit G", direction: "South", distance: "45m" },
      { label: "Exit H", direction: "North", distance: "60m" },
    ],
  },
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-900/30 border-red-500/50 text-red-300",
  high:     "bg-amber-900/20 border-amber-500/40 text-amber-300",
  medium:   "bg-yellow-900/20 border-yellow-500/30 text-yellow-300",
  low:      "bg-gray-800 border-gray-600 text-gray-300",
};

export default function ZoneBriefing({ zone, onBack, onConfirm }: ZoneBriefingProps) {
  const data = ZONE_DATA[zone] || ZONE_DATA["Zone A"];
  const [checkedPPE, setCheckedPPE] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const togglePPE = (item: string) =>
    setCheckedPPE(s => { const n = new Set(s); n.has(item) ? n.delete(item) : n.add(item); return n; });

  const allChecked = checkedPPE.size >= data.ppe.length;

  const handleConfirm = () => {
    setConfirmed(true);
    localStorage.setItem(`zone_briefing_${zone}_${Date.now()}`, JSON.stringify({
      zone, confirmedAt: new Date().toISOString(), ppe: Array.from(checkedPPE),
    }));
    setTimeout(onConfirm, 1500);
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <Shield className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="font-mono font-bold text-white text-xl">Briefing Confirmed</h2>
        <p className="text-gray-400 font-mono text-sm text-center">PPE compliance logged. Stay safe.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white pb-6">
      <div className="bg-[#0d1117] border-b border-[#1f2937] px-4 pt-10 pb-4 sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-cyan-400 font-mono text-sm mb-3 active:opacity-70">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="font-mono font-bold text-white text-xl">{zone}</h1>
        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-0.5">Zone Safety Briefing</p>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Active Hazards */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Active Hazards ({data.hazards.length})</p>
          </div>
          <div className="space-y-2">
            {data.hazards.map((h, i) => (
              <div key={i} className={`border rounded-xl p-3 ${SEVERITY_STYLE[h.severity]}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider shrink-0 mt-0.5 border rounded-full px-2 py-0.5 ${SEVERITY_STYLE[h.severity]}`}>
                    {h.severity}
                  </span>
                  <p className="text-sm leading-relaxed">{h.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PPE Checklist */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-cyan-400" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Required PPE — Tap to Confirm</p>
            <span className={`ml-auto text-xs font-mono ${allChecked ? "text-green-400" : "text-gray-500"}`}>
              {checkedPPE.size}/{data.ppe.length}
            </span>
          </div>
          <div className="space-y-2">
            {data.ppe.map(item => {
              const checked = checkedPPE.has(item);
              return (
                <button key={item} onClick={() => togglePPE(item)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] ${
                    checked ? "bg-green-900/20 border-green-500/40" : "bg-[#111827] border-[#1f2937]"
                  }`}>
                  {checked
                    ? <CheckSquare className="w-5 h-5 text-green-400 shrink-0" />
                    : <Square className="w-5 h-5 text-gray-600 shrink-0" />}
                  <span className={`font-mono text-sm ${checked ? "text-green-300" : "text-white"}`}>{item}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nearby Machinery */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Nearby Machinery</p>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl divide-y divide-[#1f2937]">
            {data.machinery.map((m, i) => (
              <div key={i} className="p-3 flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm font-mono text-gray-300">{m}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Exits */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DoorOpen className="w-4 h-4 text-green-400" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Emergency Exits</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.exits.map((e, i) => (
              <div key={i} className="bg-green-900/15 border border-green-500/30 rounded-xl p-3">
                <p className="font-mono font-bold text-green-400 text-sm">{e.label}</p>
                <p className="font-mono text-xs text-gray-400 mt-0.5">{e.distance} {e.direction}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!allChecked}
          className="w-full py-5 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl font-mono font-bold text-sm uppercase tracking-wider leading-tight transition-all active:scale-95 disabled:cursor-not-allowed"
        >
          {allChecked
            ? "I understand and I am wearing\nall required PPE"
            : `Check all PPE first (${data.ppe.length - checkedPPE.size} remaining)`}
        </button>
      </div>
    </div>
  );
}
