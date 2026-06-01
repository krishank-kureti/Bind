import React, { useState, useEffect } from "react";
import { DuplicateGroup, CloudAccount, CloudFile, StaleFile } from "../types";
import { Sparkles, Trash2, ShieldAlert, CheckCircle, RefreshCw, ChevronRight, HardDrive, Filter, AlertTriangle, FileText, ChevronDown, CheckSquare } from "lucide-react";
import { formatBytes } from "./DashboardView";

interface IntelligenceViewProps {
  accounts: CloudAccount[];
  files: CloudFile[];
  onRefreshAllData: () => void;
}

interface GeminiAdvisorOutput {
  persona: string;
  statusSummary: string;
  score: number;
  recommendations: Array<{
    title: string;
    description: string;
    spaceReclaimed: string;
  }>;
}

function transformDuplicateGroup(g: any): DuplicateGroup {
  const instances = (g.duplicateFiles || []).map((df: any) => ({
    fileId: df.fileId,
    path: df.file?.name || '',
    sizeBytes: Number(df.file?.size ?? 0),
    accountEmail: df.account?.email || '',
  }));
  const fileSize = Number(g.fileSize ?? 0);
  return {
    id: g.id,
    checksum: g.checksum || '',
    filename: g.duplicateFiles?.[0]?.file?.name || g.checksum || 'Unknown',
    totalSizeBytes: fileSize,
    wastedSizeBytes: Number(g.totalWaste ?? 0),
    fileCount: g.fileCount,
    fileSize: g.fileSize,
    totalWaste: g.totalWaste,
    instances,
    duplicateFiles: g.duplicateFiles || [],
  };
}

