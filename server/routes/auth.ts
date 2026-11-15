import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import {
  getUserPermissions,
  logAudit,
  requireAuth,
  sanitizeText,
  signAuthToken,
  type AuthenticatedRequest,
} from '../auth';
import { getActiveAcademicContext } from '../services/academicService';
import type { RoleName } from '../../src/types/lms';

const router = Router();

router.post('/login', (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.status, u.phone, u.is_sample_data, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE lower(u.email) = ?`,
    )
    .get(email) as
    | {
        id: number;
        full_name: string;
        email: string;
        password_hash: string;
        status: 'active' | 'inactive';
        phone: string;
        is_sample_data: number;
        created_at: string;
        role_name: RoleName;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logAudit(null, 'LOGIN_FAILED', 'AUTH', email, 'Invalid credentials', req.ip || '');
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Your account has been deactivated. Contact the school administrator.' });
    return;
  }

  const permissions = getUserPermissions(user.role_name);
  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role_name,
    permissions,
  });

  logAudit(user.id, 'LOGIN_SUCCESS', 'AUTH', user.id, `Logged in as ${user.role_name}`, req.ip || '');

  res.cookie('lgbs_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 4 * 60 * 60 * 1000,
  });

  res.json({
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role_name,
      status: user.status,
      phone: user.phone,
      isSampleData: Boolean(user.is_sample_data),
      createdAt: user.created_at,
      permissions,
    },
  });
});

router.post('/register', (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const gender = req.body?.gender === 'Female' ? 'Female' : 'Male';
  const dateOfBirth = sanitizeText(req.body?.dateOfBirth, 20) || '2008-01-15';
  const gradeId = Number(req.body?.gradeId || 3);
  const streamCode = req.body?.streamCode === 'SOCIAL_SCIENCE' ? 'SOCIAL_SCIENCE' : 'NATURAL_SCIENCE';
  const guardianName = sanitizeText(req.body?.guardianName, 120) || 'Parent / Guardian';
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40) || '+251900000000';
  const customStudentCode = sanitizeText(req.body?.studentCode, 40);

  if (!fullName || !email || !email.includes('@') || password.length < 6) {
    res.status(400).json({
      error: 'Valid full name, email address, and password (at least 6 characters) are required.',
    });
    return;
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
  if (existingEmail) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  if (customStudentCode) {
    const dupCode = db.prepare('SELECT id FROM students WHERE student_code = ?').get(customStudentCode);
    if (dupCode) {
      res.status(409).json({ error: `Student ID ${customStudentCode} is already registered.` });
      return;
    }
  }

  const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'STUDENT'").get() as { id: number };
  const streamRow = db
    .prepare('SELECT id FROM academic_streams WHERE code = ?')
    .get(streamCode) as { id: number };
  const ctx = getActiveAcademicContext();
  const hash = bcrypt.hashSync(password, 8);

  const tx = db.transaction(() => {
    const userRes = db
      .prepare(
        "INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)",
      )
      .run(fullName, email, hash, roleRow.id, guardianPhone);
    const userId = Number(userRes.lastInsertRowid);

    const count = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
    const studentCode =
      customStudentCode || `LGBS-2026-${String(count + 1).padStart(3, '0')}`;

    const stuRes = db
      .prepare(
        `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, ?, ?, 'Pending Dorm Assignment', ?, ?, ?, ?, ?, 'enrolled', 0)`,
      )
      .run(userId, studentCode, gender, dateOfBirth, guardianName, guardianPhone, gradeId, streamRow.id, ctx.academicYearId);

    // Auto-create a pending tuition record so fee clearance gate works immediately for newly registered students
    db.prepare(
      `INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes)
       VALUES (?, ?, ?, 14500, 'Bank Deposit', ?, 'pending', 'Initial semester tuition fee awaiting verification')`,
    ).run(
      Number(stuRes.lastInsertRowid),
      ctx.academicYearId,
      ctx.semesterId,
      `REG-${Date.now()}-${userId}`,
    );

    logAudit(userId, 'STUDENT_SELF_REGISTER', 'STUDENT', studentCode, `Registered in ${streamCode}`, req.ip || '');
    return { userId, studentCode };
  });

  const created = tx();
  const permissions = getUserPermissions('STUDENT');
  const token = signAuthToken({
    userId: created.userId,
    email,
    fullName,
    role: 'STUDENT',
    permissions,
  });

  res.cookie('lgbs_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 4 * 60 * 60 * 1000,
  });

  res.status(201).json({
    token,
    studentCode: created.studentCode,
    user: {
      id: created.userId,
      fullName,
      email,
      role: 'STUDENT',
      status: 'active',
      isSampleData: false,
      permissions,
    },
  });
});

router.post('/forgot-password', (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  const user = db.prepare('SELECT id, email FROM users WHERE lower(email) = ?').get(email) as
    | { id: number; email: string }
    | undefined;

  if (!user) {
    // Return uniform response
    res.json({
      message: 'If an account matches that email, a password reset code has been generated.',
    });
    return;
  }

  const resetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO password_resets (user_id, reset_token, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    resetToken,
    expiresAt,
  );
  logAudit(user.id, 'PASSWORD_RESET_REQUEST', 'AUTH', user.id, 'Generated password reset code', req.ip || '');

  res.json({
    message: 'Password reset code generated (valid for 30 minutes).',
    // Provided in response because external SMTP is not configured in sandbox
    resetCodePreview: resetToken,
  });
});

router.post('/reset-password', (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const token = sanitizeText(req.body?.resetCode, 32).toUpperCase();
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!email || !token || newPassword.length < 6) {
    res.status(400).json({ error: 'Email, valid reset code, and new password (6+ chars) are required.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT pr.id, pr.user_id, pr.expires_at, pr.used
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE lower(u.email) = ? AND pr.reset_token = ?
       ORDER BY pr.id DESC LIMIT 1`,
    )
    .get(email, token) as
    | { id: number; user_id: number; expires_at: string; used: number }
    | undefined;

  if (!row || row.used || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 8);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    logAudit(row.user_id, 'PASSWORD_RESET_COMPLETE', 'AUTH', row.user_id, 'Password updated via reset token', req.ip || '');
  });
  tx();

  res.json({ message: 'Password updated successfully. You may now sign in.' });
});

