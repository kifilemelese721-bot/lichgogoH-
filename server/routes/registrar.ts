import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { logAudit, requireAuth, requireRole, sanitizeText, type AuthenticatedRequest } from '../auth';
import { buildStudentReportCard, getActiveAcademicContext } from '../services/academicService';

const router = Router();
router.use(requireAuth, requireRole('REGISTRAR', 'ADMIN'));

router.get('/students', (req, res) => {
  const search = sanitizeText(req.query.search, 100).toLowerCase();
  const streamCode = sanitizeText(req.query.streamCode, 30);

  let sql = `
    SELECT s.id, s.user_id, s.student_code, u.full_name, u.email, u.phone,
           s.gender, s.date_of_birth, s.dormitory_block, s.guardian_name, s.guardian_phone,
           s.grade_id, g.name as grade_name, s.stream_id, st.code as stream_code, st.name as stream_name,
           s.academic_year_id, ay.name as academic_year_name, s.enrollment_status, s.is_sample_data,
           (SELECT p.status FROM payments p WHERE p.student_id = s.id ORDER BY p.id DESC LIMIT 1) as latest_payment_status
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN grades g ON g.id = s.grade_id
    JOIN academic_streams st ON st.id = s.stream_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (search) {
    sql += ' AND (lower(u.full_name) LIKE ? OR lower(s.student_code) LIKE ? OR lower(u.email) LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (streamCode) {
    sql += ' AND st.code = ?';
    params.push(streamCode);
  }
  sql += ' ORDER BY s.id DESC';

  const students = db.prepare(sql).all(...params);
  res.json({ students });
});

router.post('/students', (req: AuthenticatedRequest, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' && req.body.password.length >= 6 ? req.body.password : 'Student@2026';
  const studentCodeInput = sanitizeText(req.body?.studentCode, 40).toUpperCase();
  const gender = req.body?.gender === 'Female' ? 'Female' : 'Male';
  const dateOfBirth = sanitizeText(req.body?.dateOfBirth, 20) || '2008-03-10';
  const dormitoryBlock = sanitizeText(req.body?.dormitoryBlock, 80) || 'Boys Dormitory — Block A';
  const guardianName = sanitizeText(req.body?.guardianName, 120) || 'Parent / Guardian';
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40) || '+251911000000';
  const gradeId = Number(req.body?.gradeId || 3);
  const streamCode = req.body?.streamCode === 'SOCIAL_SCIENCE' ? 'SOCIAL_SCIENCE' : 'NATURAL_SCIENCE';

  if (!fullName || !email || !email.includes('@')) {
    res.status(400).json({ error: 'Student full name and valid email are required.' });
    return;
  }

  const dupEmail = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
  if (dupEmail) {
    res.status(409).json({ error: 'Email address is already registered.' });
    return;
  }

  if (studentCodeInput) {
    const dupCode = db.prepare('SELECT id FROM students WHERE student_code = ?').get(studentCodeInput);
    if (dupCode) {
      res.status(409).json({ error: `Duplicate Student ID: ${studentCodeInput} already exists.` });
      return;
    }
  }

  const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'STUDENT'").get() as { id: number };
  const streamRow = db.prepare('SELECT id FROM academic_streams WHERE code = ?').get(streamCode) as { id: number };
  const ctx = getActiveAcademicContext();
  const hash = bcrypt.hashSync(password, 8);

  const created = db.transaction(() => {
    const uRes = db
      .prepare("INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)")
      .run(fullName, email, hash, roleRow.id, guardianPhone);
    const uid = Number(uRes.lastInsertRowid);
    const count = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
    const studentCode = studentCodeInput || `LGBS-2026-${String(count + 1).padStart(3, '0')}`;

    const sRes = db
      .prepare(
        `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 0)`,
      )
      .run(uid, studentCode, gender, dateOfBirth, dormitoryBlock, guardianName, guardianPhone, gradeId, streamRow.id, ctx.academicYearId);
    const studentId = Number(sRes.lastInsertRowid);

    // Auto-enroll in core courses for their grade and stream
    const courses = db
      .prepare('SELECT id FROM courses WHERE grade_id = ? AND (stream_id IS NULL OR stream_id = ?)')
      .all(gradeId, streamRow.id) as Array<{ id: number }>;
    const insEnroll = db.prepare('INSERT OR IGNORE INTO student_enrollments (student_id, course_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)');
    for (const c of courses) insEnroll.run(studentId, c.id, ctx.academicYearId, ctx.semesterId);

    logAudit(req.authUser!.userId, 'REGISTRAR_STUDENT_CREATE', 'STUDENT', studentCode, `Registered ${fullName} in ${streamCode}`, req.ip || '');
    return { studentId, studentCode };
  })();

  res.status(201).json({
    ...created,
    message: `Student registered with ID ${created.studentCode}.`,
  });
});

router.patch('/students/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, user_id FROM students WHERE id = ?').get(id) as
    | { id: number; user_id: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const fullName = sanitizeText(req.body?.fullName, 120);
  const gradeId = req.body?.gradeId ? Number(req.body.gradeId) : null;
  const streamCode = req.body?.streamCode;
  const enrollmentStatus = req.body?.enrollmentStatus;
  const dormitoryBlock = sanitizeText(req.body?.dormitoryBlock, 80);

  db.transaction(() => {
    if (fullName) {
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, existing.user_id);
    }
    if (gradeId) {
      db.prepare('UPDATE students SET grade_id = ? WHERE id = ?').run(gradeId, id);
    }
    if (streamCode === 'NATURAL_SCIENCE' || streamCode === 'SOCIAL_SCIENCE') {
      const st = db.prepare('SELECT id FROM academic_streams WHERE code = ?').get(streamCode) as { id: number };
      db.prepare('UPDATE students SET stream_id = ? WHERE id = ?').run(st.id, id);
    }
    if (['enrolled', 'transferred', 'graduated', 'suspended'].includes(enrollmentStatus)) {
      db.prepare('UPDATE students SET enrollment_status = ? WHERE id = ?').run(enrollmentStatus, id);
    }
    if (dormitoryBlock) {
      db.prepare('UPDATE students SET dormitory_block = ? WHERE id = ?').run(dormitoryBlock, id);
    }
    logAudit(req.authUser!.userId, 'REGISTRAR_STUDENT_UPDATE', 'STUDENT', id, `Updated grade/stream/status`, req.ip || '');
  })();

  res.json({ message: 'Student record updated.' });
});

router.get('/grades-overview', (req, res) => {
  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const records = db
    .prepare(
      `SELECT gr.id, gr.student_id, s.student_code, u.full_name as student_name, st.name as stream_name,
              g.name as grade_name, c.code as course_code, c.title as course_title,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN courses c ON c.id = gr.course_id
       WHERE gr.semester_id = ?
       ORDER BY u.full_name, c.code`,
    )
    .all(semesterId);
  res.json({ records, semesterId });
});

router.post('/grades/:id/verify', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE grades_records SET verified_by_registrar = 1 WHERE id = ?').run(id);
  logAudit(req.authUser!.userId, 'GRADE_VERIFY', 'GRADE_RECORD', id, 'Verified official grade record', req.ip || '');
  res.json({ message: 'Academic grade verified.' });
});

router.get('/report-card/:studentId', (req, res) => {
  const studentId = Number(req.params.studentId);
  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const reportCard = buildStudentReportCard(studentId, semesterId, true);
  if (!reportCard) {
    res.status(404).json({ error: 'Student or semester not found.' });
    return;
  }
  res.json(reportCard);
});

router.get('/certificates', (_req, res) => {
  const certificates = db
    .prepare(
      `SELECT cert.id, cert.certificate_number, cert.student_id, s.student_code, u.full_name as student_name,
              g.name as grade_name, st.name as stream_name, ay.name as academic_year_name,
              cert.certificate_type, ib.full_name as issued_by_name, cert.issued_at, cert.status
       FROM certificates cert
       JOIN students s ON s.id = cert.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN academic_years ay ON ay.id = cert.academic_year_id
       JOIN users ib ON ib.id = cert.issued_by_user_id
       ORDER BY cert.id DESC`,
    )
    .all();
  res.json({ certificates });
});

router.post('/certificates', (req: AuthenticatedRequest, res) => {
  const studentId = Number(req.body?.studentId);
  const certificateType = req.body?.certificateType;
  if (!studentId || !['Academic Completion', 'Honor Roll', 'Stream Graduation'].includes(certificateType)) {
    res.status(400).json({ error: 'Student and valid certificate type are required.' });
    return;
  }
  const ctx = getActiveAcademicContext();
  const count = (db.prepare('SELECT COUNT(*) as c FROM certificates').get() as { c: number }).c;
  const certNumber = `CERT-LGBS-2026-${String(count + 1).padStart(3, '0')}`;

  const r = db
    .prepare(
      `INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
       VALUES (?, ?, ?, ?, ?, 'issued')`,
    )
    .run(certNumber, studentId, ctx.academicYearId, certificateType, req.authUser!.userId);

  logAudit(req.authUser!.userId, 'CERTIFICATE_ISSUE', 'CERTIFICATE', certNumber, `Issued ${certificateType} to student #${studentId}`, req.ip || '');
  res.status(201).json({ id: r.lastInsertRowid, certificateNumber: certNumber, message: `Certificate ${certNumber} issued.` });
});

export default router;
