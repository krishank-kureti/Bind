import React, { useState, useRef, useEffect } from "react";
import { CloudFile, CloudAccount } from "../types";
import { Folder, FileText, Image, FileArchive, Star, Trash2, FolderPlus, Upload, Shield, ChevronRight, File, Music, MoreHorizontal, Edit3, Copy, Move, X, Check, CreditCard, ExternalLink, RotateCw, RefreshCw } from "lucide-react";

interface FileManagerViewProps {
  accounts: CloudAccount[];
  refreshTick: number;
  onOpenUploadModal: () => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

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

function transformFile(backendFile: any): CloudFile {
  const sizeBytes = backendFile.size ? Math.round(Number(backendFile.size)) : 0;
  return {
    ...backendFile,
    sizeBytes,
    category: categorizeMimeType(backendFile.mimeType, backendFile.isFolder),
    modified: formatModified(backendFile.modifiedAtProvider),
    accountEmail: backendFile.account?.email || '',
  };
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

const BASE_LIMIT = 50;

export default function FileManagerView({ accounts, refreshTick, onOpenUploadModal }: FileManagerViewProps) {
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [navigatedFolderId, setNavigatedFolderId] = useState<string | null>(null);
  const [folderBreadcrumb, setFolderBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<CloudFile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [renameFileId, setRenameFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveFileId, setMoveFileId] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState<'same' | 'across'>('same');
  const [moveTargetAccountId, setMoveTargetAccountId] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<CloudFile[]>([]);
  const [syncNotification, setSyncNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setSyncNotification({ message, type });
    setTimeout(() => setSyncNotification(null), 4000);
  };

  const handleToggleStar = async (fileId: string) => {
    const prev = localFiles;
    setLocalFiles((p) => p.map((f) => f.id === fileId ? { ...f, starred: !f.starred } : f));
    setOpenMenuFileId(null);
    setMenuPosition(null);
    const res = await fetch(`/api/files/${fileId}/star`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) { setLocalFiles(prev); showToast('Failed to update star', 'error'); }
  };

  const handleDeleteFile = async (fileId: string) => {
    const prev = localFiles;
    setLocalFiles((p) => p.filter((f) => f.id !== fileId));
    setOpenMenuFileId(null);
    setMenuPosition(null);
    const res = await fetch(`/api/files/${fileId}/trash`, { method: 'POST' });
    if (!res.ok) { setLocalFiles(prev); showToast('Failed to trash file', 'error'); }
  };

  const handleRenameFile = async (fileId: string, name: string) => {
    const prev = localFiles;
    setLocalFiles((p) => p.map((f) => f.id === fileId ? { ...f, name } : f));
    const res = await fetch(`/api/files/${fileId}/rename`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) { setLocalFiles(prev); showToast('Failed to rename file', 'error'); }
  };

  const handleCopyFile = async (fileId: string) => {
    const prev = localFiles;
    setOpenMenuFileId(null);
    setMenuPosition(null);
    const res = await fetch(`/api/files/${fileId}/copy`, { method: 'POST' });
    if (res.ok) {
      const body = await res.json();
      const newFile = transformFile(body.data);
      setLocalFiles((p) => [newFile, ...p]);
    } else {
      showToast('Failed to copy file', 'error');
    }
  };

  const handleMoveFile = async (fileId: string, folderId: string) => {
    const prev = localFiles;
    setLocalFiles((p) => p.filter((f) => f.id !== fileId));
    const res = await fetch(`/api/files/${fileId}/move`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    if (!res.ok) { setLocalFiles(prev); showToast('Failed to move file', 'error'); }
  };

  const handleMoveAcrossAccounts = async (fileId: string, targetAccountId: string, targetFolderId?: string) => {
    const prev = localFiles;
    setLocalFiles((p) => p.filter((f) => f.id !== fileId));
    const res = await fetch(`/api/files/${fileId}/move-across`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetAccountId, targetFolderId }) });
    if (!res.ok) { setLocalFiles(prev); showToast('Failed to move file', 'error'); }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.file-menu-btn')) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpenMenuFileId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setNavigatedFolderId(null);
    setFolderBreadcrumb([]);
    setActiveAccountId(null);
    setSearchQuery('');
    setDebouncedSearch('');
  }, [ownershipFilter, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchFiles(false);
  }, [ownershipFilter, categoryFilter, navigatedFolderId, activeAccountId, debouncedSearch, refreshTick]);

