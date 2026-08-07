import React, { useState, useEffect } from 'react';
import { CloudAccount, CloudFile } from './types';
import SideNavBar from './components/SideNavBar';
import TopNavBar from './components/TopNavBar';
import DashboardView from './components/DashboardView';
import FileManagerView from './components/FileManagerView';
import IntelligenceView from './components/IntelligenceView';
import AccountsView from './components/AccountsView';
import SettingsView from './components/SettingsView';
import SupportView from './components/SupportView';
import { ConnectAccountModal, UploadModal } from './components/Modals';
import { apiFetch } from './api';
import {
  applyStoredTheme,
  fetchSettings,
  DEFAULT_SETTINGS,
  type UserSettings,
  type ThemeMode,
} from './settings';
import { Cloud, RefreshCw, CheckCircle, XCircle, X } from 'lucide-react';

type SyncAccountProgress = {
  id: string;
  email: string;
  label: string;
  color: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  detail?: string;
};

function categorizeMimeType(mimeType: string, isFolder: boolean): string {
  if (isFolder) return 'other';
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf' || mimeType.includes('document') || mimeType.includes('word')) return 'docs';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z')) return 'archive';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'data';
  if (mimeType.includes('json') || mimeType.includes('xml')) return 'data';
  return 'other';
}

function formatSize(size: string | null): number {
  return size ? Math.round(Number(size)) : 0;
}

