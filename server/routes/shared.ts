import { Router } from 'express';
import fs from 'fs';
import { db } from '../db';
import { requireAuth, sanitizeText, type AuthenticatedRequest } from '../auth';

const router = Router();
router.use(requireAuth);

// Secure material download for authenticated users
router.get('/materials/:id/download', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const mat = db
    .prepare('SELECT id, course_id, file_name, stored_path FROM course_materials WHERE id = ?')
    .get(id) as { id: number; course_id: number; file_name: string; stored_path: string } | undefined;

  if (!mat || !fs.existsSync(mat.stored_path)) {
    res.status(404).json({ error: 'Learning material file not found.' });
    return;
  }

  res.download(mat.stored_path, mat.file_name);
});

// Course Discussions (accessible to Students enrolled, Instructors assigned, and Admins)
router.get('/discussions', (req: AuthenticatedRequest, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  let sql = `
    SELECT d.id, d.course_id, c.code as course_code, c.title as course_title,
           d.author_user_id, u.full_name as author_name, r.name as author_role,
           d.title, d.body, d.created_at,
           (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.discussion_id = d.id) as reply_count
    FROM discussions d
    JOIN courses c ON c.id = d.course_id
    JOIN users u ON u.id = d.author_user_id
    JOIN roles r ON r.id = u.role_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (courseId) {
    sql += ' AND d.course_id = ?';
    params.push(courseId);
  }
  sql += ' ORDER BY d.created_at DESC';
  const topics = db.prepare(sql).all(...params);
  res.json({ topics });
});

router.get('/discussions/:id/replies', (req, res) => {
  const id = Number(req.params.id);
  const replies = db
    .prepare(
      `SELECT dr.id, dr.discussion_id, dr.author_user_id, u.full_name as author_name, r.name as author_role,
              dr.body, dr.created_at
       FROM discussion_replies dr
       JOIN users u ON u.id = dr.author_user_id
       JOIN roles r ON r.id = u.role_id
       WHERE dr.discussion_id = ?
       ORDER BY dr.created_at ASC`,
    )
    .all(id);
  res.json({ replies });
});

router.post('/discussions', (req: AuthenticatedRequest, res) => {
  const courseId = Number(req.body?.courseId);
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2000);
  if (!courseId || !title || !body) {
    res.status(400).json({ error: 'Course, topic title, and question body are required.' });
    return;
  }
  const r = db
    .prepare('INSERT INTO discussions (course_id, author_user_id, title, body) VALUES (?, ?, ?, ?)')
    .run(courseId, req.authUser!.userId, title, body);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Discussion topic posted.' });
});

router.post('/discussions/:id/replies', (req: AuthenticatedRequest, res) => {
  const discussionId = Number(req.params.id);
  const body = sanitizeText(req.body?.body, 2000);
  if (!body) {
    res.status(400).json({ error: 'Reply message cannot be empty.' });
    return;
  }
  const r = db
    .prepare('INSERT INTO discussion_replies (discussion_id, author_user_id, body) VALUES (?, ?, ?)')
    .run(discussionId, req.authUser!.userId, body);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Reply posted.' });
});

export default router;