  const getFilterParams = (): Record<string, string> => {
    switch (categoryFilter) {
      case 'images': return { mimeType: 'image/*' };
      case 'audio': return { mimeType: 'audio/*' };
      case 'video': return { mimeType: 'video/*' };
      case 'docs': return { category: 'docs' };
      default: return {};
    }
  };

  const buildQueryParams = (cursor?: string | null): string => {
    const params = new URLSearchParams();
    params.set('limit', String(BASE_LIMIT));

    const filterParams = getFilterParams();
    for (const [k, v] of Object.entries(filterParams)) params.set(k, v);
    if (categoryFilter === 'starred') params.set('starred', 'true');
    if (ownershipFilter === 'owned') params.set('owned', 'true');
    if (ownershipFilter === 'shared') params.set('owned', 'false');
    if (navigatedFolderId) params.set('folderId', navigatedFolderId);
    if (activeAccountId) params.set('accountId', activeAccountId);
    if (debouncedSearch) params.set('query', debouncedSearch);
    if (cursor) params.set('cursor', cursor);

    return params.toString();
  };

  const fetchFiles = async (append: boolean) => {
    setLoadingFiles(true);
    try {
      const cursor = append ? nextCursor : null;
      const qs = buildQueryParams(cursor);
      const res = await fetch(`/api/files?${qs}`);
      if (res.ok) {
        const body = await res.json();
        const newFiles = (body.data || []).map(transformFile);
        setLocalFiles(append ? (prev) => [...prev, ...newFiles] : newFiles);
        setNextCursor(body.meta?.nextCursor ?? null);
        setHasMore(body.meta?.hasMore ?? false);
        setTotal(body.meta?.total ?? 0);
      }
    } catch (e) {
      console.error('Fetch files error', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const params = new URLSearchParams();
      params.set('mimeType', 'application/vnd.google-apps.folder');
      params.set('limit', '500');
      if (activeAccountId) params.set('accountId', activeAccountId);
      const res = await fetch(`/api/files?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setAllFolders((body.data || []).map(transformFile));
      }
    } catch (e) {
      console.error('Fetch folders error', e);
    }
  };

  const ownershipFilters = [
    { id: 'all', label: 'All Files', icon: null },
    { id: 'owned', label: 'Owned', icon: null },
    { id: 'shared', label: 'Shared', icon: null },
  ];

  const categoryFilters = [
    { id: 'images', label: 'Images', icon: Image },
    { id: 'docs', label: 'Docs', icon: FileText },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'accounts', label: 'Accounts', icon: CreditCard },
  ];

  const isInAccountsMode = categoryFilter === 'accounts';

  const folders = localFiles.filter((f) => f.isFolder);
  const nonFolders = localFiles.filter((f) => !f.isFolder);
  const sortedFiles = [...folders, ...nonFolders];

  const getFileIcon = (f: CloudFile) => {
    if (f.isFolder) return <Folder className="w-5 h-5 text-blue-500 fill-blue-500/10" />;
    if (f.category === 'images') return <Image className="w-5 h-5 text-purple-500" />;
    if (f.category === 'docs') return <FileText className="w-5 h-5 text-blue-500" />;
    if (f.category === 'archive') return <FileArchive className="w-5 h-5 text-amber-500" />;
    if (f.mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-pink-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const getAccountColor = (email: string) => {
    const a = accounts.find((ac) => ac.email === email);
    return a ? a.color : '#000';
  };

  const handleFolderClick = (folder: CloudFile) => {
    setNavigatedFolderId(folder.providerId);
    setFolderBreadcrumb((prev) => [...prev, { id: folder.providerId, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      setNavigatedFolderId(null);
      setFolderBreadcrumb([]);
    } else {
      const item = folderBreadcrumb[index - 1];
      setNavigatedFolderId(item.id);
      setFolderBreadcrumb((prev) => prev.slice(0, index));
    }
  };

  const handleAccountClick = (account: CloudAccount) => {
    setActiveAccountId(account.id);
    setNavigatedFolderId(null);
    setFolderBreadcrumb([{ id: null, name: account.email.split('@')[0] }]);
  };

  const handleBackToAccounts = () => {
    setActiveAccountId(null);
    setNavigatedFolderId(null);
    setFolderBreadcrumb([]);
  };

  const openRename = (file: CloudFile) => {
    setRenameFileId(file.id);
    setRenameValue(file.name);
    setOpenMenuFileId(null);
  };

  const submitRename = () => {
    if (renameFileId && renameValue.trim()) {
      handleRenameFile(renameFileId, renameValue.trim());
    }
    setRenameFileId(null);
    setRenameValue('');
  };

  const openMoveDialog = (fileId: string) => {
    setMoveFileId(fileId);
    setMoveTargetAccountId(null);
    setMoveTargetFolderId(null);
    setMoveMode('same');
    setMoveDialogOpen(true);
    setOpenMenuFileId(null);
    fetchFolders();
  };

  const submitMove = () => {
    if (!moveFileId) return;
    if (moveMode === 'same') {
      handleMoveFile(moveFileId, moveTargetFolderId || 'root');
    } else if (moveTargetAccountId) {
      handleMoveAcrossAccounts(moveFileId, moveTargetAccountId, moveTargetFolderId || undefined);
    }
    setMoveDialogOpen(false);
    setMoveFileId(null);
  };

  const totalSize = sortedFiles.reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <nav className="flex items-center gap-1.5 text-[10.5px] text-slate-600 font-mono font-bold uppercase tracking-wider">
            <span className="hover:text-blue-600 cursor-pointer" onClick={() => { setNavigatedFolderId(null); setFolderBreadcrumb([]); setActiveAccountId(null); }}>Files</span>
            {folderBreadcrumb.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />}
            {isInAccountsMode && activeAccountId === null && (
              <>
                <span className="font-extrabold text-white bg-black px-2 py-0.5">Accounts</span>
              </>
            )}
            {folderBreadcrumb.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />}
                <span className={`${i === folderBreadcrumb.length - 1 ? 'font-extrabold text-white bg-black px-2 py-0.5' : 'hover:text-blue-600 cursor-pointer'}`} onClick={() => handleBreadcrumbClick(i + 1)}>
                  {item.name}
                </span>
              </React.Fragment>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center border-2 border-black h-9">
              <input
                type="text"
                placeholder="SEARCH..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 h-full px-2.5 text-[11px] font-bold font-mono uppercase tracking-wider text-black placeholder:text-slate-300 focus:outline-none"
              />
            </div>
            <button onClick={onOpenUploadModal} className="geo-btn-primary flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> Upload file
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {ownershipFilters.map((tab) => {
              const isActive = ownershipFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setOwnershipFilter(tab.id)}
                  className={`h-7 px-3 rounded-none text-[10px] font-extrabold uppercase tracking-widest border cursor-pointer transition-all ${
                    isActive ? "bg-black text-white border-black shadow-[2px_2px_0px_0px_#3b82f6]" : "bg-white text-black border-black hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 border-b-2 border-black pb-2">
            {categoryFilters.map((tab) => {
              const Icon = tab.icon;
              const isActive = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id === categoryFilter ? 'all' : tab.id)}
                  className={`h-8 px-4 rounded-none text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 border cursor-pointer transition-all ${
                    isActive ? "bg-black text-white border-black shadow-[2.5px_2.5px_0px_0px_#3b82f6]" : "bg-white text-black border-black hover:bg-slate-50"
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />} {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isInAccountsMode && activeAccountId === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <div key={a.id} onClick={() => handleAccountClick(a)} className="bg-white border-2 border-black p-5 cursor-pointer shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 border-2 border-black text-sm font-black text-white flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: a.color }}>
                  {a.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[13px] text-black uppercase truncate">{a.email.split('@')[0]}</h3>
                  <p className="text-[9px] text-[#2563eb] font-mono font-extrabold uppercase mt-0.5 truncate">{a.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                <span className="text-slate-500 uppercase">{a.id ? `${a.email.split('@')[0]}'s root` : ''}</span>
                <ChevronRight className="w-4 h-4 text-black" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="h-11 bg-slate-100 border-b-2 border-black flex items-center px-6 text-[10px] text-black font-mono font-extrabold uppercase tracking-widest">
            <div className="w-8 shrink-0" />
            <div className="flex-1 min-w-[200px]">Name</div>
            <div className="w-44 hidden sm:block">Source</div>
            <div className="w-24 text-right">Size</div>
            <div className="w-20 text-right">Modified</div>
            <div className="w-20" />
          </div>

          {loadingFiles && sortedFiles.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs uppercase font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs uppercase font-bold">No files found.</div>
          ) : (
            <div className="divide-y divide-black relative">
              {sortedFiles.map((file) => (
                <div key={file.id} className="h-12 flex items-center px-6 text-xs hover:bg-slate-50 transition-colors">
                  <div className="w-8 shrink-0 flex items-center" onClick={() => file.isFolder && handleFolderClick(file)}>
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-[200px] flex items-center gap-3 pr-4 truncate font-bold">
                    {renameFileId === file.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenameFileId(null); }}
                          className="flex-1 h-7 border-2 border-black px-2 text-[11px] font-bold font-mono uppercase focus:outline-none"
                          autoFocus
                        />
                        <button onClick={submitRename} className="p-1 bg-black text-white border border-black"><Check className="w-3 h-3" /></button>
                        <button onClick={() => setRenameFileId(null)} className="p-1 bg-white border border-black"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-black truncate uppercase ${file.isFolder ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={() => file.isFolder && handleFolderClick(file)}>
                          {file.name}
                        </span>
                        {file.starred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                      </>
                    )}
                  </div>
                  <div className="w-44 hidden sm:flex items-center">
                    <span className="px-2 py-1 text-[9.5px] font-extrabold flex items-center gap-1.5 border border-black uppercase tracking-wider" style={{ backgroundColor: `${getAccountColor(file.accountEmail)}15` }}>
                      <span className="w-2 h-2 border border-black shrink-0" style={{ backgroundColor: getAccountColor(file.accountEmail) }} />
                      <span className="truncate max-w-[124px] font-mono">{file.accountEmail?.split('@')[0] || 'SYS'}</span>
                    </span>
                  </div>
                  <div className="w-24 text-right font-extrabold text-slate-800 font-mono text-[11px]">
                    {file.isFolder ? '--' : formatBytes(file.sizeBytes)}
                  </div>
                  <div className="w-20 text-right font-bold text-slate-500 font-mono text-[10.5px]">{file.modified}</div>
                  <div className="w-20 flex items-center justify-end">
                    <button
                      onClick={(e) => {
                        if (openMenuFileId === file.id) {
                          setOpenMenuFileId(null);
                          setMenuPosition(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPosition({ top: rect.bottom + 4, left: rect.right - 176 });
                          setOpenMenuFileId(file.id);
                        }
                      }}
                      className="file-menu-btn p-1.5 border border-black bg-white text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="border-t-2 border-black">
              <button onClick={() => fetchFiles(true)} disabled={loadingFiles} className="w-full h-12 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[11px] font-extrabold uppercase tracking-widest text-blue-600 transition-colors disabled:opacity-50">
                {loadingFiles ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                Load More ({total - localFiles.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {openMenuFileId && menuPosition && (() => {
        const file = localFiles.find((f) => f.id === openMenuFileId);
        if (!file) return null;
        return (
          <div ref={menuRef} className="fixed z-50 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] w-44 py-1" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <button onClick={() => handleToggleStar(file.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider hover:bg-slate-50 text-left">
              <Star className={`w-3.5 h-3.5 ${file.starred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} /> {file.starred ? 'Unstar' : 'Star'}
            </button>
            <button onClick={() => openRename(file)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider hover:bg-slate-50 text-left">
              <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Rename
            </button>
            <button onClick={() => handleCopyFile(file.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider hover:bg-slate-50 text-left">
              <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy
            </button>
            <button onClick={() => openMoveDialog(file.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider hover:bg-slate-50 text-left">
              <Move className="w-3.5 h-3.5 text-slate-400" /> Move
            </button>
            <div className="border-t border-black my-1" />
            <button onClick={() => handleDeleteFile(file.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider hover:bg-red-50 text-red-600 text-left">
              <Trash2 className="w-3.5 h-3.5" /> Trash
            </button>
          </div>
        );
      })()}

      <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] px-2 font-extrabold uppercase tracking-wide">
        <span>{total || sortedFiles.length} file{(total || sortedFiles.length) !== 1 ? 's' : ''} ({formatBytes(totalSize)} total)</span>
        <span className="flex items-center gap-1.5 text-blue-600"><Shield className="w-3.5 h-3.5" /> Encrypted</span>
      </div>

      {moveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMoveDialogOpen(false)}>
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-md mx-4 relative" onClick={(e) => e.stopPropagation()}>
            <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Move className="w-5 h-5 text-blue-400" />
                <h2 className="font-extrabold text-[12px] uppercase tracking-widest">Move File</h2>
              </div>
              <button onClick={() => setMoveDialogOpen(false)} className="text-white hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-2">
                <button onClick={() => setMoveMode('same')} className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-widest border ${moveMode === 'same' ? 'bg-black text-white border-black shadow-[2px_2px_0px_#3b82f6]' : 'bg-white text-slate-500 border-slate-300 hover:border-black'}`}>
                  Same Account
                </button>
                <button onClick={() => setMoveMode('across')} className={`flex-1 py-2 text-[10px] font-extrabold uppercase tracking-widest border ${moveMode === 'across' ? 'bg-black text-white border-black shadow-[2px_2px_0px_#3b82f6]' : 'bg-white text-slate-500 border-slate-300 hover:border-black'}`}>
                  Different Account
                </button>
              </div>

              {moveMode === 'across' && (
                <div>
                  <label className="block text-[10px] font-extrabold text-black uppercase tracking-widest mb-1.5 font-mono">Target Account</label>
                  <select value={moveTargetAccountId || ''} onChange={(e) => setMoveTargetAccountId(e.target.value || null)} className="w-full h-10 border-2 border-black px-3 text-[11px] font-bold font-mono uppercase bg-white focus:outline-none">
                    <option value="">Select account...</option>
                    {accounts.filter((a) => a.id !== localFiles.find((f) => f.id === moveFileId)?.accountId).map((a) => (
                      <option key={a.id} value={a.id}>{a.email}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-black uppercase tracking-widest mb-1.5 font-mono">Target Folder</label>
                <select value={moveTargetFolderId || ''} onChange={(e) => setMoveTargetFolderId(e.target.value || null)} className="w-full h-10 border-2 border-black px-3 text-[11px] font-bold font-mono uppercase bg-white focus:outline-none">
                  <option value="">Root folder</option>
                  {(moveMode === 'across' && moveTargetAccountId ? allFolders.filter((f) => f.accountId === moveTargetAccountId) : allFolders).map((f) => (
                    <option key={f.id} value={f.providerId}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMoveDialogOpen(false)} className="px-4 py-2 border border-black bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-extrabold uppercase tracking-widest shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all">
                  Cancel
                </button>
                <button onClick={submitMove} className="geo-btn-primary text-[10px] flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" /> Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {syncNotification && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-2 fade-in">
          <div className={`bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] px-5 py-3.5 flex items-center gap-3 min-w-[280px] max-w-sm`}>
            <div className={`w-8 h-8 border border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)] ${syncNotification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {syncNotification.type === 'success' ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-black break-words">{syncNotification.message}</p>
            </div>
            <button onClick={() => setSyncNotification(null)} className="text-slate-400 hover:text-black transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
