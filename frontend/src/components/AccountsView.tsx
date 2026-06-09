import React from "react";
import { CloudAccount } from "../types";
import { CreditCard, Plus, Trash2, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, RotateCw } from "lucide-react";

interface AccountsViewProps {
  accounts: CloudAccount[];
  onOpenConnectModal: () => void;
  onRefreshAllData: () => void;
  onDisconnectAccount: (id: string) => void;
  onSyncAccount: (id: string) => Promise<string | void>;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

function statusBadge(status: string) {
  switch (status) {
    case 'SYNCED': return { icon: CheckCircle, label: 'Active', cls: 'bg-emerald-500 text-white border-emerald-800' };
    case 'SYNCING': return { icon: RefreshCw, label: 'Syncing', cls: 'bg-blue-500 text-white border-blue-800' };
    case 'ERROR': return { icon: XCircle, label: 'Error', cls: 'bg-red-500 text-white border-red-800' };
    default: return { icon: Clock, label: 'Pending', cls: 'bg-amber-400 text-black border-amber-700' };
  }
}

export default function AccountsView({ accounts, onOpenConnectModal, onRefreshAllData, onDisconnectAccount, onSyncAccount }: AccountsViewProps) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-black text-black text-lg uppercase tracking-wider">Connected Accounts</h2>
          <p className="text-[11px] text-slate-500 font-mono font-bold mt-1 uppercase">{accounts.length} integration node{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={async () => { for (const a of accounts) await onSyncAccount(a.id); onRefreshAllData(); }} className="geo-btn-secondary flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4" /> Sync All
          </button>
          <button onClick={onOpenConnectModal} className="geo-btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="bg-white border-2 border-black p-12 text-center shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <h3 className="font-extrabold text-slate-500 text-sm uppercase mb-3">No Accounts Linked</h3>
            <p className="text-[12px] text-slate-400 font-mono font-bold mb-6">Connect a Google Drive account to get started.</p>
            <button onClick={onOpenConnectModal} className="geo-btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Connect Google Drive
            </button>
          </div>
        ) : (
          accounts.map((a) => {
            const pct = a.quotaTotal > 0 ? (a.quotaUsed / a.quotaTotal) * 100 : 0;
            const badge = statusBadge(a.syncStatus);
            const Icon = badge.icon;
            return (
              <div key={a.id} className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 border-2 border-black text-lg font-black text-white flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] shrink-0" style={{ backgroundColor: a.color }}>
                      {a.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-[15px] text-black uppercase truncate">{a.displayName || a.email}</h3>
                      <p className="text-[11px] text-slate-500 font-mono font-bold mt-0.5">{a.email}</p>
                      <p className="text-[9px] text-blue-600 font-extrabold font-mono uppercase mt-0.5">{a.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 border flex items-center gap-1.5 ${badge.cls}`}>
                      <Icon className={`w-3 h-3 ${a.syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} /> {badge.label}
                    </span>
                    <button onClick={() => onSyncAccount(a.id)} className="p-2 border border-black bg-white text-blue-600 hover:bg-blue-50 transition-colors" title="Sync">
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDisconnectAccount(a.id)} className="p-2 border border-black bg-white text-red-500 hover:bg-red-50 transition-colors" title="Disconnect">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] font-mono font-bold text-slate-600 mb-2 uppercase">
                    <span>Storage Allocation</span>
                    <span>{formatBytes(a.quotaUsed, 0)} / {formatBytes(a.quotaTotal, 0)}</span>
                  </div>
                  <div className="h-6 w-full bg-slate-100 border-2 border-black overflow-hidden">
                    <div className="h-full transition-all duration-300 flex items-center justify-end pr-2" style={{ width: `${pct}%`, backgroundColor: a.color }}>
                      <span className="text-[9px] font-extrabold text-white drop-shadow-[1px_1px_0_rgba(0,0,0,0.8)]">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4 text-[10px] font-mono font-bold">
                  <div className="border border-black p-3 bg-slate-50">
                    <span className="text-slate-500 uppercase block">Quota Total</span>
                    <span className="text-black text-[13px] font-black">{formatBytes(a.quotaTotal, 1)}</span>
                  </div>
                  <div className="border border-black p-3 bg-slate-50">
                    <span className="text-slate-500 uppercase block">Quota Used</span>
                    <span className="text-black text-[13px] font-black">{formatBytes(a.quotaUsed, 1)}</span>
                  </div>
                  <div className="border border-black p-3 bg-slate-50">
                    <span className="text-slate-500 uppercase block">Last Synced</span>
                    <span className="text-black text-[13px] font-black">{a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleDateString() : 'Never'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
