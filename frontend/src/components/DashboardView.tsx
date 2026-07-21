import React from "react";
import { CloudAccount, CloudFile } from "../types";
import { HardDrive, UploadCloud, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";

interface DashboardViewProps {
  accounts: CloudAccount[];
  files: CloudFile[];
  onOpenUploadModal: () => void;
  isSyncing: boolean;
  onRefreshStorage: () => void;
  onNavigateIntelligence: () => void;
  onSyncAccounts: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)));
  // Keep fixed decimals so 1.85 + 8.84 reads correctly (not rounded to 2 + 9)
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

const GIB = 1024 ** 3; // same base as formatBytes (binary GB)

export default function DashboardView({ accounts, files, onOpenUploadModal, isSyncing, onRefreshStorage, onNavigateIntelligence, onSyncAccounts }: DashboardViewProps) {
  // Must match SideNavBar Global Grid Storage: sum of per-account quota fields
  const totalQuota = accounts.reduce((s, a) => s + (a.quotaTotal || 0), 0);
  const totalUsed = accounts.reduce((s, a) => s + (a.quotaUsed || 0), 0);
  const usedGiB = totalUsed / GIB;
  const quotaGiB = totalQuota / GIB;
  const activeCount = accounts.filter((a) => a.syncStatus === 'SYNCED').length;

  const duplicateSizes: Record<string, number> = {};
  files.forEach((f) => {
    if (f.sizeBytes > 0) {
      const key = `${f.name.toLowerCase()}_${f.sizeBytes}`;
      duplicateSizes[key] = (duplicateSizes[key] || 0) + 1;
    }
  });
  let totalWastedBytes = 0;
  Object.keys(duplicateSizes).forEach((key) => {
    const count = duplicateSizes[key];
    if (count > 1) totalWastedBytes += (count - 1) * parseInt(key.split('_')[1]);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {totalWastedBytes > 0 && (
        <div className="bg-amber-100 border-2 border-black rounded-none p-5 flex items-start gap-4 shadow-[4px_4px_0px_0px_#d97706]">
          <div className="w-10 h-10 bg-amber-500 border border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <AlertTriangle className="w-5 h-5 text-black" />
          </div>
          <div className="flex-1">
            <span className="text-[9px] font-semibold bg-black text-white px-2 py-0.5 tracking-normal">Intelligence Critical</span>
            <h4 className="font-extrabold text-[15px] text-black mt-1 ">Redundant Cluster Storage Detected</h4>
            <p className="text-[12px] text-slate-800 mt-1 font-medium">
              <strong className="font-extrabold text-blue-700">{formatBytes(totalWastedBytes)}</strong> of duplicate files across accounts.
            </p>
            <button onClick={onNavigateIntelligence} className="text-[11px] font-semibold tracking-normal text-blue-600 hover:underline mt-3 flex items-center gap-1.5">
              Analyze & De-duplicate <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <section className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4.5 h-4.5 text-black" />
            <h3 className="font-semibold text-black text-[11px] tracking-normal">Unified Space Accumulator</h3>
          </div>
          <button onClick={onSyncAccounts} disabled={isSyncing} className="geo-btn-secondary !h-8 text-[9px] flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Live
          </button>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-black text-black tracking-tighter">{usedGiB.toFixed(2)}</span>
          <span className="text-[11px] font-semibold text-black tracking-normal">GB Consolidated</span>
          <span className="text-[11px] text-slate-500 font-mono font-bold ml-auto ">Cap: {quotaGiB.toFixed(1)} GB</span>
        </div>
        <div className="h-6 w-full bg-slate-100 border-2 border-black flex overflow-hidden mb-4">
          {accounts.map((a) => {
            const pct = totalQuota > 0 ? (a.quotaUsed / totalQuota) * 100 : 0;
            return (
              <div key={a.id} className="h-full border-r border-black last:border-0 transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: a.color }} />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {accounts.map((a) => {
            const pct = totalQuota > 0 ? ((a.quotaUsed / totalQuota) * 100).toFixed(0) : '0';
            return (
              <div key={a.id} className="flex items-center gap-2">
                <span className="w-3 h-3 border border-black shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: a.color }} />
                <span className="text-[11px] font-mono font-semibold text-slate-800">{a.email.split('@')[0]} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="px-1">
          <span className="text-[10px] font-semibold text-slate-400 tracking-normal ">Connected Active Integration Nodes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.slice(0, 3).map((a) => {
            const pct = a.quotaTotal > 0 ? (a.quotaUsed / a.quotaTotal) * 100 : 0;
            return (
              <div key={a.id} className="bg-white border border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border border-black text-xs font-bold text-white flex items-center justify-center shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: a.color }}>
                    {a.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-extrabold text-black truncate">{a.email}</p>
                    <p className="text-[9px] text-[#2563eb] font-semibold mt-0.5">{a.provider}</p>
                  </div>
                </div>
                <div className="h-5 w-full bg-slate-100 border border-black overflow-hidden mb-2">
                  <span className="block h-full transition-all" style={{ width: `${pct}%`, backgroundColor: a.color }} />
                </div>
                <div className="flex justify-between text-[10px] font-semibold ">
                  <span className="text-slate-500" title={`${a.quotaUsed} / ${a.quotaTotal} bytes`}>
                    {formatBytes(a.quotaUsed, 2)} / {formatBytes(a.quotaTotal, 2)}
                  </span>
                  <span className={pct > 90 ? 'text-red-600' : 'text-black'}>{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div onClick={onOpenUploadModal} className="bg-white border border-black p-6 flex items-center justify-between cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black border border-black flex items-center justify-center text-white shadow-[3px_3px_0px_0px_#3b82f6] shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-black text-sm tracking-normal">Smart Pack Router</h3>
            <p className="text-[10px] text-slate-400 font-bold tracking-normal">Secure Account Dispatch</p>
          </div>
        </div>
        <button className="geo-btn-primary">Upload Items</button>
      </div>
    </div>
  );
}
