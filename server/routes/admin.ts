import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { logAudit, requireAuth, requireRole, sanitizeText, type AuthenticatedRequest } from '../auth';
import { getActiveAcademicContext, recalculateAllGradesForSemester } from '../services/academicService';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', (_req, res) => {
  const ctx = getActiveAcademicContext();
  const totalStudents = (db.prepare("SELECT COUNT(*) as c FROM students WHERE enrollment_status = 'enrolled'").get() as { c: number }).c;
  const totalInstructors = (db.prepare('SELECT COUNT(*) as c FROM instructors').get() as { c: number }).c;
  const totalCourses = (db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number }).c;
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeCourses = (db.prepare('SELECT COUNT(DISTINCT course_id) as c FROM course_assignments WHERE semester_id = ?').get(ctx.semesterId) as { c: number }).c;
  const pendingPayments = (db.prepare("SELECT COUNT(*) as c FROM payments WHERE status = 'pending'").get() as { c: number }).c;

  const streamPerformance = db
    .prepare(
      `SELECT st.name as stream_name, ROUND(AVG(gr.total_score), 2) as avg_score, COUNT(DISTINCT gr.student_id) as student_count
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       JOIN academic_streams st ON st.id = s.stream_id
       WHERE gr.semester_id = ?
       GROUP BY st.id`,
    )
    .all(ctx.semesterId);

  const gradeDistribution = db
    .prepare(
      `SELECT g.name as grade_name, COUNT(s.id) as student_count
       FROM grades g
       LEFT JOIN students s ON s.grade_id = g.id AND s.enrollment_status = 'enrolled'
       GROUP BY g.id
       ORDER BY g.level_order`,
    )
    .all();

  const recentActivities = db
    .prepare(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
              COALESCE(u.full_name, 'System') as actor_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.id DESC LIMIT 12`,
    )
    .all();

  res.json({
    kpis: {
      totalStudents,
      totalInstructors,
      totalCourses,
      totalUsers,
      activeCourses,
      pendingPayments,
    },
    streamPerformance,
    gradeDistribution,
    recentActivities,
  });
});

// Users CRUD
router.get('/users', (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, r.name as role, u.phone, u.status, u.is_sample_data, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.id DESC`,
    )
    .all();
  res.json({ users });
});

router.post('/users', (req: AuthenticatedRequest, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const roleName = sanitizeText(req.body?.role, 32).toUpperCase();
  const phone = sanitizeText(req.body?.phone, 40);

  if (!fullName || !email || !email.includes('@') || password.length < 6 || !roleName) {
    res.status(400).json({ error: 'Valid name, email, role, and 6+ character password are required.' });
    return;
  }

  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as { id: number } | undefined;
  if (!role) {
    res.status(400).json({ error: 'Invalid role specified.' });
    return;
  }

  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
  if (exists) {
    res.status(409).json({ error: 'Email is already registered.' });
    return;
  }

  const hash = bcrypt.hashSync(password, 8);
  const ctx = getActiveAcademicContext();

  const createdId = db.transaction(() => {
    const uRes = db
      .prepare("INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)")
      .run(fullName, email, hash, role.id, phone);
    const uid = Number(uRes.lastInsertRowid);

    if (roleName === 'INSTRUCTOR') {
      const dept = sanitizeText(req.body?.department, 120) || 'General Academics';
      const qual = sanitizeText(req.body?.qualification, 120) || 'B.Sc / B.Ed';
      db.prepare('INSERT INTO instructors (user_id, employee_code, department, qualification, is_sample_data) VALUES (?, ?, ?, ?, 0)').run(
        uid,
        `INST-2026-${String(uid).padStart(3, '0')}`,
        dept,
        qual,
      );
    } else if (roleName === 'STUDENT') {
      const gradeId = Number(req.body?.gradeId || 3);
      const streamCode = req.body?.streamCode === 'SOCIAL_SCIENCE' ? 'SOCIAL_SCIENCE' : 'NATURAL_SCIENCE';
      const stream = db.prepare('SELECT id FROM academic_streams WHERE code = ?').get(streamCode) as { id: number };
      db.prepare(
        `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, 'Male', '2008-05-01', 'Block A', 'Guardian', ?, ?, ?, ?, 'enrolled', 0)`,
      ).run(uid, `LGBS-2026-${String(uid).padStart(3, '0')}`, phone, gradeId, stream.id, ctx.academicYearId);
    }

    logAudit(req.authUser!.userId, 'USER_CREATE', 'USER', uid, `Created user ${email} (${roleName})`, req.ip || '');
    return uid;
  })();

  res.status(201).json({ id: createdId, message: 'User account created successfully.' });
});

