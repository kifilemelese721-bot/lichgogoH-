import { useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from './utils/api';
import { PublicSite } from './components/PublicSite';
import { AuthView, type AuthMode } from './components/AuthView';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { InstructorDashboard } from './components/dashboards/InstructorDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { RegistrarDashboard } from './components/dashboards/RegistrarDashboard';
import { FinanceDashboard } from './components/dashboards/FinanceDashboard';
import type { NotificationItem, RoleName } from './types/lms';

interface SessionState {
  user: {
    id: number;
    fullName: string;
    email: string;
    role: RoleName;
    permissions: string[];
  };
  notifications: NotificationItem[];
  activeContextLabel: string;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<'public' | 'auth' | 'dashboard'>('public');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [session, setSession] = useState<SessionState | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const hydrateSession = async () => {
    try {
      const res = await apiRequest<{
        authenticated: boolean;
        user?: { userId?: number; id?: number; fullName: string; email: string; role: RoleName; permissions: string[] };
        notifications?: Array<{ id: number; user_id: number; title: string; message: string; category: NotificationItem['category']; is_read: number; created_at: string }>;
        activeContext?: { academicYearName: string; semesterName: string };
      }>('/api/auth/session');

      if (!res.authenticated || !res.user || !res.activeContext) {
        setSession(null);
        return;
      }

      setSession({
        user: {
          id: res.user.userId ?? res.user.id ?? 0,
          fullName: res.user.fullName,
          email: res.user.email,
          role: res.user.role,
          permissions: res.user.permissions,
        },
        notifications: (res.notifications || []).map((n) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          message: n.message,
          category: n.category,
          isRead: Boolean(n.is_read),
          createdAt: n.created_at,
        })),
        activeContextLabel: `${res.activeContext.academicYearName} · ${res.activeContext.semesterName}`,
      });
      setView('dashboard');
    } catch {
      setSession(null);
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => {
    if (getStoredToken()) {
      hydrateSession();
    } else {
      // Also check cookie session silently
      hydrateSession();
    }
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error
    }
    setStoredToken(null);
    setSession(null);
    setView('public');
  };

  const handleMarkNotificationRead = async (id: number) => {
    await apiRequest(`/api/auth/notifications/${id}/read`, { method: 'PATCH' });
    setSession((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
          }
        : null,
    );
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB] dark:bg-[#0B1120] text-sm text-slate-600 dark:text-slate-300">
        Loading Lich Gogo Excellence Boarding School LMS...
      </div>
    );
  }

  if (view === 'dashboard' && session) {
    const commonProps = {
      user: session.user,
      activeContextLabel: session.activeContextLabel,
      notifications: session.notifications,
      onMarkNotificationRead: handleMarkNotificationRead,
      onLogout: handleLogout,
      darkMode,
      onToggleDarkMode: () => setDarkMode((d) => !d),
    };

    switch (session.user.role) {
      case 'ADMIN':
        return <AdminDashboard {...commonProps} />;
      case 'INSTRUCTOR':
        return <InstructorDashboard {...commonProps} />;
      case 'STUDENT':
        return <StudentDashboard {...commonProps} />;
      case 'REGISTRAR':
        return <RegistrarDashboard {...commonProps} />;
      case 'FINANCE':
        return <FinanceDashboard {...commonProps} />;
    }
  }

  if (view === 'auth') {
    return (
      <AuthView
        initialMode={authMode}
        onBack={() => setView('public')}
        onAuthSuccess={async () => {
          await hydrateSession();
        }}
      />
    );
  }

  return (
    <PublicSite
      onOpenAuth={(mode) => {
        setAuthMode(mode);
        setView('auth');
      }}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
    />
  );
}