function formatModified(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function stringToColor(str: string): string {
  const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ab47bc', '#ff6d01', '#46bdc6', '#7b1fa2'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function transformFile(backendFile: any): CloudFile {
  return {
    ...backendFile,
    sizeBytes: formatSize(backendFile.size),
    category: categorizeMimeType(backendFile.mimeType, backendFile.isFolder),
    modified: formatModified(backendFile.modifiedAtProvider),
    accountEmail: backendFile.account?.email || '',
  };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [syncNotification, setSyncNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [syncProgressOpen, setSyncProgressOpen] = useState(false);
  const [syncProgressItems, setSyncProgressItems] = useState<SyncAccountProgress[]>([]);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [theme, setThemeState] = useState<ThemeMode>(() => applyStoredTheme());

  const checkAuth = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const body = await res.json();
        if (body.data?.user) {
          setIsAuthenticated(true);
          const [settings] = await Promise.all([fetchSettings(), fetchAllData()]);
          setUserSettings(settings);
          return;
        }
      }
    } catch (e) {
      console.error('Auth check failed', e);
    }
    setAuthChecked(true);
    setLoading(false);
  };

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (authChecked && !isAuthenticated && !loading && !splashDone) {
      const startTime = Date.now();
      const duration = 3000;
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setSplashProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setSplashDone(true);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [authChecked, isAuthenticated, loading, splashDone]);

  const fetchAllData = async (showSync = false) => {
    if (showSync) setIsSyncing(true);
    try {
      const [accountsRes, filesRes, storageRes] = await Promise.all([
        apiFetch('/api/accounts'),
        apiFetch('/api/files?limit=50'),
        apiFetch('/api/storage'),
      ]);

      let accs: CloudAccount[] = [];
      if (accountsRes.ok) {
        const body = await accountsRes.json();
        accs = (body.data || []).map((a: any) => ({
          id: a.id,
          email: a.email,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
          provider: a.provider === 'google' ? 'Google Drive' : a.provider,
          isActive: a.isActive,
          syncStatus: a.syncStatus,
          lastSyncedAt: a.lastSyncedAt,
          createdAt: a.createdAt,
          quotaUsed: 0,
          quotaTotal: 0,
          usagePercent: 0,
          color: stringToColor(a.email),
        }));
      }

      if (storageRes.ok) {
        const sbody = await storageRes.json();
        const storage = sbody.data || sbody;
        if (storage.accounts) {
          accs = accs.map((a) => {
            const sa = storage.accounts.find((s: any) => s.accountId === a.id);
            if (sa) {
              const total = Number(sa.totalBytes ?? sa.quotaBytes ?? 0);
              const used = Number(sa.usedBytes ?? 0);
              return { ...a, quotaUsed: used, quotaTotal: total, usagePercent: total > 0 ? (used / total) * 100 : 0 };
            }
            return a;
          });
        }
      }

      let fls: CloudFile[] = [];
      if (filesRes.ok) {
        const body = await filesRes.json();
        fls = (body.data || []).map(transformFile);
      }

      setAccounts(accs);
      setFiles(fls);
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
      setAuthChecked(true);
      if (showSync) setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const handleSyncAccount = async (accountId: string): Promise<'SYNCED' | 'ERROR' | string> => {
    try {
      const res = await apiFetch(`/api/accounts/${accountId}/sync`, { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        if (body.data?.syncStatus === 'SYNCED') {
          const n = body.data?.totalIndexed;
          return typeof n === 'number' ? `SYNCED:${n}` : 'SYNCED';
        }
        return 'ERROR';
      }
      const body = await res.json().catch(() => ({}));
      return body.error?.message || 'ERROR';
    } catch (e) {
      return e instanceof Error ? e.message : 'ERROR';
    }
  };

  const showSyncToast = (message: string, type: 'success' | 'error') => {
    if (!userSettings.notificationsEnabled) return;
    setSyncNotification({ message, type });
    setTimeout(() => setSyncNotification(null), 4000);
  };

  const updateSyncItem = (id: string, patch: Partial<SyncAccountProgress>) => {
    setSyncProgressItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSyncAllAccounts = async () => {
    if (accounts.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncNotification(null);
    const initial: SyncAccountProgress[] = accounts.map((a) => ({
      id: a.id,
      email: a.email,
      label: a.email.split('@')[0] || a.email,
      color: a.color,
      status: 'pending',
    }));
    setSyncProgressItems(initial);
    setSyncProgressOpen(true);

    let failCount = 0;

    // Sequential so the panel shows clear account-by-account progress
    for (const account of accounts) {
      updateSyncItem(account.id, { status: 'syncing', detail: 'Indexing Drive…' });
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, syncStatus: 'SYNCING' } : a)),
      );

      const result = await handleSyncAccount(account.id);

      if (typeof result === 'string' && result.startsWith('SYNCED')) {
        const indexed = result.includes(':') ? result.split(':')[1] : undefined;
        updateSyncItem(account.id, {
          status: 'success',
          detail: indexed ? `${indexed} items indexed` : 'Synced',
        });
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id ? { ...a, syncStatus: 'SYNCED', lastSyncedAt: new Date().toISOString() } : a,
          ),
        );
      } else {
        failCount += 1;
        const errMsg = result === 'ERROR' || !result ? 'Sync failed' : String(result);
        updateSyncItem(account.id, { status: 'error', detail: errMsg });
        setAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? { ...a, syncStatus: 'ERROR' } : a)),
        );
      }
    }

    await fetchAllData(true);
    setIsSyncing(false);

    if (failCount === 0) {
      showSyncToast(
        `All ${accounts.length} account${accounts.length > 1 ? 's' : ''} synced successfully`,
        'success',
      );
    } else {
      showSyncToast(
        `${failCount} of ${accounts.length} account${accounts.length > 1 ? 's' : ''} failed to sync`,
        'error',
      );
    }
  };

  const handleSyncOneAccount = async (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account || isSyncing) return;

    setIsSyncing(true);
    setSyncNotification(null);
    setSyncProgressItems([
      {
        id: account.id,
        email: account.email,
        label: account.email.split('@')[0] || account.email,
        color: account.color,
        status: 'syncing',
        detail: 'Indexing Drive…',
      },
    ]);
    setSyncProgressOpen(true);
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, syncStatus: 'SYNCING' } : a)),
    );

    const result = await handleSyncAccount(accountId);

    if (typeof result === 'string' && result.startsWith('SYNCED')) {
      const indexed = result.includes(':') ? result.split(':')[1] : undefined;
      updateSyncItem(accountId, {
        status: 'success',
        detail: indexed ? `${indexed} items indexed` : 'Synced',
      });
      showSyncToast(`${account.email.split('@')[0]} synced successfully`, 'success');
    } else {
      const errMsg = result === 'ERROR' || !result ? 'Sync failed' : String(result);
      updateSyncItem(accountId, { status: 'error', detail: errMsg });
      showSyncToast(`${account.email.split('@')[0]}: ${errMsg}`, 'error');
    }

    await fetchAllData(true);
    setIsSyncing(false);
  };

  const refreshStorageOnly = async () => {
    setIsSyncing(true);
    try {
      const res = await apiFetch('/api/storage');
      if (res.ok) {
        const sbody = await res.json();
        const storage = sbody.data || sbody;
        if (storage.accounts) {
          setAccounts((prev) =>
            prev.map((a) => {
              const sa = storage.accounts.find((s: any) => s.accountId === a.id);
              if (sa) {
                const total = Number(sa.totalBytes ?? sa.quotaBytes ?? 0);
                const used = Number(sa.usedBytes ?? 0);
                return { ...a, quotaUsed: used, quotaTotal: total, usagePercent: total > 0 ? (used / total) * 100 : 0 };
              }
              return a;
            }),
          );
        }
      }
    } catch (e) {
      console.error('Storage refresh failed', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const handleConnectAccount = () => { window.location.href = '/api/auth/google'; };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAccounts([]);
    setFiles([]);
    setCurrentTab('dashboard');
    setIsAuthenticated(false);
    setAuthChecked(true);
    setLoading(false);
    setSplashDone(false);
    setSplashProgress(0);
    setUserSettings(DEFAULT_SETTINGS);
  };

  const handleDisconnectAccount = async (id: string) => {
    const res = await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) fetchAllData(true);
    else {
      const body = await res.json();
      alert(body.error?.message || 'Failed to disconnect');
    }
  };

  if (authChecked && !isAuthenticated && !loading) {
    if (!splashDone) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
          <div className="max-w-lg w-full text-center space-y-12">
            <div>
              <div className="w-20 h-20 border-4 border-black bg-black flex items-center justify-center text-white shadow-[8px_8px_0px_0px_#3b82f6] mx-auto mb-8">
                <Cloud className="w-10 h-10" />
              </div>
              <h1 className="font-black text-7xl text-black tracking-tight mb-4">BIND</h1>
              <p className="text-sm text-slate-400 font-bold tracking-normal ">Multi-account Google Drive command center</p>
            </div>
            <div className="w-full">
              <div className="h-3 w-full bg-slate-100 border-2 border-black overflow-hidden">
                <div className="h-full bg-[#3b82f6] geo-stripes transition-all duration-75" style={{ width: `${splashProgress}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-mono font-bold mt-3 tracking-normal">Initializing secure grid... {Math.round(splashProgress)}%</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="w-16 h-16 border-4 border-black bg-black flex items-center justify-center text-white shadow-[6px_6px_0px_0px_#3b82f6] mx-auto">
            <Cloud className="w-8 h-8" />
          </div>
          <h1 className="font-black text-5xl text-black tracking-normal ">BIND</h1>
          <p className="text-[11px] text-slate-500 font-bold -mt-4">Multi-account Google Drive command center</p>
          <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 space-y-5">
            <p className="text-xs text-slate-600 font-bold leading-relaxed tracking-normal">
              Consolidate all your Google Drive accounts into a single unified interface.
            </p>
            <p className="text-xs text-slate-600 font-bold leading-relaxed tracking-normal">
              Search, organize, and manage files across every cloud node from one secure command center.
            </p>
            <p className="text-xs text-slate-600 font-bold leading-relaxed tracking-normal">
              Detect duplicates, reclaim storage, and route uploads intelligently.
            </p>
            <div className="pt-2">
              <button onClick={() => { window.location.href = '/api/auth/google'; }} className="geo-btn-primary w-full h-12 text-sm flex items-center justify-center gap-2">
                <Cloud className="w-5 h-5" /> Sign in with Google
              </button>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 tracking-normal">
            <a href="/about/" className="underline font-bold text-slate-500 hover:text-black">About BIND</a>
            {' · '}
            <a href="/privacy/" className="underline font-bold text-slate-500 hover:text-black">Privacy</a>
            {' · '}
            <a href="/terms/" className="underline font-bold text-slate-500 hover:text-black">Terms</a>
          </p>
        </div>
      </div>
    );
  }

  if (!authChecked) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex app-shell">
      <SideNavBar currentTab={currentTab} setCurrentTab={setCurrentTab} accounts={accounts} onLogout={handleLogout} />
      <div className="flex-1 ml-64 flex flex-col min-h-screen relative font-sans app-main">
        <TopNavBar currentTab={currentTab} />
        <main className="flex-1 p-8 pt-24 overflow-y-auto app-content">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-24 text-slate-400 font-medium text-xs space-y-2 animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Piping cloud indexes...</span>
            </div>
          ) : renderContent()}
        </main>
      </div>
      <ConnectAccountModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} onSubmit={handleConnectAccount} />
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => { setIsUploadOpen(false); fetchAllData(true); setRefreshTick((t) => t + 1); }}
        accounts={accounts}
        uploadMode={userSettings.uploadMode}
      />
      {syncProgressOpen && syncProgressItems.length > 0 && (() => {
        const done = syncProgressItems.filter((i) => i.status === 'success' || i.status === 'error').length;
        const total = syncProgressItems.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const allDone = done === total && !isSyncing;
        const anyError = syncProgressItems.some((i) => i.status === 'error');
        return (
          <div className="fixed bottom-6 right-6 z-[100] w-[min(100vw-2rem,22rem)]">
            <div className="bg-white border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] overflow-hidden">
              <div className="bg-black text-white px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold tracking-normal">
                    {allDone ? (anyError ? 'Sync finished with errors' : 'Sync complete') : 'Syncing accounts'}
                  </p>
                  <p className="text-[9px] font-mono font-bold text-slate-300 mt-0.5">
                    {done} / {total} accounts · {pct}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncProgressOpen(false)}
                  className="text-white hover:text-slate-300 shrink-0 p-1"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 pt-3 pb-2">
                <div className="h-3 w-full bg-slate-100 border-2 border-black overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${anyError && allDone ? 'bg-red-500' : allDone ? 'bg-emerald-500' : 'bg-blue-500 geo-stripes'}`}
                    style={{ width: `${Math.max(pct, isSyncing && pct === 0 ? 8 : pct)}%` }}
                  />
                </div>
              </div>

              <div className="px-4 pb-4 max-h-56 overflow-y-auto space-y-2.5">
                {syncProgressItems.map((item) => {
                  const rowPct =
                    item.status === 'success' || item.status === 'error'
                      ? 100
                      : item.status === 'syncing'
                        ? 55
                        : 0;
                  const barCls =
                    item.status === 'success'
                      ? 'bg-emerald-500'
                      : item.status === 'error'
                        ? 'bg-red-500'
                        : item.status === 'syncing'
                          ? 'bg-blue-500 geo-stripes animate-pulse'
                          : 'bg-slate-300';
                  return (
                    <div key={item.id} className="border border-black p-2.5 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 border border-black shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[10px] font-extrabold truncate text-black">{item.label}</span>
                        </div>
                        <span className="shrink-0">
                          {item.status === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
                          {item.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                          {item.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                          {item.status === 'pending' && <span className="text-[8px] font-mono font-bold text-slate-400">WAIT</span>}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white border border-black overflow-hidden mb-1">
                        <div className={`h-full transition-all duration-500 ${barCls}`} style={{ width: `${rowPct}%` }} />
                      </div>
                      <p
                        className={`text-[8px] font-bold truncate ${
                          item.status === 'error' ? 'text-red-600' : item.status === 'success' ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {item.status === 'pending' && 'Queued…'}
                        {item.status === 'syncing' && (item.detail || 'Syncing…')}
                        {item.status === 'success' && (item.detail || 'Success')}
                        {item.status === 'error' && (item.detail || 'Error')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {syncNotification && !syncProgressOpen && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-2 fade-in">
          <div className={`bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] px-5 py-3.5 flex items-center gap-3 min-w-[280px] max-w-sm`}>
            <div className={`w-8 h-8 border border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)] ${syncNotification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {syncNotification.type === 'success' ? <CheckCircle className="w-4 h-4 text-white" /> : <XCircle className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-normal text-black break-words">{syncNotification.message}</p>
            </div>
            <button onClick={() => setSyncNotification(null)} className="text-slate-400 hover:text-black transition-colors shrink-0">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function renderContent() {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView accounts={accounts} files={files} onOpenUploadModal={() => setIsUploadOpen(true)} isSyncing={isSyncing} onRefreshStorage={refreshStorageOnly} onNavigateIntelligence={() => setCurrentTab('intelligence')} onSyncAccounts={handleSyncAllAccounts} />;
      case 'files':
        return (
          <FileManagerView
            accounts={accounts}
            refreshTick={refreshTick}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            showSharedFiles={userSettings.showSharedFiles}
          />
        );
      case 'intelligence':
        return <IntelligenceView accounts={accounts} files={files} onRefreshAllData={() => fetchAllData(true)} />;
      case 'accounts':
        return (
          <AccountsView
            accounts={accounts}
            onOpenConnectModal={() => setIsConnectOpen(true)}
            onRefreshAllData={() => fetchAllData(true)}
            onDisconnectAccount={handleDisconnectAccount}
            onSyncAccount={handleSyncOneAccount}
            onSyncAll={handleSyncAllAccounts}
            isSyncing={isSyncing}
            onLogout={handleLogout}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={userSettings}
            theme={theme}
            onSettingsChange={setUserSettings}
            onThemeChange={setThemeState}
          />
        );
      case 'support':
        return <SupportView />;
      default:
        return null;
    }
  }
}
