import React, { useState } from "react";
import { X, Cloud, Info, FolderPlus, Upload, ShieldCheck } from "lucide-react";
import { CloudAccount } from "../types";

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, provider: string, quotaGB: string, syncFrequency: string) => Promise<void>;
}

export function ConnectAccountModal({
  isOpen,
  onClose,
  onSubmit,
}: ConnectAccountModalProps) {
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("Google Drive");
  const [quotaGB, setQuotaGB] = useState("1024");
  const [syncFrequency, setSyncFrequency] = useState("15m");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !quotaGB) return;
    setSubmitting(true);
    await onSubmit(email, provider, quotaGB, syncFrequency);
    setSubmitting(false);
    setEmail("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/45 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000000] max-w-md w-full overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-5 border-b-2 border-black flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black rounded-none bg-black flex items-center justify-center text-white">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-black text-[13px] uppercase tracking-wider">Connect New Cloud Account</h3>
              <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-tight mt-0.5">Link workspace indices securely</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 px-2 border-2 border-black text-black font-black hover:bg-slate-200 rounded-none transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Provider Option */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Cloud Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 bg-white font-bold uppercase text-[11px]"
            >
              <option value="Google Drive">Google Drive / GSuite</option>
              <option value="OneDrive">Microsoft OneDrive</option>
              <option value="Dropbox">Dropbox Personal / Teams</option>
              <option value="AWS S3">Amazon S3 Object Bucket</option>
              <option value="Box">Box Professional</option>
            </select>
          </div>

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Email Address</label>
            <input
              type="email"
              placeholder="e.g. workspace.admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 font-semibold text-[11.5px]"
            />
          </div>

          {/* Quota inputs and frequency row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Quota Limit (GB)</label>
              <input
                type="number"
                min="1"
                placeholder="1024"
                value={quotaGB}
                onChange={(e) => setQuotaGB(e.target.value)}
                required
                className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 font-semibold text-[11.5px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Interval sync</label>
              <select
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(e.target.value)}
                className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 bg-white font-bold uppercase text-[11px]"
              >
                <option value="realtime">Push (Real-time)</option>
                <option value="15m">Every 15 minutes</option>
                <option value="hourly">Hourly Sync</option>
                <option value="manual">Manual trigger</option>
              </select>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-slate-50 border border-black p-3 rounded-none flex gap-2 text-[10px] text-slate-700 font-mono tracking-tight uppercase leading-normal">
            <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <span>Connects safely using Google Cloud API scopes. BIND never stores raw user passwords.</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black text-black hover:bg-slate-100 rounded-none font-extrabold cursor-pointer text-xs uppercase font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="geo-btn-primary shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 text-xs px-4"
            >
              Link Connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CloudAccount[];
  onSubmit: (name: string, sizeBytes: string, category: string, targetAccount: string) => Promise<void>;
}

export function UploadModal({
  isOpen,
  onClose,
  accounts,
  onSubmit,
}: UploadModalProps) {
  const [filename, setFilename] = useState("");
  const [sizeMB, setSizeMB] = useState("50");
  const [category, setCategory] = useState("docs");
  const [targetAccount, setTargetAccount] = useState(accounts[0]?.email || "");
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename || !sizeMB) return;
    setUploading(true);

    // Convert MB to bytes
    const bytes = parseFloat(sizeMB) * 1024 * 1024;
    await onSubmit(filename, bytes.toString(), category, targetAccount);

    setUploading(false);
    setFilename("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/45 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000000] max-w-sm w-full overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-5 border-b-2 border-black flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-black rounded-none bg-black flex items-center justify-center text-white">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-black text-[13px] uppercase tracking-wider">Quick Smart-Upload</h3>
              <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-tight mt-0.5">Automated router networks</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 px-2 border-2 border-black text-black font-black hover:bg-slate-200 rounded-none transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Filename Input */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Filename</label>
            <input
              type="text"
              placeholder="e.g. sales_forecast_2026.xlsx"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              required
              className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 font-semibold text-[11.5px]"
            />
          </div>

          {/* Size and Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Size (MB)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={sizeMB}
                onChange={(e) => setSizeMB(e.target.value)}
                required
                className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 font-semibold text-[11.5px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Mime Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 bg-white font-bold uppercase text-[11px]"
              >
                <option value="docs">Document / Sheet</option>
                <option value="images">Image Assets</option>
                <option value="video">Promotional Video</option>
                <option value="archive">Compressed Archive (.zip)</option>
                <option value="data">Database Dump (.sql)</option>
              </select>
            </div>
          </div>

          {/* Router Selection */}
          <div className="space-y-1.5">
            <label className="font-extrabold text-black uppercase tracking-widest font-mono text-[9.5px]">Target Router Node</label>
            <select
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value)}
              className="w-full h-10 border-2 border-black focus:outline-none rounded-none px-3 bg-white font-bold uppercase text-[11px]"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.email}>
                  {acc.email} ({acc.provider.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Notice */}
          <div className="bg-slate-50 border border-black p-3 rounded-none flex gap-2 text-[10px] text-slate-700 font-mono tracking-tight uppercase leading-normal">
            <ShieldCheck className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
            <span>Intelligent router automatically assigns optimal data clusters to avoid storage redundancy bounds.</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-black text-black hover:bg-slate-100 rounded-none font-extrabold cursor-pointer text-xs uppercase font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="geo-btn-primary shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 text-xs px-4"
            >
              Upload node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