router.patch('/users/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const fullName = sanitizeText(req.body?.fullName, 120);
  const phone = sanitizeText(req.body?.phone, 40);
  const status = req.body?.status === 'inactive' ? 'inactive' : 'active';
  const roleName = sanitizeText(req.body?.role, 32).toUpperCase();

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (roleName) {
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as { id: number } | undefined;
    if (!role) {
      res.status(400).json({ error: 'Invalid role.' });
      return;
    }
    db.prepare('UPDATE users SET full_name = COALESCE(NULLIF(?, \'\'), full_name), phone = ?, status = ?, role_id = ? WHERE id = ?').run(
      fullName,
      phone,
      status,
      role.id,
      id,
    );
  } else {
    db.prepare('UPDATE users SET full_name = COALESCE(NULLIF(?, \'\'), full_name), phone = ?, status = ? WHERE id = ?').run(
      fullName,
      phone,
      status,
      id,
    );
  }

  if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
    const hash = bcrypt.hashSync(req.body.newPassword, 8);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  logAudit(req.authUser!.userId, 'USER_UPDATE', 'USER', id, `Updated user status=${status}`, req.ip || '');
  res.json({ message: 'User account updated.' });
});

router.delete('/users/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.authUser!.userId) {
    res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(req.authUser!.userId, 'USER_DELETE', 'USER', id, 'Deleted user account', req.ip || '');
  res.json({ message: 'User account deleted.' });
});

// Roles & Permissions
router.get('/roles-permissions', (_req, res) => {
  const roles = db.prepare('SELECT id, name, description FROM roles ORDER BY id').all() as Array<{
    id: number;
    name: string;
    description: string;
  }>;
  const permissions = db.prepare('SELECT id, code, module, description FROM permissions ORDER BY module, id').all();
  const mappings = db.prepare('SELECT role_id, permission_id FROM role_permissions').all();
  res.json({ roles, permissions, mappings });
});

router.put('/roles-permissions/:roleId', (req: AuthenticatedRequest, res) => {
  const roleId = Number(req.params.roleId);
  const permissionIds: number[] = Array.isArray(req.body?.permissionIds)
    ? req.body.permissionIds.map(Number).filter(Number.isFinite)
    : [];

  db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
    const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const pid of permissionIds) ins.run(roleId, pid);
    logAudit(req.authUser!.userId, 'ROLE_PERMISSIONS_UPDATE', 'ROLE', roleId, `Assigned ${permissionIds.length} permissions`, req.ip || '');
  })();

  res.json({ message: 'Role permissions updated.' });
});

// Course Categories
router.get('/categories', (_req, res) => {
  const categories = db.prepare('SELECT id, name, description FROM course_categories ORDER BY name').all();
  res.json({ categories });
});

router.post('/categories', (req: AuthenticatedRequest, res) => {
  const name = sanitizeText(req.body?.name, 100);
  const description = sanitizeText(req.body?.description, 300);
  if (!name) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  try {
    const r = db.prepare('INSERT INTO course_categories (name, description) VALUES (?, ?)').run(name, description);
    logAudit(req.authUser!.userId, 'CATEGORY_CREATE', 'COURSE_CATEGORY', Number(r.lastInsertRowid), name, req.ip || '');
    res.status(201).json({ id: r.lastInsertRowid, message: 'Course category added.' });
  } catch {
    res.status(409).json({ error: 'Category already exists.' });
  }
});

