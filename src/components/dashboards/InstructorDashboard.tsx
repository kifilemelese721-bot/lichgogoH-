import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  MessageSquare,
  Trash2,
  Upload,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { DashboardLayout, type NavSectionItem } from '../DashboardLayout';
import type { NotificationItem, RoleName } from '../../types/lms';
import booksPhoto from '../../assets/images/books_photo.jpg';

interface InstructorDashboardProps {
  user: { id: number; fullName: string; email: string; role: RoleName };
  activeContextLabel: string;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const NAV_ITEMS: NavSectionItem[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'courses', label: 'Courses & Materials', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'assessments', label: 'Assessments & Quizzes', icon: <FilePlus2 className="w-4 h-4" /> },
  { id: 'grading', label: 'Gradebook (0–100)', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'attendance', label: 'Attendance Tracking', icon: <CalendarCheck className="w-4 h-4" /> },
  { id: 'communication', label: 'Discussions & Notices', icon: <MessageSquare className="w-4 h-4" /> },
];

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
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

  const [dashData, setDashData] = useState<{
    courses: Array<{ id: number; code: string; title: string; grade_name: string; stream_name: string | null; enrolled_count: number }>;
    assessments: Array<{ id: number; course_id: number; course_code: string; title: string; assessment_type: string; total_marks: number; duration_minutes: number; deadline: string; submission_count: number; pending_grading_count: number }>;
    announcements: Array<{ id: number; title: string; body: string; course_title: string | null; created_at: string }>;
    courseStats: Array<{ code: string; title: string; avg_score: number | null; graded_count: number }>;
  } | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<number>(0);
  const [courseDetail, setCourseDetail] = useState<{
    students: Array<{
      student_id: number;
      student_code: string;
      full_name: string;
      grade_name: string;
      stream_name: string;
      quiz_score: number | null;
      assignment_score: number | null;
      midterm_score: number | null;
      final_exam_score: number | null;
      total_score: number | null;
      letter_grade: string | null;
    }>;
    materials: Array<{ id: number; title: string; material_type: string; description: string; file_name: string; created_at: string }>;
  } | null>(null);

  // Material Upload
  const [matForm, setMatForm] = useState({ title: '', materialType: 'pdf', description: '', fileName: 'Lecture_Notes.pdf', contentBase64: '' });

  // Assessment Creator
  const [assessForm, setAssessForm] = useState({
    title: '',
    assessmentType: 'quiz',
    description: '',
    totalMarks: 100,
    durationMinutes: 30,
    deadline: '2026-12-25T23:59',
    allowLateSubmission: false,
    questionText: '',
    optionsCsv: 'Option A, Option B, Option C, Option D',
    correctOption: 'Option A',
  });
  const [submissionsView, setSubmissionsView] = useState<{
    assessment: { id: number; title: string; total_marks: number };
    submissions: Array<{ submission_id: number; student_code: string; student_name: string; answers_json: string; submitted_at: string; status: string; marks_obtained: number | null; feedback: string | null }>;
  } | null>(null);

  // Gradebook local edits
  const [markDrafts, setMarkDrafts] = useState<Record<number, { quiz: string; assignment: string; midterm: string; finalExam: string }>>({});

  // Attendance
  const [attDate, setAttDate] = useState('2026-11-15');
  const [attEntries, setAttEntries] = useState<Record<number, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [isCorrection, setIsCorrection] = useState(false);
  const [attHistory, setAttHistory] = useState<Array<{ id: number; student_code: string; student_name: string; attendance_date: string; status: string; remarks: string }>>([]);

  // Communication
  const [annForm, setAnnForm] = useState({ title: '', body: '' });
  const [topics, setTopics] = useState<Array<{ id: number; course_code: string; author_name: string; title: string; body: string; reply_count: number; created_at: string }>>([]);
  const [replyTarget, setReplyTarget] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadDashboard = async () => {
    const d = await apiRequest<NonNullable<typeof dashData>>('/api/instructor/dashboard');
    setDashData(d);
    if (!selectedCourseId && d.courses[0]) {
      setSelectedCourseId(d.courses[0].id);
    }
  };

  const loadCourseDetail = async (cid: number) => {
    if (!cid) return;
    const detail = await apiRequest<NonNullable<typeof courseDetail>>(`/api/instructor/courses/${cid}/students`);
    setCourseDetail(detail);
    const drafts: typeof markDrafts = {};
    const statuses: typeof attEntries = {};
    for (const s of detail.students) {
      drafts[s.student_id] = {
        quiz: s.quiz_score !== null ? String(s.quiz_score) : '',
        assignment: s.assignment_score !== null ? String(s.assignment_score) : '',
        midterm: s.midterm_score !== null ? String(s.midterm_score) : '',
        finalExam: s.final_exam_score !== null ? String(s.final_exam_score) : '',
      };
      statuses[s.student_id] = 'present';
    }
    setMarkDrafts(drafts);
    setAttEntries(statuses);

    const hist = await apiRequest<{ records: typeof attHistory }>(`/api/instructor/attendance?courseId=${cid}`);
    setAttHistory(hist.records);
  };

  const loadDiscussions = async () => {
    const res = await apiRequest<{ topics: typeof topics }>('/api/instructor/discussions');
    setTopics(res.topics);
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCourseId) loadCourseDetail(selectedCourseId).catch(() => {});
  }, [selectedCourseId]);

  useEffect(() => {
    if (tab === 'communication') loadDiscussions().catch(() => {});
  }, [tab]);

  const handleSaveGrade = async (studentId: number) => {
    const d = markDrafts[studentId];
    if (!d) return;
    const checkNum = (v: string, label: string) => {
      if (v.trim() === '') return null;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        throw new Error(`${label} mark must be between 0 and 100.`);
      }
      return n;
    };

    try {
      const payload = {
        courseId: selectedCourseId,
        studentId,
        quizScore: checkNum(d.quiz, 'Quiz'),
        assignmentScore: checkNum(d.assignment, 'Assignment'),
        midtermScore: checkNum(d.midterm, 'Midterm'),
        finalExamScore: checkNum(d.finalExam, 'Final Exam'),
      };
      const res = await apiRequest<{ message: string; totalScore: number; letterGrade: string }>(
        '/api/instructor/grades',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      showMsg('ok', `${res.message} Computed Total: ${res.totalScore}% (${res.letterGrade})`);
      loadCourseDetail(selectedCourseId);
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Failed to save marks.');
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseDetail) return;
    try {
      const entries = courseDetail.students.map((s) => ({
        studentId: s.student_id,
        status: attEntries[s.student_id] || 'present',
      }));
      const res = await apiRequest<{ message: string }>('/api/instructor/attendance', {
        method: 'POST',
        body: JSON.stringify({
          courseId: selectedCourseId,
          attendanceType: 'classroom',
          attendanceDate: attDate,
          isCorrection,
          entries,
        }),
      });
      showMsg('ok', res.message);
      setIsCorrection(false);
      loadCourseDetail(selectedCourseId);
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Attendance save failed.');
    }
  };

  const courseSelector = dashData && (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 glass-card rounded-xl p-4">
      <div className="text-xs font-medium text-slate-500">Active Assigned Course</div>
      <select
        aria-label="Select assigned course"
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(Number(e.target.value))}
        className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium"
      >
        {dashData.courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.title} ({c.enrolled_count} students)
          </option>
        ))}
      </select>
    </div>
  );

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

      {tab === 'overview' && dashData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Assigned Courses</span>
                <BookOpen className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {dashData.courses.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Active teaching load</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Enrolled Students</span>
                <CalendarCheck className="w-4 h-4 text-[#14B8A6]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {dashData.courses.reduce((sum, c) => sum + c.enrolled_count, 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Across assigned classes</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Active Assessments</span>
                <FilePlus2 className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {dashData.assessments.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Quizzes &amp; exams</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Pending Grading</span>
                <ClipboardCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-amber-600 mt-2">
                {dashData.assessments.reduce((sum, a) => sum + a.pending_grading_count, 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Submissions awaiting score</div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
              Course Performance Average (%)
            </h2>
            <div className="relative h-64 w-full min-w-0">
              <Bar
                data={{
                  labels: dashData.courseStats.map((c) => c.code),
                  datasets: [
                    {
                      label: 'Class Average (%)',
                      data: dashData.courseStats.map((c) => c.avg_score || 0),
                      backgroundColor: '#2563EB',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'courses' && courseDetail && (
        <div className="space-y-6">
          {courseSelector}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiRequest<{ message: string }>(
                  `/api/instructor/courses/${selectedCourseId}/materials`,
                  { method: 'POST', body: JSON.stringify(matForm) },
                );
                showMsg('ok', res.message);
                setMatForm({ title: '', materialType: 'pdf', description: '', fileName: 'Lecture_Notes.pdf', contentBase64: '' });
                loadCourseDetail(selectedCourseId);
              } catch (err) {
                showMsg('err', err instanceof Error ? err.message : 'Upload failed.');
              }
            }}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Upload Learning Material
            </h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Material Title"
                value={matForm.title}
                onChange={(e) => setMatForm({ ...matForm, title: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <select
                value={matForm.materialType}
                onChange={(e) => setMatForm({ ...matForm, materialType: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="pdf">PDF Document</option>
                <option value="presentation">Presentation Slides</option>
                <option value="video">Lecture Video</option>
                <option value="document">Study Document</option>
              </select>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const b64 = String(reader.result).split(',')[1] || '';
                    setMatForm((prev) => ({ ...prev, fileName: file.name, contentBase64: b64 }));
                  };
                  reader.readAsDataURL(file);
                }}
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-xs"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Brief description or chapter note..."
                value={matForm.description}
                onChange={(e) => setMatForm({ ...matForm, description: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Material</span>
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                <img
                  src={booksPhoto}
                  alt="Published course books and materials"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Published Course Books &amp; Materials ({courseDetail.materials.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {courseDetail.materials.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-[#F2F7FF] shrink-0">
                      <img
                        src={booksPhoto}
                        alt={`${m.title} course book`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white">{m.title}</div>
                      <div className="text-slate-500">
                        {m.material_type.toUpperCase()} · {m.file_name} · {m.created_at.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadAuthenticatedFile(`/api/shared/materials/${m.id}/download`, m.file_name)}
                      className="text-[#2563EB] font-medium hover:underline"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${m.title}`}
                      onClick={async () => {
                        await apiRequest(`/api/instructor/materials/${m.id}`, { method: 'DELETE' });
                        loadCourseDetail(selectedCourseId);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'assessments' && dashData && (
        <div className="space-y-6">
          {courseSelector}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiRequest<{ message: string }>('/api/instructor/assessments', {
                  method: 'POST',
                  body: JSON.stringify({
                    courseId: selectedCourseId,
                    title: assessForm.title,
                    assessmentType: assessForm.assessmentType,
                    description: assessForm.description,
                    totalMarks: Number(assessForm.totalMarks),
                    durationMinutes: Number(assessForm.durationMinutes),
                    deadline: new Date(assessForm.deadline).toISOString(),
                    allowLateSubmission: assessForm.allowLateSubmission,
                    questions: assessForm.questionText
                      ? [
                          {
                            questionText: assessForm.questionText,
                            questionType: 'mcq',
                            options: assessForm.optionsCsv.split(',').map((s) => s.trim()).filter(Boolean),
                            correctOption: assessForm.correctOption.trim(),
                            maxMarks: Number(assessForm.totalMarks),
                          },
                        ]
                      : [],
                  }),
                });
                showMsg('ok', res.message);
                setAssessForm({ ...assessForm, title: '', description: '', questionText: '' });
                loadDashboard();
              } catch (err) {
                showMsg('err', err instanceof Error ? err.message : 'Failed to create assessment.');
              }
            }}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Create Quiz, Assignment, or Examination
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Assessment Title"
                value={assessForm.title}
                onChange={(e) => setAssessForm({ ...assessForm, title: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <select
                value={assessForm.assessmentType}
                onChange={(e) => setAssessForm({ ...assessForm, assessmentType: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
                <option value="midterm">Midterm Exam</option>
                <option value="final_exam">Final Exam</option>
              </select>
              <input
                type="number"
                min={1}
                max={100}
                value={assessForm.durationMinutes}
                onChange={(e) => setAssessForm({ ...assessForm, durationMinutes: Number(e.target.value) })}
                placeholder="Duration (mins)"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="datetime-local"
                required
                value={assessForm.deadline}
                onChange={(e) => setAssessForm({ ...assessForm, deadline: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Sample MCQ Question (optional)"
                value={assessForm.questionText}
                onChange={(e) => setAssessForm({ ...assessForm, questionText: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="text"
                placeholder="Options comma-separated"
                value={assessForm.optionsCsv}
                onChange={(e) => setAssessForm({ ...assessForm, optionsCsv: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="text"
                placeholder="Correct option exact text"
                value={assessForm.correctOption}
                onChange={(e) => setAssessForm({ ...assessForm, correctOption: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={assessForm.allowLateSubmission}
                  onChange={(e) => setAssessForm({ ...assessForm, allowLateSubmission: e.target.checked })}
                />
                <span>Allow Late Submissions</span>
              </label>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium">
                Publish Assessment
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Published Assessments &amp; Student Submissions
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dashData.assessments.map((a) => (
                <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {a.course_code} · {a.title}
                    </div>
                    <div className="text-slate-500 font-mono-tabular">
                      {a.assessment_type.toUpperCase()} · {a.duration_minutes} mins · Due {a.deadline.slice(0, 10)} · {a.submission_count} submissions
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiRequest<NonNullable<typeof submissionsView>>(
                        `/api/instructor/assessments/${a.id}/submissions`,
                      );
                      setSubmissionsView(res);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[#2563EB] font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Review Submissions
                  </button>
                </div>
              ))}
            </div>
          </div>

          {submissionsView && (
            <div className="glass-card rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">
                  Submissions: {submissionsView.assessment.title}
                </h3>
                <button type="button" onClick={() => setSubmissionsView(null)} className="text-xs text-slate-500">
                  Close
                </button>
              </div>
              {submissionsView.submissions.length === 0 ? (
                <p className="text-xs text-slate-500">No student submissions yet.</p>
              ) : (
                submissionsView.submissions.map((sub) => (
                  <div key={sub.submission_id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold">{sub.student_name} ({sub.student_code})</div>
                      <div className="text-slate-500 font-mono-tabular">Submitted {sub.submitted_at.slice(0, 16)} · Status: {sub.status}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-semibold">
                        Marks: {sub.marks_obtained ?? 'Pending'} / {submissionsView.assessment.total_marks}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/instructor/submissions/${sub.submission_id}/grade`, {
                            method: 'POST',
                            body: JSON.stringify({ marksObtained: 85, feedback: 'Reviewed and verified by instructor.' }),
                          });
                          showMsg('ok', `Graded ${sub.student_name}.`);
                          const res = await apiRequest<NonNullable<typeof submissionsView>>(
                            `/api/instructor/assessments/${submissionsView.assessment.id}/submissions`,
                          );
                          setSubmissionsView(res);
                        }}
                        className="px-2.5 py-1 rounded bg-[#2563EB] text-white"
                      >
                        Record 85/100
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'grading' && courseDetail && (
        <div className="space-y-6">
          {courseSelector}

          <div className="glass-card rounded-xl p-6 space-y-4 overflow-x-auto">
            <div>
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Automated Gradebook &amp; Marks Validation (0–100)
              </h2>
              <p className="text-xs text-slate-500">
                Enter assessment marks between 0 and 100. Weighted totals and GPA letter grades are automatically calculated by the backend engine according to the student&apos;s academic stream.
              </p>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Student ID</th>
                  <th className="py-2 pr-3">Student Name</th>
                  <th className="py-2 pr-2">Quiz</th>
                  <th className="py-2 pr-2">Assign</th>
                  <th className="py-2 pr-2">Midterm</th>
                  <th className="py-2 pr-2">Final</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {courseDetail.students.map((st) => {
                  const draft = markDrafts[st.student_id] || { quiz: '', assignment: '', midterm: '', finalExam: '' };
                  return (
                    <tr key={st.student_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-mono-tabular text-slate-500">{st.student_code}</td>
                      <td className="py-2.5 pr-3 font-medium">{st.full_name}</td>
                      {(
                        [
                          ['quiz', 'Quiz mark'],
                          ['assignment', 'Assignment mark'],
                          ['midterm', 'Midterm mark'],
                          ['finalExam', 'Final exam mark'],
                        ] as const
                      ).map(([key, aria]) => (
                        <td key={key} className="py-2 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            aria-label={`${st.full_name} ${aria}`}
                            value={draft[key]}
                            onChange={(e) =>
                              setMarkDrafts({
                                ...markDrafts,
                                [st.student_id]: { ...draft, [key]: e.target.value },
                              })
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-tabular"
                          />
                        </td>
                      ))}
                      <td className="py-2.5 pr-3 text-right font-mono-tabular font-semibold">
                        {st.total_score !== null ? `${st.total_score}%` : '-'}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-tabular font-bold text-[#163B65] dark:text-teal-300">
                        {st.letter_grade || '-'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          aria-label={`Save marks for ${st.full_name}`}
                          onClick={() => handleSaveGrade(st.student_id)}
                          className="px-3 py-1 rounded bg-[#2563EB] hover:bg-[#163B65] text-white font-medium whitespace-nowrap"
                        >
                          Save Marks
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && courseDetail && (
        <div className="space-y-6">
          {courseSelector}

          <form
            onSubmit={handleSaveAttendance}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                  Daily Classroom Attendance
                </h2>
                <p className="text-xs text-slate-500">
                  Duplicate records for the same student, course, and date are blocked unless Authorized Correction Mode is enabled.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="date"
                  aria-label="Attendance date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
                />
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isCorrection}
                    onChange={(e) => setIsCorrection(e.target.checked)}
                  />
                  <span>Authorized Correction Mode</span>
                </label>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {courseDetail.students.map((st) => (
                <div key={st.student_id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-mono-tabular text-slate-500 mr-2">{st.student_code}</span>
                    <span className="font-medium">{st.full_name}</span>
                  </div>
                  <select
                    aria-label={`Attendance status for ${st.full_name}`}
                    value={attEntries[st.student_id] || 'present'}
                    onChange={(e) =>
                      setAttEntries({
                        ...attEntries,
                        [st.student_id]: e.target.value as 'present' | 'absent' | 'late' | 'excused',
                      })
                    }
                    className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              ))}
            </div>

            <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium">
              Save Attendance Register
            </button>
          </form>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-3">
              Attendance History
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Student ID</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 font-mono-tabular">{h.attendance_date}</td>
                    <td className="py-2 font-mono-tabular text-slate-500">{h.student_code}</td>
                    <td className="py-2 font-medium">{h.student_name}</td>
                    <td className="py-2 uppercase font-semibold">{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'communication' && (
        <div className="space-y-6">
          {courseSelector}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiRequest<{ message: string }>('/api/instructor/announcements', {
                method: 'POST',
                body: JSON.stringify({ courseId: selectedCourseId, ...annForm }),
              });
              showMsg('ok', res.message);
              setAnnForm({ title: '', body: '' });
              loadDashboard();
            }}
            className="glass-card rounded-xl p-6 space-y-3"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Post Course Announcement
            </h2>
            <input
              type="text"
              required
              placeholder="Announcement Title"
              value={annForm.title}
              onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
            <textarea
              rows={2}
              required
              placeholder="Write update for enrolled students..."
              value={annForm.body}
              onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium">
              Post Course Notice
            </button>
          </form>

          <div className="glass-card rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
              Course Discussion Moderation
            </h2>
            {topics.map((t) => (
              <div key={t.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-slate-500">
                      {t.course_code} · {t.author_name} · {t.created_at.slice(0, 10)}
                    </div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">{t.title}</div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{t.body}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete topic ${t.title}`}
                    onClick={async () => {
                      await apiRequest(`/api/instructor/discussions/${t.id}`, { method: 'DELETE' });
                      showMsg('ok', 'Discussion post removed.');
                      loadDiscussions();
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {replyTarget === t.id ? (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write instructor response..."
                      className="flex-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/shared/discussions/${t.id}/replies`, {
                          method: 'POST',
                          body: JSON.stringify({ body: replyBody }),
                        });
                        setReplyBody('');
                        setReplyTarget(null);
                        loadDiscussions();
                      }}
                      className="px-3 py-1.5 rounded bg-[#2563EB] text-white font-medium"
                    >
                      Send Reply
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyTarget(t.id)}
                    className="text-[#2563EB] font-medium hover:underline"
                  >
                    Reply ({t.reply_count} replies)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
