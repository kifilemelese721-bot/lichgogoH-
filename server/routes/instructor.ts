import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, UPLOAD_DIR } from '../db';
import { logAudit, requireAuth, requireRole, sanitizeText, type AuthenticatedRequest } from '../auth';
import {
  getActiveAcademicContext,
  getGradingScale,
  getStreamWeightConfig,
} from '../services/academicService';
import {
  computeWeightedSubjectScore,
  resolveLetterGrade,
  validateMark,
} from '../../src/lib/gradingEngine';

const router = Router();
router.use(requireAuth, requireRole('INSTRUCTOR', 'ADMIN'));

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.ppt', '.pptx', '.doc', '.docx', '.mp4']);

function getInstructorIdByUserId(userId: number): number | null {
  const row = db.prepare('SELECT id FROM instructors WHERE user_id = ?').get(userId) as
    | { id: number }
    | undefined;
  return row ? row.id : null;
}

function ensureCourseAccess(req: AuthenticatedRequest, courseId: number): boolean {
  if (req.authUser!.role === 'ADMIN') return true;
  const instId = getInstructorIdByUserId(req.authUser!.userId);
  if (!instId) return false;
  const ctx = getActiveAcademicContext();
  const row = db
    .prepare('SELECT id FROM course_assignments WHERE course_id = ? AND instructor_id = ? AND semester_id = ?')
    .get(courseId, instId, ctx.semesterId);
  return Boolean(row);
}