router.delete('/categories/:id', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const inUse = (db.prepare('SELECT COUNT(*) as c FROM courses WHERE category_id = ?').get(id) as { c: number }).c;
  if (inUse > 0) {
    res.status(409).json({ error: 'Cannot delete a category currently assigned to courses.' });
    return;
  }
  db.prepare('DELETE FROM course_categories WHERE id = ?').run(id);
  res.json({ message: 'Category removed.' });
});

// Courses, Assignments & Schedules
router.get('/courses', (_req, res) => {
  const ctx = getActiveAcademicContext();
  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.description, c.category_id, cat.name as category_name,
              c.grade_id, g.name as grade_name, c.stream_id, st.name as stream_name, c.credit_hours,
              ca.instructor_id, u.full_name as instructor_name,
              (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.semester_id = ?) as enrolled_count
       FROM courses c
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = ?
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       ORDER BY g.level_order, c.code`,
    )
    .all(ctx.semesterId, ctx.semesterId);

  const instructors = db
    .prepare(
      `SELECT i.id, i.employee_code, u.full_name, i.department
       FROM instructors i JOIN users u ON u.id = i.user_id
       WHERE u.status = 'active'
       ORDER BY u.full_name`,
    )
    .all();

  const schedules = db
    .prepare(
      `SELECT s.id, s.course_id, c.code as course_code, c.title as course_title,
              g.name as grade_name, s.day_of_week, s.start_time, s.end_time, s.room
       FROM schedules s
       JOIN courses c ON c.id = s.course_id
       JOIN grades g ON g.id = c.grade_id
       WHERE s.semester_id = ?
       ORDER BY s.day_of_week, s.start_time`,
    )
    .all(ctx.semesterId);

  res.json({ courses, instructors, schedules });
});

router.post('/courses', (req: AuthenticatedRequest, res) => {
  const code = sanitizeText(req.body?.code, 24).toUpperCase();
  const title = sanitizeText(req.body?.title, 150);
  const description = sanitizeText(req.body?.description, 1000);
  const categoryId = Number(req.body?.categoryId);
  const gradeId = Number(req.body?.gradeId);
  const streamId = req.body?.streamId ? Number(req.body.streamId) : null;
  const creditHours = Number(req.body?.creditHours || 4);
  const instructorId = req.body?.instructorId ? Number(req.body.instructorId) : null;

  if (!code || !title || !categoryId || !gradeId) {
    res.status(400).json({ error: 'Course code, title, category, and grade level are required.' });
    return;
  }

  const ctx = getActiveAcademicContext();
  try {
    const courseId = db.transaction(() => {
      const cRes = db
        .prepare(
          'INSERT INTO courses (code, title, description, category_id, grade_id, stream_id, credit_hours, is_sample_data) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        )
        .run(code, title, description, categoryId, gradeId, streamId, creditHours);
      const cid = Number(cRes.lastInsertRowid);
      if (instructorId) {
        db.prepare('INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)').run(
          cid,
          instructorId,
          ctx.academicYearId,
          ctx.semesterId,
        );
      }
      logAudit(req.authUser!.userId, 'COURSE_CREATE', 'COURSE', code, title, req.ip || '');
      return cid;
    })();
    res.status(201).json({ id: courseId, message: 'Academic course created.' });
  } catch {
    res.status(409).json({ error: `Course code ${code} already exists.` });
  }
});

router.post('/courses/:id/assign-instructor', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.params.id);
  const instructorId = Number(req.body?.instructorId);
  const ctx = getActiveAcademicContext();
  db.prepare(
    `INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(course_id, academic_year_id, semester_id) DO UPDATE SET instructor_id = excluded.instructor_id`,
  ).run(courseId, instructorId, ctx.academicYearId, ctx.semesterId);
  logAudit(req.authUser!.userId, 'INSTRUCTOR_ASSIGN', 'COURSE', courseId, `Assigned instructor #${instructorId}`, req.ip || '');
  res.json({ message: 'Instructor assigned to course.' });
});