router.post('/logout', (req: AuthenticatedRequest, res) => {
  res.clearCookie('lgbs_token');
  res.json({ message: 'Signed out securely.' });
});

router.get('/session', (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const cookieHeader = req.headers.cookie;
  let cookieToken: string | null = null;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'lgbs_token') cookieToken = decodeURIComponent(rest.join('='));
    }
  }
  const token = bearerToken || cookieToken;
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  requireAuth(req as AuthenticatedRequest, res, () => {
    const user = (req as AuthenticatedRequest).authUser!;
    const notifications = db
      .prepare(
        'SELECT id, user_id, title, message, category, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      )
      .all(user.userId);
    res.json({
      authenticated: true,
      user,
      notifications,
      activeContext: getActiveAcademicContext(),
    });
  });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const notifications = db
    .prepare(
      'SELECT id, user_id, title, message, category, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    )
    .all(user.userId);
  res.json({
    user,
    notifications,
    activeContext: getActiveAcademicContext(),
  });
});

router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    id,
    req.authUser!.userId,
  );
  res.json({ success: true });
});

router.get('/meta', requireAuth, (_req, res) => {
  const grades = db.prepare('SELECT id, name, level_order FROM grades ORDER BY level_order').all();
  const streams = db.prepare('SELECT id, code, name, description FROM academic_streams ORDER BY id').all();
  const categories = db.prepare('SELECT id, name, description FROM course_categories ORDER BY name').all();
  const academicYears = db.prepare('SELECT id, name, start_date, end_date, is_active FROM academic_years ORDER BY id DESC').all();
  const semesters = db.prepare('SELECT id, academic_year_id, name, start_date, end_date, is_active FROM semesters ORDER BY id DESC').all();
  res.json({
    grades,
    streams,
    categories,
    academicYears,
    semesters,
    activeContext: getActiveAcademicContext(),
  });
});

export default router;
