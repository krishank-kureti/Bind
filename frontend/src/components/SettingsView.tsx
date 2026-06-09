import React, { useState } from "react";
import { Settings, ToggleLeft, ToggleRight, Shield, Bell, Database, HardDrive, RefreshCw } from "lucide-react";

export default function SettingsView() {
  const [dedupMode, setDedupMode] = useState<'auto' | 'manual'>('auto');
  const [throttleLimit, setThrottleLimit] = useState(10);
  const [geminiToggle, setGeminiToggle] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const settingsSections = [
    {
      title: 'Duplication Engine',
      icon: Database,
      items: [
        {
          label: 'Dedup Mode',
          description: 'Auto mode runs duplicate scans after each sync. Manual requires explicit trigger.',
          control: (
            <div className="flex gap-2">
              <button onClick={() => setDedupMode('auto')} className={`px-3 py-1.5 text-[10px] font-extrabold uppercase border tracking-widest ${dedupMode === 'auto' ? 'bg-black text-white border-black shadow-[2px_2px_0px_#3b82f6]' : 'bg-white text-slate-500 border-slate-300 hover:border-black'}`}>
                Auto
              </button>
              <button onClick={() => setDedupMode('manual')} className={`px-3 py-1.5 text-[10px] font-extrabold uppercase border tracking-widest ${dedupMode === 'manual' ? 'bg-black text-white border-black shadow-[2px_2px_0px_#3b82f6]' : 'bg-white text-slate-500 border-slate-300 hover:border-black'}`}>
                Manual
              </button>
            </div>
          ),
        },
        {
          label: 'Upload Throttle',
          description: 'Max concurrent upload operations per account.',
          control: (
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={20} value={throttleLimit} onChange={(e) => setThrottleLimit(Number(e.target.value))} className="w-24 accent-black" />
              <span className="text-[13px] font-black font-mono text-black w-6">{throttleLimit}</span>
            </div>
          ),
        },
      ],
    },
    {
      title: 'AI & Intelligence',
      icon: Shield,
      items: [
        {
          label: 'Gemini Storage Audit',
          description: 'Enable AI-powered storage analysis and recommendations.',
          control: (
            <button onClick={() => setGeminiToggle(!geminiToggle)} className="transition-colors">
              {geminiToggle ? <ToggleRight className="w-8 h-8 text-blue-600" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          ),
        },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        {
          label: 'Sync Alerts',
          description: 'Notify when sync completes or errors occur.',
          control: (
            <button onClick={() => setNotifications(!notifications)} className="transition-colors">
              {notifications ? <ToggleRight className="w-8 h-8 text-blue-600" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          ),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-black" />
        <h2 className="font-black text-black text-lg uppercase tracking-wider">Settings</h2>
      </div>

      <div className="space-y-6">
        {settingsSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.title} className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="bg-black text-white px-6 py-3 flex items-center gap-3">
                <SectionIcon className="w-4 h-4 text-blue-400" />
                <h3 className="font-extrabold text-[11px] uppercase tracking-widest">{section.title}</h3>
              </div>
              <div className="divide-y divide-black">
                {section.items.map((item) => (
                  <div key={item.label} className="px-6 py-5 flex items-center justify-between gap-6">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-[13px] text-black uppercase">{item.label}</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">{item.description}</p>
                    </div>
                    <div className="shrink-0">{item.control}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border-2 border-black p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-amber-600" />
          <div>
            <h4 className="font-extrabold text-black text-[12px] uppercase">Cache & Local Data</h4>
            <p className="text-[10px] text-slate-600 font-mono font-bold">File index cache, search vectors, and session data.</p>
          </div>
        </div>
        <button onClick={() => alert('Cache cleared.')} className="px-4 py-2 bg-white border border-black text-slate-700 hover:bg-red-50 hover:text-red-600 text-[10px] font-extrabold uppercase tracking-widest shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
