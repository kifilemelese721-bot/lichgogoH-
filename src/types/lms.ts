export type RoleName = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'REGISTRAR' | 'FINANCE';

export type AcademicStreamCode = 'NATURAL_SCIENCE' | 'SOCIAL_SCIENCE';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: RoleName;
  status: 'active' | 'inactive';
  phone?: string;
  avatarUrl?: string;
  isSampleData: boolean;
  createdAt: string;
}

export interface StudentProfile {
  id: number;
  userId: number;
  studentCode: string;
  fullName: string;
  email: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  dormitoryBlock: string;
  guardianName: string;
  guardianPhone: string;
  gradeId: number;
  gradeName: string;
  streamId: number;
  streamCode: AcademicStreamCode;
  streamName: string;
  academicYearId: number;
  academicYearName: string;
  enrollmentStatus: 'enrolled' | 'transferred' | 'graduated' | 'suspended';
  isSampleData: boolean;
}

export interface InstructorProfile {
  id: number;
  userId: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  qualification: string;
  phone?: string;
}

export interface GradingScaleBand {
  id?: number;
  letterGrade: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
  remark: string;
}

export interface StreamWeightConfig {
  streamCode: AcademicStreamCode;
  quizWeight: number;
  assignmentWeight: number;
  midtermWeight: number;
  finalExamWeight: number;
  passingScore: number;
}

export interface CourseCategory {
  id: number;
  name: string;
  description: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string;
  categoryId: number;
  categoryName?: string;
  gradeId: number;
  gradeName?: string;
  streamId: number | null;
  streamName?: string;
  streamCode?: AcademicStreamCode | null;
  creditHours: number;
  instructorId?: number | null;
  instructorName?: string | null;
  enrolledCount?: number;
  isEnrolled?: boolean;
}

export interface CourseMaterial {
  id: number;
  courseId: number;
  courseCode?: string;
  courseTitle?: string;
  title: string;
  materialType: 'pdf' | 'presentation' | 'video' | 'document';
  description: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedByName: string;
  createdAt: string;
}

export interface AssessmentQuestion {
  id: number;
  assessmentId: number;
  questionText: string;
  questionType: 'mcq' | 'short_answer';
  options: string[];
  correctOption?: string;
  maxMarks: number;
}

export interface Assessment {
  id: number;
  courseId: number;
  courseCode?: string;
  courseTitle?: string;
  title: string;
  assessmentType: 'quiz' | 'assignment' | 'midterm' | 'final_exam';
  description: string;
  totalMarks: number;
  durationMinutes: number;
  deadline: string;
  allowLateSubmission: boolean;
  isPublished: boolean;
  submissionStatus?: 'not_started' | 'submitted' | 'graded';
  obtainedMarks?: number | null;
}

export interface AttendanceRecord {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  courseId: number | null;
  courseTitle?: string;
  attendanceType: 'classroom' | 'dormitory';
  attendanceDate: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  recordedByName?: string;
}

export interface PaymentRecord {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  academicYearId: number;
  semesterId: number;
  semesterName: string;
  amountEtb: number;
  paymentMethod: 'Bank Deposit' | 'Telebirr Reference' | 'Cashier Office';
  transactionRef: string;
  status: 'pending' | 'verified' | 'rejected';
  receiptNumber?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  paidAt: string;
  notes?: string;
}

export interface SubjectGradeResult {
  courseId: number;
  courseCode: string;
  courseTitle: string;
  creditHours: number;
  quizScore: number | null;
  assignmentScore: number | null;
  midtermScore: number | null;
  finalExamScore: number | null;
  totalScore: number;
  letterGrade: string;
  gradePoint: number;
  passed: boolean;
  verifiedByRegistrar: boolean;
}

export interface ReportCardPayload {
  cleared: boolean;
  clearanceReason?: string;
  student: StudentProfile;
  academicYearName: string;
  semesterName: string;
  subjects: SubjectGradeResult[];
  totalMarks: number;
  averageScore: number;
  gpa: number;
  classRank: number | null;
  totalInClass: number;
  attendancePercentage: number;
  totalDaysRecorded: number;
  presentDays: number;
  absentDays: number;
  generatedAt: string;
}

export interface CertificateRecord {
  id: number;
  certificateNumber: string;
  studentId: number;
  studentCode: string;
  studentName: string;
  gradeName: string;
  streamName: string;
  academicYearName: string;
  certificateType: 'Academic Completion' | 'Honor Roll' | 'Stream Graduation';
  issuedByName: string;
  issuedAt: string;
  status: 'issued' | 'revoked';
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  targetRole: 'ALL' | RoleName;
  courseId: number | null;
  courseTitle?: string | null;
  authorName: string;
  authorRole: RoleName;
  isPublic: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  category: 'academic' | 'assessment' | 'grade' | 'finance' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface DiscussionTopic {
  id: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  authorUserId: number;
  authorName: string;
  authorRole: RoleName;
  title: string;
  body: string;
  replyCount: number;
  createdAt: string;
}

export interface DiscussionReply {
  id: number;
  discussionId: number;
  authorUserId: number;
  authorName: string;
  authorRole: RoleName;
  body: string;
  createdAt: string;
}

export interface ScheduleItem {
  id: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  instructorName: string;
  gradeName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
}
