import React, { useState } from 'react';
import {
  Settings,
  ToggleLeft,
  ToggleRight,
  Bell,
  Database,
  HardDrive,
  RefreshCw,
  Upload,
  Sun,
  Moon,
  CheckCircle,
} from 'lucide-react';
import {
  type UploadMode,
  type ThemeMode,
  type UserSettings,
  setTheme,
  getDedupMode,
  setDedupMode,
  patchSettings,
  clearLocalAppData,
} from '../settings';

interface SettingsViewProps {
  settings: UserSettings;
  theme: ThemeMode;
  onSettingsChange: (next: UserSettings) => void;
  onThemeChange: (theme: ThemeMode) => void;
}

export default function SettingsView({
  settings,
  theme,
  onSettingsChange,
  onThemeChange,
}: SettingsViewProps) {
  const [dedupMode, setDedupModeState] = useState<'auto' | 'manual'>(() => getDedupMode());
  const [saving, setSaving] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);

  const handleDedup = (mode: 'auto' | 'manual') => {
    setDedupModeState(mode);
    setDedupMode(mode);
  };

  const handleUploadMode = async (mode: UploadMode) => {
    if (mode === settings.uploadMode) return;
    const prev = settings;
    onSettingsChange({ ...settings, uploadMode: mode });
    setSaving(true);
    try {
      const next = await patchSettings({ uploadMode: mode });
      onSettingsChange(next);
    } catch {
      onSettingsChange(prev);
      alert('Failed to save upload mode');
    } finally {
      setSaving(false);
    }
  };

  const handleNotifications = async () => {
    const nextVal = !settings.notificationsEnabled;
    const prev = settings;
    onSettingsChange({ ...settings, notificationsEnabled: nextVal });
    setSaving(true);
    try {
      const next = await patchSettings({ notificationsEnabled: nextVal });
      onSettingsChange(next);
    } catch {
      onSettingsChange(prev);
      alert('Failed to save notification preference');
    } finally {
      setSaving(false);
    }
  };

  const handleTheme = (next: ThemeMode) => {
    setTheme(next);
    onThemeChange(next);
  };

  const handleClearCache = () => {
    clearLocalAppData();
    setDedupModeState('auto');
    onThemeChange('light');
    setCacheMsg('Local data cleared (theme, dedup preference, cached app keys).');
    setTimeout(() => setCacheMsg(null), 4000);
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-[10px] font-semibold border tracking-normal ${
      active
        ? 'bg-black text-white border-black shadow-[2px_2px_0px_#3b82f6] dark-active-pill'
        : 'bg-white text-slate-500 border-slate-300 hover:border-black settings-pill-inactive'
    }`;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 settings-page">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-black settings-icon" />
        <h2 className="font-black text-black text-lg tracking-normal settings-title">Settings</h2>
        {saving && <span className="text-[10px] font-bold text-slate-400">Saving…</span>}
      </div>

      {/* Duplication Engine */}
      <section className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden settings-card">
        <div className="bg-black text-white px-6 py-3 flex items-center gap-3">
          <Database className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-[11px] tracking-normal">Duplication Engine</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h4 className="font-extrabold text-[13px] text-black settings-label">Dedup Mode</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 settings-desc">
              Auto mode runs duplicate scans after each sync. Manual requires explicit trigger from Intelligence.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => handleDedup('auto')} className={pill(dedupMode === 'auto')}>
              Auto
            </button>
            <button type="button" onClick={() => handleDedup('manual')} className={pill(dedupMode === 'manual')}>
              Manual
            </button>
          </div>
        </div>
      </section>

      {/* Upload Routing */}
      <section className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden settings-card">
        <div className="bg-black text-white px-6 py-3 flex items-center gap-3">
          <Upload className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-[11px] tracking-normal">Upload Routing</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h4 className="font-extrabold text-[13px] text-black settings-label">Target Account</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 settings-desc">
              Auto sends uploads to the connected account with the most free storage. Manual lets you pick an account each time you upload.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleUploadMode('auto')}
              className={pill(settings.uploadMode === 'auto')}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => handleUploadMode('manual')}
              className={pill(settings.uploadMode === 'manual')}
            >
              Manual
            </button>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden settings-card">
        <div className="bg-black text-white px-6 py-3 flex items-center gap-3">
          <Bell className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-[11px] tracking-normal">Notifications</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h4 className="font-extrabold text-[13px] text-black settings-label">Sync Alerts</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 settings-desc">
              Show toast notifications when a sync completes or fails.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.notificationsEnabled}
            onClick={handleNotifications}
            className="transition-colors shrink-0"
            title={settings.notificationsEnabled ? 'Notifications on' : 'Notifications off'}
          >
            {settings.notificationsEnabled ? (
              <ToggleRight className="w-8 h-8 text-blue-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden settings-card">
        <div className="bg-black text-white px-6 py-3 flex items-center gap-3">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-blue-400" />}
          <h3 className="font-semibold text-[11px] tracking-normal">Appearance</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h4 className="font-extrabold text-[13px] text-black settings-label">Theme</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5 settings-desc">
              Light or dark Neo-Brutalist chrome. Saved on this browser only.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={() => handleTheme('light')} className={`${pill(theme === 'light')} flex items-center gap-1.5`}>
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
            <button type="button" onClick={() => handleTheme('dark')} className={`${pill(theme === 'dark')} flex items-center gap-1.5`}>
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
          </div>
        </div>
      </section>

      {/* Cache */}
      <div className="bg-amber-50 border-2 border-black p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4 settings-cache-card">
        <div className="flex items-center gap-3 min-w-0">
          <HardDrive className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-extrabold text-black text-[12px] settings-label">Cache & Local Data</h4>
            <p className="text-[10px] text-slate-600 font-bold settings-desc">
              Clears theme, local preferences, and other BIND keys stored in this browser. Does not disconnect Google accounts or delete Drive files.
            </p>
            {cacheMsg && (
              <p className="text-[10px] text-emerald-700 font-bold mt-1.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {cacheMsg}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClearCache}
          className="px-4 py-2 bg-white border border-black text-slate-700 hover:bg-red-50 hover:text-red-600 text-[10px] font-semibold tracking-normal shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0 settings-clear-btn"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
