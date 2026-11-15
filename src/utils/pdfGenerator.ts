import { jsPDF } from 'jspdf';
import type { CertificateRecord, PaymentRecord, ReportCardPayload } from '../types/lms';

export function downloadReportCardPdf(report: ReportCardPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 42;
  let y = 46;

  // Institutional Header
  doc.setFillColor(22, 59, 101); // #163B65
  doc.rect(0, 0, 595, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('LICH GOGO EXCELLENCE BOARDING SCHOOL', margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Hosanna, Hadiya Zone, Ethiopia  |  Official Academic Report Card', margin, 56);
  doc.text(`${report.academicYearName}  ·  ${report.semesterName}`, margin, 72);

  y = 112;
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('STUDENT ACADEMIC RECORD', margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Full Name: ${report.student.fullName}`, margin, y);
  doc.text(`Student ID: ${report.student.studentCode}`, 330, y);
  y += 16;
  doc.text(`Grade Level: ${report.student.gradeName}`, margin, y);
  doc.text(`Academic Stream: ${report.student.streamName}`, 330, y);
  y += 16;
  doc.text(`Dormitory: ${report.student.dormitoryBlock}`, margin, y);
  doc.text(`Fee Clearance: ${report.cleared ? 'VERIFIED' : 'STAFF PREVIEW'}`, 330, y);

  y += 24;
  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 12, 511, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Code', margin + 6, y + 2);
  doc.text('Subject Title', margin + 70, y + 2);
  doc.text('Cr', margin + 280, y + 2);
  doc.text('Quiz', margin + 310, y + 2);
  doc.text('Asg', margin + 345, y + 2);
  doc.text('Mid', margin + 380, y + 2);
  doc.text('Fin', margin + 415, y + 2);
  doc.text('Total', margin + 450, y + 2);
  doc.text('Grade', margin + 485, y + 2);
  y += 18;

  doc.setFont('helvetica', 'normal');
  for (const subj of report.subjects) {
    doc.text(subj.courseCode, margin + 6, y);
    doc.text(subj.courseTitle.slice(0, 34), margin + 70, y);
    doc.text(String(subj.creditHours), margin + 280, y);
    doc.text(subj.quizScore !== null ? String(subj.quizScore) : '-', margin + 310, y);
    doc.text(subj.assignmentScore !== null ? String(subj.assignmentScore) : '-', margin + 345, y);
    doc.text(subj.midtermScore !== null ? String(subj.midtermScore) : '-', margin + 380, y);
    doc.text(subj.finalExamScore !== null ? String(subj.finalExamScore) : '-', margin + 415, y);
    doc.text(`${subj.totalScore.toFixed(1)}%`, margin + 448, y);
    doc.text(subj.letterGrade, margin + 488, y);
    y += 18;
  }

  y += 14;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + 511, y);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total Marks: ${report.totalMarks.toFixed(2)}`, margin, y);
  doc.text(`Average Score: ${report.averageScore.toFixed(2)}%`, margin + 150, y);
  doc.text(`Semester GPA: ${report.gpa.toFixed(2)}`, margin + 310, y);
  doc.text(
    `Class Rank: ${report.classRank ? `${report.classRank} / ${report.totalInClass}` : 'N/A'}`,
    margin + 425,
    y,
  );
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.text(
    `Attendance Summary: ${report.attendancePercentage}% (${report.presentDays} present, ${report.absentDays} absent out of ${report.totalDaysRecorded} recorded sessions)`,
    margin,
    y,
  );

  y += 60;
  doc.line(margin, y, margin + 170, y);
  doc.line(350, y, 520, y);
  y += 14;
  doc.setFontSize(9);
  doc.text('Academic Registrar Signature & Seal', margin, y);
  doc.text('School Principal Signature', 350, y);

  doc.setTextColor(100, 116, 139);
  doc.text(`Generated via Lich Gogo LMS on ${new Date().toLocaleDateString()}`, margin, 790);
  doc.save(`ReportCard_${report.student.studentCode}_${report.semesterName.replace(/\s+/g, '_')}.pdf`);
}

export function downloadCertificatePdf(cert: CertificateRecord): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const w = 842;

  doc.setDrawColor(22, 59, 101);
  doc.setLineWidth(6);
  doc.rect(28, 28, w - 56, 539);
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(1.5);
  doc.rect(38, 38, w - 76, 519);

  doc.setTextColor(22, 59, 101);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('LICH GOGO EXCELLENCE BOARDING SCHOOL', w / 2, 105, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Hosanna, Hadiya Zone, Ethiopia', w / 2, 126, { align: 'center' });

  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(`CERTIFICATE OF ${cert.certificateType.toUpperCase()}`, w / 2, 195, { align: 'center' });

  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('This official institutional credential is proudly conferred upon', w / 2, 240, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(cert.studentName, w / 2, 282, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(
    `Student ID: ${cert.studentCode}   ·   Grade: ${cert.gradeName}   ·   Stream: ${cert.streamName}`,
    w / 2,
    314,
    { align: 'center' },
  );
  doc.text(
    `For successfully fulfilling all academic and residential requirements during the ${cert.academicYearName} Academic Year.`,
    w / 2,
    346,
    { align: 'center' },
  );

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Certificate No: ${cert.certificateNumber}`, 90, 480);
  doc.text(`Issued Date: ${cert.issuedAt.slice(0, 10)}`, 90, 498);

  doc.setDrawColor(148, 163, 184);
  doc.line(540, 470, 740, 470);
  doc.setTextColor(31, 41, 55);
  doc.text(`Academic Registrar (${cert.issuedByName})`, 540, 488);

  doc.save(`Certificate_${cert.certificateNumber}.pdf`);
}

export function downloadReceiptPdf(payment: PaymentRecord): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a5' });
  const margin = 32;
  let y = 40;

  doc.setFillColor(22, 59, 101);
  doc.rect(0, 0, 420, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LICH GOGO EXCELLENCE BOARDING SCHOOL', margin, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Hosanna, Ethiopia  |  Official Tuition Payment Receipt', margin, 48);

  y = 100;
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Receipt No: ${payment.receiptNumber || 'PENDING'}`, margin, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const rows: Array<[string, string]> = [
    ['Student Name', payment.studentName],
    ['Student ID', payment.studentCode],
    ['Academic Term', payment.semesterName],
    ['Amount Paid', `${payment.amountEtb.toLocaleString()} ETB`],
    ['Payment Method', payment.paymentMethod],
    ['Transaction Reference', payment.transactionRef],
    ['Verification Status', payment.status.toUpperCase()],
    ['Verified By', payment.verifiedByName || 'Pending Verification'],
    ['Date Recorded', payment.paidAt.slice(0, 10)],
  ];

  for (const [label, val] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(val, margin + 135, y);
    y += 20;
  }

  y += 24;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Verified institutional financial clearance record — Lich Gogo Finance Office.', margin, y);

  doc.save(`Receipt_${payment.receiptNumber || payment.transactionRef}.pdf`);
}
