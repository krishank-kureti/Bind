import React from "react";
import { LayoutDashboard, FolderOpen, Brain, CreditCard, Plus, Settings, HelpCircle, Cloud } from "lucide-react";

interface SideNavBarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenConnectModal: () => void;
  accountsCount: number;
}

export default function SideNavBar({
  currentTab,
  setCurrentTab,
  onOpenConnectModal,
  accountsCount,
}: SideNavBarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "files", label: "File Manager", icon: FolderOpen },
    { id: "intelligence", label: "Intelligence", icon: Brain, highlight: true },
    { id: "accounts", label: "Accounts", icon: CreditCard },
  ];

  return (
    <aside className="w-64 border-r-2 border-black bg-white flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b-2 border-black bg-slate-50">
        <div className="w-9 h-9 border-2 border-black bg-black flex items-center justify-center text-white shadow-[3px_3px_0px_0px_#3b82f6]">
          <Cloud className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-black text-2xl text-black tracking-widest leading-none uppercase">BIND</h1>
          <p className="text-[9px] text-slate-500 font-black tracking-widest font-mono uppercase mt-1">Unified CloudVault</p>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto bg-white">
        <div className="px-2 mb-3">
          <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">Navigation</span>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-none text-[12px] font-extrabold tracking-wide uppercase border transition-all duration-100 cursor-pointer ${
                isActive
                  ? "bg-black text-white border-black shadow-[3px_3px_0px_0px_#3b82f6]"
                  : "text-slate-600 border-transparent hover:border-black hover:bg-slate-50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#3b82f6]" : "text-slate-500"}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.highlight && (
                <span className="w-2 h-2 rounded-none bg-[#3b82f6] animate-pulse" />
              )}
            </button>
          );
        })}

        {/* CTA : Add Account */}
        <div className="pt-4 px-1">
          <button
            onClick={onOpenConnectModal}
            className="w-full text-center geo-btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </nav>

      {/* Storage Indicator */}
      <div className="p-4 border-t border-black bg-slate-50">
        <div className="px-1 mb-2">
          <span className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase block">Global Grid Storage</span>
        </div>
        <div className="border border-black h-5 w-full bg-slate-200 overflow-hidden relative">
          <div className="geo-stripes h-full" style={{ width: "65%" }}></div>
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-[10px] font-mono font-bold text-slate-600">652.4 GB / 1 TB</span>
          <span className="text-[10px] font-mono font-extrabold text-blue-600">65% Used</span>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t-2 border-black bg-[#f8fafc]">
        <ul className="space-y-1.5">
          <li>
            <button
              onClick={() => setCurrentTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-none text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                currentTab === "settings" 
                  ? "bg-black text-white border-black" 
                  : "text-slate-600 border-transparent hover:border-black hover:bg-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentTab("support")}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-none text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                currentTab === "support" 
                  ? "bg-black text-white border-black" 
                  : "text-slate-600 border-transparent hover:border-black hover:bg-white"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Support</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
