import { useState } from "react";
import { Activity, Globe } from "lucide-react";

const LANGUAGES: Record<string, { name: string; pin: string; id: string; login: string; remember: string; demo: string }> = {
  en: { name: "English",  pin: "Enter PIN",   id: "Worker ID", login: "LOG IN",  remember: "Remember me", demo: "Demo Login" },
  ur: { name: "اردو",     pin: "پن درج کریں", id: "کارکن ID",  login: "لاگ ان",  remember: "یاد رکھیں",  demo: "ڈیمو لاگ ان" },
  ar: { name: "عربي",     pin: "أدخل الرقم",  id: "رقم العامل",login: "دخول",    remember: "تذكرني",      demo: "دخول تجريبي" },
  hi: { name: "हिंदी",    pin: "PIN दर्ज करें",id: "कर्मी ID",  login: "लॉग इन", remember: "याद रखें",   demo: "डेमो लॉगिन" },
};

interface WorkerLoginProps {
  onLogin: (workerId: number, workerName: string) => void;
}

export default function WorkerLogin({ onLogin }: WorkerLoginProps) {
  const [lang, setLang] = useState<keyof typeof LANGUAGES>("en");
  const [pin, setPin] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = LANGUAGES[lang];

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) setPin(p => p + digit);
  };
  const handlePinDelete = () => setPin(p => p.slice(0, -1));

  const handleLogin = async () => {
    if (!workerId.trim()) { setError("Enter your Worker ID"); return; }
    if (pin.length < 4) { setError("Enter your 4-digit PIN"); return; }
    setLoading(true);
    setError("");
    try {
      const stored = localStorage.getItem(`worker_pin_${workerId.trim()}`);
      if (stored && stored === pin) {
        const name = localStorage.getItem(`worker_name_${workerId.trim()}`) || `Worker ${workerId}`;
        if (remember) {
          localStorage.setItem("worker_remembered_id", workerId.trim());
          localStorage.setItem("worker_remembered_pin", pin);
        }
        onLogin(parseInt(workerId), name);
        return;
      }
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `worker${workerId.trim()}@tower.com`, password: `pin${pin}` }),
      });
      if (!resp.ok) throw new Error("Invalid credentials");
      const data = await resp.json();
      localStorage.setItem("siteiq_worker_token", data.token);
      localStorage.setItem(`worker_pin_${workerId.trim()}`, pin);
      localStorage.setItem(`worker_name_${workerId.trim()}`, data.user?.email?.split("@")[0] || `Worker ${workerId}`);
      if (remember) {
        localStorage.setItem("worker_remembered_id", workerId.trim());
        localStorage.setItem("worker_remembered_pin", pin);
      }
      onLogin(parseInt(workerId), data.user?.email?.split("@")[0] || `Worker ${workerId}`);
    } catch {
      setError("Invalid Worker ID or PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    localStorage.setItem("worker_pin_1", "1234");
    localStorage.setItem("worker_name_1", "Jake Morrison");
    setWorkerId("1");
    setPin("1234");
    setTimeout(() => onLogin(1, "Jake Morrison"), 300);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center px-4 relative">
      {/* Language toggle */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Globe className="w-4 h-4 text-cyan-400" />
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          className="bg-[#111827] border border-[#1f2937] text-cyan-300 text-sm rounded px-2 py-1 font-mono"
        >
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <option key={k} value={k}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mb-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-pulse" />
        </div>
        <h1 className="text-2xl font-mono font-bold text-white tracking-widest uppercase">
          SITE<span className="text-cyan-400">IQ</span>
        </h1>
        <p className="text-xs font-mono text-gray-500 mt-1 uppercase tracking-widest">Worker Portal</p>
      </div>

      {/* Worker ID */}
      <div className="w-full max-w-xs mb-4">
        <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">{t.id}</label>
        <input
          type="text"
          inputMode="numeric"
          value={workerId}
          onChange={e => setWorkerId(e.target.value.replace(/\D/g, ""))}
          className="w-full h-14 px-4 bg-[#111827] border border-[#1f2937] rounded-lg text-white font-mono text-xl text-center focus:border-cyan-500 focus:outline-none"
          placeholder="e.g. 1"
        />
      </div>

      {/* PIN display */}
      <div className="w-full max-w-xs mb-6">
        <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">{t.pin}</label>
        <div className="flex gap-3 justify-center">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-mono transition-all ${
                pin.length > i
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                  : "border-[#1f2937] bg-[#111827] text-gray-600"
              }`}
            >
              {pin.length > i ? "●" : "○"}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="w-full max-w-xs mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg text-red-400 text-sm font-mono text-center">
          {error}
        </div>
      )}

      {/* PIN keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
          <button
            key={i}
            onClick={() => d === "⌫" ? handlePinDelete() : d ? handlePinPress(d) : undefined}
            disabled={!d && d !== "0"}
            className={`h-16 rounded-xl font-mono text-2xl font-semibold transition-all active:scale-95 ${
              d === "⌫"
                ? "bg-[#1f2937] text-red-400 border border-red-900/40 active:bg-red-900/20"
                : d
                ? "bg-[#111827] text-white border border-[#1f2937] active:bg-cyan-900/20 active:border-cyan-500"
                : "opacity-0 pointer-events-none"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Remember me */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setRemember(r => !r)}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
            remember ? "border-cyan-500 bg-cyan-500" : "border-[#1f2937] bg-[#111827]"
          }`}
        >
          {remember && <span className="text-white text-xs font-bold">✓</span>}
        </button>
        <span className="text-sm font-mono text-gray-400">{t.remember}</span>
      </div>

      {/* Login button */}
      <button
        onClick={handleLogin}
        disabled={loading || pin.length < 4}
        className="w-full max-w-xs h-14 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-mono font-bold uppercase tracking-widest text-sm rounded-xl transition-all active:scale-95 mb-3"
      >
        {loading ? "..." : t.login}
      </button>

      {/* Demo login */}
      <button
        onClick={handleDemo}
        className="w-full max-w-xs h-12 border border-[#1f2937] text-gray-400 hover:text-cyan-400 hover:border-cyan-500/40 font-mono text-xs uppercase tracking-wider rounded-xl transition-all"
      >
        {t.demo}
      </button>
    </div>
  );
}
