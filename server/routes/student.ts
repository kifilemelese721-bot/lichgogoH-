import { Router } from 'express';
import { db } from '../db';
import { logAudit, requireAuth, requireRole, sanitizeText, type AuthenticatedRequest } from '../auth';
import {
  buildStudentReportCard,
  getActiveAcademicContext,
  getStudentProfileByUserId,
} from '../services/academicService';
import {
  calculateAttendanceSummary,
  canSubmitAssessment,
  hasFinancialClearance,
} from '../../src/lib/gradingEngine';
import type { PaymentRecord } from '../../src/types/lms';

const router = Router();
router.use(requireAuth, requireRole('STUDENT'));

router.get('/dashboard', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }
  const ctx = getActiveAcademicContext();

  const enrolledCourses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.description, c.credit_hours, cat.name as category_name,
              g.name as grade_name, st.name as stream_name, u.full_name as instructor_name
       FROM student_enrollments se
       JOIN courses c ON c.id = se.course_id
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = se.semester_id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       ORDER BY c.code`,
    )
    .all(student.id, ctx.semesterId);

  const availableCourses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.description, c.credit_hours, cat.name as category_name,
              g.name as grade_name, st.name as stream_name, u.full_name as instructor_name,
              EXISTS(SELECT 1 FROM student_enrollments se WHERE se.student_id = ? AND se.course_id = c.id AND se.semester_id = ? AND se.status = 'active') as is_enrolled
       FROM courses c
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = ?
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE (c.stream_id IS NULL OR c.stream_id = ?)
       ORDER BY g.level_order, c.code`,
    )
    .all(student.id, ctx.semesterId, ctx.semesterId, student.streamId);

  const materials = db
    .prepare(
      `SELECT cm.id, cm.course_id, c.code as course_code, c.title as course_title,
              cm.title, cm.material_type, cm.description, cm.file_name, cm.file_size_bytes, cm.created_at,
              u.full_name as uploaded_by_name
       FROM course_materials cm
       JOIN courses c ON c.id = cm.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       JOIN users u ON u.id = cm.uploaded_by_user_id
       ORDER BY cm.created_at DESC`,
    )
    .all(student.id, ctx.semesterId);

  const assessments = db
    .prepare(
      `SELECT a.id, a.course_id, c.code as course_code, c.title as course_title,
              a.title, a.assessment_type, a.description, a.total_marks, a.duration_minutes,
              a.deadline, a.allow_late_submission, a.is_published,
              ss.status as submission_status, ar.marks_obtained as obtained_marks
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       LEFT JOIN student_submissions ss ON ss.assessment_id = a.id AND ss.student_id = ?
       LEFT JOIN assessment_results ar ON ar.submission_id = ss.id
       WHERE a.semester_id = ? AND a.is_published = 1
       ORDER BY a.deadline ASC`,
    )
    .all(student.id, ctx.semesterId, student.id, ctx.semesterId);

  const schedule = db
    .prepare(
      `SELECT s.id, s.course_id, c.code as course_code, c.title as course_title,
              COALESCE(u.full_name, 'TBA') as instructor_name, g.name as grade_name,
              s.day_of_week, s.start_time, s.end_time, s.room
       FROM schedules s
       JOIN courses c ON c.id = s.course_id
       JOIN grades g ON g.id = c.grade_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = s.semester_id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE s.semester_id = ?
       ORDER BY s.day_of_week, s.start_time`,
    )
    .all(student.id, ctx.semesterId, ctx.semesterId);

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.course_id, c.title as course_title, a.created_at, u.full_name as author_name
       FROM announcements a
       LEFT JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = a.author_user_id
       WHERE a.target_role IN ('ALL', 'STUDENT')
         AND (a.course_id IS NULL OR a.course_id IN (
           SELECT course_id FROM student_enrollments WHERE student_id = ? AND semester_id = ?
         ))
       ORDER BY a.created_at DESC LIMIT 12`,
    )
    .all(student.id, ctx.semesterId);

  const attendanceRows = db
    .prepare(
      `SELECT att.id, att.course_id, COALESCE(c.title, 'Dormitory Roll Call') as course_title,
              att.attendance_type, att.attendance_date, att.status, att.remarks
       FROM attendance att
       LEFT JOIN courses c ON c.id = att.course_id
       WHERE att.student_id = ?
       ORDER BY att.attendance_date DESC`,
    )
    .all(student.id) as Array<{
    id: number;
    course_id: number | null;
    course_title: string;
    attendance_type: 'classroom' | 'dormitory';
    attendance_date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remarks: string;
  }>;

  const attendanceSummary = calculateAttendanceSummary(attendanceRows);

  const payments = db
    .prepare(
      `SELECT p.id, p.student_id, p.academic_year_id, p.semester_id, sem.name as semester_name,
              p.amount_etb, p.payment_method, p.transaction_ref, p.status, p.paid_at, p.verified_at, p.notes,
              pr.receipt_number, v.full_name as verified_by_name
       FROM payments p
       JOIN semesters sem ON sem.id = p.semester_id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       LEFT JOIN users v ON v.id = p.verified_by_user_id
       WHERE p.student_id = ?
       ORDER BY p.paid_at DESC`,
    )
    .all(student.id) as Array<PaymentRecord & { semester_id: number }>;

  const clearance = hasFinancialClearance(
    payments.map((p) => ({ semesterId: p.semester_id, status: p.status })),
    ctx.semesterId,
  );

  res.json({
    student,
    activeContext: ctx,
    enrolledCourses,
    availableCourses,
    materials,
    assessments,
    schedule,
    announcements,
    attendanceRows,
    attendanceSummary,
    payments,
    clearance,
  });
});

router.patch('/profile', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  const phone = sanitizeText(req.body?.phone, 40);
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40);
  db.transaction(() => {
    if (phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.authUser!.userId);
    if (guardianPhone) {
      db.prepare('UPDATE students SET guardian_phone = ? WHERE id = ?').run(guardianPhone, student.id);
    }
  })();
  res.json({ message: 'Permitted profile contact details updated.' });
});

router.post('/enroll', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  const courseId = Number(req.body?.courseId);
  const course = db.prepare('SELECT id, stream_id FROM courses WHERE id = ?').get(courseId) as
    | { id: number; stream_id: number | null }
    | undefined;
  if (!course) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }
  if (course.stream_id !== null && course.stream_id !== student.streamId) {
    res.status(403).json({ error: 'You cannot enroll in courses outside your assigned academic stream.' });
    return;
  }

  const ctx = getActiveAcademicContext();
  db.prepare(
    `INSERT INTO student_enrollments (student_id, course_id, academic_year_id, semester_id, status)
     VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(student_id, course_id, semester_id) DO UPDATE SET status = 'active'`,
  ).run(student.id, courseId, ctx.academicYearId, ctx.semesterId);

  logAudit(req.authUser!.userId, 'STUDENT_COURSE_ENROLL', 'COURSE', courseId, `Student ${student.studentCode} enrolled`, req.ip || '');
  res.json({ message: 'Enrolled in course successfully.' });
});

router.get('/assessments/:assessmentId', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db
    .prepare(
      `SELECT a.*, c.code as course_code, c.title as course_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.status = 'active'
       WHERE a.id = ? AND a.is_published = 1`,
    )
    .get(student.id, assessmentId) as
    | {
        id: number;
        course_id: number;
        title: string;
        assessment_type: string;
        description: string;
        total_marks: number;
        duration_minutes: number;
        deadline: string;
        allow_late_submission: number;
        course_code: string;
        course_title: string;
      }
    | undefined;

  if (!assessment) {
    res.status(404).json({ error: 'Assessment not found or you are not enrolled in this course.' });
    return;
  }

  const questions = db
    .prepare('SELECT id, question_text, question_type, options_json, max_marks FROM assessment_questions WHERE assessment_id = ?')
    .all(assessmentId) as Array<{
    id: number;
    question_text: string;
    question_type: 'mcq' | 'short_answer';
    options_json: string;
    max_marks: number;
  }>;

  const submission = db
    .prepare('SELECT id, submitted_at, status FROM student_submissions WHERE assessment_id = ? AND student_id = ?')
    .get(assessmentId, student.id);

  res.json({
    assessment,
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: JSON.parse(q.options_json || '[]'),
      maxMarks: q.max_marks,
    })),
    submission,
    deadlineStatus: canSubmitAssessment(assessment.deadline, Boolean(assessment.allow_late_submission)),
  });
});

router.post('/assessments/:assessmentId/submit', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db
    .prepare(
      `SELECT a.*
       FROM assessments a
       JOIN student_enrollments se ON se.course_id = a.course_id AND se.student_id = ? AND se.status = 'active'
       WHERE a.id = ? AND a.is_published = 1`,
    )
    .get(student.id, assessmentId) as
    | { id: number; course_id: number; deadline: string; allow_late_submission: number; total_marks: number }
    | undefined;

  if (!assessment) {
    res.status(404).json({ error: 'Assessment not accessible.' });
    return;
  }

  const existingSub = db
    .prepare('SELECT id FROM student_submissions WHERE assessment_id = ? AND student_id = ?')
    .get(assessmentId, student.id);
  if (existingSub) {
    res.status(409).json({ error: 'You have already submitted this assessment.' });
    return;
  }

  const deadlineCheck = canSubmitAssessment(
    assessment.deadline,
    Boolean(assessment.allow_late_submission),
    new Date(),
  );
  if (!deadlineCheck.allowed) {
    res.status(403).json({ error: deadlineCheck.reason, code: 'DEADLINE_PASSED' });
    return;
  }

  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const questions = db
    .prepare('SELECT id, question_type, correct_option, max_marks FROM assessment_questions WHERE assessment_id = ?')
    .all(assessmentId) as Array<{
    id: number;
    question_type: string;
    correct_option: string;
    max_marks: number;
  }>;

  const allMcq = questions.length > 0 && questions.every((q) => q.question_type === 'mcq');
  let autoScore = 0;
  for (const q of questions) {
    if (q.question_type === 'mcq') {
      const given = sanitizeText(answers[String(q.id)], 200);
      if (given && given === q.correct_option) {
        autoScore += q.max_marks;
      }
    }
  }

  const result = db.transaction(() => {
    const subRes = db
      .prepare('INSERT INTO student_submissions (assessment_id, student_id, answers_json, is_late, status) VALUES (?, ?, ?, ?, ?)')
      .run(
        assessmentId,
        student.id,
        JSON.stringify(answers),
        deadlineCheck.isLate ? 1 : 0,
        allMcq ? 'graded' : 'submitted',
      );
    const submissionId = Number(subRes.lastInsertRowid);

    if (allMcq) {
      db.prepare(
        `INSERT INTO assessment_results (submission_id, assessment_id, student_id, marks_obtained, feedback, graded_by_user_id)
         VALUES (?, ?, ?, ?, 'Auto-graded objective assessment', ?)`,
      ).run(submissionId, assessmentId, student.id, Math.min(100, autoScore), req.authUser!.userId);
    }

    logAudit(req.authUser!.userId, 'ASSESSMENT_SUBMIT', 'ASSESSMENT', assessmentId, `Student ${student.studentCode} submitted`, req.ip || '');
    return { submissionId, autoGraded: allMcq, score: allMcq ? Math.min(100, autoScore) : null };
  })();

  res.status(201).json({
    ...result,
    message: result.autoGraded
      ? `Assessment submitted and auto-graded: ${result.score} / ${assessment.total_marks}.`
      : 'Assessment submitted successfully. Pending instructor grading.',
  });
});

// Academic Results & Report Card — Strictly Enforces Financial Fee Clearance Rule!
router.get('/results', (req: AuthenticatedRequest, res) => {
  const student = getStudentProfileByUserId(req.authUser!.userId);
  if (!student) {
    res.status(404).json({ error: 'Student profile not found.' });
    return;
  }

  // Prevent IDOR: reject any query attempting to request another student's ID
  if (req.query.studentId && Number(req.query.studentId) !== student.id) {
    logAudit(req.authUser!.userId, 'IDOR_BLOCKED', 'RESULTS', String(req.query.studentId), 'Student attempted to access peer academic records', req.ip || '');
    res.status(403).json({ error: 'Security violation: you may only access your own academic records.' });
    return;
  }

  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const reportCard = buildStudentReportCard(student.id, semesterId, false);
  if (!reportCard) {
    res.status(404).json({ error: 'Academic term not found.' });
    return;
  }

  if (!reportCard.cleared) {
    res.status(403).json({
      error: reportCard.clearanceReason,
      code: 'FEE_CLEARANCE_REQUIRED',
      cleared: false,
      clearanceReason: reportCard.clearanceReason,
      student: reportCard.student,
      semesterName: reportCard.semesterName,
      academicYearName: reportCard.academicYearName,
      attendancePercentage: reportCard.attendancePercentage,
    });
    return;
  }

  res.json(reportCard);
});

export default router;
