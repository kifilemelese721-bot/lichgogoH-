import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle,
  Download,
  FileCheck2,
  Printer,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { downloadCertificatePdf, downloadReportCardPdf } from '../../utils/pdfGenerator';
import { DashboardLayout, type NavSectionItem } from '../DashboardLayout';
import type { CertificateRecord, NotificationItem, ReportCardPayload, RoleName } from '../../types/lms';

interface RegistrarDashboardProps {
  user: { id: number; fullName: string; email: string; role: RoleName };
  activeContextLabel: string;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const NAV_ITEMS: NavSectionItem[] = [
  { id: 'enrollment', label: 'Enrollment & Streams', icon: <Users className="w-4 h-4" /> },
  { id: 'grades', label: 'Grade Verification', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'report-cards', label: 'Official Report Cards', icon: <FileCheck2 className="w-4 h-4" /> },
  { id: 'certificates', label: 'Certificates', icon: <Award className="w-4 h-4" /> },
];

export const RegistrarDashboard: React.FC<RegistrarDashboardProps> = ({
  user,
  activeContextLabel,
  notifications,
  onMarkNotificationRead,
  onLogout,
  darkMode,
  onToggleDarkMode,
}) => {
  const [tab, setTab] = useState('enrollment');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [students, setStudents] = useState<Array<{
    id: number;
    student_code: string;
    full_name: string;
    email: string;
    grade_id: number;
    grade_name: string;
    stream_code: string;
    stream_name: string;
    dormitory_block: string;
    enrollment_status: string;
    latest_payment_status: string | null;
  }>>([]);
  const [search, setSearch] = useState('');
  const [newStu, setNewStu] = useState({
    fullName: '',
    email: '',
    studentCode: '',
    gender: 'Female',
    gradeId: '3',
    streamCode: 'NATURAL_SCIENCE',
    dormitoryBlock: 'Girls Dormitory — Block B',
    guardianName: '',
    guardianPhone: '',
  });

  const [gradeRecords, setGradeRecords] = useState<Array<{
    id: number;
    student_code: string;
    student_name: string;
    stream_name: string;
    course_code: string;
    course_title: string;
    total_score: number;
    letter_grade: string;
    verified_by_registrar: number;
  }>>([]);

  const [selectedStudentId, setSelectedStudentId] = useState<number>(1);
  const [reportCard, setReportCard] = useState<ReportCardPayload | null>(null);

  const [certificates, setCertificates] = useState<Array<{
    id: number;
    certificate_number: string;
    student_id: number;
    student_code: string;
    student_name: string;
    grade_name: string;
    stream_name: string;
    academic_year_name: string;
    certificate_type: CertificateRecord['certificateType'];
    issued_by_name: string;
    issued_at: string;
    status: 'issued' | 'revoked';
  }>>([]);
  const [certType, setCertType] = useState<CertificateRecord['certificateType']>('Academic Completion');

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadStudents = async () => {
    const res = await apiRequest<{ students: typeof students }>(
      `/api/registrar/students?search=${encodeURIComponent(search)}`,
    );
    setStudents(res.students);
    if (res.students[0] && !selectedStudentId) setSelectedStudentId(res.students[0].id);
  };

  const loadGrades = async () => {
    const res = await apiRequest<{ records: typeof gradeRecords }>('/api/registrar/grades-overview');
    setGradeRecords(res.records);
  };

  const loadCertificates = async () => {
    const res = await apiRequest<{ certificates: typeof certificates }>('/api/registrar/certificates');
    setCertificates(res.certificates);
  };

  useEffect(() => {
    loadStudents().catch(() => {});
  }, [search]);

  useEffect(() => {
    if (tab === 'grades') loadGrades().catch(() => {});
    if (tab === 'certificates') loadCertificates().catch(() => {});
  }, [tab]);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/registrar/students', {
        method: 'POST',
        body: JSON.stringify({ ...newStu, gradeId: Number(newStu.gradeId) }),
      });
      showMsg('ok', res.message);
      setNewStu({
        fullName: '',
        email: '',
        studentCode: '',
        gender: 'Female',
        gradeId: '3',
        streamCode: 'NATURAL_SCIENCE',
        dormitoryBlock: 'Girls Dormitory — Block B',
        guardianName: '',
        guardianPhone: '',
      });
      loadStudents();
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Student registration failed.');
    }
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
          className={`no-print mb-6 p-3.5 rounded-lg border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {tab === 'enrollment' && (
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterStudent}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2563EB]" />
              <span>Register New Boarding Student &amp; Assign Stream</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Student Full Name"
                value={newStu.fullName}
                onChange={(e) => setNewStu({ ...newStu, fullName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={newStu.email}
                onChange={(e) => setNewStu({ ...newStu, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="text"
                placeholder="Student ID (auto if blank)"
                value={newStu.studentCode}
                onChange={(e) => setNewStu({ ...newStu, studentCode: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
              />
              <select
                value={newStu.streamCode}
                onChange={(e) => setNewStu({ ...newStu, streamCode: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="NATURAL_SCIENCE">Natural Science Stream</option>
                <option value="SOCIAL_SCIENCE">Social Science Stream</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-4 gap-3">
              <select
                value={newStu.gradeId}
                onChange={(e) => setNewStu({ ...newStu, gradeId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="1">Grade 9</option>
                <option value="2">Grade 10</option>
                <option value="3">Grade 11</option>
                <option value="4">Grade 12</option>
              </select>
              <input
                type="text"
                placeholder="Dormitory Block"
                value={newStu.dormitoryBlock}
                onChange={(e) => setNewStu({ ...newStu, dormitoryBlock: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="text"
                placeholder="Guardian Name"
                value={newStu.guardianName}
                onChange={(e) => setNewStu({ ...newStu, guardianName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium"
              >
                Register &amp; Enroll
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                Student Registry ({students.length})
              </h2>
              <input
                type="search"
                placeholder="Search ID, name, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>

            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Student ID</th>
                  <th className="py-2 pr-3">Full Name</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 pr-3">Academic Stream</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Fee Clearance</th>
                  <th className="py-2 text-right">Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[#2563EB]">{st.student_code}</td>
                    <td className="py-2.5 pr-3 font-medium">{st.full_name}</td>
                    <td className="py-2.5 pr-3">{st.grade_name}</td>
                    <td className="py-2.5 pr-3">
                      <select
                        aria-label={`Stream for ${st.full_name}`}
                        value={st.stream_code}
                        onChange={async (e) => {
                          await apiRequest(`/api/registrar/students/${st.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ streamCode: e.target.value }),
                          });
                          showMsg('ok', `Updated stream for ${st.full_name}.`);
                          loadStudents();
                        }}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        <option value="NATURAL_SCIENCE">Natural Science</option>
                        <option value="SOCIAL_SCIENCE">Social Science</option>
                      </select>
                    </td>
                    <td className="py-2.5 pr-3 capitalize">{st.enrollment_status}</td>
                    <td className="py-2.5 pr-3 uppercase font-semibold">
                      {st.latest_payment_status || 'Unpaid'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          const next = st.enrollment_status === 'enrolled' ? 'transferred' : 'enrolled';
                          await apiRequest(`/api/registrar/students/${st.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ enrollmentStatus: next }),
                          });
                          loadStudents();
                        }}
                        className="text-[#2563EB] hover:underline"
                      >
                        {st.enrollment_status === 'enrolled' ? 'Mark Transferred' : 'Re-enroll'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'grades' && (
        <div className="glass-card rounded-xl p-6 space-y-4 overflow-x-auto">
          <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
            Academic Marks Verification
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 pr-3">Student ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Course</th>
                <th className="py-2 pr-3 text-right">Score</th>
                <th className="py-2 pr-3">Grade</th>
                <th className="py-2 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gradeRecords.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-mono-tabular text-slate-500">{g.student_code}</td>
                  <td className="py-2.5 pr-3 font-medium">{g.student_name}</td>
                  <td className="py-2.5 pr-3">{g.course_code} · {g.course_title}</td>
                  <td className="py-2.5 pr-3 text-right font-mono-tabular font-semibold">{g.total_score}%</td>
                  <td className="py-2.5 pr-3 font-mono-tabular font-bold">{g.letter_grade}</td>
                  <td className="py-2.5 text-right">
                    {g.verified_by_registrar ? (
                      <span className="text-emerald-600 font-semibold">Verified</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/registrar/grades/${g.id}/verify`, { method: 'POST' });
                          showMsg('ok', 'Grade verified.');
                          loadGrades();
                        }}
                        className="px-2.5 py-1 rounded bg-[#2563EB] text-white"
                      >
                        Verify Record
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'report-cards' && (
        <div className="space-y-6">
          <div className="no-print glass-card rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="rc-student" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Select Student
              </label>
              <select
                id="rc-student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.student_code} — {s.full_name} ({s.stream_name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  const data = await apiRequest<ReportCardPayload>(`/api/registrar/report-card/${selectedStudentId}`);
                  setReportCard(data);
                }}
                className="px-4 py-2 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-xs font-medium"
              >
                Generate Report Card
              </button>
            </div>
            {reportCard && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportCardPdf(reportCard)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            )}
          </div>

          {reportCard && (
            <div className="print-area glass-card rounded-xl p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-[#163B65]">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#163B65] dark:text-white">
                    Lich Gogo Excellence Boarding School
                  </h2>
                  <p className="text-xs text-slate-500">
                    Hosanna, Ethiopia · Official Student Academic Report Card
                  </p>
                </div>
                <div className="text-right text-xs font-mono-tabular">
                  <div>{reportCard.academicYearName}</div>
                  <div className="font-semibold">{reportCard.semesterName}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Student Name: </span>
                  <strong>{reportCard.student.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Student ID: </span>
                  <strong className="font-mono-tabular">{reportCard.student.studentCode}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Grade Level: </span>
                  <strong>{reportCard.student.gradeName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Academic Stream: </span>
                  <strong>{reportCard.student.streamName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Fee Clearance: </span>
                  <strong className={reportCard.cleared ? 'text-emerald-600' : 'text-amber-600'}>
                    {reportCard.cleared ? 'Verified Cleared' : 'Pending Verification'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Attendance: </span>
                  <strong className="font-mono-tabular">{reportCard.attendancePercentage}%</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Subject</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5 text-center">Grade</th>
                      <th className="p-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportCard.subjects.map((s) => (
                      <tr key={s.courseId}>
                        <td className="p-2.5 font-mono-tabular whitespace-nowrap">{s.courseCode}</td>
                        <td className="p-2.5 font-medium">{s.courseTitle}</td>
                        <td className="p-2.5 text-right font-mono-tabular whitespace-nowrap">{s.totalScore.toFixed(1)}%</td>
                        <td className="p-2.5 text-center font-mono-tabular font-bold">{s.letterGrade}</td>
                        <td className="p-2.5 text-right font-mono-tabular">{s.gradePoint.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
                <div>Total Marks: <strong className="font-mono-tabular">{reportCard.totalMarks.toFixed(1)}</strong></div>
                <div>Average: <strong className="font-mono-tabular">{reportCard.averageScore.toFixed(2)}%</strong></div>
                <div>GPA: <strong className="font-mono-tabular">{reportCard.gpa.toFixed(2)}</strong></div>
                <div>Class Rank: <strong className="font-mono-tabular">{reportCard.classRank ? `#${reportCard.classRank} of ${reportCard.totalInClass}` : '-'}</strong></div>
              </div>

              <div className="pt-8 flex flex-col sm:flex-row justify-between gap-6 text-xs text-slate-500">
                <div className="border-t border-slate-300 dark:border-slate-700 pt-2 sm:w-52">
                  Academic Registrar Signature &amp; Seal
                </div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-2 sm:w-52">
                  Principal Approval
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'certificates' && (
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 flex flex-wrap items-center gap-3">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.student_code} — {s.full_name}
                </option>
              ))}
            </select>
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value as CertificateRecord['certificateType'])}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            >
              <option value="Academic Completion">Academic Completion</option>
              <option value="Honor Roll">Honor Roll</option>
              <option value="Stream Graduation">Stream Graduation</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                const res = await apiRequest<{ message: string }>('/api/registrar/certificates', {
                  method: 'POST',
                  body: JSON.stringify({ studentId: selectedStudentId, certificateType: certType }),
                });
                showMsg('ok', res.message);
                loadCertificates();
              }}
              className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium"
            >
              Issue Certificate
            </button>
          </div>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
              Issued Institutional Certificates
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Certificate No</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Stream</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Issued Date</th>
                  <th className="py-2 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {certificates.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[#2563EB]">{c.certificate_number}</td>
                    <td className="py-2.5 pr-3 font-medium">{c.student_name} ({c.student_code})</td>
                    <td className="py-2.5 pr-3">{c.stream_name}</td>
                    <td className="py-2.5 pr-3">{c.certificate_type}</td>
                    <td className="py-2.5 pr-3 font-mono-tabular">{c.issued_at.slice(0, 10)}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCertificatePdf({
                            id: c.id,
                            certificateNumber: c.certificate_number,
                            studentId: c.student_id,
                            studentCode: c.student_code,
                            studentName: c.student_name,
                            gradeName: c.grade_name,
                            streamName: c.stream_name,
                            academicYearName: c.academic_year_name,
                            certificateType: c.certificate_type,
                            issuedByName: c.issued_by_name,
                            issuedAt: c.issued_at,
                            status: c.status,
                          })
                        }
                        className="text-[#2563EB] font-medium hover:underline"
                      >
                        Certificate PDF
                      </button>
                    </td>
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
