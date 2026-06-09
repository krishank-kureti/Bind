import React from "react";

interface TopNavBarProps {
  currentTab: string;
}

export default function TopNavBar({ currentTab }: TopNavBarProps) {
  const tabLabel: Record<string, string> = {
    dashboard: 'Dashboard',
    files: 'File Manager',
    intelligence: 'Intelligence',
    accounts: 'Accounts',
    settings: 'Settings',
    support: 'Support',
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b-2 border-black z-10 flex items-center px-8">
      <h1 className="text-[15px] font-black text-black uppercase tracking-widest">{tabLabel[currentTab] || currentTab.toUpperCase()}</h1>
    </header>
  );
}