router.get('/dashboard', (req: AuthenticatedRequest, res) => {
  const ctx = getActiveAcademicContext();
  const instId = getInstructorIdByUserId(req.authUser!.userId);

  const courses = instId
    ? db
        .prepare(
          `SELECT c.id, c.code, c.title, c.description, g.name as grade_name, st.name as stream_name,
                  (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.semester_id = ?) as enrolled_count
           FROM course_assignments ca
           JOIN courses c ON c.id = ca.course_id
           JOIN grades g ON g.id = c.grade_id
           LEFT JOIN academic_streams st ON st.id = c.stream_id
           WHERE ca.instructor_id = ? AND ca.semester_id = ?
           ORDER BY c.code`,
        )
        .all(ctx.semesterId, instId, ctx.semesterId)
    : db
        .prepare(
          `SELECT c.id, c.code, c.title, c.description, g.name as grade_name, st.name as stream_name,
                  (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.semester_id = ?) as enrolled_count
           FROM courses c
           JOIN grades g ON g.id = c.grade_id
           LEFT JOIN academic_streams st ON st.id = c.stream_id`,
        )
        .all(ctx.semesterId);

  const courseIds = (courses as Array<{ id: number }>).map((c) => c.id);
  const placeholders = courseIds.length ? courseIds.map(() => '?').join(',') : '-1';

  const assessments = db
    .prepare(
      `SELECT a.*, c.code as course_code, c.title as course_title,
              (SELECT COUNT(*) FROM student_submissions ss WHERE ss.assessment_id = a.id) as submission_count,
              (SELECT COUNT(*) FROM student_submissions ss WHERE ss.assessment_id = a.id AND ss.status = 'submitted') as pending_grading_count
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.course_id IN (${placeholders}) AND a.semester_id = ?
       ORDER BY a.deadline ASC`,
    )
    .all(...courseIds, ctx.semesterId);

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.course_id, c.title as course_title, a.created_at, u.full_name as author_name
       FROM announcements a
       LEFT JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = a.author_user_id
       WHERE a.target_role IN ('ALL', 'INSTRUCTOR') OR a.author_user_id = ?
       ORDER BY a.created_at DESC LIMIT 10`,
    )
    .all(req.authUser!.userId);

  const courseStats = db
    .prepare(
      `SELECT c.code, c.title, ROUND(AVG(gr.total_score), 2) as avg_score, COUNT(gr.id) as graded_count
       FROM courses c
       LEFT JOIN grades_records gr ON gr.course_id = c.id AND gr.semester_id = ?
       WHERE c.id IN (${placeholders})
       GROUP BY c.id`,
    )
    .all(ctx.semesterId, ...courseIds);

  res.json({ courses, assessments, announcements, courseStats, activeContext: ctx });
});

router.get('/courses/:courseId/students', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.params.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'You are not assigned to this course.' });
    return;
  }
  const ctx = getActiveAcademicContext();
  const students = db
    .prepare(
      `SELECT s.id as student_id, s.student_code, u.full_name, u.email, g.name as grade_name, st.name as stream_name,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM student_enrollments se
       JOIN students s ON s.id = se.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       LEFT JOIN grades_records gr ON gr.student_id = s.id AND gr.course_id = se.course_id AND gr.semester_id = se.semester_id
       WHERE se.course_id = ? AND se.semester_id = ? AND se.status = 'active'
       ORDER BY u.full_name`,
    )
    .all(courseId, ctx.semesterId);

  const materials = db
    .prepare(
      `SELECT cm.id, cm.course_id, cm.title, cm.material_type, cm.description, cm.file_name, cm.file_size_bytes, cm.created_at,
              u.full_name as uploaded_by_name
       FROM course_materials cm
       JOIN users u ON u.id = cm.uploaded_by_user_id
       WHERE cm.course_id = ?
       ORDER BY cm.created_at DESC`,
    )
    .all(courseId);

  res.json({ students, materials });
});

router.post('/courses/:courseId/materials', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.params.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'You are not assigned to this course.' });
    return;
  }

  const title = sanitizeText(req.body?.title, 160);
  const materialType = req.body?.materialType;
  const description = sanitizeText(req.body?.description, 600);
  const rawFileName = sanitizeText(req.body?.fileName, 140) || 'lecture-notes.txt';
  const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : '';

  if (!title || !['pdf', 'presentation', 'video', 'document'].includes(materialType)) {
    res.status(400).json({ error: 'Valid material title and type are required.' });
    return;
  }

  const ext = path.extname(rawFileName).toLowerCase() || '.txt';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    res.status(400).json({ error: `Unsupported file type ${ext}. Allowed: pdf, ppt/pptx, doc/docx, txt, md, mp4.` });
    return;
  }

  const safeBase = path.basename(rawFileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalName = `${safeBase}_${Date.now()}${ext}`;
  const courseDir = path.join(UPLOAD_DIR, `course_${courseId}`);
  if (!fs.existsSync(courseDir)) fs.mkdirSync(courseDir, { recursive: true });
  const storedPath = path.join(courseDir, finalName);

  const buffer = contentBase64
    ? Buffer.from(contentBase64, 'base64')
    : Buffer.from(`Lich Gogo Excellence Boarding School\nCourse Material: ${title}\n\n${description}\n`, 'utf-8');

  if (buffer.byteLength > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'File size exceeds 5MB limit.' });
    return;
  }

  fs.writeFileSync(storedPath, buffer);

  const r = db
    .prepare(
      `INSERT INTO course_materials (course_id, uploaded_by_user_id, title, material_type, description, file_name, stored_path, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(courseId, req.authUser!.userId, title, materialType, description, rawFileName, storedPath, buffer.byteLength);

  logAudit(req.authUser!.userId, 'MATERIAL_UPLOAD', 'COURSE_MATERIAL', Number(r.lastInsertRowid), `${title} (${rawFileName})`, req.ip || '');
  res.status(201).json({ id: r.lastInsertRowid, message: 'Learning material uploaded.' });
});

router.delete('/materials/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const mat = db.prepare('SELECT id, course_id, stored_path FROM course_materials WHERE id = ?').get(id) as
    | { id: number; course_id: number; stored_path: string }
    | undefined;
  if (!mat) {
    res.status(404).json({ error: 'Material not found.' });
    return;
  }
  if (!ensureCourseAccess(req, mat.course_id)) {
    res.status(403).json({ error: 'Not authorized to remove this material.' });
    return;
  }
  db.prepare('DELETE FROM course_materials WHERE id = ?').run(id);
  res.json({ message: 'Learning material deleted.' });
});

