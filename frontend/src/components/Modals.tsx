import React, { useState, useRef, useEffect, useCallback } from "react";
import { CloudAccount } from "../types";
import { X, Cloud, Upload, ExternalLink, CheckCircle, XCircle, Clock, Loader } from "lucide-react";
import { apiFetch } from "../api";

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CloudAccount[];
}

interface UploadFileEntry {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'success' | 'failed';
  progress: number;
  jobId?: string;
  errorMessage?: string;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

let fileIdCounter = 0;

export function ConnectAccountModal({ isOpen, onClose, onSubmit }: ConnectAccountModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md mx-4 relative" onClick={(e) => e.stopPropagation()}>
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-[12px] uppercase tracking-widest">Link Cloud Account</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <p className="text-[12px] text-slate-600 font-mono font-medium leading-relaxed">
            You will be redirected to Google to authorize access to your Drive files. Only metadata and file listings are indexed — content stays in Google Drive.
          </p>
          <div className="bg-blue-50 border border-blue-200 p-4">
            <p className="text-[10px] text-blue-800 font-extrabold font-mono uppercase tracking-wider">
              <ExternalLink className="w-3 h-3 inline mr-1" /> Google OAuth popup will open in a new window.
            </p>
          </div>
          <button onClick={onSubmit} className="geo-btn-primary w-full h-12 text-sm flex items-center justify-center gap-2">
            <Cloud className="w-5 h-5" /> Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

export function UploadModal({ isOpen, onClose, accounts }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setUploading(false);
      pollTimers.current.forEach((t) => clearInterval(t));
      pollTimers.current.clear();
    }
  }, [isOpen]);

  const stopPolling = useCallback((id: string) => {
    const t = pollTimers.current.get(id);
    if (t) {
      clearInterval(t);
      pollTimers.current.delete(id);
    }
  }, []);

  const pollJobStatus = useCallback((entryId: string, jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/upload/${jobId}`);
        if (res.ok) {
          const body = await res.json();
          const job = body.data;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entryId
                ? { ...f, progress: job.progress ?? f.progress, status: job.status === 'COMPLETE' ? 'success' as const : job.status === 'FAILED' ? 'failed' as const : 'uploading' as const, errorMessage: job.errorMessage ?? undefined }
                : f,
            ),
          );
          if (job.status === 'COMPLETE' || job.status === 'FAILED') {
            stopPolling(entryId);
            checkAllDone();
          }
        }
      } catch {
        stopPolling(entryId);
      }
    }, 2000);
    pollTimers.current.set(entryId, interval);
  }, [stopPolling]);

  const checkAllDone = useCallback(() => {
    setFiles((prev) => {
      const allDone = prev.every((f) => f.status === 'success' || f.status === 'failed');
      if (allDone) setUploading(false);
      return prev;
    });
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: UploadFileEntry[] = Array.from(newFiles).map((file) => ({
      id: `file_${++fileIdCounter}`,
      file,
      status: 'queued',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const handleUploadAll = useCallback(async () => {
    setUploading(true);
    const toUpload = files.filter((f) => f.status === 'queued');
    if (toUpload.length === 0) return;

    setFiles((prev) => prev.map((f) => (f.status === 'queued' ? { ...f, status: 'uploading' as const } : f)));

    for (const entry of toUpload) {
      const formData = new FormData();
      formData.append('file', entry.file);
      try {
        const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const body = await res.json();
          const jobId = body.data.id;
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, jobId, progress: 5, status: 'uploading' as const } : f)),
          );
          pollJobStatus(entry.id, jobId);
        } else {
          const body = await res.json();
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, status: 'failed' as const, errorMessage: body.error?.message || 'Upload failed' } : f)),
          );
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, status: 'failed' as const, errorMessage: 'Upload failed — is the backend running?' } : f)),
        );
      }
    }
  }, [files, pollJobStatus]);

  const removeFile = useCallback((id: string) => {
    stopPolling(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, [stopPolling]);

  const totalQuota = accounts.reduce((s, a) => s + a.quotaTotal, 0);
  const totalUsed = accounts.reduce((s, a) => s + a.quotaUsed, 0);
  const pct = totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0;

  const queuedCount = files.filter((f) => f.status === 'queued').length;
  const allDone = files.length > 0 && files.every((f) => f.status === 'success' || f.status === 'failed');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-lg mx-4 relative max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-blue-400" />
            <h2 className="font-extrabold text-[12px] uppercase tracking-widest">Upload Files</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed border-black p-8 text-center cursor-pointer transition-colors ${dragOver ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
            <p className="font-extrabold text-black text-[11px] uppercase tracking-wider mb-1">Drop files here or click to browse</p>
            <p className="text-[9px] text-slate-400 font-mono font-bold uppercase">Select multiple files at once</p>
          </div>

          {files.length > 0 && (
            <div className="border border-black divide-y divide-black max-h-56 overflow-y-auto">
              {files.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {entry.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : entry.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      ) : entry.status === 'uploading' ? (
                        <Loader className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-[11px] font-extrabold text-black truncate uppercase">{entry.file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] font-mono font-bold text-slate-500">{formatBytes(entry.file.size, 0)}</span>
                      {entry.status === 'queued' && !uploading && (
                        <button onClick={() => removeFile(entry.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {(entry.status === 'uploading' || entry.status === 'success') && (
                    <div className="h-2 w-full bg-slate-100 border border-black overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${entry.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500 geo-stripes'}`}
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                  )}
                  {entry.status === 'failed' && entry.errorMessage && (
                    <p className="text-[9px] text-red-600 font-mono font-bold mt-1 truncate">{entry.errorMessage}</p>
                  )}
                  {entry.status === 'uploading' && (
                    <p className="text-[8px] text-blue-600 font-mono font-bold mt-0.5">Uploading... {entry.progress}%</p>
                  )}
                  {entry.status === 'success' && (
                    <p className="text-[8px] text-emerald-600 font-mono font-bold mt-0.5">Upload successful</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono font-bold text-slate-600 uppercase">
              <span>Grid Storage Status</span>
              <span>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="h-4 w-full bg-slate-100 border border-black overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-black flex items-center justify-between shrink-0 bg-slate-50">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-3">
            {allDone ? (
              <button onClick={onClose} className="geo-btn-primary text-[10px] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Done
              </button>
            ) : (
              <>
                <button onClick={onClose} className="px-4 py-2 border border-black bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all">
                  Cancel
                </button>
                {files.length > 0 && queuedCount > 0 && (
                  <button onClick={handleUploadAll} disabled={uploading} className="geo-btn-primary text-[10px] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Upload {queuedCount > 1 ? `All (${queuedCount})` : ''}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
