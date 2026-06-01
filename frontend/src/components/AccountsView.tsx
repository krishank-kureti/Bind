import React, { useState } from "react";
import { CloudAccount } from "../types";
import { CheckCircle2, RotateCw, AlertCircle, Trash2, Unlink, Plus, ExternalLink, RefreshCw, HardDrive } from "lucide-react";
import { formatBytes } from "./DashboardView";

interface AccountsViewProps {
  accounts: CloudAccount[];
  onOpenConnectModal: () => void;
  onRefreshAllData: () => void;
  onDisconnectAccount: (id: string) => Promise<void>;
  onReauthorizeAccount: (id: string) => Promise<void>;
  onChangeFrequency: (id: string, freq: string) => Promise<void>;
}

export default function AccountsView({
  accounts,
  onOpenConnectModal,
  onRefreshAllData,
  onDisconnectAccount,
  onReauthorizeAccount,
  onChangeFrequency,
}: AccountsViewProps) {
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const activeQuota = accounts.length;
  const optimalStatus = accounts.every((a) => a.status === "synced" || a.status === "syncing");
  const totalQuota = accounts.reduce((acc, curr) => acc + curr.quotaBytes, 0);
  const totalUsed = accounts.reduce((acc, curr) => acc + curr.usedBytes, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Overview stats layout */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black pb-5 gap-4">
        <div>
          <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase font-mono">Data Sources</span>
          <h3 className="font-extrabold text-black text-xl tracking-tight leading-none mt-1 uppercase">
            Registered Storage Networks
          </h3>
          <p className="text-[12px] text-slate-600 font-medium leading-normal mt-2.5 font-mono uppercase">
            Synchronize indexing nodes, assign folders, and manage OAuth login access tokens.
          </p>
        </div>

        <button
          onClick={onOpenConnectModal}
          className="geo-btn-primary"
        >
          <Plus className="w-4 h-4 mr-1 shrink-0" />
          Connect New Account
        </button>
      </section>

      {/* Bento storage summaries */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="geo-cell bg-white p-5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Active Connections</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-black text-black text-3xl tracking-tighter">{activeQuota}</span>
            <span className="text-[11px] text-slate-500 font-bold font-mono uppercase">/ 5 allocation</span>
          </div>
        </div>

        <div className="geo-cell bg-white p-5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Global Sync State</span>
          <div className="flex items-center gap-1.5 mt-2">
            {optimalStatus ? (
              <div className="flex items-center gap-2 border border-[#10b981] bg-emerald-50 text-[#10b981] font-bold text-xs uppercase px-2.5 py-1 rounded-none tracking-wide">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Optimal Indexing</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 border border-amber-500 bg-amber-50 text-amber-700 font-bold text-xs uppercase px-2.5 py-1 rounded-none tracking-wide animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Credentials Needed</span>
              </div>
            )}
          </div>
        </div>

        <div className="geo-cell bg-white p-5 flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Unified Storage Ratio</span>
          <div className="mt-2.5 space-y-1.5">
            <div className="w-full bg-slate-105 border-2 border-black rounded-none h-6 overflow-hidden relative">
              <div
                className="bg-[#2563eb] h-full transition-all duration-300 relative"
                style={{ width: totalQuota > 0 ? `${(totalUsed / totalQuota) * 100}%` : "0%" }}
              >
                <div className="absolute inset-0 geo-stripes opacity-15 mix-blend-overlay"></div>
              </div>
            </div>
            <p className="text-[10.5px] text-black font-mono font-bold text-right mt-1 uppercase">
              {formatBytes(totalUsed, 0).toUpperCase()} USED / {formatBytes(totalQuota, 0).toUpperCase()} TOTAL
            </p>
          </div>
        </div>
      </section>

      {/* Account items card stack */}
      <section className="space-y-4">
        {accounts.map((acc) => {
          const initials = acc.email.charAt(0).toUpperCase();
          const isSyncingLoader = acc.status === "syncing";
          const isErrorState = acc.status === "auth_error";
          const isSubmitting = submittingAction === acc.id;

          return (
            <div
              key={acc.id}
              className={`geo-cell bg-white p-5 flex flex-col gap-5 ${
                isErrorState ? "border-red-500 bg-red-50/5" : ""
              }`}
            >
              {/* Header Status Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 border border-black rounded-none flex items-center justify-center text-white font-black text-sm shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                    style={{ backgroundColor: acc.color }}
                  >
                    {initials}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-black text-[13px] uppercase tracking-tight">{acc.email}</h4>
                    <p className="text-[10.5px] text-slate-500 font-mono mt-0.5 uppercase font-bold">{acc.provider} Storage Node</p>
                  </div>
                </div>

                {/* Badges indicators */}
                <div>
                  {isSyncingLoader ? (
                    <span className="bg-amber-100 text-amber-800 border border-black font-extrabold text-[9px] px-2.5 py-1 rounded-none uppercase tracking-widest flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing (34%)
                    </span>
                  ) : isErrorState ? (
                    <span className="bg-red-650 text-white border border-black font-extrabold text-[9px] px-2.5 py-1 rounded-none uppercase tracking-widest flex items-center gap-1.5 animate-pulse shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <AlertCircle className="w-3 h-3" />
                      Auth Error
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-[#10b981] border border-black font-extrabold text-[9px] px-2.5 py-1 rounded-none uppercase tracking-widest flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <CheckCircle2 className="w-3 h-3" />
                      Synced
                    </span>
                  )}
                </div>
              </div>

              {/* Configure settings inner rows */}
              {isErrorState ? (
                /* Auth error warning inner block */
                <div className="bg-red-50/20 border border-red-500 p-4 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-red-650 mt-0.5 shrink-0" />
                    <div>
                      <h5 className="font-extrabold text-[11px] text-red-905 uppercase tracking-wide">Access Token Revoked or Expired</h5>
                      <p className="text-[11.5px] text-red-600 font-mono leading-normal mt-1 uppercase">
                        Please re-authenticate to renew workspace permissions. Last directory scan was 3 days ago.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 self-start sm:self-center">
                    <button
                      onClick={async () => {
                        setSubmittingAction(acc.id);
                        await onDisconnectAccount(acc.id);
                        setSubmittingAction(null);
                      }}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-55 hover:text-white border border-transparent hover:border-black rounded-none text-xs font-black uppercase transition-colors cursor-pointer font-mono"
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={async () => {
                        setSubmittingAction(acc.id);
                        await onReauthorizeAccount(acc.id);
                        setSubmittingAction(null);
                      }}
                      className="geo-btn-primary"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Reassign OAuth
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Synced configuration row */
                <div className="bg-slate-50 border border-black p-4 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-8 text-xs select-text">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Storage space</span>
                      <span className="font-bold text-black font-mono mt-0.5 uppercase">
                        {formatBytes(acc.usedBytes, 0).toUpperCase()} OF {formatBytes(acc.quotaBytes, 0).toUpperCase()}
                      </span>
                    </div>

                    <div className="w-[2px] h-8 bg-black hidden sm:block" />

                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono mb-1">
                        Frequency
                      </span>
                      <select
                        value={acc.syncFrequency}
                        onChange={async (e) => {
                          setSubmittingAction(acc.id);
                          await onChangeFrequency(acc.id, e.target.value);
                          setSubmittingAction(null);
                        }}
                        className="h-8 cursor-pointer text-xs border-2 border-black rounded-none bg-white px-2 focus:outline-none font-bold uppercase"
                      >
                        <option value="realtime">Real-time (Push)</option>
                        <option value="15m">Every 15 minutes</option>
                        <option value="hourly">Hourly</option>
                        <option value="manual">Manual Only</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setSubmittingAction(acc.id);
                      await onDisconnectAccount(acc.id);
                      setSubmittingAction(null);
                    }}
                    className="geo-btn-secondary px-3.5 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer bg-white"
                  >
                    <Unlink className="w-3.5 h-3.5 mr-1" />
                    Disconnect Node
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
