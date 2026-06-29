import React from "react";
import { LayoutDashboard, FolderOpen, Brain, CreditCard, Plus, Settings, HelpCircle, Cloud, LogOut } from "lucide-react";
import { CloudAccount } from "../types";

interface SideNavBarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenConnectModal: () => void;
  accountsCount: number;
  accounts: CloudAccount[];
  onLogout: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "files", label: "File Manager", icon: FolderOpen },
  { id: "intelligence", label: "Intelligence", icon: Brain, highlight: true },
  { id: "accounts", label: "Accounts", icon: CreditCard },
];

const footerItems = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "support", label: "Support", icon: HelpCircle },
];

export default function SideNavBar({ currentTab, setCurrentTab, onOpenConnectModal, accountsCount, accounts, onLogout }: SideNavBarProps) {
  const totalUsed = (accounts || []).reduce((sum, a) => sum + (a.quotaUsed || 0), 0);
  const totalQuota = (accounts || []).reduce((sum, a) => sum + (a.quotaTotal || 0), 0);
  const usagePercent = totalQuota > 0 ? Math.min(100, Math.round((totalUsed / totalQuota) * 100)) : 0;
  const usedLabel = formatBytes(totalUsed);
  const totalLabel = formatBytes(totalQuota);

  return (
    <aside className="w-64 border-r-2 border-black bg-white flex flex-col h-screen fixed left-0 top-0 z-20">
      <div className="p-6 flex items-center gap-3 border-b-2 border-black bg-slate-50">
        <div className="w-9 h-9 border-2 border-black bg-black flex items-center justify-center text-white shadow-[3px_3px_0px_0px_#3b82f6]">
          <Cloud className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-black text-2xl text-black tracking-widest leading-none uppercase">BIND</h1>
          <p className="text-[9px] text-slate-500 font-black tracking-widest font-mono uppercase mt-1">Unified CloudVault</p>
        </div>
      </div>

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
              {item.highlight && <span className="w-2 h-2 rounded-none bg-[#3b82f6] animate-pulse" />}
            </button>
          );
        })}

        <div className="pt-4 px-1">
          <button onClick={onOpenConnectModal} className="w-full text-center geo-btn-primary flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-black bg-slate-50">
        <div className="px-1 mb-1 flex items-center justify-between">
          <span className="text-[9px] font-extrabold text-slate-400 tracking-widest uppercase">Global Grid Storage</span>
          <span className="text-[8px] font-mono font-bold text-slate-500">{usagePercent}%</span>
        </div>
        <div className="border border-black h-4 w-full bg-slate-200 overflow-hidden relative" title={`${usedLabel} / ${totalLabel}`}>
          <div className="h-full geo-stripes" style={{ width: `${usagePercent}%` }} />
        </div>
        <div className="text-[7px] font-mono text-right text-slate-400 mt-0.5 tracking-tighter" title="Combined across connected accounts">
          {usedLabel} / {totalLabel}
        </div>
      </div>

      <div className="p-4 border-t-2 border-black bg-[#f8fafc] space-y-1.5">
        <ul className="space-y-1.5">
          {footerItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-none text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    isActive ? "bg-black text-white border-black" : "text-slate-600 border-transparent hover:border-black hover:bg-white"
                  }`}
                >
                  <Icon className="w-4 h-4" /> <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 rounded-none text-[11px] font-bold uppercase tracking-wider border border-transparent text-red-500 hover:border-red-400 hover:bg-red-50 transition-all cursor-pointer">
          <LogOut className="w-4 h-4" /> <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