// Assessments & Questions
router.post('/assessments', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'You are not assigned to this course.' });
    return;
  }

  const title = sanitizeText(req.body?.title, 180);
  const assessmentType = req.body?.assessmentType;
  const description = sanitizeText(req.body?.description, 800);
  const totalMarks = Number(req.body?.totalMarks || 100);
  const durationMinutes = Number(req.body?.durationMinutes || 30);
  const deadline = sanitizeText(req.body?.deadline, 40);
  const allowLate = req.body?.allowLateSubmission ? 1 : 0;
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];

  if (!title || !['quiz', 'assignment', 'midterm', 'final_exam'].includes(assessmentType) || !deadline) {
    res.status(400).json({ error: 'Title, assessment type, and deadline are required.' });
    return;
  }
  if (totalMarks <= 0 || totalMarks > 100) {
    res.status(400).json({ error: 'Total marks must be between 1 and 100.' });
    return;
  }

  const ctx = getActiveAcademicContext();
  const assessmentId = db.transaction(() => {
    const aRes = db
      .prepare(
        `INSERT INTO assessments (course_id, semester_id, created_by_user_id, title, assessment_type, description, total_marks, duration_minutes, deadline, allow_late_submission, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(courseId, ctx.semesterId, req.authUser!.userId, title, assessmentType, description, totalMarks, durationMinutes, deadline, allowLate);
    const aid = Number(aRes.lastInsertRowid);

    const insQ = db.prepare(
      'INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_option, max_marks) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const q of questions) {
      const qText = sanitizeText(q?.questionText, 600);
      if (!qText) continue;
      const qType = q?.questionType === 'short_answer' ? 'short_answer' : 'mcq';
      const opts = Array.isArray(q?.options) ? q.options.map((o: unknown) => sanitizeText(o, 200)) : [];
      const correct = sanitizeText(q?.correctOption, 200);
      const qMarks = Number(q?.maxMarks || 10);
      insQ.run(aid, qText, qType, JSON.stringify(opts), correct, qMarks);
    }

    // Notify enrolled students
    const enrolled = db
      .prepare(
        `SELECT u.id as user_id FROM student_enrollments se
         JOIN students s ON s.id = se.student_id
         JOIN users u ON u.id = s.user_id
         WHERE se.course_id = ? AND se.semester_id = ? AND se.status = 'active'`,
      )
      .all(courseId, ctx.semesterId) as Array<{ user_id: number }>;

    const insNotif = db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, ?, ?, 'assessment')");
    for (const stu of enrolled) {
      insNotif.run(stu.user_id, `New Assessment: ${title}`, `Deadline: ${deadline.slice(0, 10)} (${durationMinutes} mins)`);
    }

    logAudit(req.authUser!.userId, 'ASSESSMENT_CREATE', 'ASSESSMENT', aid, title, req.ip || '');
    return aid;
  })();

  res.status(201).json({ id: assessmentId, message: 'Assessment created and published to enrolled students.' });
});

router.get('/assessments/:assessmentId/submissions', (req: AuthenticatedRequest, res) => {
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db.prepare('SELECT id, course_id, title, total_marks FROM assessments WHERE id = ?').get(assessmentId) as
    | { id: number; course_id: number; title: string; total_marks: number }
    | undefined;
  if (!assessment) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  if (!ensureCourseAccess(req, assessment.course_id)) {
    res.status(403).json({ error: 'Not authorized.' });
    return;
  }

  const submissions = db
    .prepare(
      `SELECT ss.id as submission_id, ss.student_id, s.student_code, u.full_name as student_name,
              ss.answers_json, ss.submitted_at, ss.is_late, ss.status,
              ar.marks_obtained, ar.feedback
       FROM student_submissions ss
       JOIN students s ON s.id = ss.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN assessment_results ar ON ar.submission_id = ss.id
       WHERE ss.assessment_id = ?
       ORDER BY ss.submitted_at DESC`,
    )
    .all(assessmentId);

  const questions = db.prepare('SELECT * FROM assessment_questions WHERE assessment_id = ?').all(assessmentId);
  res.json({ assessment, submissions, questions });
});

router.post('/submissions/:submissionId/grade', (req: AuthenticatedRequest, res) => {
  const submissionId = Number(req.params.submissionId);
  const marksCheck = validateMark(Number(req.body?.marksObtained));
  if (!marksCheck.valid) {
    res.status(400).json({ error: marksCheck.error });
    return;
  }
  const feedback = sanitizeText(req.body?.feedback, 500);

  const sub = db
    .prepare(
      `SELECT ss.id, ss.assessment_id, ss.student_id, a.course_id
       FROM student_submissions ss
       JOIN assessments a ON a.id = ss.assessment_id
       WHERE ss.id = ?`,
    )
    .get(submissionId) as { id: number; assessment_id: number; student_id: number; course_id: number } | undefined;

  if (!sub) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  if (!ensureCourseAccess(req, sub.course_id)) {
    res.status(403).json({ error: 'Not authorized to grade this course submission.' });
    return;
  }

  db.transaction(() => {
    db.prepare(
      `INSERT INTO assessment_results (submission_id, assessment_id, student_id, marks_obtained, feedback, graded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(submission_id) DO UPDATE SET marks_obtained = excluded.marks_obtained, feedback = excluded.feedback, graded_by_user_id = excluded.graded_by_user_id, graded_at = datetime('now')`,
    ).run(sub.id, sub.assessment_id, sub.student_id, marksCheck.normalized!, feedback, req.authUser!.userId);

    db.prepare("UPDATE student_submissions SET status = 'graded' WHERE id = ?").run(sub.id);
    logAudit(req.authUser!.userId, 'SUBMISSION_GRADE', 'SUBMISSION', sub.id, `Graded ${marksCheck.normalized}`, req.ip || '');
  })();

  res.json({ message: 'Submission graded successfully.' });
});

// Grade Management (0-100 validated + automated weighted grading engine)
router.post('/grades', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  const studentId = Number(req.body?.studentId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'Unauthorized grade modification: you are not assigned to this course.' });
    return;
  }

  const parseOptionalMark = (val: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } => {
    if (val === null || val === undefined || val === '') return { ok: true, value: null };
    const check = validateMark(Number(val));
    if (!check.valid) return { ok: false, error: `${label}: ${check.error}` };
    return { ok: true, value: check.normalized! };
  };

  const q = parseOptionalMark(req.body?.quizScore, 'Quiz');
  const a = parseOptionalMark(req.body?.assignmentScore, 'Assignment');
  const m = parseOptionalMark(req.body?.midtermScore, 'Midterm');
  const f = parseOptionalMark(req.body?.finalExamScore, 'Final Exam');

  for (const r of [q, a, m, f]) {
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
  }

  const student = db.prepare('SELECT id, user_id, stream_id FROM students WHERE id = ?').get(studentId) as
    | { id: number; user_id: number; stream_id: number }
    | undefined;
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const ctx = getActiveAcademicContext();
  const cfg = getStreamWeightConfig(student.stream_id);
  const scale = getGradingScale();

  const totalScore = computeWeightedSubjectScore(
    {
      quizScore: q.ok ? q.value : null,
      assignmentScore: a.ok ? a.value : null,
      midtermScore: m.ok ? m.value : null,
      finalExamScore: f.ok ? f.value : null,
    },
    cfg,
    'full',
  );
  const resolved = resolveLetterGrade(totalScore, scale);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO grades_records (student_id, course_id, semester_id, quiz_score, assignment_score, midterm_score, final_exam_score, total_score, letter_grade, grade_point, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, course_id, semester_id) DO UPDATE SET
         quiz_score = excluded.quiz_score,
         assignment_score = excluded.assignment_score,
         midterm_score = excluded.midterm_score,
         final_exam_score = excluded.final_exam_score,
         total_score = excluded.total_score,
         letter_grade = excluded.letter_grade,
         grade_point = excluded.grade_point,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = datetime('now')`,
    ).run(
      studentId,
      courseId,
      ctx.semesterId,
      q.ok ? q.value : null,
      a.ok ? a.value : null,
      m.ok ? m.value : null,
      f.ok ? f.value : null,
      totalScore,
      resolved.letterGrade,
      resolved.gradePoint,
      req.authUser!.userId,
    );

    db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Course Grade Updated', ?, 'grade')").run(
      student.user_id,
      `Your updated mark (${totalScore}% · ${resolved.letterGrade}) has been recorded.`,
    );

    logAudit(
      req.authUser!.userId,
      'GRADE_UPSERT',
      'GRADE_RECORD',
      `${studentId}:${courseId}`,
      `Total=${totalScore}, Letter=${resolved.letterGrade}`,
      req.ip || '',
    );
  })();

  res.json({
    totalScore,
    letterGrade: resolved.letterGrade,
    gradePoint: resolved.gradePoint,
    message: 'Marks validated and computed via automated grading engine.',
  });
});