router.post('/schedules', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  const dayOfWeek = sanitizeText(req.body?.dayOfWeek, 20);
  const startTime = sanitizeText(req.body?.startTime, 10);
  const endTime = sanitizeText(req.body?.endTime, 10);
  const room = sanitizeText(req.body?.room, 80);
  const ctx = getActiveAcademicContext();

  if (!courseId || !dayOfWeek || !startTime || !endTime || !room) {
    res.status(400).json({ error: 'All class schedule fields are required.' });
    return;
  }
  const r = db
    .prepare('INSERT INTO schedules (course_id, semester_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)')
    .run(courseId, ctx.semesterId, dayOfWeek, startTime, endTime, room);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Class schedule added.' });
});

router.delete('/schedules/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Schedule entry deleted.' });
});

// Grading Scales, Stream Weights & System Settings
router.get('/system-config', (_req, res) => {
  const settings = db.prepare('SELECT key, value FROM school_settings').all();
  const gradingScales = db.prepare('SELECT id, letter_grade, min_score, max_score, grade_point, remark FROM grading_scales ORDER BY min_score DESC').all();
  const streamConfigs = db
    .prepare(
      `SELECT c.id, c.stream_id, s.code as stream_code, s.name as stream_name,
              c.quiz_weight, c.assignment_weight, c.midterm_weight, c.final_exam_weight, c.passing_score
       FROM stream_grading_configs c
       JOIN academic_streams s ON s.id = c.stream_id`,
    )
    .all();
  const academicYears = db.prepare('SELECT * FROM academic_years ORDER BY id DESC').all();
  const semesters = db.prepare('SELECT * FROM semesters ORDER BY id DESC').all();
  res.json({ settings, gradingScales, streamConfigs, academicYears, semesters });
});

router.put('/system-config/stream-weights/:streamId', (req: AuthenticatedRequest, res) => {
  const streamId = Number(req.params.streamId);
  const quizWeight = Number(req.body?.quizWeight);
  const assignmentWeight = Number(req.body?.assignmentWeight);
  const midtermWeight = Number(req.body?.midtermWeight);
  const finalExamWeight = Number(req.body?.finalExamWeight);
  const passingScore = Number(req.body?.passingScore);

  const total = quizWeight + assignmentWeight + midtermWeight + finalExamWeight;
  if (Math.abs(total - 100) > 0.01) {
    res.status(400).json({ error: `Assessment weights must total 100% (currently ${total}%).` });
    return;
  }

  db.prepare(
    `UPDATE stream_grading_configs
     SET quiz_weight = ?, assignment_weight = ?, midterm_weight = ?, final_exam_weight = ?, passing_score = ?
     WHERE stream_id = ?`,
  ).run(quizWeight, assignmentWeight, midtermWeight, finalExamWeight, passingScore, streamId);

  const ctx = getActiveAcademicContext();
  recalculateAllGradesForSemester(ctx.semesterId);
  logAudit(req.authUser!.userId, 'STREAM_GRADING_CONFIG_UPDATE', 'STREAM', streamId, `Updated weights (${quizWeight}/${assignmentWeight}/${midtermWeight}/${finalExamWeight}), pass=${passingScore}`, req.ip || '');
  res.json({ message: 'Stream grading weights updated and semester grades recalculated.' });
});

router.put('/system-config/settings', (req: AuthenticatedRequest, res) => {
  const updates = req.body?.settings;
  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Invalid settings payload.' });
    return;
  }
  const stmt = db.prepare('INSERT INTO school_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(updates)) {
    stmt.run(sanitizeText(k, 80), sanitizeText(String(v), 500));
  }
  logAudit(req.authUser!.userId, 'SETTINGS_UPDATE', 'SYSTEM', 'school_settings', 'Updated institutional settings', req.ip || '');
  res.json({ message: 'School settings saved.' });
});

