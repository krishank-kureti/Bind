import React, { useState } from "react";
import { 
  Globe, 
  User, 
  Terminal, 
  Check, 
  Send, 
  RefreshCw, 
  HelpCircle, 
  ChevronRight, 
  ShieldAlert, 
  Cpu 
} from "lucide-react";

export default function SupportView() {
  const [senderName, setSenderName] = useState<string>("");
  const [sector, setSector] = useState<string>("API Sync Route");
  const [severity, setSeverity] = useState<string>("Normal");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dispatchReceipt, setDispatchReceipt] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Diagnostic states
  const [diagnosticLoading, setDiagnosticLoading] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);

  const faqs = [
    {
      id: "faq-1",
      icon: Globe,
      color: "text-blue-500",
      query: "How does BIND Unified Storage work?",
      answer: "BIND acts as a highly optimized metadata pipeline. Instead of uploading heavy duplicate binaries directly, it indexes directory boundaries, maps physical layout offsets, and aggregates metadata into unified indices across multiple accounts. This ensures maximum storage density without duplicate clutter."
    },
    {
      id: "faq-2",
      icon: User,
      color: "text-purple-500",
      query: "What provider nodes can be bound to our network?",
      answer: "We support seamless connections to Google Drive API scopes, Dropbox directories, Microsoft OneDrive Graph endpoints, Amazon AWS S3 buckets, and custom Box enterprise servers. Individual nodes are separated cleanly through local cryptographic identifiers."
    },
    {
      id: "faq-3",
      icon: Terminal,
      color: "text-indigo-500",
      query: "How do we resolve persistent Authorization Failures?",
      answer: "Navigate to the Accounts page under storage connections and locate files marked with red authorization issues. Click re-authorize connection to quickly refresh OAuth 2.0 access tokens securely. Metadata catalogs will synchronize automatically in under 15 seconds."
    }
  ];

  const handleDispatchTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !senderName) {
      setToastMessage("ERROR: PLEASE FILL ALL REQUIREMENT NODES");
      setTimeout(() => setToastMessage(null), 3050);
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const generatedId = `BND-TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      setDispatchReceipt({
        id: generatedId,
        senderName,
        sector,
        severity,
        timestamp: new Date().toISOString(),
        tracker: "PENDING_DISPATCHER_ROUTING"
      });
      setSenderName("");
      setDescription("");
      setToastMessage("SUPPORT_TICKET_ROUTED_TO_GRID_ADMIN");
      setTimeout(() => setToastMessage(null), 3000);
    }, 1500);
  };

  const runDiagnostics = () => {
    setDiagnosticLoading(true);
    setDiagnosticResult(null);
    setTimeout(() => {
      setDiagnosticLoading(false);
      const errors = [
        "GRID ALLOCATION STATUS: OPTIMAL (0 FAULTS DETECTED)",
        "OAUTH TOKEN CHAINS: HEALTHY",
        "INTELLIGENCE VECTOR INDEXER: ACTIVE (24 FLIGHT SCAN COMPLETED)"
      ];
      setDiagnosticResult(errors.join(" | "));
    }, 1800);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2563eb] text-white border-2 border-black font-mono font-black text-[10px] px-5 py-3 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-2 uppercase tracking-widest animate-bounce">
          <ChevronRight className="w-4 h-4 shrink-0 animate-pulse text-[#10b981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black pb-5 gap-4">
        <div>
          <span className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase font-mono">Support and Manual</span>
          <h3 className="font-extrabold text-black text-xl tracking-tight leading-none mt-1 uppercase">
            Nodal Support Dispatch
          </h3>
          <p className="text-[12px] text-slate-600 font-medium leading-normal mt-2.5 font-mono uppercase">
            Run real-time network tests, read indexing documentation, and submit system repair tickets.
          </p>
        </div>
      </section>

      {/* Primary FAQ Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FAQ Column (Left - 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="geo-cell bg-white p-6 space-y-5">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-black" />
              Frequently Asked Questions
            </h4>
            
            <div className="space-y-4">
              {faqs.map((faq) => {
                const Icon = faq.icon;
                return (
                  <div key={faq.id} className="border border-black p-5 bg-slate-50/70 select-none">
                    <h5 className="font-extrabold text-xs uppercase tracking-wider text-black flex items-center gap-2.5 mb-2.5">
                      <div className="p-1 border border-black bg-black text-white rounded-none shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      {faq.query}
                    </h5>
                    <p className="text-[11.5px] text-slate-650 leading-relaxed font-sans font-medium pl-1">
                      {faq.answer}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diagnostics Test Box */}
          <div className="geo-cell bg-black text-white p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 geo-stripes-slate opacity-15 pointer-events-none" />
            
            <h4 className="font-black text-[12px] text-white uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
              Real-time System Diagnostics
            </h4>
            <p className="text-[11px] text-slate-400 font-mono uppercase leading-relaxed">
              Test active storage clusters, credentials, and check indexing node status dynamically.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={runDiagnostics}
                disabled={diagnosticLoading}
                className="geo-btn-primary bg-white text-black border-white hover:bg-slate-200 shadow-white self-stretch sm:self-auto shrink-0"
              >
                {diagnosticLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    RUNNING CHECKS...
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5 mr-1.5" />
                    RUN DIAGNOSTICS
                  </>
                )}
              </button>
              
              {diagnosticLoading && (
                <span className="text-[9.5px] font-mono text-amber-400 uppercase tracking-widest animate-pulse">
                  Querying standard network boundaries...
                </span>
              )}

              {diagnosticResult && (
                <div className="flex-1 bg-slate-900 border border-slate-700 p-3 font-mono text-[9px] text-[#22c55e] uppercase tracking-wide leading-tight break-all">
                  {diagnosticResult}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Support Ticket Dispatch Form (Right - 1 Col) */}
        <div>
          <div className="geo-cell bg-white p-6 space-y-4">
            <h4 className="font-extrabold text-[12px] text-black uppercase tracking-widest border-b border-black pb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600 shrink-0" />
              Support Dispatcher
            </h4>

            <form onSubmit={handleDispatchTicket} className="space-y-4 text-xs">
              {/* Name field */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Your Name / Operator</label>
                <input
                  type="text"
                  placeholder="e.g. Space Admin J"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 font-semibold text-[11px] uppercase placeholder:lowercase"
                />
              </div>

              {/* Sector Dropdown */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Problem Sector</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 bg-white font-bold uppercase text-[11px] cursor-pointer"
                >
                  <option value="API Sync Route">API Sync Route</option>
                  <option value="OAuth Token Chain">OAuth Token Chain</option>
                  <option value="Intelligence Vector">Intelligence Vector</option>
                  <option value="File Storage Balance">File Storage Balance</option>
                  <option value="Other">Other / Miscellaneous</option>
                </select>
              </div>

              {/* Severity Priority */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Severity Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Normal", "Elevated", "Critical"].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`h-9 border text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                        severity === sev 
                          ? "bg-black text-white border-black shadow-[1.5px_1.5px_0px_rgba(59,130,246,1)]" 
                          : "bg-white text-black border-slate-350 hover:border-black"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description box */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Nodal Message Detail</label>
                <textarea
                  rows={4}
                  placeholder="State the connection failure or indexing deviation context here..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border-2 border-black focus:outline-none rounded-none p-3 font-medium text-[11px]"
                />
              </div>

              {/* Action Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="geo-btn-primary w-full h-11 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    DISPATCHING NODAL ROUTING...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1" />
                    DISPATCH SUPPORT TICKET
                  </>
                )}
              </button>
            </form>

            {/* Support Ticket Dispatch Receipt */}
            {dispatchReceipt && (
              <div className="mt-4 p-4 border border-black bg-slate-50 space-y-1.5 font-mono text-[9.5px] uppercase select-text">
                <div className="font-extrabold text-black font-sans text-[10px] border-b border-black pb-1 mb-1.5 flex items-center gap-1.5 ">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600" /> Ticket routed successfullyReceipt
                </div>
                <div><span className="text-slate-400">Ticket ref:</span> <strong className="text-black font-black selection:bg-yellow-300">{dispatchReceipt.id}</strong></div>
                <div><span className="text-slate-400">Operator:</span> <span className="font-bold">{dispatchReceipt.senderName}</span></div>
                <div><span className="text-slate-400">Sector:</span> <span className="font-bold">{dispatchReceipt.sector}</span></div>
                <div><span className="text-slate-400">Severity:</span> <span className="font-bold text-red-650">{dispatchReceipt.severity}</span></div>
                <div><span className="text-slate-400">Queued router:</span> <span className="text-slate-500">{dispatchReceipt.tracker}</span></div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
