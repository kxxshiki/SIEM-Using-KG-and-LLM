import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Bot,
  ChevronDown,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  User,
  LogOut,
  Settings,
  HelpCircle
} from 'lucide-react';

interface TopbarProps {
  pageTitle?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ pageTitle = 'Dashboard' }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [selectedEnv, setSelectedEnv] = useState<string>('AWS-Production');

  // Handle keyboard shortcut (⌘K / Ctrl+K) for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 border-b border-[#1e1e2d] bg-[#0d0d12]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none">
      
      {/* Left Section: Page Title & Environment Selector */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-white tracking-wide">
          {pageTitle}
        </h1>

        <div className="h-4 w-[1px] bg-[#1e1e2d] hidden sm:block" />

        {/* Environment Selector Dropdown */}
        <div className="relative hidden sm:flex items-center">
          <select
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value)}
            className="bg-[#14141c] text-xs font-medium text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-lg px-3 py-1.5 pr-8 appearance-none cursor-pointer outline-none transition"
          >
            <option value="AWS-Production">AWS - Production</option>
            <option value="Azure-Staging">Azure - Staging</option>
            <option value="GCP-MultiCloud">GCP - MultiCloud</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-purple-400 absolute right-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Middle Section: Global Search Bar */}
      <div className="hidden md:flex items-center max-w-md w-full mx-4">
        <div className="relative w-full flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search assets, CVEs, identity policies..."
            className="w-full bg-[#14141c] border border-[#232333] focus:border-purple-500/50 text-xs text-gray-200 placeholder-gray-500 rounded-xl pl-10 pr-20 py-2 outline-none transition duration-200"
          />
          <div className="absolute right-2.5 flex items-center gap-1">
            <button className="p-1 hover:text-gray-300 text-gray-500" title="Filter search">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <kbd className="hidden lg:inline-block bg-[#1e1e2d] text-[10px] text-gray-400 font-semibold px-1.5 py-0.5 rounded border border-[#2a2a3d]">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Section: System Status, AI Trigger, Utilities & Profile */}
      <div className="flex items-center gap-3">
        
        {/* Real-time Monitoring Badge */}
        <div className="hidden xl:flex items-center gap-2 bg-[#14141c] border border-[#232333] px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium text-gray-300">Live</span>
          <button className="text-gray-500 hover:text-gray-300 transition ml-1" title="Refresh Sync">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* SOC Co-Pilot Trigger Button */}
        <button className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl font-medium text-xs shadow-[0_0_15px_rgba(168,85,247,0.3)] transition active:scale-95">
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">SOC Co-Pilot</span>
        </button>

        <div className="h-4 w-[1px] bg-[#1e1e2d]" />

        {/* Notifications Icon with Badge */}
        <button className="relative p-2 text-gray-400 hover:text-white hover:bg-[#181822] rounded-xl transition">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full ring-2 ring-[#0d0d12]" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#181822] rounded-xl transition"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#181822] transition border border-transparent hover:border-[#232333]"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
              AU
            </div>
            <div className="hidden lg:flex flex-col items-start text-left">
              <span className="text-xs font-semibold text-white leading-tight">Admin User</span>
              <span className="text-[10px] text-purple-400 font-medium">SecOps lead</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden lg:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-[#121218] border border-[#232333] rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[#1e1e2d] mb-1">
                <p className="font-semibold text-white">Admin User</p>
                <p className="text-[10px] text-gray-400 truncate">admin@securitysuite.io</p>
              </div>

              <a href="#profile" className="flex items-center gap-2.5 px-3 py-2 text-gray-300 hover:text-white hover:bg-[#181822] rounded-xl transition">
                <User className="w-3.5 h-3.5" />
                <span>My Profile</span>
              </a>
              <a href="#settings" className="flex items-center gap-2.5 px-3 py-2 text-gray-300 hover:text-white hover:bg-[#181822] rounded-xl transition">
                <Settings className="w-3.5 h-3.5" />
                <span>Account Settings</span>
              </a>
              <a href="#help" className="flex items-center gap-2.5 px-3 py-2 text-gray-300 hover:text-white hover:bg-[#181822] rounded-xl transition">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Documentation</span>
              </a>

              <div className="my-1 border-t border-[#1e1e2d]" />

              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default Topbar;