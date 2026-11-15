import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Download, Receipt } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { downloadReceiptPdf } from '../../utils/pdfGenerator';
import { DashboardLayout, type NavSectionItem } from '../DashboardLayout';
import type { NotificationItem, PaymentRecord, RoleName } from '../../types/lms';

interface FinanceDashboardProps {
  user: { id: number; fullName: string; email: string; role: RoleName };
  activeContextLabel: string;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const NAV_ITEMS: NavSectionItem[] = [
  { id: 'payments', label: 'Payment Verification', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'outstanding', label: 'Outstanding Clearance', icon: <AlertCircle className="w-4 h-4" /> },
];

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  user,
  activeContextLabel,
  notifications,
  onMarkNotificationRead,
  onLogout,
  darkMode,
  onToggleDarkMode,
}) => {
  const [tab, setTab] = useState('payments');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [data, setData] = useState<{
    payments: Array<{
      id: number;
      student_id: number;
      student_code: string;
      student_name: string;
      academic_year_id: number;
      semester_id: number;
      semester_name: string;
      amount_etb: number;
      payment_method: PaymentRecord['paymentMethod'];
      transaction_ref: string;
      status: PaymentRecord['status'];
      paid_at: string;
      verified_at: string | null;
      notes: string;
      receipt_number: string | null;
      verified_by_name: string | null;
    }>;
    outstandingStudents: Array<{
      student_id: number;
      student_code: string;
      student_name: string;
      grade_name: string;
      stream_name: string;
    }>;
  } | null>(null);

  const [newPay, setNewPay] = useState({
    studentId: '',
    amountEtb: '14500',
    paymentMethod: 'Bank Deposit',
    transactionRef: '',
    notes: 'Semester II Tuition & Boarding Fee',
    verifyImmediately: true,
  });

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadPayments = async () => {
    const res = await apiRequest<NonNullable<typeof data>>('/api/finance/payments');
    setData(res);
    if (!newPay.studentId && res.outstandingStudents[0]) {
      setNewPay((p) => ({ ...p, studentId: String(res.outstandingStudents[0].student_id) }));
    }
  };

  useEffect(() => {
    loadPayments().catch(() => {});
  }, []);

  const handleVerify = async (paymentId: number, status: 'verified' | 'rejected') => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/finance/payments/${paymentId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showMsg('ok', res.message);
      loadPayments();
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string }>('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...newPay,
          studentId: Number(newPay.studentId),
          amountEtb: Number(newPay.amountEtb),
        }),
      });
      showMsg('ok', res.message);
      setNewPay({ ...newPay, transactionRef: '' });
      loadPayments();
    } catch (err) {
      showMsg('err', err instanceof Error ? err.message : 'Could not record payment.');
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
          className={`mb-6 p-3.5 rounded-lg border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {tab === 'payments' && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Verified Payments</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-emerald-600 mt-2">
                {data.payments.filter((p) => p.status === 'verified').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Cleared &amp; receipted</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Pending Verification</span>
                <Receipt className="w-4 h-4 text-amber-600" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-amber-600 mt-2">
                {data.payments.filter((p) => p.status === 'pending').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting cashier check</div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Uncleared Students</span>
                <AlertCircle className="w-4 h-4 text-[#163B65] dark:text-slate-300" />
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-[#163B65] dark:text-white mt-2">
                {data.outstandingStudents.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Results locked until cleared</div>
            </div>
          </div>

          <form
            onSubmit={handleRecordPayment}
            className="glass-card rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#2563EB]" />
              <span>Record Bank Slip or Cashier Payment</span>
            </h2>
            <p className="text-xs text-slate-500">
              Note: This module records and verifies physical bank deposits, Telebirr references, and cashier receipts. Online payment gateway checkout is not enabled.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="number"
                required
                placeholder="Student Numeric ID"
                value={newPay.studentId}
                onChange={(e) => setNewPay({ ...newPay, studentId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
              />
              <input
                type="number"
                required
                min={1}
                placeholder="Amount (ETB)"
                value={newPay.amountEtb}
                onChange={(e) => setNewPay({ ...newPay, amountEtb: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
              />
              <select
                value={newPay.paymentMethod}
                onChange={(e) => setNewPay({ ...newPay, paymentMethod: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="Bank Deposit">Bank Deposit</option>
                <option value="Telebirr Reference">Telebirr Reference</option>
                <option value="Cashier Office">Cashier Office</option>
              </select>
              <input
                type="text"
                required
                placeholder="Transaction Reference (e.g. CBE-99812)"
                value={newPay.transactionRef}
                onChange={(e) => setNewPay({ ...newPay, transactionRef: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono-tabular"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#163B65] text-white text-xs font-medium">
                Record Payment
              </button>
            </div>
          </form>

          <div className="glass-card rounded-xl p-6 overflow-x-auto">
            <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white mb-4">
              Student Payment Transactions
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Receipt</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{p.student_name}</div>
                      <div className="font-mono-tabular text-slate-500">{p.student_code}</div>
                    </td>
                    <td className="py-3 pr-3 font-mono-tabular">{p.transaction_ref}</td>
                    <td className="py-3 pr-3">{p.payment_method}</td>
                    <td className="py-3 pr-3 text-right font-mono-tabular font-semibold">
                      {p.amount_etb.toLocaleString()} ETB
                    </td>
                    <td className="py-3 pr-3 uppercase font-semibold">
                      <span
                        className={
                          p.status === 'verified'
                            ? 'text-emerald-600'
                            : p.status === 'pending'
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono-tabular">{p.receipt_number || '-'}</td>
                    <td className="py-3 text-right space-x-2 whitespace-nowrap">
                      {p.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleVerify(p.id, 'verified')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify &amp; Clear</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerify(p.id, 'rejected')}
                            className="px-2.5 py-1 rounded border border-red-300 text-red-600 font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === 'verified' && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadReceiptPdf({
                              id: p.id,
                              studentId: p.student_id,
                              studentCode: p.student_code,
                              studentName: p.student_name,
                              academicYearId: p.academic_year_id,
                              semesterId: p.semester_id,
                              semesterName: p.semester_name,
                              amountEtb: p.amount_etb,
                              paymentMethod: p.payment_method,
                              transactionRef: p.transaction_ref,
                              status: p.status,
                              receiptNumber: p.receipt_number,
                              verifiedByName: p.verified_by_name,
                              verifiedAt: p.verified_at,
                              paidAt: p.paid_at,
                            })
                          }
                          className="inline-flex items-center gap-1 text-[#2563EB] font-medium hover:underline"
                        >
                          <Download className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'outstanding' && data && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
            Students Without Verified Semester Fee Clearance
          </h2>
          {data.outstandingStudents.length === 0 ? (
            <p className="text-xs text-emerald-700">All enrolled students have verified fee clearance for the active semester.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Student ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2">Stream</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.outstandingStudents.map((s) => (
                  <tr key={s.student_id}>
                    <td className="py-2.5 pr-3 font-mono-tabular">{s.student_id}</td>
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-amber-600">{s.student_code}</td>
                    <td className="py-2.5 pr-3 font-medium">{s.student_name}</td>
                    <td className="py-2.5 pr-3">{s.grade_name}</td>
                    <td className="py-2.5">{s.stream_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
