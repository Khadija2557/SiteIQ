import { useState, useEffect, useRef } from "react";
import { ArrowLeft, MapPin, Phone, DoorOpen } from "lucide-react";

interface WorkerSOSProps {
  workerName: string;
  workerZone: string;
  onBack: () => void;
}

const NEAREST_EXITS = [
  { label: "Exit A", direction: "North", distance: "25m" },
  { label: "Exit B", direction: "West",  distance: "40m" },
];

export default function WorkerSOS({ workerName, workerZone, onBack }: WorkerSOSProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef(3);

  const token = localStorage.getItem("siteiq_token") || localStorage.getItem("siteiq_worker_token");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  }, []);

  const startHold = () => {
    if (sent) return;
    setHolding(true);
    countRef.current = 3;
    setCountdown(3);
    holdTimer.current = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        clearInterval(holdTimer.current!);
        sendSOS();
      }
    }, 1000);
  };

  const endHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setHolding(false);
    setCountdown(3);
  };

  const sendSOS = async () => {
    setHolding(false);
    try {
      const body: Record<string, unknown> = {
        type: "sos",
        severity: "critical",
        message: `SOS EMERGENCY: ${workerName} requires immediate assistance in ${workerZone}`,
        zone: workerZone,
        acknowledged: false,
      };
      if (coords) {
        body.message += ` | GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      }
      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error();
      setSent(true);
    } catch {
      // Queue offline
      const queue = JSON.parse(localStorage.getItem("offline_queue") || "[]");
      queue.push({
        type: "sos",
        workerName,
        zone: workerZone,
        coords,
        ts: Date.now(),
      });
      localStorage.setItem("offline_queue", JSON.stringify(queue));
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center px-6 gap-6">
        <div className="w-28 h-28 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center animate-pulse">
          <Phone className="w-12 h-12 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="font-mono font-bold text-white text-2xl mb-2">Alert Sent</h2>
          <p className="text-red-400 font-mono text-base font-semibold">Help is coming</p>
          <p className="text-gray-400 font-mono text-sm mt-2">Supervisors have been notified</p>
          {coords && (
            <p className="text-xs font-mono text-gray-500 mt-2">
              GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Nearest exits */}
        <div className="w-full max-w-xs">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest text-center mb-3">Nearest Emergency Exits</p>
          <div className="space-y-2">
            {NEAREST_EXITS.map((e, i) => (
              <div key={i} className="bg-green-900/20 border border-green-500/40 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="font-mono font-bold text-green-300 text-sm">{e.label}</p>
                    <p className="font-mono text-xs text-gray-400">{e.distance} {e.direction}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-green-400 uppercase tracking-wider">GO NOW</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onBack}
          className="w-full max-w-xs h-14 border border-[#1f2937] rounded-xl font-mono text-gray-400 text-sm uppercase tracking-wider active:scale-95 transition-all">
          Back to Tasks
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#0d1117] border-b border-[#1f2937] px-4 pt-10 pb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-cyan-400 font-mono text-sm active:opacity-70">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* GPS coords */}
        <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          {coords
            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : "Getting GPS location..."}
        </div>

        <p className="font-mono text-gray-300 text-sm text-center">
          Zone: <strong className="text-white">{workerZone}</strong>
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-2 text-red-400 font-mono text-sm">
            {error}
          </div>
        )}

        {/* SOS button — 60% of screen width */}
        <div className="relative flex items-center justify-center">
          {holding && (
            <div
              className="absolute rounded-full border-4 border-red-500/40 animate-ping"
              style={{ width: "calc(60vw + 40px)", height: "calc(60vw + 40px)" }}
            />
          )}
          <button
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            className={`w-[60vw] h-[60vw] max-w-[280px] max-h-[280px] rounded-full flex flex-col items-center justify-center gap-2 font-mono font-black text-white uppercase tracking-widest select-none transition-all ${
              holding
                ? "bg-red-600 scale-95 shadow-[0_0_60px_rgba(239,68,68,0.8)]"
                : "bg-red-700 hover:bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
            }`}
            style={{ fontSize: "clamp(24px, 8vw, 48px)" }}
          >
            SOS
            {holding && (
              <span className="text-base font-mono font-normal text-red-200">
                {countdown}...
              </span>
            )}
          </button>
        </div>

        <p className="text-sm font-mono text-gray-400 text-center">
          {holding ? `Sending in ${countdown} second${countdown !== 1 ? "s" : ""}...` : "Hold 3 seconds to confirm emergency"}
        </p>

        {/* Emergency exits */}
        <div className="w-full">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest text-center mb-2">Nearest Emergency Exits</p>
          <div className="grid grid-cols-2 gap-2">
            {NEAREST_EXITS.map((e, i) => (
              <div key={i} className="bg-green-900/15 border border-green-500/30 rounded-xl p-3 text-center">
                <p className="font-mono font-bold text-green-400 text-sm">{e.label}</p>
                <p className="font-mono text-xs text-gray-400">{e.distance} {e.direction}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
