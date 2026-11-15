import { Router } from 'express';
import { db } from '../db';
import { sanitizeText } from '../auth';

const router = Router();

router.get('/overview', (_req, res) => {
  const settingsRows = db.prepare('SELECT key, value FROM school_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  const stats = {
    totalStudents: (db.prepare("SELECT COUNT(*) as c FROM students WHERE enrollment_status = 'enrolled'").get() as { c: number }).c,
    totalInstructors: (db.prepare('SELECT COUNT(*) as c FROM instructors').get() as { c: number }).c,
    totalCourses: (db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number }).c,
    streamsCount: (db.prepare('SELECT COUNT(*) as c FROM academic_streams').get() as { c: number }).c,
  };

  const streams = db.prepare('SELECT id, code, name, description FROM academic_streams').all();

  const courses = db
    .prepare(
      `SELECT c.id, c.code, c.title, c.description, c.credit_hours,
              cat.name as category_name, g.name as grade_name,
              st.name as stream_name, st.code as stream_code,
              u.full_name as instructor_name
       FROM courses c
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       GROUP BY c.id
       ORDER BY g.level_order, c.code`,
    )
    .all();

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.created_at, u.full_name as author_name, r.name as author_role
       FROM announcements a
       JOIN users u ON u.id = a.author_user_id
       JOIN roles r ON r.id = u.role_id
       WHERE a.is_public = 1
       ORDER BY a.created_at DESC
       LIMIT 6`,
    )
    .all();

  res.json({ settings, stats, streams, courses, announcements });
});

router.post('/contact', (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160);
  const subject = sanitizeText(req.body?.subject, 160);
  const message = sanitizeText(req.body?.message, 2000);

  if (!fullName || !email || !email.includes('@') || !subject || !message) {
    res.status(400).json({ error: 'Please provide a valid name, email address, subject, and message.' });
    return;
  }

  const result = db
    .prepare('INSERT INTO contact_messages (full_name, email, subject, message) VALUES (?, ?, ?, ?)')
    .run(fullName, email, subject, message);

  res.status(201).json({
    id: result.lastInsertRowid,
    message: 'Your inquiry has been received by the Lich Gogo Excellence Boarding School Admissions Office.',
  });
});

export default router;
