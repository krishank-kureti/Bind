import React, { useState, useEffect } from "react";
import { CloudAccount, CloudFile, ActivityLog } from "./types";
import SideNavBar from "./components/SideNavBar";
import TopNavBar from "./components/TopNavBar";
import DashboardView from "./components/DashboardView";
import FileManagerView from "./components/FileManagerView";
import IntelligenceView from "./components/IntelligenceView";
import AccountsView from "./components/AccountsView";
import SettingsView from "./components/SettingsView";
import SupportView from "./components/SupportView";
import { ConnectAccountModal, UploadModal } from "./components/Modals";
import { Settings as SettingsIcon, ShieldCheck, Activity, Key, Globe, Eye, User, Terminal, RefreshCw } from "lucide-react";

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
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function transformFile(backendFile: any): CloudFile {
  return {
    ...backendFile,
    sizeBytes: formatSize(backendFile.size),
    category: categorizeMimeType(backendFile.mimeType, backendFile.isFolder),
    path: backendFile.fullPath || '/',
    modified: formatModified(backendFile.modifiedAtProvider),
    accountEmail: backendFile.account?.email || '',
  };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const userEmail = "kuretikrishank@gmail.com";

  const fetchAllData = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsSyncing(true);
    try {
      const [accountsRes, filesRes, activitiesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/files?limit=200"),
        fetch("/api/activities"),
      ]);

      let accs: CloudAccount[] = [];
      let fls: CloudFile[] = [];
      let acts: ActivityLog[] = [];

      if (accountsRes.ok) {
        const body = await accountsRes.json();
        accs = (body.data || body).map((a: any) => ({
          ...a,
          provider: a.provider === 'google' ? 'Google Drive' : a.provider,
          status: a.syncStatus === 'SYNCED' ? 'synced' : a.syncStatus === 'SYNCING' ? 'syncing' : a.syncStatus === 'ERROR' ? 'auth_error' : 'synced',
          quotaBytes: 0,
          usedBytes: 0,
          color: '#4285f4',
          syncFrequency: '15m',
        }));
      }

      if (filesRes.ok) {
        const body = await filesRes.json();
        fls = (body.data || []).map(transformFile);
      }

      if (activitiesRes.ok) {
        const body = await activitiesRes.json();
        acts = body.data || body || [];
      }

      const storageRes = await fetch("/api/storage");
      if (storageRes.ok) {
        const sbody = await storageRes.json();
        const storage = sbody.data || sbody;
        if (storage.accounts && Array.isArray(storage.accounts)) {
          accs = accs.map((a) => {
            const sa = storage.accounts.find((sa: any) => sa.id === a.id);
            return sa ? {
              ...a,
              quotaBytes: Number(sa.totalBytes ?? sa.quotaBytes ?? 0),
              usedBytes: Number(sa.usedBytes ?? 0),
              color: stringToColor(a.email),
            } : a;
          });
        }
      }

      setAccounts(accs);
      setFiles(fls);
      setActivities(acts);
    } catch (e) {
      console.error("Network error syncing CloudVault database", e);
    } finally {
      setLoading(false);
      if (showSyncIndicator) {
        setTimeout(() => setIsSyncing(false), 800);
      }
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleToggleStar = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/star`, { method: "PATCH" });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (e) {
      console.error("Toggle star failed", e);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/trash`, { method: "POST" });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (e) {
      console.error("Failed trashing file", e);
    }
  };

  const handleConnectAccount = async (email: string, provider: string, quotaGB: string, syncFrequency: string) => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, provider, quotaGB, syncFrequency }),
      });
      if (res.ok) {
        await fetchAllData(true);
      } else {
        const body = await res.json();
        alert(body.error?.message || 'Accounts can only be linked via Google OAuth. Use the sidebar "Add Account" button to sign in with Google.');
      }
    } catch (e) {
      console.error("Link account error", e);
      alert('Accounts can only be linked via Google OAuth. Use the sidebar "Add Account" button to sign in with Google.');
    }
  };

  const handleUploadFile = async (name: string, sizeBytes: string, category: string, accountEmail: string) => {
    alert('File uploads require the actual file. Use the Upload button in the File Manager and select a file to upload.');
  };

  const handleDisconnectAccount = async (id: string) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAllData(true);
      } else {
        const body = await res.json();
        alert(body.error?.message || 'Failed to disconnect account');
      }
    } catch (e) {
      console.error("Disconnect failed", e);
    }
  };

  const handleReauthorizeAccount = async (id: string) => {
    alert('Re-authorization is handled via Google OAuth. Disconnect and re-add the account.');
  };

  const handleChangeFrequency = async (id: string, syncFrequency: string) => {
    alert('Sync frequency configuration is coming soon.');
  };

  const renderTabContent = () => {
    const activeFilesList = searchQuery
      ? files.filter(
          (f) =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.path.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : files;

    if (searchQuery && currentTab !== "files") {
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 text-xs text-blue-700 rounded-lg p-3 flex justify-between items-center">
            <span>
              Showing search matches for <strong className="font-bold">"{searchQuery}"</strong> across connected cloud databases.
            </span>
            <button onClick={() => setSearchQuery("")} className="font-semibold underline">
              Reset filter
            </button>
          </div>
          <FileManagerView
            files={activeFilesList}
            accounts={accounts}
            onToggleStar={handleToggleStar}
            onDeleteFile={handleDeleteFile}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
        </div>
      );
    }

    switch (currentTab) {
      case "dashboard":
        return (
          <DashboardView
            accounts={accounts}
            files={files}
            activities={activities}
            onTabChange={setCurrentTab}
            onOpenUploadModal={() => setIsUploadOpen(true)}
            isSyncing={isSyncing}
          />
        );
      case "files":
        return (
          <FileManagerView
            files={activeFilesList}
            accounts={accounts}
            onToggleStar={handleToggleStar}
            onDeleteFile={handleDeleteFile}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
        );
      case "intelligence":
        return (
          <IntelligenceView
            accounts={accounts}
            files={files}
            onRefreshAllData={() => fetchAllData(true)}
          />
        );
      case "accounts":
        return (
          <AccountsView
            accounts={accounts}
            onOpenConnectModal={() => setIsConnectOpen(true)}
            onRefreshAllData={() => fetchAllData(true)}
            onDisconnectAccount={handleDisconnectAccount}
            onReauthorizeAccount={handleReauthorizeAccount}
            onChangeFrequency={handleChangeFrequency}
          />
        );
      case "settings":
        return <SettingsView />;
      case "support":
        return <SupportView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <SideNavBar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenConnectModal={() => setIsConnectOpen(true)}
        accountsCount={accounts.length}
      />

      <div className="flex-1 ml-64 flex flex-col min-h-screen relative font-sans">
        <TopNavBar
          currentTab={currentTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefreshData={() => fetchAllData(true)}
          isSyncing={isSyncing}
          userEmail={userEmail}
        />

        <main className="flex-1 p-8 pt-24 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-24 text-slate-400 font-medium text-xs font-mono space-y-2 select-none animate-pulse">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>Piping cloud indexes...</span>
            </div>
          ) : (
            renderTabContent()
          )}
        </main>
      </div>

      <ConnectAccountModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSubmit={handleConnectAccount}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        accounts={accounts}
        onSubmit={handleUploadFile}
      />
    </div>
  );
}

function stringToColor(str: string): string {
  const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ab47bc', '#ff6d01', '#46bdc6', '#7b1fa2'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
