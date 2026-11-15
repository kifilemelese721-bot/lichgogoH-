import React, { useState } from 'react';
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  Check,
  GraduationCap,
} from 'lucide-react';
import type { NotificationItem, RoleName } from '../types/lms';

export interface NavSectionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardLayoutProps {
  userName: string;
  userEmail: string;
  role: RoleName;
  activeContextLabel: string;
  navItems: NavSectionItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: 'System Administrator',
  INSTRUCTOR: 'Faculty Instructor',
  STUDENT: 'Boarding Scholar',
  REGISTRAR: 'Academic Registrar',
  FINANCE: 'Finance Verification',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  userName,
  userEmail,
  role,
  activeContextLabel,
  navItems,
  activeTab,
  onSelectTab,
  notifications,
  onMarkNotificationRead,
  onLogout,
  darkMode,
  onToggleDarkMode,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const currentTitle = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex dashboard-mesh-bg text-[#1F2937] dark:text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Glassmorphic Sidebar Navigation */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 glass-sidebar text-white flex flex-col transition-transform duration-200 lg:translate-x-0 overflow-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Subtle ambient light sheen inside sidebar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-48 h-48 rounded-full bg-teal-400/10 blur-2xl"
        />

        <div className="relative px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#14B8A6] to-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-[0_6px_16px_-4px_rgba(20,184,166,0.5)] border border-white/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm tracking-tight truncate">
                Lich Gogo LMS
              </div>
              <div className="text-[11px] text-teal-200/90 truncate">{ROLE_LABELS[role]}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-md text-slate-200 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label="Dashboard Navigation">
          {navItems.map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white border border-white/20 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.65)]'
                    : 'text-slate-200/90 border border-transparent hover:bg-white/10 hover:border-white/10 hover:text-white'
                }`}
              >
                <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-300'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative p-4 border-t border-white/10 bg-white/[0.04] backdrop-blur-md space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/20 text-xs font-display font-bold text-white flex items-center justify-center shrink-0 shadow-inner">
              {getInitials(userName)}
            </div>
            <div className="min-w-0 text-xs">
              <div className="font-semibold text-white truncate">{userName}</div>
              <div className="truncate text-slate-300 text-[11px]">{userEmail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-medium text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Glassmorphic Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 glass-topbar px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold tracking-tight text-[#163B65] dark:text-white truncate">
                {currentTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {activeContextLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-xs"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="View notifications"
                className="relative p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-xs"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 glass-card rounded-xl shadow-xl p-3.5 z-50">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
                    <span className="text-xs font-semibold text-[#163B65] dark:text-slate-100">
                      Notifications ({unreadCount} unread)
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/80">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-500">
                        All caught up. No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-medium ${
                                n.isRead
                                  ? 'text-slate-500 dark:text-slate-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                              {n.message}
                            </p>
                          </div>
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => onMarkNotificationRead(n.id)}
                              aria-label={`Mark ${n.title} as read`}
                              className="p-1.5 text-[#2563EB] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
