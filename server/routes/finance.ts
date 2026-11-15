import { Router } from 'express';
import { db } from '../db';
import { logAudit, requireAuth, requireRole, sanitizeText, type AuthenticatedRequest } from '../auth';
import { getActiveAcademicContext } from '../services/academicService';

const router = Router();
router.use(requireAuth, requireRole('FINANCE', 'ADMIN', 'REGISTRAR'));

router.get('/payments', (_req, res) => {
  const payments = db
    .prepare(
      `SELECT p.id, p.student_id, s.student_code, u.full_name as student_name,
              p.academic_year_id, p.semester_id, sem.name as semester_name,
              p.amount_etb, p.payment_method, p.transaction_ref, p.status,
              p.paid_at, p.verified_at, p.notes,
              pr.receipt_number, v.full_name as verified_by_name
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN users u ON u.id = s.user_id
       JOIN semesters sem ON sem.id = p.semester_id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       LEFT JOIN users v ON v.id = p.verified_by_user_id
       ORDER BY p.id DESC`,
    )
    .all();

  const ctx = getActiveAcademicContext();
  const outstandingStudents = db
    .prepare(
      `SELECT s.id as student_id, s.student_code, u.full_name as student_name, g.name as grade_name, st.name as stream_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       WHERE s.enrollment_status = 'enrolled'
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE p.student_id = s.id AND p.semester_id = ? AND p.status = 'verified'
         )
       ORDER BY s.student_code`,
    )
    .all(ctx.semesterId);

  res.json({ payments, outstandingStudents, activeContext: ctx });
});

router.post('/payments', (req: AuthenticatedRequest, res) => {
  const studentId = Number(req.body?.studentId);
  const amountEtb = Number(req.body?.amountEtb);
  const paymentMethod = req.body?.paymentMethod;
  const transactionRef = sanitizeText(req.body?.transactionRef, 80).toUpperCase();
  const notes = sanitizeText(req.body?.notes, 300);
  const verifyImmediately = Boolean(req.body?.verifyImmediately);

  if (
    !studentId ||
    !Number.isFinite(amountEtb) ||
    amountEtb <= 0 ||
    !['Bank Deposit', 'Telebirr Reference', 'Cashier Office'].includes(paymentMethod) ||
    !transactionRef
  ) {
    res.status(400).json({ error: 'Student, positive amount (ETB), payment method, and unique transaction reference are required.' });
    return;
  }

  const student = db.prepare('SELECT id, user_id, student_code FROM students WHERE id = ?').get(studentId) as
    | { id: number; user_id: number; student_code: string }
    | undefined;
  if (!student) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const dupRef = db.prepare('SELECT id FROM payments WHERE transaction_ref = ?').get(transactionRef);
  if (dupRef) {
    res.status(409).json({ error: `Transaction reference ${transactionRef} is already recorded.` });
    return;
  }

  const ctx = getActiveAcademicContext();

  const created = db.transaction(() => {
    const status = verifyImmediately ? 'verified' : 'pending';
    const verifiedBy = verifyImmediately ? req.authUser!.userId : null;
    const verifiedAt = verifyImmediately ? new Date().toISOString() : null;

    const pRes = db
      .prepare(
        `INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes, verified_by_user_id, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(studentId, ctx.academicYearId, ctx.semesterId, amountEtb, paymentMethod, transactionRef, status, notes, verifiedBy, verifiedAt);
    const paymentId = Number(pRes.lastInsertRowid);

    let receiptNumber: string | null = null;
    if (verifyImmediately) {
      const rCount = (db.prepare('SELECT COUNT(*) as c FROM payment_receipts').get() as { c: number }).c;
      receiptNumber = `RCPT-LGBS-2026-${String(rCount + 1).padStart(4, '0')}`;
      db.prepare('INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)').run(
        paymentId,
        receiptNumber,
        req.authUser!.userId,
      );
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Tuition Payment Verified', ?, 'finance')").run(
        student.user_id,
        `Payment ${transactionRef} (${amountEtb} ETB) verified. Official Receipt: ${receiptNumber}. Semester results unlocked.`,
      );
    }

    logAudit(req.authUser!.userId, 'PAYMENT_RECORD', 'PAYMENT', paymentId, `${student.student_code} ${amountEtb} ETB (${status})`, req.ip || '');
    return { paymentId, receiptNumber, status };
  })();

  res.status(201).json({ ...created, message: 'Payment recorded successfully.' });
});

router.patch('/payments/:id/verify', (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const action = req.body?.status === 'rejected' ? 'rejected' : 'verified';
  const notes = sanitizeText(req.body?.notes, 300);

  const payment = db
    .prepare(
      `SELECT p.id, p.student_id, p.amount_etb, p.transaction_ref, s.user_id, s.student_code
       FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE p.id = ?`,
    )
    .get(id) as
    | { id: number; student_id: number; amount_etb: number; transaction_ref: string; user_id: number; student_code: string }
    | undefined;

  if (!payment) {
    res.status(404).json({ error: 'Payment record not found.' });
    return;
  }

  const receiptNumber = db.transaction(() => {
    db.prepare(
      `UPDATE payments
       SET status = ?, verified_by_user_id = ?, verified_at = datetime('now'), notes = COALESCE(NULLIF(?, ''), notes)
       WHERE id = ?`,
    ).run(action, req.authUser!.userId, notes, id);

    let rcpt: string | null = null;
    if (action === 'verified') {
      const existingReceipt = db.prepare('SELECT receipt_number FROM payment_receipts WHERE payment_id = ?').get(id) as
        | { receipt_number: string }
        | undefined;
      if (existingReceipt) {
        rcpt = existingReceipt.receipt_number;
      } else {
        const rCount = (db.prepare('SELECT COUNT(*) as c FROM payment_receipts').get() as { c: number }).c;
        rcpt = `RCPT-LGBS-2026-${String(rCount + 1).padStart(4, '0')}`;
        db.prepare('INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)').run(
          id,
          rcpt,
          req.authUser!.userId,
        );
      }
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Fee Clearance Approved', ?, 'finance')").run(
        payment.user_id,
        `Your payment ${payment.transaction_ref} has been verified (Receipt ${rcpt}). Your official semester results are now accessible.`,
      );
    } else {
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Payment Verification Rejected', ?, 'finance')").run(
        payment.user_id,
        `Payment ${payment.transaction_ref} could not be verified. Please contact the Finance Office.`,
      );
    }

    logAudit(req.authUser!.userId, `PAYMENT_${action.toUpperCase()}`, 'PAYMENT', id, `${payment.student_code} (${payment.transaction_ref})`, req.ip || '');
    return rcpt;
  })();

  res.json({
    status: action,
    receiptNumber,
    message: action === 'verified' ? `Payment verified and receipt ${receiptNumber} generated.` : 'Payment marked as rejected.',
  });
});

export default router;
