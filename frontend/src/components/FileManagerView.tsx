import React, { useState } from "react";
import { CloudFile, CloudAccount } from "../types";
import { Folder, FileText, Image, FileArchive, Star, Trash2, FolderPlus, Upload, Shield, ChevronRight, File } from "lucide-react";
import { formatBytes } from "./DashboardView";

interface FileManagerViewProps {
  files: CloudFile[];
  accounts: CloudAccount[];
  onToggleStar: (id: string) => void;
  onDeleteFile: (id: string) => void;
  onOpenUploadModal: () => void;
}

export default function FileManagerView({
  files,
  accounts,
  onToggleStar,
  onDeleteFile,
  onOpenUploadModal,
}: FileManagerViewProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");

  // Category tags mapping
  const categoryFilters = [
    { id: "all", label: "All Files", icon: null },
    { id: "images", label: "Images", icon: Image },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "starred", label: "StarredOnly", icon: Star },
  ];

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedFileIds(filteredFiles.map((f) => f.id));
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter files based on tabs
  const filteredFiles = files.filter((file) => {
    if (activeCategory === "starred") return file.starred;
    if (activeCategory === "all") return true;
    return file.category === activeCategory;
  });

  const totalSize = filteredFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0);

  const getFileIcon = (file: CloudFile) => {
    if (file.sizeBytes === 0) return <Folder className="w-5 h-5 text-blue-500 fill-blue-500/10" />;
    if (file.category === "images") return <Image className="w-5 h-5 text-purple-500 fill-purple-500/10" />;
    if (file.category === "docs") return <FileText className="w-5 h-5 text-blue-500 fill-blue-500/10" />;
    if (file.category === "archive") return <FileArchive className="w-5 h-5 text-amber-505 fill-amber-500/10" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };

  // Helper to color badge according to source account
  const getAccountColor = (email: string) => {
    const acc = accounts.find((a) => a.email === email);
    return acc ? acc.color : "#4285f4";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Search and Navigation crumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-[10.5px] text-slate-600 font-mono font-bold uppercase tracking-wider">
            <span className="hover:text-blue-600 cursor-pointer">Unified Vault</span>
            <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="hover:text-blue-600 cursor-pointer">Q3 Planning</span>
            <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="font-extrabold text-black bg-black text-white px-2 py-0.5">Design Assets</span>
          </nav>

          {/* Quick folder upload action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="geo-btn-secondary flex items-center gap-1.5"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            <button
              onClick={onOpenUploadModal}
              className="geo-btn-primary flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Upload file
            </button>
          </div>
        </div>

        {/* Filter categories tabs header */}
        <div className="flex items-center gap-2 border-b-2 border-black pb-2 pt-2">
          {categoryFilters.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`h-8 px-4 rounded-none text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 transition-all border cursor-pointer ${
                  isActive
                    ? "bg-black text-white border-black shadow-[2.5px_2.5px_0px_0px_#3b82f6]"
                    : "bg-white text-black border-black hover:bg-slate-50"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Files List Table */}
      <div className="bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="h-11 bg-slate-100 border-b-2 border-black flex items-center px-6 text-[10px] text-black font-mono font-extrabold uppercase tracking-widest">
          <div className="w-8 shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              className="rounded-none border-2 border-black text-black focus:ring-0 w-4 h-4 cursor-pointer"
              onChange={handleSelectAll}
              checked={filteredFiles.length > 0 && selectedFileIds.length === filteredFiles.length}
            />
          </div>
          <div className="flex-1 min-w-[200px]">Name</div>
          <div className="w-48 hidden sm:block">Source Node</div>
          <div className="w-24 text-right">Size</div>
          <div className="w-28 text-right">Modified</div>
          <div className="w-16"></div>
        </div>

        {/* File Rows */}
        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs uppercase font-bold">
            No matching files discovered in this path.
          </div>
        ) : (
          <div className="divide-y divide-black">
            {filteredFiles.map((file) => {
              const isSelected = selectedFileIds.includes(file.id);
              const isStarred = file.starred;
              const accountColor = getAccountColor(file.accountEmail);

              return (
                <div
                  key={file.id}
                  className={`h-12 flex items-center px-6 text-xs hover:bg-slate-50 transition-colors group cursor-pointer ${
                    isSelected ? "bg-slate-100" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectFile(file.id)}
                      className="rounded-none border border-black text-black focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  </div>

                  {/* Logo + Filename */}
                  <div className="flex-1 min-w-[200px] flex items-center gap-3 pr-4 truncate font-bold">
                    {getFileIcon(file)}
                    <span className="text-black truncate uppercase tracking-wide" title={file.name}>
                      {file.name}
                    </span>
                    {isStarred && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                  </div>

                  {/* Cloud Account Pill Badge */}
                  <div className="w-48 hidden sm:flex items-center">
                    <span
                      className="px-2.5 py-1 rounded-none text-[9.5px] font-extrabold flex items-center gap-1.5 border border-black uppercase tracking-wider"
                      style={{
                        backgroundColor: `${accountColor}15`,
                        color: "#000000",
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-none border border-black shrink-0"
                        style={{ backgroundColor: accountColor }}
                      />
                      <span className="truncate max-w-[124px] font-mono leading-none">
                        {file.accountEmail?.split("@")[0] || "SYSTEM"}
                      </span>
                    </span>
                  </div>

                  {/* File Size */}
                  <div className="w-24 text-right font-extrabold text-slate-800 font-mono text-[11px]">
                    {file.sizeBytes === 0 ? "--" : formatBytes(file.sizeBytes).toUpperCase()}
                  </div>

                  {/* Modified Date */}
                  <div className="w-28 text-right font-bold text-slate-500 font-mono text-[10.5px]">
                    {file.modified.toUpperCase()}
                  </div>

                  {/* Row Actions Trash star etc */}
                  <div className="w-16 flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(file.id);
                      }}
                      title="Star File"
                      className={`p-1.5 rounded-none border border-black transition-colors ${
                        isStarred 
                          ? "bg-amber-100 text-amber-600" 
                          : "bg-white text-slate-400 hover:bg-slate-100 hover:text-black"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      title="Delete File"
                      className="p-1.5 rounded-none border border-black bg-white text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contextual statistics and status summary */}
      <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] px-2 font-extrabold uppercase tracking-wide">
        <span>
          CONSOLIDATED FEED: {filteredFiles.length} INDEXED ELEMENTS ({formatBytes(totalSize).toUpperCase()} TOTAL SIZE)
        </span>
        <span className="flex items-center gap-1.5 text-blue-600">
          <Shield className="w-3.5 h-3.5" /> CRITICAL SECURE LINKED ENCRYPTED
        </span>
      </div>

      {/* New Folder Inline Dialog */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-black rounded-none shadow-[8px_8px_0px_rgba(0,0,0,1)] max-w-sm w-full p-6 space-y-4">
            <span className="text-[9px] font-extrabold bg-[#000] text-white px-2 py-0.5 uppercase tracking-widest">NAMESPACE MANAGER</span>
            <h3 className="font-black text-black text-base uppercase tracking-tight">Create Grid Directory</h3>
            <p className="text-[11px] text-slate-500 font-medium">Specifies a local namespace path inside the Vault structure.</p>
            <input
              type="text"
              placeholder="e.g. Q4 Marketing Materials"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full text-xs h-10 border-2 border-black rounded-none px-3 font-mono text-black"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="geo-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => { alert('Creating folders via the API is coming soon.'); setShowNewFolderModal(false); }}
                className="geo-btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
