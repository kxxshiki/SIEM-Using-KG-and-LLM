import React, { useState } from 'react';
import {
  LayoutDashboard,
  BarChart2,
  ShieldAlert,
  Database,
  FileText,
  Activity,
  Bell,
  Bot,
  Settings,
  MessageSquare,
  ChevronRight
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const [activeItem, setActiveItem] = useState<string>('dashboard');

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'threats', label: 'Threats', icon: ShieldAlert },
    { id: 'sources', label: 'Sources', icon: Database },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'indicators', label: 'Indicators', icon: Activity },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'soc-copilot', label: 'SOC Co-Pilot', icon: Bot, badge: 'AI' },
  ];

  const bottomNavItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  return (
    <aside className="w-20 hover:w-64 transition-all duration-300 ease-in-out bg-[#0d0d12] border-r border-[#1e1e2d] h-screen flex flex-col justify-between py-6 px-3 z-30 group fixed left-0 top-0 select-none">
      {/* Top Brand Logo */}
      <div className="flex flex-col items-start w-full">
        <div className="flex items-center gap-3.5 px-2 mb-8 w-full cursor-pointer">
          <div className="w-10 h-10 min-w-[2.5rem] rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_20px_rgba(168,85,247,0.35)]">
            v
          </div>
          <span className="text-white font-bold text-lg tracking-wide opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            SecuritySuite
          </span>
        </div>

        {/* Primary Navigation */}
        <nav className="w-full flex flex-col gap-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={`flex items-center justify-between w-full p-3 rounded-xl transition-all duration-200 group/btn relative ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:bg-[#181822] hover:text-gray-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className="w-5 h-5 min-w-[1.25rem]" />
                  <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    {item.label}
                  </span>
                </div>

                {/* Optional AI / Status Badge */}
                {item.badge && (
                  <span className="hidden group-hover:block text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-semibold border border-purple-500/30">
                    {item.badge}
                  </span>
                )}

                {/* Active Indicator Line for Collapsed Mode */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-purple-500 rounded-r-full group-hover:hidden" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Navigation (Settings & Feedback) */}
      <div className="w-full flex flex-col gap-2 border-t border-[#1e1e2d] pt-4">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={`flex items-center gap-3.5 w-full p-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:bg-[#181822] hover:text-gray-200 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5 min-w-[1.25rem]" />
              <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;