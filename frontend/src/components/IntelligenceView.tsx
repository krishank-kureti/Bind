import React, { useState, useEffect } from "react";
import { CloudAccount, CloudFile, DuplicateGroup } from "../types";
import { ShieldAlert, RefreshCw, FileText, CheckSquare, Trash2 } from "lucide-react";
import { apiFetch } from "../api";

interface IntelligenceViewProps {
  accounts: CloudAccount[];
  files: CloudFile[];
  onRefreshAllData: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

function transformGroup(g: any): DuplicateGroup {
  const dups = g.duplicateFiles || [];
  return {
    id: g.id,
    checksum: g.checksum || '',
    fileSize: g.fileSize,
    fileCount: g.fileCount,
    totalWaste: g.totalWaste,
    detectedAt: g.detectedAt,
    resolvedAt: g.resolvedAt,
    duplicateFiles: dups,
    wastedSizeBytes: Number(g.totalWaste ?? 0),
    filename: dups[0]?.file?.name || g.checksum?.replace(/^name:/, '') || 'Unknown',
  };
}

export default function IntelligenceView({ accounts, files, onRefreshAllData }: IntelligenceViewProps) {
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const dRes = await apiFetch('/api/duplicates');
      const dBody = await dRes.json();
      setDupGroups((dBody.data || []).map(transformGroup));
    } catch (e) {
      console.error('Failed to load duplicates', e);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/duplicates/scan', { method: 'POST' });
      // Wait a bit for the scan to complete, then reload
      await new Promise((r) => setTimeout(r, 3000));
      await fetchDuplicates();
      onRefreshAllData();
    } catch (e) {
      console.error('Scan failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDuplicates(); }, [files]);

  const handleResolve = async (groupId: string) => {
    setResolving(groupId);
    try {
      const res = await apiFetch(`/api/duplicates/${groupId}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const body = await res.json();
        if (body.data?.partial) {
          const failed = body.data.results.filter((r: any) => !r.success);
          alert('Some files could not be removed:\n' + failed.map((f: any) => `  • ${f.error}`).join('\n'));
        }
        await fetchDuplicates();
        onRefreshAllData();
      }
    } catch (e) {
      console.error('Resolve failed', e);
    } finally {
      setResolving(null);
    }
  };

  const totalWasted = dupGroups.reduce((s, g) => s + g.wastedSizeBytes, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <section className="bg-white border-2 border-black p-8 shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className={`w-16 h-16 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_rgba(0,0,0,1)] shrink-0 ${totalWasted > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
            <Trash2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-black text-black text-lg uppercase tracking-wider">Waste Cleanup</h2>
              <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 border-2 border-black ${totalWasted > 0 ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {totalWasted > 0 ? `${dupGroups.length} Group${dupGroups.length > 1 ? 's' : ''}` : 'Optimized'}
              </span>
            </div>
            <p className="text-[12px] text-slate-500 font-mono font-bold uppercase tracking-wider">
              {totalWasted > 0
                ? `${formatBytes(totalWasted, 1)} of recoverable storage across ${dupGroups.length} duplicate cluster${dupGroups.length > 1 ? 's' : ''}.`
                : 'All storage is optimized — no duplicates detected.'}
            </p>
          </div>
        </div>
        <button onClick={handleScan} disabled={loading} className="geo-btn-primary h-12 px-6 text-xs shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </section>

      <section className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] space-y-4">
        <div className="border-b-2 border-black pb-3 flex justify-between items-center">
          <h3 className="font-extrabold text-[11px] uppercase tracking-widest text-black">Duplicate Groups</h3>
          <span className="text-[10px] font-mono font-bold uppercase text-slate-500">{dupGroups.length} group{dupGroups.length !== 1 ? 's' : ''}</span>
        </div>
        {dupGroups.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono uppercase font-bold flex flex-col items-center gap-3">
            <CheckSquare className="w-10 h-10 text-emerald-500" />
            <span>No duplicates detected. Storage is clean.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {dupGroups.map((g) => (
              <div key={g.id} className="border-2 border-black p-5 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-3 items-center">
                    <div className="p-2.5 border-2 border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,1)]"><FileText className="w-4 h-4" /></div>
                    <div>
                      <h4 className="font-black text-black text-[14px] uppercase">{g.filename}</h4>
                      <p className="text-[10px] text-slate-500 font-mono font-bold uppercase">{g.duplicateFiles.length} cop{g.duplicateFiles.length > 1 ? 'ies' : 'y'} across {new Set(g.duplicateFiles.map((df) => df.accountId)).size} account{new Set(g.duplicateFiles.map((df) => df.accountId)).size > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-black text-red-600 font-mono">{formatBytes(g.wastedSizeBytes)}</div>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Wasted</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {g.duplicateFiles.map((df) => (
                    <div key={df.id} className="h-10 bg-white border-2 border-black px-4 flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-mono text-[11px] font-bold truncate">{df.file?.name || 'Unknown'}</span>
                      <span className="text-[9.5px] bg-black text-white border border-black font-extrabold font-mono px-2 py-0.5 shrink-0 ml-3">{df.account?.email?.split('@')[0] || 'SYS'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-3">
                  <button onClick={() => handleResolve(g.id)} disabled={resolving === g.id} className="px-4 py-2 bg-white border-2 border-black text-red-600 hover:bg-red-50 text-[11px] font-extrabold shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all flex items-center gap-1.5 uppercase tracking-wider">
                    {resolving === g.id ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resolving...</> : <><Trash2 className="w-3.5 h-3.5" /> Resolve & Reclaim</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