// Attendance Management (strict duplicate prevention)
router.get('/attendance', (req: AuthenticatedRequest, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  const date = sanitizeText(req.query.date, 20);

  if (courseId && !ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'Not authorized for this course.' });
    return;
  }

  let query = `
    SELECT att.id, att.student_id, s.student_code, u.full_name as student_name,
           att.course_id, c.title as course_title, att.attendance_type, att.attendance_date,
           att.status, att.remarks, rec.full_name as recorded_by_name
    FROM attendance att
    JOIN students s ON s.id = att.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN courses c ON c.id = att.course_id
    JOIN users rec ON rec.id = att.recorded_by_user_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (courseId) {
    query += ' AND att.course_id = ?';
    params.push(courseId);
  }
  if (date) {
    query += ' AND att.attendance_date = ?';
    params.push(date);
  }
  query += ' ORDER BY att.attendance_date DESC, u.full_name ASC LIMIT 200';

  const records = db.prepare(query).all(...params);
  res.json({ records });
});

router.post('/attendance', (req: AuthenticatedRequest, res) => {
  const courseId = req.body?.courseId ? Number(req.body.courseId) : null;
  const attendanceType = req.body?.attendanceType === 'dormitory' ? 'dormitory' : 'classroom';
  const attendanceDate = sanitizeText(req.body?.attendanceDate, 20);
  const isCorrection = Boolean(req.body?.isCorrection);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

  if (attendanceType === 'classroom' && (!courseId || !ensureCourseAccess(req, courseId))) {
    res.status(403).json({ error: 'Valid assigned course is required for classroom attendance.' });
    return;
  }
  if (!attendanceDate || entries.length === 0) {
    res.status(400).json({ error: 'Attendance date and student entries are required.' });
    return;
  }

  // Check duplicates first when not in explicit correction mode
  if (!isCorrection) {
    for (const entry of entries) {
      const sid = Number(entry.studentId);
      const existing = courseId
        ? db
            .prepare('SELECT id FROM attendance WHERE student_id = ? AND course_id = ? AND attendance_date = ?')
            .get(sid, courseId, attendanceDate)
        : db
            .prepare("SELECT id FROM attendance WHERE student_id = ? AND attendance_type = 'dormitory' AND attendance_date = ?")
            .get(sid, attendanceDate);

      if (existing) {
        res.status(409).json({
          error: `Duplicate attendance detected for ${attendanceDate}. Enable "Authorized Correction Mode" to update existing records.`,
          code: 'DUPLICATE_ATTENDANCE',
        });
        return;
      }
    }
  }

  db.transaction(() => {
    for (const entry of entries) {
      const sid = Number(entry.studentId);
      const status = ['present', 'absent', 'late', 'excused'].includes(entry.status)
        ? entry.status
        : 'present';
      const remarks = sanitizeText(entry.remarks, 200);

      const existing = courseId
        ? (db
            .prepare('SELECT id FROM attendance WHERE student_id = ? AND course_id = ? AND attendance_date = ?')
            .get(sid, courseId, attendanceDate) as { id: number } | undefined)
        : (db
            .prepare("SELECT id FROM attendance WHERE student_id = ? AND attendance_type = 'dormitory' AND attendance_date = ?")
            .get(sid, attendanceDate) as { id: number } | undefined);

      if (existing) {
        db.prepare(
          "UPDATE attendance SET status = ?, remarks = ?, recorded_by_user_id = ?, updated_at = datetime('now') WHERE id = ?",
        ).run(status, remarks, req.authUser!.userId, existing.id);
      } else {
        db.prepare(
          'INSERT INTO attendance (student_id, course_id, attendance_type, attendance_date, status, remarks, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(sid, courseId, attendanceType, attendanceDate, status, remarks, req.authUser!.userId);
      }
    }
    logAudit(
      req.authUser!.userId,
      isCorrection ? 'ATTENDANCE_CORRECTION' : 'ATTENDANCE_RECORD',
      'ATTENDANCE',
      `${courseId ?? 'DORM'}:${attendanceDate}`,
      `Recorded ${entries.length} student statuses`,
      req.ip || '',
    );
  })();

  res.json({ message: `Attendance saved for ${entries.length} students on ${attendanceDate}.` });
});

// Announcements & Discussions
router.post('/announcements', (req: AuthenticatedRequest, res) => {
  const courseId = req.body?.courseId ? Number(req.body.courseId) : null;
  if (courseId && !ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: 'Not authorized for this course.' });
    return;
  }
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2000);
  if (!title || !body) {
    res.status(400).json({ error: 'Title and message are required.' });
    return;
  }

  const r = db
    .prepare("INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, 'STUDENT', ?, ?, 0)")
    .run(title, body, courseId, req.authUser!.userId);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Course announcement posted.' });
});

router.get('/discussions', (req: AuthenticatedRequest, res) => {
  const instId = getInstructorIdByUserId(req.authUser!.userId);
  const ctx = getActiveAcademicContext();
  const topics = instId
    ? db
        .prepare(
          `SELECT d.id, d.course_id, c.code as course_code, c.title as course_title,
                  d.author_user_id, u.full_name as author_name, r.name as author_role,
                  d.title, d.body, d.created_at,
                  (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.discussion_id = d.id) as reply_count
           FROM discussions d
           JOIN courses c ON c.id = d.course_id
           JOIN course_assignments ca ON ca.course_id = c.id AND ca.instructor_id = ? AND ca.semester_id = ?
           JOIN users u ON u.id = d.author_user_id
           JOIN roles r ON r.id = u.role_id
           ORDER BY d.created_at DESC`,
        )
        .all(instId, ctx.semesterId)
    : db
        .prepare(
          `SELECT d.id, d.course_id, c.code as course_code, c.title as course_title,
                  d.author_user_id, u.full_name as author_name, r.name as author_role,
                  d.title, d.body, d.created_at,
                  (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.discussion_id = d.id) as reply_count
           FROM discussions d
           JOIN courses c ON c.id = d.course_id
           JOIN users u ON u.id = d.author_user_id
           JOIN roles r ON r.id = u.role_id
           ORDER BY d.created_at DESC`,
        )
        .all();
  res.json({ topics });
});

router.delete('/discussions/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM discussions WHERE id = ?').run(id);
  logAudit(req.authUser!.userId, 'DISCUSSION_MODERATE_DELETE', 'DISCUSSION', id, 'Removed post', req.ip || '');
  res.json({ message: 'Discussion thread removed.' });
});

router.delete('/discussion-replies/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM discussion_replies WHERE id = ?').run(id);
  logAudit(req.authUser!.userId, 'REPLY_MODERATE_DELETE', 'DISCUSSION_REPLY', id, 'Removed reply', req.ip || '');
  res.json({ message: 'Discussion reply removed.' });
});

export default router;
