import React from "react";
import { Search, Bell, RefreshCw, Sparkles, LogOut, ShieldAlert } from "lucide-react";

interface TopNavBarProps {
  currentTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefreshData: () => void;
  isSyncing: boolean;
  userEmail: string;
}

export default function TopNavBar({
  currentTab,
  searchQuery,
  setSearchQuery,
  onRefreshData,
  isSyncing,
  userEmail,
}: TopNavBarProps) {
  // Get neat initial matching user email
  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "J";

  const getPageTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "Overview";
      case "files":
        return "File Manager";
      case "intelligence":
        return "Storage Intelligence";
      case "accounts":
        return "Account Management";
      case "settings":
        return "Settings";
      case "support":
        return "Support";
      default:
        return "BIND";
    }
  };

  return (
    <header className="h-16 border-b-2 border-black bg-white flex items-center justify-between px-8 fixed top-0 right-0 z-10 w-[calc(100%-16rem)]">
      {/* Current Navigation Label */}
      <div className="flex items-center gap-3">
        <h2 className="font-extrabold text-black text-base uppercase tracking-wider">
          {getPageTitle()}
        </h2>
        {currentTab === "intelligence" && (
          <span className="flex items-center gap-1.5 text-[9px] bg-[#3b82f6] text-white font-extrabold px-2 py-0.5 rounded-none border border-black uppercase tracking-widest animate-pulse">
            <Sparkles className="w-2.5 h-2.5" /> AI Enabled
          </span>
        )}
      </div>

      {/* Global Search across connected clouds */}
      <div className="flex-1 max-w-md mx-6 relative">
        <Search className="w-4 h-4 text-slate-900 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="SEARCH CLOUD INDEX..."
          className="w-full h-10 pl-10 pr-4 bg-white border-2 border-black focus:outline-none focus:bg-slate-50 rounded-none text-xs text-black font-mono placeholder-slate-400 transition-all"
        />
      </div>

      {/* Trailing Actions */}
      <div className="flex items-center gap-3">
        {/* Sync Trigger */}
        <button
          onClick={onRefreshData}
          title="Force aggregate cloud sync"
          className="w-9 h-9 border border-black bg-white hover:bg-black hover:text-white rounded-none flex items-center justify-center text-black active:translate-y-0.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-blue-600" : ""}`} />
        </button>

        {/* Notifications Mock */}
        <div className="relative">
          <button className="w-9 h-9 border border-black bg-white hover:bg-black hover:text-white rounded-none flex items-center justify-center text-black active:translate-y-0.5 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Bell className="w-4 h-4" />
          </button>
          <span className="w-2 h-2 rounded-none bg-red-600 border border-black absolute -top-0.5 -right-0.5" />
        </div>

        {/* User Identity Avatar */}
        <div className="flex items-center gap-3 pl-3 border-l-2 border-black">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-extrabold text-black uppercase tracking-wider leading-none">Admin</span>
            <span className="text-[9px] font-mono font-bold text-slate-500 truncate max-w-[120px] mt-0.5" title={userEmail}>
              {userEmail || "kuretikrishank@gmail.com"}
            </span>
          </div>
          <div
            className="w-9 h-9 border-2 border-black bg-[#2563eb] font-extrabold text-xs text-white flex items-center justify-center cursor-pointer rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5"
          >
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
