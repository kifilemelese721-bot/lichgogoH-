import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { apiRequest, ApiError, downloadAuthenticatedFile } from '../../utils/api';
import { downloadReceiptPdf, downloadReportCardPdf } from '../../utils/pdfGenerator';
import { DashboardLayout, type NavSectionItem } from '../DashboardLayout';
import type { NotificationItem, PaymentRecord, ReportCardPayload, RoleName, StudentProfile } from '../../types/lms';
import booksPhoto from '../../assets/images/books_photo.jpg';

interface StudentDashboardProps {
  user: { id: number; fullName: string; email: string; role: RoleName };
  activeContextLabel: string;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const NAV_ITEMS: NavSectionItem[] = [
  { id: 'overview', label: 'Overview & Profile', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'courses', label: 'Courses & Timetable', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'materials', label: 'Learning Materials', icon: <FileText className="w-4 h-4" /> },
  { id: 'assessments', label: 'Online Assessments', icon: <Clock className="w-4 h-4" /> },
  { id: 'results', label: 'Academic Results', icon: <Award className="w-4 h-4" /> },
  { id: 'attendance', label: 'Attendance', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'discussions', label: 'Discussion Forum', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'payments', label: 'Payment History', icon: <CreditCard className="w-4 h-4" /> },
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
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

  const [dash, setDash] = useState<{
    student: StudentProfile;
    enrolledCourses: Array<{ id: number; code: string; title: string; credit_hours: number; instructor_name: string | null }>;
    availableCourses: Array<{ id: number; code: string; title: string; description: string; credit_hours: number; grade_name: string; stream_name: string | null; instructor_name: string | null; is_enrolled: number }>;
    materials: Array<{ id: number; course_code: string; course_title: string; title: string; material_type: string; description: string; file_name: string; created_at: string }>;
    assessments: Array<{ id: number; course_code: string; title: string; assessment_type: string; total_marks: number; duration_minutes: number; deadline: string; allow_late_submission: number; submission_status: string | null; obtained_marks: number | null }>;
    schedule: Array<{ id: number; course_code: string; course_title: string; instructor_name: string; day_of_week: string; start_time: string; end_time: string; room: string }>;
    announcements: Array<{ id: number; title: string; body: string; author_name: string; created_at: string }>;
    attendanceRows: Array<{ id: number; course_title: string; attendance_type: string; attendance_date: string; status: string; remarks: string }>;
    attendanceSummary: { totalDays: number; presentDays: number; absentDays: number; lateDays: number; attendancePercentage: number };
    payments: PaymentRecord[];
    clearance: { cleared: boolean; reason?: string };
  } | null>(null);

  // Results state
  const [resultsState, setResultsState] = useState<
    | { status: 'idle' }
    | { status: 'locked'; reason: string }
    | { status: 'unlocked'; report: ReportCardPayload }
  >({ status: 'idle' });

  // Active assessment taking state
  const [activeExam, setActiveExam] = useState<{
    assessment: { id: number; title: string; duration_minutes: number; deadline: string; course_code: string };
    questions: Array<{ id: number; questionText: string; questionType: 'mcq' | 'short_answer'; options: string[]; maxMarks: number }>;
    deadlineStatus: { allowed: boolean; isLate: boolean; reason?: string };
  } | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Discussions
  const [topics, setTopics] = useState<Array<{ id: number; course_id: number; course_code: string; author_name: string; author_role: string; title: string; body: string; reply_count: number; created_at: string }>>([]);
  const [newTopic, setNewTopic] = useState({ courseId: '', title: '', body: '' });
  const [openReplies, setOpenReplies] = useState<Record<number, Array<{ id: number; author_name: string; author_role: string; body: string; created_at: string }>>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  // Profile update
  const [guardianPhone, setGuardianPhone] = useState('');

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadDashboard = async () => {
    const data = await apiRequest<NonNullable<typeof dash>>('/api/student/dashboard');
    setDash(data);
    setGuardianPhone(data.student.guardianPhone || '');
    if (!newTopic.courseId && data.enrolledCourses[0]) {
      setNewTopic((t) => ({ ...t, courseId: String(data.enrolledCourses[0].id) }));
    }
  };

  const loadResults = async () => {
    try {
      const report = await apiRequest<ReportCardPayload>('/api/student/results');
      setResultsState({ status: 'unlocked', report });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FEE_CLEARANCE_REQUIRED') {
        setResultsState({ status: 'locked', reason: err.message });
      } else {
        showMsg('err', err instanceof Error ? err.message : 'Unable to load academic results.');
      }
    }
  };

