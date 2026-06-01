import React from "react";
import { CloudAccount, CloudFile, ActivityLog } from "../types";
import { HardDrive, UploadCloud, ChevronRight, AlertTriangle, RefreshCw, FileText, FileCode, Video, Archive, MoreHorizontal, Sparkles } from "lucide-react";

interface DashboardViewProps {
  accounts: CloudAccount[];
  files: CloudFile[];
  activities: ActivityLog[];
  onTabChange: (tab: string) => void;
  onOpenUploadModal: () => void;
  isSyncing: boolean;
}

// Utility to format bytes beautifully
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function DashboardView({
  accounts,
  files,
  activities,
  onTabChange,
  onOpenUploadModal,
  isSyncing,
}: DashboardViewProps) {
  // Aggregate accounts calculations
  const totalQuota = accounts.reduce((acc, curr) => acc + curr.quotaBytes, 0);
  const totalUsed = accounts.reduce((acc, curr) => acc + curr.usedBytes, 0);
  const totalUsedFormatted = formatBytes(totalUsed, 1);
  const totalQuotaFormatted = formatBytes(totalQuota, 1);
  const activeCount = accounts.filter((a) => a.status === "synced").length;

  // Find exact duplicates total wasted size
  const duplicatesGroupSize = files.filter((f) => f.id.startsWith("dup-"));
  // Let's count duplicate sizes dynamically
  const duplicateMap: { [key: string]: number } = {};
  files.forEach((file) => {
    if (file.sizeBytes > 0) {
      const key = `${file.name.toLowerCase()}_${file.sizeBytes}`;
      duplicateMap[key] = (duplicateMap[key] || 0) + 1;
    }
  });

  let totalWastedBytes = 0;
  Object.keys(duplicateMap).forEach((key) => {
    const count = duplicateMap[key];
    if (count > 1) {
      const sizeStr = key.split("_")[1];
      const sizeBytes = parseInt(sizeStr);
      totalWastedBytes += (count - 1) * sizeBytes;
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Dynamic Banner alerts */}
      {totalWastedBytes > 0 && (
        <div className="bg-amber-100 border-2 border-black rounded-none p-5 flex items-start gap-4 shadow-[4px_4px_0px_0px_#d97706]">
          <div className="w-10 h-10 bg-amber-500 border border-black flex items-center justify-center shrink-0 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-[9px] font-extrabold bg-[#000] text-white px-2 py-0.5 uppercase tracking-widest">INTELLIGENCE CRITICAL</span>
            <h4 className="font-extrabold text-[15px] text-black tracking-tight mt-1 px-0.5 uppercase">Redundant Cluster Storage Detected</h4>
            <p className="text-[12px] text-slate-800 mt-1 max-w-xl font-medium px-0.5">
              BIND Unified AI has analyzed your connected paths and discovered{" "}
              <strong className="font-extrabold text-blue-700">{formatBytes(totalWastedBytes)}</strong> of duplicate files cloned across multiple accounts.
            </p>
            <button
              onClick={() => onTabChange("intelligence")}
              className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 hover:text-blue-800 hover:underline transition-colors mt-3 text-left cursor-pointer flex items-center gap-1.5"
            >
              Analyze & De-duplicate now <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Aggregated Unified Storage Bento Block */}
        <div className="col-span-1 md:col-span-2 bg-white rounded-none border border-black p-6 flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4.5 h-4.5 text-black" />
                <h3 className="font-extrabold text-black text-[11px] uppercase tracking-widest">UNIFIED SPACE ACCUMULATOR</h3>
              </div>
              <span className="text-[9px] text-[#2563eb] border border-[#2563eb] bg-white font-black px-2.5 py-0.5 rounded-none uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Sync Live
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-black leading-none tracking-tighter">
                {(totalUsed / 1e12).toFixed(2)}
              </span>
              <span className="text-11 font-extrabold text-black uppercase tracking-wider">TB Consolidated</span>
              <span className="text-[11px] text-slate-500 font-mono font-bold ml-auto uppercase tracking-wide">
                CAP: {(totalQuota / 1e12).toFixed(1)} TB ARCH
              </span>
            </div>
          </div>

          <div>
            {/* Multi-seg progress bar calculated dynamically - with hard dark outlines */}
            <div className="h-6 w-full bg-slate-100 border-2 border-black flex overflow-hidden mb-4 rounded-none">
              {accounts.map((account) => {
                const percentage = totalQuota > 0 ? (account.usedBytes / totalQuota) * 100 : 0;
                return (
                  <div
                    key={account.id}
                    className="h-full border-r border-black last:border-0 transition-all duration-300 relative group"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: account.color,
                    }}
                    title={`${account.email}: ${formatBytes(account.usedBytes)}`}
                  >
                    {percentage > 6 && (
                      <div className="absolute inset-0 geo-stripes opacity-15 mix-blend-overlay"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dynamic Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
              {accounts.map((acc) => {
                const percentage = totalQuota > 0 ? ((acc.usedBytes / totalQuota) * 100).toFixed(0) : "0";
                return (
                  <div key={acc.id} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-none border border-black shrink-0 shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                      style={{ backgroundColor: acc.color }}
                    />
                    <span className="text-[11px] font-mono font-extrabold uppercase text-slate-800">
                      {acc.email.split("@")[0]} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Upload Action Component */}
        <div
          onClick={onOpenUploadModal}
          className="geo-cell geo-cell-interactive cursor-pointer p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group bg-white"
        >
          {/* Subtle geometric stripe background on top header */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-black"></div>
          <div className="w-12 h-12 rounded-none bg-black border border-black flex items-center justify-center mb-4 text-white shadow-[3px_3px_0px_0px_#3b82f6] transition-transform duration-200 group-hover:-translate-y-1">
            <UploadCloud className="w-5 h-5" />
          </div>
          <h3 className="font-extrabold text-black text-xs uppercase tracking-widest mb-1">SMART PACK ROUTER</h3>
          <p className="text-[10px] text-slate-400 font-bold font-mono uppercase mb-4 tracking-wider">SECURE ACCOUNT DISPATCH</p>
          <button className="geo-btn-primary w-full flex items-center justify-center">
            Upload Items
          </button>
        </div>
      </section>

      {/* Quotas Segment */}
      <section className="space-y-4">
        <div className="px-1">
          <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block">CONNECTED ACTIVE INTEGRATION NODES</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.slice(0, 3).map((acc) => {
            const usagePercent = acc.quotaBytes > 0 ? (acc.usedBytes / acc.quotaBytes) * 100 : 0;
            const initials = acc.email.charAt(0).toUpperCase();
            return (
              <div
                key={acc.id}
                onClick={() => onTabChange("accounts")}
                className="geo-cell geo-cell-interactive p-4 cursor-pointer bg-white"
              >
                <div className="flex items-center gap-3 mb-4.5">
                  <div
                    className="w-8 h-8 rounded-none border border-black text-xs font-black text-white flex items-center justify-center shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]"
                    style={{ backgroundColor: acc.color }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-extrabold text-black uppercase tracking-tight truncate">{acc.email}</p>
                    <p className="text-[9px] text-[#2563eb] font-mono font-extrabold uppercase mt-0.5 tracking-wider">{acc.provider}</p>
                  </div>
                </div>

                <div className="h-5 w-full bg-slate-100 border border-black rounded-none overflow-hidden mb-2 relative">
                  <span
                    className="block h-full transition-all duration-300 relative"
                    style={{
                      width: `${usagePercent}%`,
                      backgroundColor: acc.color,
                    }}
                  >
                    <span className="absolute inset-0 geo-stripes opacity-10 mix-blend-overlay"></span>
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono font-extrabold uppercase tracking-wide">
                  <span className="text-slate-500">
                    {formatBytes(acc.usedBytes, 0)} / {formatBytes(acc.quotaBytes, 0)}
                  </span>
                  <span
                    className={`font-black ${
                      usagePercent > 90 ? "text-red-600" : "text-black"
                    }`}
                  >
                    {usagePercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Feed Activity */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block">NODE ACTIVITY LEDGER</span>
          <button
            onClick={() => onTabChange("files")}
            className="text-[10px] font-extrabold text-black uppercase tracking-widest hover:underline cursor-pointer border border-black px-2 py-1 bg-white hover:bg-slate-50 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all"
          >
            Explore files
          </button>
        </div>

        <div className="geo-cell bg-white overflow-hidden p-0">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-xs uppercase">No active transaction telemetry logged.</div>
          ) : (
            <div className="divide-y divide-black flex flex-col font-mono">
              {activities.map((act) => {
                return (
                  <div
                    key={act.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-4 text-xs hover:bg-slate-50 gap-2 transition-colors border-l-4 border-l-slate-900"
                    style={{ borderLeftColor: act.iconType === "upload" ? "#10b981" : act.iconType === "move" ? "#f59e0b" : "#3b82f6" }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {act.iconType === "upload" ? (
                        <div className="w-1.5 h-1.5 bg-emerald-500 shrink-0" />
                      ) : act.iconType === "move" ? (
                        <div className="w-1.5 h-1.5 bg-amber-500 shrink-0" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-blue-500 shrink-0" />
                      )}
                      <span className="text-black font-bold truncate tracking-tight">{act.message}</span>
                      <span className="text-[9px] bg-black text-white px-2 py-0.5 font-bold uppercase tracking-widest shrink-0 max-w-[170px] truncate hidden sm:inline-block">
                        {act.accountEmail?.split("@")[0] || "SYSTEM"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 text-right shrink-0">
                      {act.sizeBytes && (
                        <span className="text-slate-600 font-extrabold text-[10px]">
                          {formatBytes(act.sizeBytes, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="text-slate-500 text-[9.5px] font-bold">{act.timestamp.toUpperCase()}</span>
                      <div className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 border border-black bg-slate-100 shrink-0 text-slate-700">
                        {act.iconType.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
