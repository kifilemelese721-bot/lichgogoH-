import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Download,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { apiRequest } from '../../utils/api';
import { DashboardLayout, type NavSectionItem } from '../DashboardLayout';
import type { NotificationItem, RoleName } from '../../types/lms';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface AdminDashboardProps {
  user: { id: number; fullName: string; email: string; role: RoleName };
  activeContextLabel: string;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const NAV_ITEMS: NavSectionItem[] = [
  { id: 'overview', label: 'Overview & Analytics', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Users & Accounts', icon: <Users className="w-4 h-4" /> },
  { id: 'roles', label: 'Roles & Privileges', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'courses', label: 'Courses & Schedules', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'system', label: 'Grading & System', icon: <Settings className="w-4 h-4" /> },
  { id: 'reports', label: 'Institutional Reports', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'announcements', label: 'Announcements & Logs', icon: <Megaphone className="w-4 h-4" /> },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  activeContextLabel,
  notifications,
  onMarkNotificationRead,
  onLogout,
  darkMode,
  onToggleDarkMode,
}) => {
  const [tab, setTab] = useState('overview');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Overview state
  const [overview, setOverview] = useState<{
    kpis: Record<string, number>;
    streamPerformance: Array<{ stream_name: string; avg_score: number; student_count: number }>;
    gradeDistribution: Array<{ grade_name: string; student_count: number }>;
    recentActivities: Array<{ id: number; action: string; entity_type: string; details: string; actor_name: string; created_at: string }>;
  } | null>(null);

  // Users state
  const [usersList, setUsersList] = useState<Array<{ id: number; full_name: string; email: string; role: RoleName; phone: string; status: string; is_sample_data: number }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'INSTRUCTOR', phone: '', department: 'Natural Sciences' });

  // Roles & Permissions
  const [rolesData, setRolesData] = useState<{
    roles: Array<{ id: number; name: string; description: string }>;
    permissions: Array<{ id: number; code: string; module: string; description: string }>;
    mappings: Array<{ role_id: number; permission_id: number }>;
  } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number>(2);

  // Courses & Categories & Schedules
  const [categories, setCategories] = useState<Array<{ id: number; name: string; description: string }>>([]);
  const [coursesData, setCoursesData] = useState<{
    courses: Array<{ id: number; code: string; title: string; category_name: string; grade_name: string; stream_name: string | null; instructor_name: string | null; instructor_id: number | null; enrolled_count: number }>;
    instructors: Array<{ id: number; full_name: string; department: string }>;
    schedules: Array<{ id: number; course_code: string; course_title: string; grade_name: string; day_of_week: string; start_time: string; end_time: string; room: string }>;
  } | null>(null);
  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [newCourse, setNewCourse] = useState({ code: '', title: '', description: '', categoryId: '1', gradeId: '3', streamId: '1', creditHours: '4', instructorId: '' });
  const [newSched, setNewSched] = useState({ courseId: '', dayOfWeek: 'Friday', startTime: '08:30', endTime: '10:00', room: 'Hall N-102' });

  // System Config
  const [sysConfig, setSysConfig] = useState<{
    settings: Array<{ key: string; value: string }>;
    gradingScales: Array<{ id: number; letter_grade: string; min_score: number; max_score: number; grade_point: number; remark: string }>;
    streamConfigs: Array<{ id: number; stream_id: number; stream_name: string; quiz_weight: number; assignment_weight: number; midterm_weight: number; final_exam_weight: number; passing_score: number }>;
    semesters: Array<{ id: number; name: string; start_date: string; end_date: string; is_active: number }>;
  } | null>(null);

  // Reports & Audit Logs
  const [reports, setReports] = useState<{
    enrollmentReport: Array<{ grade_name: string; stream_name: string; total_students: number }>;
    instructorReport: Array<{ full_name: string; employee_code: string; department: string; assigned_courses: number }>;
    coursePerformanceReport: Array<{ code: string; title: string; graded_students: number; average_score: number | null; min_score: number | null; max_score: number | null }>;
    attendanceReport: Array<{ attendance_type: string; status: string; total_count: number }>;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: number; action: string; entity_type: string; entity_id: string; details: string; actor_name: string; actor_role: string; created_at: string }>>([]);
  const [annForm, setAnnForm] = useState({ title: '', body: '', targetRole: 'ALL', isPublic: true });

  const loadDataForTab = async (currentTab: string) => {
    try {
      if (currentTab === 'overview') {
        setOverview(await apiRequest('/api/admin/dashboard'));
      } else if (currentTab === 'users') {
        const res = await apiRequest<{ users: typeof usersList }>('/api/admin/users');
        setUsersList(res.users);
      } else if (currentTab === 'roles') {
        setRolesData(await apiRequest('/api/admin/roles-permissions'));
      } else if (currentTab === 'courses') {
        const [cats, crs] = await Promise.all([
          apiRequest<{ categories: typeof categories }>('/api/admin/categories'),
          apiRequest<NonNullable<typeof coursesData>>('/api/admin/courses'),
        ]);
        setCategories(cats.categories);
        setCoursesData(crs);
        if (!newSched.courseId && crs.courses[0]) {
          setNewSched((s) => ({ ...s, courseId: String(crs.courses[0].id) }));
        }
      } else if (currentTab === 'system') {
        setSysConfig(await apiRequest('/api/admin/system-config'));
      } else if (currentTab === 'reports') {
        setReports(await apiRequest('/api/admin/reports'));
      } else if (currentTab === 'announcements') {
        const logs = await apiRequest<{ logs: typeof auditLogs }>('/api/admin/audit-logs');
        setAuditLogs(logs.logs);
      }
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed to load data.' });
    }
  };

  useEffect(() => {
    loadDataForTab(tab);
  }, [tab]);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      showMsg('ok', res.message);
      setNewUser({ fullName: '', email: '', password: '', role: 'INSTRUCTOR', phone: '', department: 'Natural Sciences' });
      loadDataForTab('users');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Failed to create user.');
    }
  };

  const handleToggleUserStatus = async (u: typeof usersList[number]) => {
    try {
      await apiRequest(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: u.status === 'active' ? 'inactive' : 'active' }),
      });
      loadDataForTab('users');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleTogglePermission = async (permId: number) => {
    if (!rolesData) return;
    const current = rolesData.mappings
      .filter((m) => m.role_id === selectedRoleId)
      .map((m) => m.permission_id);
    const next = current.includes(permId)
      ? current.filter((id) => id !== permId)
      : [...current, permId];
    try {
      await apiRequest(`/api/admin/roles-permissions/${selectedRoleId}`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: next }),
      });
      showMsg('ok', 'Role privileges updated.');
      loadDataForTab('roles');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Failed to update permissions.');
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          ...newCourse,
          categoryId: Number(newCourse.categoryId),
          gradeId: Number(newCourse.gradeId),
          streamId: newCourse.streamId ? Number(newCourse.streamId) : null,
          creditHours: Number(newCourse.creditHours),
          instructorId: newCourse.instructorId ? Number(newCourse.instructorId) : null,
        }),
      });
      showMsg('ok', res.message);
      setNewCourse({ code: '', title: '', description: '', categoryId: '1', gradeId: '3', streamId: '1', creditHours: '4', instructorId: '' });
      loadDataForTab('courses');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Failed to create course.');
    }
  };

  const handleSaveStreamConfig = async (cfg: NonNullable<typeof sysConfig>['streamConfigs'][number]) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/system-config/stream-weights/${cfg.stream_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          quizWeight: cfg.quiz_weight,
          assignmentWeight: cfg.assignment_weight,
          midtermWeight: cfg.midterm_weight,
          finalExamWeight: cfg.final_exam_weight,
          passingScore: cfg.passing_score,
        }),
      });
      showMsg('ok', res.message);
      loadDataForTab('system');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Failed to update weights.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const data = await apiRequest('/api/admin/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LichGogo_LMS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('ok', 'Database backup exported.');
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Backup export failed.');
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const q = userSearch.toLowerCase();
    const matchSearch =
      !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  return (
    <DashboardLayout
      userName={user.fullName}
      userEmail={user.email}
      role={user.role}
      activeContextLabel={activeContextLabel}
      navItems={NAV_ITEMS}
      activeTab={tab}
      onSelectTab={setTab}
      notifications={notifications}
      onMarkNotificationRead={onMarkNotificationRead}
      onLogout={onLogout}
      darkMode={darkMode}
      onToggleDarkMode={onToggleDarkMode}
    >
      {feedback && (
        <div
          role="status"
          className={`mb-6 p-3.5 rounded-lg border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              ['Total Students', overview.kpis.totalStudents, 'Enrolled scholars'],
              ['Instructors', overview.kpis.totalInstructors, 'Active faculty'],
              ['Total Courses', overview.kpis.totalCourses, 'Catalog subjects'],
              ['Active Courses', overview.kpis.activeCourses, 'Current term'],
              ['Registered Users', overview.kpis.totalUsers, 'Portal accounts'],
              ['Pending Payments', overview.kpis.pendingPayments, 'Awaiting verification'],
            ].map(([label, val, hint]) => (
              <div
                key={String(label)}
                className="glass-card rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
                <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-1.5">
                  {val}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 min-w-0 overflow-hidden glass-card rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
                Academic Stream Performance Average (%)
              </h2>
              <div className="relative h-64 w-full min-w-0">
                <Bar
                  data={{
                    labels: overview.streamPerformance.map((s) => s.stream_name),
                    datasets: [
                      {
                        label: 'Average Score (%)',
                        data: overview.streamPerformance.map((s) => s.avg_score || 0),
                        backgroundColor: ['#163B65', '#14B8A6'],
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }}
                />
              </div>
            </div>

            <div className="lg:col-span-5 min-w-0 overflow-hidden glass-card rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
                Student Enrollment by Grade Level
              </h2>
              <div className="relative h-64 w-full min-w-0 flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: overview.gradeDistribution.map((g) => g.grade_name),
                    datasets: [
                      {
                        data: overview.gradeDistribution.map((g) => g.student_count),
                        backgroundColor: ['#163B65', '#2563EB', '#14B8A6', '#64748B'],
                      },
                    ],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
              Recent System Activity
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs min-w-0">
                  <div className="min-w-0 break-words">
                    <span className="font-mono-tabular font-semibold text-[#2563EB]">{act.action}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-700 dark:text-slate-200">{act.details}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono-tabular shrink-0">
                    {act.actor_name} · {act.created_at.slice(0, 16)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateUser}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Create Staff or Student Account
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                placeholder="Full Name"
                aria-label="New user full name"
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="email"
                required
                placeholder="Email (@lichgogo.edu.et)"
                aria-label="New user email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password (6+ chars)"
                aria-label="New user password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <select
                aria-label="New user role"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="ADMIN">Administrator</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="REGISTRAR">Registrar</option>
                <option value="FINANCE">Finance Staff</option>
                <option value="STUDENT">Student</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-sm font-medium"
              >
                Add User
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Directory ({filteredUsers.length} users)
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Search name or email..."
                  aria-label="Search users"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <select
                  aria-label="Filter users by role"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="STUDENT">Student</option>
                  <option value="REGISTRAR">Registrar</option>
                  <option value="FINANCE">Finance</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Full Name</th>
                    <th className="py-2.5 pr-4">Email</th>
                    <th className="py-2.5 pr-4">Role</th>
                    <th className="py-2.5 pr-4">Origin</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{u.full_name}</td>
                      <td className="py-3 pr-4 font-mono-tabular text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="py-3 pr-4 font-medium">{u.role}</td>
                      <td className="py-3 pr-4 text-slate-500">{u.is_sample_data ? 'Sample Data' : 'Live Record'}</td>
                      <td className="py-3 pr-4">
                        <span className={u.status === 'active' ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                          {u.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-xs font-medium text-[#2563EB] hover:underline"
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'roles' && rolesData && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Role &amp; Privilege Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Configure role-based access control permissions across institutional modules.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {rolesData.roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    selectedRoleId === r.id
                      ? 'bg-white dark:bg-slate-900 text-[#163B65] dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {rolesData.permissions.map((perm) => {
              const checked = rolesData.mappings.some(
                (m) => m.role_id === selectedRoleId && m.permission_id === perm.id,
              );
              return (
                <label
                  key={perm.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleTogglePermission(perm.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      {perm.code} <span className="font-normal text-slate-500">· {perm.module}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'courses' && coursesData && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Add Category */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiRequest<{ message: string }>('/api/admin/categories', {
                    method: 'POST',
                    body: JSON.stringify(newCat),
                  });
                  showMsg('ok', res.message);
                  setNewCat({ name: '', description: '' });
                  loadDataForTab('courses');
                } catch (err) {
                  showMsg('err', err instanceof Error ? err.message : 'Error adding category.');
                }
              }}
              className="glass-card rounded-xl p-6 space-y-3"
            >
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Course Categories ({categories.length})
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Category name"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium"
                >
                  Add
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {categories.map((c) => (
                  <div key={c.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-500 truncate max-w-[200px]">{c.description}</span>
                  </div>
                ))}
              </div>
            </form>

            {/* Add Schedule */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiRequest<{ message: string }>('/api/admin/schedules', {
                    method: 'POST',
                    body: JSON.stringify({ ...newSched, courseId: Number(newSched.courseId) }),
                  });
                  showMsg('ok', res.message);
                  loadDataForTab('courses');
                } catch (err) {
                  showMsg('err', err instanceof Error ? err.message : 'Error adding schedule.');
                }
              }}
              className="glass-card rounded-xl p-6 space-y-3"
            >
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Create Class Schedule Entry
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newSched.courseId}
                  onChange={(e) => setNewSched({ ...newSched, courseId: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  {coursesData.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={newSched.dayOfWeek}
                  onChange={(e) => setNewSched({ ...newSched, dayOfWeek: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newSched.startTime}
                  onChange={(e) => setNewSched({ ...newSched, startTime: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
                <input
                  type="text"
                  placeholder="Room (e.g. Lab B-02)"
                  value={newSched.room}
                  onChange={(e) => setNewSched({ ...newSched, room: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-medium">
                Save Schedule Slot
              </button>
            </form>
          </div>

          {/* Create Course */}
          <form
            onSubmit={handleCreateCourse}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Create New Academic Course
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Course Code (e.g. BIOL-111)"
                value={newCourse.code}
                onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Course Title"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <select
                value={newCourse.streamId}
                onChange={(e) => setNewCourse({ ...newCourse, streamId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="1">Natural Science</option>
                <option value="2">Social Science</option>
                <option value="">All Streams</option>
              </select>
              <select
                value={newCourse.instructorId}
                onChange={(e) => setNewCourse({ ...newCourse, instructorId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="">Assign Instructor (Optional)</option>
                {coursesData.instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Course description"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium shrink-0"
              >
                Create Course
              </button>
            </div>
          </form>

          {/* Courses Table */}
          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
              Active Courses &amp; Faculty Assignments
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Course Title</th>
                  <th className="py-2 pr-4">Grade / Stream</th>
                  <th className="py-2 pr-4">Assigned Instructor</th>
                  <th className="py-2 text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {coursesData.courses.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-mono-tabular font-semibold text-[#2563EB]">{c.code}</td>
                    <td className="py-2.5 pr-4 font-medium">{c.title}</td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {c.grade_name} · {c.stream_name || 'All Streams'}
                    </td>
                    <td className="py-2.5 pr-4">{c.instructor_name || 'Unassigned'}</td>
                    <td className="py-2.5 text-right font-mono-tabular">{c.enrolled_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'system' && sysConfig && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                  Configurable Stream Grading Weights
                </h2>
                <p className="text-xs text-slate-500">
                  Weights for each stream must sum to 100%. Saving automatically recalculates active semester grades.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export System Backup (JSON)</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {sysConfig.streamConfigs.map((cfg, idx) => (
                <div
                  key={cfg.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="font-display font-semibold text-sm text-[#163B65] dark:text-white">
                    {cfg.stream_name}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {(
                      [
                        ['quiz_weight', 'Quiz (%)'],
                        ['assignment_weight', 'Assignment (%)'],
                        ['midterm_weight', 'Midterm (%)'],
                        ['final_exam_weight', 'Final Exam (%)'],
                        ['passing_score', 'Pass Threshold (%)'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={cfg[field]}
                          onChange={(e) => {
                            const updated = [...sysConfig.streamConfigs];
                            updated[idx] = { ...cfg, [field]: Number(e.target.value) };
                            setSysConfig({ ...sysConfig, streamConfigs: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-tabular"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveStreamConfig(cfg)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-medium"
                  >
                    Save &amp; Recalculate Stream Grades
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
                Configured Institutional Grading Scale
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2">Letter</th>
                    <th className="py-2">Range</th>
                    <th className="py-2">GPA Pt</th>
                    <th className="py-2">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sysConfig.gradingScales.map((band) => (
                    <tr key={band.id}>
                      <td className="py-2 font-mono-tabular font-bold">{band.letter_grade}</td>
                      <td className="py-2 font-mono-tabular">
                        {band.min_score} – {band.max_score}
                      </td>
                      <td className="py-2 font-mono-tabular">{band.grade_point.toFixed(2)}</td>
                      <td className="py-2 text-slate-500">{band.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-card rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Academic Semesters
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {sysConfig.semesters.map((sem) => (
                  <div key={sem.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{sem.name}</div>
                      <div className="text-slate-500 font-mono-tabular">
                        {sem.start_date} to {sem.end_date}
                      </div>
                    </div>
                    {sem.is_active ? (
                      <span className="text-emerald-600 font-semibold">Active Term</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/semesters/${sem.id}/activate`, { method: 'POST' });
                          showMsg('ok', `Activated ${sem.name}.`);
                          loadDataForTab('system');
                        }}
                        className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && reports && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
                Student Enrollment Report
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2">Grade</th>
                    <th className="py-2">Stream</th>
                    <th className="py-2 text-right">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports.enrollmentReport.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{r.grade_name}</td>
                      <td className="py-2">{r.stream_name}</td>
                      <td className="py-2 text-right font-mono-tabular font-semibold">{r.total_students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
                Instructor Workload Report
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2">Instructor</th>
                    <th className="py-2">Department</th>
                    <th className="py-2 text-right">Courses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports.instructorReport.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{r.full_name}</td>
                      <td className="py-2 text-slate-500">{r.department}</td>
                      <td className="py-2 text-right font-mono-tabular font-semibold">{r.assigned_courses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
              Course Academic Performance Report
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2">Code</th>
                  <th className="py-2">Course</th>
                  <th className="py-2 text-right">Graded</th>
                  <th className="py-2 text-right">Average</th>
                  <th className="py-2 text-right">Min</th>
                  <th className="py-2 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.coursePerformanceReport.map((c) => (
                  <tr key={c.code}>
                    <td className="py-2 font-mono-tabular font-semibold text-[#2563EB]">{c.code}</td>
                    <td className="py-2 font-medium">{c.title}</td>
                    <td className="py-2 text-right font-mono-tabular">{c.graded_students}</td>
                    <td className="py-2 text-right font-mono-tabular">{c.average_score ?? '-'}%</td>
                    <td className="py-2 text-right font-mono-tabular">{c.min_score ?? '-'}</td>
                    <td className="py-2 text-right font-mono-tabular">{c.max_score ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiRequest<{ message: string }>('/api/admin/announcements', {
                  method: 'POST',
                  body: JSON.stringify(annForm),
                });
                showMsg('ok', res.message);
                setAnnForm({ title: '', body: '', targetRole: 'ALL', isPublic: true });
                loadDataForTab('announcements');
              } catch (err) {
                showMsg('err', err instanceof Error ? err.message : 'Failed to post announcement.');
              }
            }}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Publish Institutional Announcement
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Announcement Title"
                value={annForm.title}
                onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <select
                value={annForm.targetRole}
                onChange={(e) => setAnnForm({ ...annForm, targetRole: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="ALL">All Portal Users</option>
                <option value="STUDENT">Students Only</option>
                <option value="INSTRUCTOR">Instructors Only</option>
              </select>
            </div>
            <textarea
              rows={3}
              required
              placeholder="Announcement body..."
              value={annForm.body}
              onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={annForm.isPublic}
                  onChange={(e) => setAnnForm({ ...annForm, isPublic: e.target.checked })}
                />
                <span>Display on Public School Website</span>
              </label>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium">
                Publish Announcement
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
              Security &amp; System Audit Trail
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Entity</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-mono-tabular text-slate-500">{log.created_at.slice(0, 19)}</td>
                    <td className="py-2 pr-3 font-medium">{log.actor_name}</td>
                    <td className="py-2 pr-3 font-mono-tabular text-[#2563EB]">{log.action}</td>
                    <td className="py-2 pr-3">{log.entity_type} #{log.entity_id}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