  const loadDiscussions = async () => {
    const res = await apiRequest<{ topics: typeof topics }>('/api/shared/discussions');
    setTopics(res.topics);
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'results') loadResults();
    if (tab === 'discussions') loadDiscussions().catch(() => {});
  }, [tab]);

  // Countdown timer for active exam
  useEffect(() => {
    if (!activeExam || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeExam, secondsLeft]);

  const startAssessment = async (assessmentId: number) => {
    try {
      const data = await apiRequest<NonNullable<typeof activeExam> & { submission: unknown }>(
        `/api/student/assessments/${assessmentId}`,
      );
      if (data.submission) {
        showMsg('err', 'You have already submitted this assessment.');
        return;
      }
      setActiveExam(data);
      setExamAnswers({});
      setSecondsLeft(data.assessment.duration_minutes * 60);
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Cannot start assessment.');
    }
  };

  const submitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExam) return;
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/student/assessments/${activeExam.assessment.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers: examAnswers }),
        },
      );
      showMsg('ok', res.message);
      setActiveExam(null);
      loadDashboard();
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Submission blocked.');
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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

      {tab === 'overview' && dash && (
        <div className="space-y-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#163B65]/95 via-[#1C4B82]/90 to-[#145374]/95 backdrop-blur-md border border-white/20 shadow-[0_18px_40px_-14px_rgba(22,59,101,0.45),inset_0_1px_0_rgba(255,255,255,0.22)] text-white rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 right-8 w-44 h-44 rounded-full bg-teal-300/15 blur-2xl"
            />
            <div className="relative space-y-1">
              <div className="text-xs font-medium text-teal-200">
                Boarding Scholar Portal · {dash.student.streamName}
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight">
                Welcome, {dash.student.fullName}
              </h2>
              <p className="text-xs text-slate-200">
                {dash.student.gradeName} · {dash.student.dormitoryBlock} · Student ID{' '}
                <span className="font-mono-tabular font-semibold text-white">{dash.student.studentCode}</span>
              </p>
            </div>
            <div className="relative flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setTab('materials')}
                className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold text-white whitespace-nowrap backdrop-blur-xs"
              >
                Open Course Books
              </button>
              <button
                type="button"
                onClick={() => setTab('results')}
                className="px-4 py-2 rounded-lg bg-[#14B8A6] hover:bg-teal-500 text-xs font-semibold text-white whitespace-nowrap shadow-[0_6px_16px_-4px_rgba(20,184,166,0.55)]"
              >
                View Academic Results
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Enrolled Courses</span>
                <BookOpen className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {dash.enrolledCourses.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Active semester subjects</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Attendance Rate</span>
                <UserCheck className="w-4 h-4 text-[#14B8A6]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#14B8A6] mt-2">
                {dash.attendanceSummary.attendancePercentage}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Classroom &amp; boarding combined</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Assessments</span>
                <Clock className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {dash.assessments.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Quizzes, assignments &amp; exams</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Fee Clearance</span>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>
              <div className={`text-sm font-bold mt-2.5 ${dash.clearance.cleared ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {dash.clearance.cleared ? 'VERIFIED CLEARED' : 'PENDING CLEARANCE'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {dash.clearance.cleared ? 'Report cards unlocked' : 'Verify tuition in finance'}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 glass-card rounded-xl p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Scholar Profile
              </h2>
              <div className="grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <div className="text-slate-500">Student ID</div>
                  <div className="font-mono-tabular font-semibold">{dash.student.studentCode}</div>
                </div>
                <div>
                  <div className="text-slate-500">Grade Level</div>
                  <div className="font-semibold">{dash.student.gradeName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Academic Stream</div>
                  <div className="font-semibold text-[#2563EB]">{dash.student.streamName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Dormitory Assignment</div>
                  <div className="font-medium">{dash.student.dormitoryBlock}</div>
                </div>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await apiRequest<{ message: string }>('/api/student/profile', {
                    method: 'PATCH',
                    body: JSON.stringify({ guardianPhone }),
                  });
                  showMsg('ok', res.message);
                }}
                className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end gap-2"
              >
                <div className="flex-1">
                  <label htmlFor="stu-gphone" className="block text-[11px] text-slate-500 mb-1">
                    Guardian Contact Phone (Permitted Update)
                  </label>
                  <input
                    id="stu-gphone"
                    type="text"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
                  />
                </div>
                <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-[#163B65] text-white text-xs font-medium">
                  Update
                </button>
              </form>
            </div>

            <div className="lg:col-span-6 glass-card rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Recent Announcements
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dash.announcements.map((a) => (
                  <div key={a.id} className="py-2.5 text-xs space-y-1">
                    <div className="text-slate-500">
                      {a.author_name} · {a.created_at.slice(0, 10)}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">{a.title}</div>
                    <p className="text-slate-600 dark:text-slate-300">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'courses' && dash && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Available Stream Courses ({dash.student.streamName})
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {dash.availableCourses.map((c) => (
                <div key={c.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                        <img
                          src={booksPhoto}
                          alt={`${c.title} course book`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-[#2563EB]">{c.code}</span>
                          <span>{c.grade_name} · {c.credit_hours} Credits</span>
                        </div>
                        <div className="font-semibold text-sm mt-0.5">{c.title}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{c.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">{c.instructor_name || 'Faculty Assigned'}</span>
                    {c.is_enrolled ? (
                      <span className="text-emerald-600 font-semibold">Enrolled</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await apiRequest<{ message: string }>('/api/student/enroll', {
                            method: 'POST',
                            body: JSON.stringify({ courseId: c.id }),
                          });
                          showMsg('ok', res.message);
                          loadDashboard();
                        }}
                        className="px-3 py-1 rounded bg-[#2563EB] text-white font-medium"
                      >
                        Enroll
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#2563EB]" />
              <span>Weekly Class Timetable</span>
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Day</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Instructor</th>
                  <th className="py-2">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dash.schedule.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-4 font-semibold">{s.day_of_week}</td>
                    <td className="py-2.5 pr-4 font-mono-tabular">{s.start_time} – {s.end_time}</td>
                    <td className="py-2.5 pr-4">{s.course_code} · {s.course_title}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{s.instructor_name}</td>
                    <td className="py-2.5 font-medium">{s.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'materials' && dash && (
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
              <img
                src={booksPhoto}
                alt="Digital course books and study guides"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Course Books &amp; Uploaded Learning Resources
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Access assigned textbooks, PDF lecture notes, and reference guides for your enrolled courses.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dash.materials.map((m) => (
              <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                    <img
                      src={booksPhoto}
                      alt={`${m.title} study book`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-500">{m.course_code} · {m.material_type.toUpperCase()}</div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{m.title}</div>
                    <div className="text-slate-500 mt-0.5">{m.description}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadAuthenticatedFile(`/api/shared/materials/${m.id}/download`, m.file_name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[#2563EB] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ({m.file_name})</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'assessments' && dash && (
        <div className="space-y-6">
          {activeExam ? (
            <form
              onSubmit={submitAssessment}
              className="glass-card rounded-xl p-6 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs text-[#2563EB] font-mono-tabular">{activeExam.assessment.course_code}</div>
                  <h2 className="font-display text-lg font-bold">{activeExam.assessment.title}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-mono-tabular text-sm font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                    Time Left: {formatTimer(secondsLeft)}
                  </div>
                  <button type="button" onClick={() => setActiveExam(null)} className="text-xs text-slate-500">
                    Cancel
                  </button>
                </div>
              </div>

              {!activeExam.deadlineStatus.allowed && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300">
                  {activeExam.deadlineStatus.reason}
                </div>
              )}

              <div className="space-y-5">
                {activeExam.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-2 text-sm">
                    <div className="font-medium">
                      {idx + 1}. {q.questionText}{' '}
                      <span className="text-xs text-slate-500 font-mono-tabular">({q.maxMarks} marks)</span>
                    </div>
                    {q.questionType === 'mcq' ? (
                      <div className="space-y-1.5 pl-4">
                        {q.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              value={opt}
                              checked={examAnswers[String(q.id)] === opt}
                              onChange={() => setExamAnswers({ ...examAnswers, [String(q.id)]: opt })}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={examAnswers[String(q.id)] || ''}
                        onChange={(e) => setExamAnswers({ ...examAnswers, [String(q.id)]: e.target.value })}
                        placeholder="Write your concise analytical answer..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={!activeExam.deadlineStatus.allowed}
                className="px-5 py-2.5 rounded-lg bg-[#163B65] hover:bg-[#2563EB] disabled:opacity-50 text-white text-xs font-semibold"
              >
                Submit Assessment Answers
              </button>
            </form>
          ) : (
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Online Quizzes, Assignments &amp; Examinations
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dash.assessments.map((a) => {
                  const expired = new Date(a.deadline).getTime() < Date.now() && !a.allow_late_submission;
                  return (
                    <div key={a.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 font-mono-tabular">
                          {a.course_code} · {a.assessment_type.toUpperCase()} · {a.duration_minutes} mins · Deadline {a.deadline.slice(0, 10)}
                        </div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">
                          {a.title}
                        </div>
                      </div>
                      <div>
                        {a.submission_status ? (
                          <span className="font-mono-tabular font-semibold text-emerald-600">
                            {a.submission_status === 'graded'
                              ? `Graded: ${a.obtained_marks} / ${a.total_marks}`
                              : 'Submitted (Pending Grade)'}
                          </span>
                        ) : expired ? (
                          <span className="text-red-600 font-medium">Deadline Passed (Locked)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startAssessment(a.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#163B65] text-white font-medium"
                          >
                            Start Assessment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-6">
          {resultsState.status === 'locked' && (
            <div className="glass-card border-amber-300/80 dark:border-amber-700/70 rounded-xl p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                Financial Fee Clearance Required
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {resultsState.reason}
              </p>
              <p className="text-xs text-slate-500">
                Institutional Policy: Students must have verified tuition fee clearance before
                accessing final semester results and official report cards.
              </p>
              <button
                type="button"
                onClick={() => setTab('payments')}
                className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium"
              >
                View Payment History
              </button>
            </div>
          )}

          {resultsState.status === 'unlocked' && (
            <div className="glass-card rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#163B65] dark:text-white">
                    Official Semester Academic Results
                  </h2>
                  <p className="text-xs text-slate-500">
                    {resultsState.report.academicYearName} · {resultsState.report.semesterName} · {resultsState.report.student.streamName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadReportCardPdf(resultsState.report)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report Card PDF</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500">Total Marks</div>
                  <div className="font-mono-tabular text-xl font-bold">{resultsState.report.totalMarks.toFixed(1)}</div>
                </div>
                <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500">Average Score</div>
                  <div className="font-mono-tabular text-xl font-bold">{resultsState.report.averageScore.toFixed(2)}%</div>
                </div>
                <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500">Semester GPA</div>
                  <div className="font-mono-tabular text-xl font-bold text-[#2563EB]">{resultsState.report.gpa.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-lg bg-[#F5F7FB] dark:bg-slate-800/60">
                  <div className="text-xs text-slate-500">Class Rank</div>
                  <div className="font-mono-tabular text-xl font-bold text-[#14B8A6]">
                    {resultsState.report.classRank ? `#${resultsState.report.classRank} / ${resultsState.report.totalInClass}` : '-'}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3 text-right">Quiz</th>
                      <th className="py-2 pr-3 text-right">Assign</th>
                      <th className="py-2 pr-3 text-right">Midterm</th>
                      <th className="py-2 pr-3 text-right">Final</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2 pr-3">Grade</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resultsState.report.subjects.map((s) => (
                      <tr key={s.courseId}>
                        <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[#2563EB]">{s.courseCode}</td>
                        <td className="py-2.5 pr-3 font-medium">{s.courseTitle}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-tabular">{s.quizScore ?? '-'}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-tabular">{s.assignmentScore ?? '-'}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-tabular">{s.midtermScore ?? '-'}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-tabular">{s.finalExamScore ?? '-'}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-tabular font-semibold">{s.totalScore.toFixed(1)}%</td>
                        <td className="py-2.5 pr-3 font-mono-tabular font-bold">{s.letterGrade}</td>
                        <td className="py-2.5">{s.passed ? 'Passed' : 'Needs Review'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && dash && (
        <div className="glass-card rounded-xl p-6 space-y-5 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Personal Attendance Summary
            </h2>
            <div className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
              Present: {dash.attendanceSummary.presentDays} · Absent: {dash.attendanceSummary.absentDays} · Attendance Rate: <strong>{dash.attendanceSummary.attendancePercentage}%</strong>
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2.5 pr-4">Date</th>
                <th className="py-2.5 pr-4">Type</th>
                <th className="py-2.5 pr-4">Subject / Block</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dash.attendanceRows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-4 font-mono-tabular">{a.attendance_date}</td>
                  <td className="py-3 pr-4 capitalize">{a.attendance_type}</td>
                  <td className="py-3 pr-4 font-medium">{a.course_title}</td>
                  <td className="py-3 pr-4 uppercase font-semibold">{a.status}</td>
                  <td className="py-3 text-slate-500">{a.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'discussions' && dash && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest('/api/shared/discussions', {
                method: 'POST',
                body: JSON.stringify({ ...newTopic, courseId: Number(newTopic.courseId) }),
              });
              showMsg('ok', 'Discussion question posted.');
              setNewTopic({ ...newTopic, title: '', body: '' });
              loadDiscussions();
            }}
            className="glass-card rounded-xl p-6 space-y-3"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Ask an Academic Question
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <select
                value={newTopic.courseId}
                onChange={(e) => setNewTopic({ ...newTopic, courseId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                {dash.enrolledCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Topic Title"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
            <textarea
              rows={2}
              required
              placeholder="Describe your question..."
              value={newTopic.body}
              onChange={(e) => setNewTopic({ ...newTopic, body: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium">
              Post Topic
            </button>
          </form>

          <div className="space-y-4">
            {topics.map((t) => (
              <div key={t.id} className="glass-card rounded-xl p-5 space-y-3 text-xs">
                <div className="text-slate-500">
                  {t.course_code} · {t.author_name} ({t.author_role}) · {t.created_at.slice(0, 10)}
                </div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white">{t.title}</div>
                <p className="text-slate-600 dark:text-slate-300">{t.body}</p>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiRequest<{ replies: typeof openReplies[number] }>(`/api/shared/discussions/${t.id}/replies`);
                    setOpenReplies({ ...openReplies, [t.id]: res.replies });
                  }}
                  className="text-[#2563EB] font-medium hover:underline"
                >
                  View Replies ({t.reply_count})
                </button>

                {openReplies[t.id] && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {openReplies[t.id].map((r) => (
                      <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="font-semibold">{r.author_name} ({r.author_role})</div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5">{r.body}</div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a reply..."
                        value={replyDrafts[t.id] || ''}
                        onChange={(e) => setReplyDrafts({ ...replyDrafts, [t.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/shared/discussions/${t.id}/replies`, {
                            method: 'POST',
                            body: JSON.stringify({ body: replyDrafts[t.id] }),
                          });
                          setReplyDrafts({ ...replyDrafts, [t.id]: '' });
                          const res = await apiRequest<{ replies: typeof openReplies[number] }>(`/api/shared/discussions/${t.id}/replies`);
                          setOpenReplies({ ...openReplies, [t.id]: res.replies });
                        }}
                        className="px-3 py-1.5 rounded bg-[#2563EB] text-white"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'payments' && dash && (
        <div className="glass-card rounded-xl p-6 space-y-4 overflow-x-auto">
          <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
            Tuition Payment History &amp; Official Receipts
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 pr-4">Semester</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4 text-right">Amount (ETB)</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Receipt No</th>
                <th className="py-2 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dash.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-4 font-medium">{(p as unknown as { semester_name: string }).semester_name}</td>
                  <td className="py-2.5 pr-4 font-mono-tabular">{(p as unknown as { transaction_ref: string }).transaction_ref}</td>
                  <td className="py-2.5 pr-4">{(p as unknown as { payment_method: string }).payment_method}</td>
                  <td className="py-2.5 pr-4 text-right font-mono-tabular">{Number((p as unknown as { amount_etb: number }).amount_etb).toLocaleString()}</td>
                  <td className="py-2.5 pr-4 uppercase font-semibold">{p.status}</td>
                  <td className="py-2.5 pr-4 font-mono-tabular">{(p as unknown as { receipt_number: string | null }).receipt_number || '-'}</td>
                  <td className="py-2.5 text-right">
                    {p.status === 'verified' ? (
                      <button
                        type="button"
                        onClick={() =>
                          downloadReceiptPdf({
                            ...p,
                            studentName: dash.student.fullName,
                            studentCode: dash.student.studentCode,
                            semesterName: (p as unknown as { semester_name: string }).semester_name,
                            amountEtb: (p as unknown as { amount_etb: number }).amount_etb,
                            paymentMethod: (p as unknown as { payment_method: PaymentRecord['paymentMethod'] }).payment_method,
                            transactionRef: (p as unknown as { transaction_ref: string }).transaction_ref,
                            receiptNumber: (p as unknown as { receipt_number: string }).receipt_number,
                            verifiedByName: (p as unknown as { verified_by_name: string }).verified_by_name,
                            paidAt: (p as unknown as { paid_at: string }).paid_at,
                          })
                        }
                        className="text-[#2563EB] font-medium hover:underline"
                      >
                        Receipt PDF
                      </button>
                    ) : (
                      <span className="text-slate-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
};
