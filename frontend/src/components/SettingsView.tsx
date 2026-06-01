import React, { useState } from "react";
import { 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Activity, 
  Key, 
  RefreshCw, 
  Sparkles, 
  Cpu, 
  Layers, 
  Wifi, 
  Check, 
  Info, 
  Lock 
} from "lucide-react";

export default function SettingsView() {
  const [dedupMode, setDedupMode] = useState<string>("exact");
  const [throttleLimit, setThrottleLimit] = useState<number>(100);
  const [geminiPiped, setGeminiPiped] = useState<boolean>(true);
  const [routingAlgorithm, setRoutingAlgorithm] = useState<string>("gemini");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      triggerToast("GRID_CONFIGURATION_FLUSHED_SUCCESSFULLY");
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#10b981] text-white border-2 border-black font-mono font-black text-[10px] px-5 py-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-2 uppercase tracking-widest animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black pb-5 gap-4">
        <div>
          <span className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase font-mono">Preferences</span>
          <h3 className="font-extrabold text-black text-xl tracking-tight leading-none mt-1 uppercase">
            System Preferences Node
          </h3>
          <p className="text-[12px] text-slate-600 font-medium leading-normal mt-2.5 font-mono uppercase">
            Configure automated deduplication limits, ledger metrics, and server-side secret API keys.
          </p>
        </div>
      </section>

      {/* Main Settings Grid */}
      <form onSubmit={handleSavePreferences} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Primary Settings Form config (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Storage Intelligence parameters */}
          <div className="geo-cell bg-white p-6 space-y-5">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              1. Storage Intelligence Tuning
            </h4>

            <div className="space-y-4">
              {/* Option: Deduplication scan depth */}
              <div>
                <label className="block text-[10px] font-mono font-extrabold text-slate-550 uppercase tracking-widest mb-1.5">
                  Deduplication Scan Depth
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "exact", label: "Exact File Match", desc: "Compares filename and raw byte sizes for fast indexing." },
                    { id: "deephash", label: "Deep Content Hash", desc: "Uses cryptographic node checksums to spot identical folders." },
                    { id: "smart", label: "Smart Metadata Match", desc: "Employs intelligent heuristics to identify approximate duplicates." }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDedupMode(opt.id)}
                      className={`text-left p-3 border cursor-pointer flex flex-col justify-between transition-colors height-[100px] ${
                        dedupMode === opt.id 
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(59,130,246,1)]" 
                          : "border-slate-350 bg-white text-slate-800 hover:border-black hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-extrabold uppercase tracking-tight">{opt.label}</div>
                        <p className={`text-[9.5px] mt-1.5 leading-snug font-mono ${dedupMode === opt.id ? "text-slate-350" : "text-slate-500"}`}>
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option: Routing Algorithm */}
              <div className="pt-2">
                <label className="block text-[10px] font-mono font-extrabold text-slate-550 uppercase tracking-widest mb-1.5">
                  Automated Routing Algorithm
                </label>
                <select
                  value={routingAlgorithm}
                  onChange={(e) => setRoutingAlgorithm(e.target.value)}
                  className="w-full h-10 border-2 border-black bg-white px-3 text-xs font-bold uppercase tracking-wide focus:outline-none focus:bg-slate-50 cursor-pointer"
                >
                  <option value="heuristic">STANDARD HEURISTIC BALANCER</option>
                  <option value="gemini">GEMINI 2.5 FLASH DYNAMIC ROUTER</option>
                  <option value="quantum">QUANTUM CELL STORAGE BOUNDS MATCH</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-mono leading-normal uppercase">
                  Sets which cluster selection optimizer assigns uploaded files to different target nodes automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Ledger and Logging limits */}
          <div className="geo-cell bg-white p-6 space-y-4">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 shrink-0" />
              2. Interface & Telemetry Constraints
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-extrabold text-slate-550 uppercase tracking-widest mb-1.5">
                  Ledger Logs Multiplier
                </label>
                <select
                  value={throttleLimit}
                  onChange={(e) => setThrottleLimit(Number(e.target.value))}
                  className="w-full h-10 border-2 border-black bg-white px-3 text-xs font-bold font-mono uppercase tracking-wide focus:outline-none cursor-pointer"
                >
                  <option value={50}>50 Record Buffers</option>
                  <option value={100}>100 Record Buffers (Default)</option>
                  <option value={250}>250 Record Buffers</option>
                  <option value={500}>500 Record Buffers</option>
                </select>
                <p className="text-[9.5px] text-slate-500 mt-1 font-mono uppercase leading-tight">
                  Limits persistent index ledger records loaded in local storage to prevent interface stuttering.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-extrabold text-slate-550 uppercase tracking-widest mb-1.5">
                  Intelligence Sync Engine
                </label>
                <div className="h-10 border-2 border-black px-3 bg-slate-50 flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-700 uppercase tracking-tight">
                    API Sync Loop
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 border border-black animate-pulse" />
                    <span className="text-[10px] font-mono font-black text-emerald-600 uppercase">STANDBY</span>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-1 font-mono uppercase leading-tight">
                  Status of concurrent websocket connections to S3 metadata buckets.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Gemini Credentials info section */}
          <div className="geo-cell bg-white p-6 space-y-4">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-600 shrink-0" />
              3. Cloud Credentials & API Keys
            </h4>

            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-black p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9.5px] bg-[#2563eb] text-white border border-black font-extrabold font-mono px-2 py-0.5 tracking-widest uppercase">
                      GEMINI_API_KEY
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">Secure Root Secret</span>
                  </div>
                  <p className="text-[11.5px] text-slate-600 font-bold leading-normal mt-2">
                    Server Routing pipeline verified. AI Advisor operates inside workspace.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 bg-emerald-100 text-[#10b981] border border-black px-2.5 py-1 font-mono text-[9px] font-black uppercase">
                  <Lock className="w-3 h-3" /> SECURED
                </div>
              </div>

              <div className="bg-slate-50 border border-black p-4 space-y-2.5">
                <div className="flex items-start gap-2.5 text-[10px] text-slate-700 font-mono tracking-tight uppercase leading-relaxed">
                  <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <span>
                    To rotate API tokens or update secret credentials, deploy custom variable overrides through your main workspace panel in developer settings, and tap "Sync Cloud Vault".
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Trigger Row */}
          <div>
            <button
              type="submit"
              disabled={isUpdating}
              className="geo-btn-primary w-full sm:w-auto h-11 px-8 flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  FLUSHING COMPILER STATE...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4 mr-1" />
                  SAVE ACTIVE GRID PREFERENCES
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Col: Geometric Stats card (1 col) */}
        <div className="space-y-6">
          <div className="geo-cell bg-white p-6 space-y-4">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-black shrink-0" />
              Active System Profile
            </h4>

            {/* Profile Info Lines */}
            <div className="space-y-3 font-mono text-[11px]">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase">Host Name</span>
                <span className="font-extrabold text-black">BIND-ROUTER-0</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase">Deployment</span>
                <span className="font-extrabold text-[#2563eb]">GCP CLOUD RUN</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase">Version</span>
                <span className="font-extrabold text-black">v1.2.6-HARDENED</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 uppercase">Geo Balance IP</span>
                <span className="font-extrabold text-black">0.0.0.0:3000</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400 uppercase">API Status</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500" />
                  <span className="font-extrabold text-emerald-600 uppercase">HEALTHY</span>
                </div>
              </div>
            </div>

            {/* Graphic Stripe Element */}
            <div className="h-6 w-full border border-black relative overflow-hidden">
              <div className="absolute inset-0 geo-stripes opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-black text-black tracking-widest uppercase">
                HARDENED METRICS NODE
              </div>
            </div>
          </div>

          <div className="geo-cell bg-slate-900 text-white p-6 space-y-4 shadow-[4px_4px_0px_rgba(59,130,246,1)]">
            <h4 className="font-black text-[12px] text-white uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              COMPLIANCE AUDIT
            </h4>
            <p className="text-[11px] text-slate-400 leading-normal font-mono uppercase">
              ALL REGISTERED DIRECTORIES Sourced From OAuth scopes ARE INDEXED BY CLIENT-SIDED IDENTIFIERS AND ROUTED VIA SECURITY MIDDLEWARES. NO SENSITIVE USER DATA EXPORTS THE LOCAL PREMISE S3 INSTANCE.
            </p>
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-[#3b82f6] font-extrabold">
              <Wifi className="w-3.5 h-3.5" /> SECURED INTEGRITY ASSURANCE
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