export default function IntelligenceView({
  accounts,
  files,
  onRefreshAllData,
}: IntelligenceViewProps) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [staleFiles, setStaleFiles] = useState<CloudFile[]>([]);
  const [largestFiles, setLargestFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [resolvingGroup, setResolvingGroup] = useState<string | null>(null);

  const [geminiReport, setGeminiReport] = useState<GeminiAdvisorOutput | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const dRes = await fetch("/api/duplicates");
      const dBody = await dRes.json();
      const dups = (dBody.data || dBody || []).map(transformDuplicateGroup);
      setDuplicateGroups(dups);

      const iRes = await fetch("/api/intelligence-data");
      const iData = await iRes.json();

      const stale = (iData.staleFiles || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        path: s.path || '',
        sizeBytes: s.sizeBytes || 0,
        category: 'other' as const,
        starred: false,
        modified: `Modified ${s.lastModifiedYear || 'Unknown'}`,
        accountEmail: s.accountEmail || '',
      }));
      setStaleFiles(stale);

      const large = (iData.largestFiles || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        path: l.path || '',
        sizeBytes: l.sizeBytes || 0,
        category: l.category || 'other',
        starred: l.starred || false,
        modified: l.modified || '',
        accountEmail: l.accountEmail || '',
      }));
      setLargestFiles(large);
    } catch (e) {
      console.error("Failed to load intelligence telemetry", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [files]);

  const handleResolveDuplicates = async (groupId: string) => {
    setResolvingGroup(groupId);
    try {
      const response = await fetch(`/api/duplicates/${groupId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const body = await response.json();
        if (!body.data?.partial) {
          await fetchStats();
          onRefreshAllData();
        } else {
          const failed = body.data.results.filter((r: any) => !r.success);
          const msgs = failed.map((f: any) => `  • ${f.error}`).join('\n');
          alert('Some files could not be removed:\n' + msgs + '\n\nThe group was not resolved. Try re-syncing the account first.');
          await fetchStats();
        }
      }
    } catch (e) {
      console.error("Duplicates resolution failed", e);
    } finally {
      setResolvingGroup(null);
    }
  };

  const handleRequestGeminiReport = async () => {
    setLoadingAi(true);
    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const report = await response.json();
        setGeminiReport(report);
      }
    } catch (error) {
      console.error("Gemini Advisor call failed", error);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    handleRequestGeminiReport();
  }, []);

  const totalWastedBytes = duplicateGroups.reduce((acc, curr) => acc + curr.wastedSizeBytes, 0);

  const totalQuota = accounts.reduce((acc, curr) => acc + (curr as any).quotaBytes, 0);
  const totalUsed = accounts.reduce((acc, curr) => acc + (curr as any).usedBytes, 0);
  const currentUtilPercent = totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0;
  const targetUtilPercent = totalQuota > 0 ? ((totalUsed - totalWastedBytes) / totalQuota) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="geo-cell bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-extrabold text-black text-[12px] uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-red-650 shrink-0" />
                Waste Cleanup
              </h2>
              {totalWastedBytes > 0 ? (
                <span className="bg-red-650 text-white font-extrabold text-[9px] uppercase tracking-widest px-2.5 py-0.5 border border-black rounded-none">
                  Active duplicate alert
                </span>
              ) : (
                <span className="bg-[#10b981] text-white font-extrabold text-[9px] uppercase tracking-widest px-2.5 py-0.5 border border-black rounded-none">
                  Optimized
                </span>
              )}
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed max-w-lg font-medium">
              Aggregate paths mapped across your folders have been audited. Reclaim storage space consumed by cloned images, old logs and duplicated binaries.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
            <div>
              <div className="text-3xl font-black text-black tracking-tighter leading-none mb-1">
                {formatBytes(totalWastedBytes, 1).toUpperCase()}
              </div>
              <p className="text-[10px] text-slate-500 font-extrabold font-mono uppercase tracking-widest">Recoverable Space</p>
            </div>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="geo-btn-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Scan for Clones
            </button>
          </div>
        </div>

        <div className="geo-cell bg-white p-6 flex flex-col justify-between">
          <h3 className="font-extrabold text-black text-[11px] uppercase tracking-widest mb-2">Global Grid Utilization</h3>
          <div className="flex-grow flex flex-col justify-center">
            <div className="flex justify-between font-mono text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
              <span>Used space: {currentUtilPercent.toFixed(0)}%</span>
              <span>{(100 - currentUtilPercent).toFixed(0)}% Free</span>
            </div>
            <div className="h-6 w-full bg-slate-100 border-2 border-black rounded-none overflow-hidden mb-4 relative">
              <div
                className="h-full bg-[#10b981] transition-all duration-300 relative"
                style={{ width: `${currentUtilPercent}%` }}
              >
                <div className="absolute inset-0 geo-stripes opacity-15 mix-blend-overlay"></div>
              </div>
            </div>
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
              Purging redundant duplicates will immediately lower total cloud utilization to{" "}
              <strong className="text-black font-extrabold">{targetUtilPercent.toFixed(0)}%</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-black text-white border-2 border-black rounded-none p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 geo-stripes-slate opacity-15 pointer-events-none" />

        <div className="space-y-3.5 max-w-2xl z-10 w-full">
          <div className="flex items-center gap-2 text-blue-400">
            <Sparkles className="w-4 h-4 fill-blue-400 animate-pulse shrink-0" />
            <span className="text-[10px] uppercase font-black tracking-widest font-mono">
              Server-Side Gemini Storage Audit Grid
            </span>
          </div>

          {geminiReport ? (
            <div className="space-y-4">
              <div>
                <span className="text-[9.5px] bg-[#2563eb] text-white border border-black px-2.5 py-1 font-bold font-mono tracking-widest uppercase">
                  Model Advisor ID: {geminiReport.persona}
                </span>
                <p className="text-[13px] text-slate-100 font-bold leading-normal mt-3 pl-1 font-mono uppercase tracking-wide">
                  "{geminiReport.statusSummary}"
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                {geminiReport.recommendations.map((rec, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-705 p-4 rounded-none text-left flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] text-[#3b82f6] font-mono font-extrabold tracking-widest bg-black border border-slate-700 px-2 py-0.5">
                        RECLAIM {rec.spaceReclaimed.toUpperCase()}
                      </span>
                      <h5 className="font-extrabold text-xs text-white uppercase tracking-tight mt-3">{rec.title}</h5>
                      <p className="text-[10.5px] text-slate-400 line-clamp-3 leading-relaxed mt-1 font-mono">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">AI Cloud Storage Advisor</h3>
              <p className="text-[12px] text-slate-300 mt-1 leading-normal font-mono uppercase">
                Authorize Gemini storage analyzer to conduct vector comparisons, review redundant folders across S3 & Google Drive, and draft space recovery recommendations.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleRequestGeminiReport}
          disabled={loadingAi}
          className="geo-btn-primary bg-white text-black border-white hover:bg-slate-200 active:translate-y-0.5 transition-all self-start md:self-center shrink-0 z-10"
        >
          {loadingAi ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              Auditing...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Audit Storage
            </>
          )}
        </button>
      </section>

      <section className="geo-cell bg-white p-6 space-y-4">
        <div className="border-b-2 border-black pb-3 flex justify-between items-center">
          <h3 className="font-extrabold text-[11px] uppercase tracking-widest text-black">Redundant Duplicate Groups</h3>
          <span className="text-[10px] font-mono font-bold uppercase text-slate-500">Telemetry size sorted</span>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-mono flex flex-col items-center gap-2 uppercase font-bold">
            <CheckSquare className="w-8 h-8 text-emerald-500 shrink-0" />
            No redundant duplicate clones detected across your networks!
          </div>
        ) : (
          <div className="space-y-4">
            {duplicateGroups.map((group) => {
              const isResolving = resolvingGroup === group.id;
              const displayName = group.duplicateFiles?.[0]?.file?.name || group.checksum?.replace(/^name:/, '') || 'Unknown';
              return (
                <div key={group.id} className="border border-black rounded-none p-4 bg-slate-50 space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="p-2 border border-black rounded-none text-white bg-black">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-black text-[13px] uppercase tracking-tight">{displayName}</h4>
                        <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5 uppercase tracking-wide">
                          {group.instances.length} exact duplicates cloned in different environments
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-black text-red-650 font-mono">
                        {formatBytes(group.wastedSizeBytes).toUpperCase()}
                      </div>
                      <p className="text-[9px] text-slate-400 font-extrabold tracking-widest font-sans uppercase mt-0.5">
                        Wasted space
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {group.instances.map((ins, i) => (
                      <div
                        key={i}
                        className="h-10 bg-white border border-black rounded-none px-3.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-slate-800 font-mono text-[11px] font-bold">
                          {ins.path}
                        </span>
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <span className="text-[9.5px] bg-[#000] text-white border border-black font-extrabold font-mono px-2 py-0.5 tracking-wider">
                            {ins.accountEmail?.split("@")[0] || "SYSTEM"}
                          </span>
                          <span className="text-slate-600 font-mono font-bold text-[10.5px]">
                            {formatBytes(ins.sizeBytes).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleResolveDuplicates(group.id)}
                      disabled={isResolving}
                      className="px-3 py-1.5 bg-white border border-black text-red-650 hover:bg-red-50 text-[11px] font-extrabold shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer rounded-none uppercase tracking-wider"
                    >
                      {isResolving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                          Resolving Clones...
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 mr-1" />
                          Resolve Duplicates
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="geo-cell bg-white p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-black pb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-black text-[11px] uppercase tracking-widest">Stale files (&gt; 1 Year aging)</h3>
              <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Inactive data</span>
            </div>

            <div className="divide-y divide-black font-mono">
              {staleFiles.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-[11px] uppercase font-bold">No stale files detected.</div>
              ) : (
                staleFiles.map((st) => (
                  <div key={st.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate pr-4">
                      <h5 className="font-extrabold text-black truncate uppercase" title={st.name}>{st.name}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{st.path}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-[#e11d48]">{formatBytes(st.sizeBytes).toUpperCase()}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">MODIFIED: {st.modified.toUpperCase()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button className="geo-btn-secondary w-full mt-5" onClick={() => alert('Coming soon.')}>
            View All Stale Files
          </button>
        </div>

        <div className="geo-cell bg-white p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-black pb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-black text-[11px] uppercase tracking-widest">Largest Consolidated Files</h3>
              <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Capacity consumers</span>
            </div>

            <div className="divide-y divide-black font-mono">
              {largestFiles.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-[11px] uppercase font-bold">No file data available.</div>
              ) : (
                largestFiles.map((lg) => (
                  <div key={lg.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate pr-4">
                      <h5 className="font-extrabold text-black truncate uppercase" title={lg.name}>{lg.name}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{lg.path}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-black">{formatBytes(lg.sizeBytes).toUpperCase()}</span>
                      <p className="text-[9.5px] bg-slate-100 text-black border border-black font-extrabold px-1.5 py-0.5 rounded-none mt-1 inline-block">
                        {lg.accountEmail?.split("@")[0].toUpperCase() || "SYSTEM"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button className="geo-btn-secondary w-full mt-5" onClick={() => alert('Coming soon.')}>
            View All Large Files
          </button>
        </div>
      </section>
    </div>
  );
}