router.post('/semesters/:id/activate', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  db.transaction(() => {
    db.prepare('UPDATE semesters SET is_active = 0').run();
    db.prepare('UPDATE semesters SET is_active = 1 WHERE id = ?').run(id);
  })();
  logAudit(req.authUser!.userId, 'SEMESTER_ACTIVATE', 'SEMESTER', id, 'Activated semester', req.ip || '');
  res.json({ message: 'Active semester switched.' });
});

// Audit Logs, Backup & Reports
router.get('/audit-logs', (_req, res) => {
  const logs = db
    .prepare(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at,
              COALESCE(u.full_name, 'Anonymous') as actor_name, COALESCE(r.name, '-') as actor_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY al.id DESC LIMIT 100`,
    )
    .all();
  res.json({ logs });
});

router.get('/backup', (req: AuthenticatedRequest, res) => {
  const tables = [
    'users', 'students', 'instructors', 'courses', 'course_categories',
    'student_enrollments', 'assessments', 'grades_records', 'attendance',
    'payments', 'payment_receipts', 'certificates', 'announcements',
  ];
  const snapshot: Record<string, unknown[]> = {};
  for (const t of tables) {
    snapshot[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  logAudit(req.authUser!.userId, 'SYSTEM_BACKUP_EXPORT', 'SYSTEM', 'full_json', 'Exported database backup snapshot', req.ip || '');
  res.json({
    exportedAt: new Date().toISOString(),
    institution: 'Lich Gogo Excellence Boarding School — Hosanna',
    snapshot,
  });
});

router.get('/reports', (_req, res) => {
  const ctx = getActiveAcademicContext();
  const enrollmentReport = db
    .prepare(
      `SELECT g.name as grade_name, st.name as stream_name, COUNT(s.id) as total_students
       FROM students s
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       WHERE s.enrollment_status = 'enrolled'
       GROUP BY g.id, st.id
       ORDER BY g.level_order`,
    )
    .all();

  const instructorReport = db
    .prepare(
      `SELECT u.full_name, i.employee_code, i.department, COUNT(DISTINCT ca.course_id) as assigned_courses
       FROM instructors i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN course_assignments ca ON ca.instructor_id = i.id AND ca.semester_id = ?
       GROUP BY i.id`,
    )
    .all(ctx.semesterId);

  const coursePerformanceReport = db
    .prepare(
      `SELECT c.code, c.title, COUNT(gr.id) as graded_students,
              ROUND(AVG(gr.total_score), 2) as average_score,
              ROUND(MIN(gr.total_score), 2) as min_score,
              ROUND(MAX(gr.total_score), 2) as max_score
       FROM courses c
       LEFT JOIN grades_records gr ON gr.course_id = c.id AND gr.semester_id = ?
       GROUP BY c.id
       ORDER BY c.code`,
    )
    .all(ctx.semesterId);

  const attendanceReport = db
    .prepare(
      `SELECT attendance_type, status, COUNT(*) as total_count
       FROM attendance
       GROUP BY attendance_type, status`,
    )
    .all();

  res.json({
    context: ctx,
    enrollmentReport,
    instructorReport,
    coursePerformanceReport,
    attendanceReport,
  });
});

router.post('/announcements', (req: AuthenticatedRequest, res) => {
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2000);
  const targetRole = sanitizeText(req.body?.targetRole, 20) || 'ALL';
  const isPublic = req.body?.isPublic ? 1 : 0;

  if (!title || !body) {
    res.status(400).json({ error: 'Announcement title and body are required.' });
    return;
  }

  const r = db
    .prepare('INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, ?, NULL, ?, ?)')
    .run(title, body, targetRole, req.authUser!.userId, isPublic);
  logAudit(req.authUser!.userId, 'ANNOUNCEMENT_CREATE', 'ANNOUNCEMENT', Number(r.lastInsertRowid), title, req.ip || '');
  res.status(201).json({ id: r.lastInsertRowid, message: 'Institutional announcement published.' });
});

export default router;
