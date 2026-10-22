import React, { useState } from 'react';
import {
  LayoutDashboard,
  Upload,
  Bell,
  MailWarning,
  FileText,
  Network,
  UserCheck,
  MessageSquare,
  LogOut
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
    { id: 'upload-logs', label: 'Upload Logs', icon: Upload },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'spam', label: 'Spam', icon: MailWarning },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'graph-visualization', label: 'Graph Visulation', icon: Network },
    { id: 'account-preference', label: 'Account Preference', icon: UserCheck },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  ];

  const bottomNavItems: NavItem[] = [
    { id: 'notification', label: 'Notification', icon: Bell },
    { id: 'logout', label: 'Logout', icon: LogOut },
  ];

  return (
    <aside className="w-20 hover:w-64 transition-all duration-300 ease-in-out bg-[#0d0d12] border-r border-[#1e1e2d] h-screen flex flex-col justify-between py-6 px-3 z-30 group fixed left-0 top-0 select-none">
      {/* Top Section */}
      <div className="flex flex-col items-start w-full">
        {/* Navigation Category Header */}
        <div className="px-3 mb-4 w-full">
          <span className="text-[11px] font-bold text-gray-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap uppercase">
            Navigation
          </span>
        </div>

        {/* Primary Navigation */}
        <nav className="w-full flex flex-col gap-1.5">
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

                {/* Active Indicator Line for Collapsed Mode */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-purple-500 rounded-r-full group-hover:hidden" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Navigation (Notification & Logout) */}
      <div className="w-full flex flex-col gap-1.5 border-t border-[#1e1e2d] pt-4">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={`flex items-center justify-between w-full p-3 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:bg-[#181822] hover:text-gray-200 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3.5 relative">
                <Icon className="w-5 h-5 min-w-[1.25rem]" />
                {item.id === 'notification' && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full group-hover:hidden" />
                )}
                <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                  {item.label}
                </span>
              </div>

              {item.id === 'notification' && (
                <span className="hidden group-hover:block w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;