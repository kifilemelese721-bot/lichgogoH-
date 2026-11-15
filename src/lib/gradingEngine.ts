import type {
  GradingScaleBand,
  PaymentRecord,
  StreamWeightConfig,
  SubjectGradeResult,
} from '../types/lms';

export interface MarkValidationResult {
  valid: boolean;
  normalized?: number;
  error?: string;
}

export function validateMark(mark: unknown): MarkValidationResult {
  if (typeof mark !== 'number' || !Number.isFinite(mark)) {
    return { valid: false, error: 'Mark must be a valid finite number.' };
  }
  if (mark < 0 || mark > 100) {
    return { valid: false, error: 'Mark must be between 0 and 100.' };
  }
  const normalized = Math.round(mark * 100) / 100;
  return { valid: true, normalized };
}

export interface ComponentMarks {
  quizScore: number | null;
  assignmentScore: number | null;
  midtermScore: number | null;
  finalExamScore: number | null;
}

/**
 * Computes weighted subject score out of 100 using the configurable stream strategy.
 * If only a subset of components has been entered so far, calculates the proportional
 * score across active entered weights or full weighted sum when all 4 components exist.
 */
export function computeWeightedSubjectScore(
  marks: ComponentMarks,
  config: StreamWeightConfig,
  mode: 'full' | 'proportional' = 'full',
): number {
  const entries: Array<{ score: number | null; weight: number }> = [
    { score: marks.quizScore, weight: config.quizWeight },
    { score: marks.assignmentScore, weight: config.assignmentWeight },
    { score: marks.midtermScore, weight: config.midtermWeight },
    { score: marks.finalExamScore, weight: config.finalExamWeight },
  ];

  const totalConfigWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  if (totalConfigWeight <= 0) {
    return 0;
  }

  let weightedSum = 0;
  let activeWeight = 0;

  for (const item of entries) {
    if (item.score !== null && item.score !== undefined && Number.isFinite(item.score)) {
      weightedSum += item.score * item.weight;
      activeWeight += item.weight;
    }
  }

  if (activeWeight === 0) return 0;

  const divisor = mode === 'proportional' ? activeWeight : totalConfigWeight;
  const raw = weightedSum / divisor;
  return Math.round(raw * 100) / 100;
}

export function resolveLetterGrade(
  score: number,
  scale: GradingScaleBand[],
): { letterGrade: string; gradePoint: number; remark: string } {
  const rounded = Math.round(score * 100) / 100;
  const sorted = [...scale].sort((a, b) => b.minScore - a.minScore);
  for (const band of sorted) {
    if (rounded >= band.minScore && rounded <= band.maxScore) {
      return {
        letterGrade: band.letterGrade,
        gradePoint: band.gradePoint,
        remark: band.remark,
      };
    }
  }
  const fallback = sorted[sorted.length - 1];
  return fallback
    ? {
        letterGrade: fallback.letterGrade,
        gradePoint: fallback.gradePoint,
        remark: fallback.remark,
      }
    : { letterGrade: 'F', gradePoint: 0, remark: 'Fail' };
}

export function calculateSemesterTotalsAndGPA(
  subjects: Array<Pick<SubjectGradeResult, 'totalScore' | 'creditHours' | 'gradePoint'>>,
): { totalMarks: number; averageScore: number; gpa: number } {
  if (subjects.length === 0) {
    return { totalMarks: 0, averageScore: 0, gpa: 0 };
  }

  const totalMarks = Math.round(
    subjects.reduce((sum, s) => sum + s.totalScore, 0) * 100,
  ) / 100;
  const averageScore = Math.round((totalMarks / subjects.length) * 100) / 100;

  const totalCredits = subjects.reduce((sum, s) => sum + Math.max(1, s.creditHours), 0);
  const weightedPoints = subjects.reduce(
    (sum, s) => sum + s.gradePoint * Math.max(1, s.creditHours),
    0,
  );
  const gpa = totalCredits > 0 ? Math.round((weightedPoints / totalCredits) * 100) / 100 : 0;

  return { totalMarks, averageScore, gpa };
}

export interface StudentRankInput {
  studentId: number;
  averageScore: number;
  totalMarks: number;
}

export interface StudentRankOutput {
  studentId: number;
  rank: number;
}

/**
 * Standard competition ranking (1, 1, 3) ordered by highest averageScore then totalMarks.
 */
export function calculateClassRankings(students: StudentRankInput[]): StudentRankOutput[] {
  const sorted = [...students].sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return b.totalMarks - a.totalMarks;
  });

  const results: StudentRankOutput[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (
      i > 0 &&
      (sorted[i].averageScore !== sorted[i - 1].averageScore ||
        sorted[i].totalMarks !== sorted[i - 1].totalMarks)
    ) {
      currentRank = i + 1;
    }
    results.push({ studentId: sorted[i].studentId, rank: currentRank });
  }

  return results;
}

/**
 * Enforces the institutional rule:
 * Students must have at least one verified payment for the target semester
 * and no unresolved pending payment blocking clearance.
 */
export function hasFinancialClearance(
  payments: Pick<PaymentRecord, 'semesterId' | 'status'>[],
  semesterId?: number,
): { cleared: boolean; reason?: string } {
  const scoped =
    semesterId !== undefined
      ? payments.filter((p) => p.semesterId === semesterId)
      : payments;

  if (scoped.length === 0) {
    return {
      cleared: false,
      reason: 'No verified tuition fee payment recorded for the current semester.',
    };
  }

  const hasVerified = scoped.some((p) => p.status === 'verified');
  const hasPending = scoped.some((p) => p.status === 'pending');

  if (!hasVerified) {
    return {
      cleared: false,
      reason: hasPending
        ? 'Your semester tuition payment is pending financial verification.'
        : 'Verified fee clearance is required before accessing final semester results and official report cards.',
    };
  }

  if (hasPending) {
    return {
      cleared: false,
      reason: 'An additional semester fee balance is currently pending financial verification.',
    };
  }

  return { cleared: true };
}

export function canSubmitAssessment(
  deadlineIso: string,
  allowLateSubmission: boolean,
  now: Date = new Date(),
): { allowed: boolean; isLate: boolean; reason?: string } {
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) {
    return { allowed: false, isLate: false, reason: 'Invalid assessment deadline.' };
  }

  const isLate = now.getTime() > deadline.getTime();
  if (isLate && !allowLateSubmission) {
    return {
      allowed: false,
      isLate: true,
      reason: 'Assessment submission deadline has passed and late submissions are disabled.',
    };
  }

  return { allowed: true, isLate };
}

export function calculateAttendanceSummary(
  records: Array<{ status: 'present' | 'absent' | 'late' | 'excused' }>,
): {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
} {
  const totalDays = records.length;
  if (totalDays === 0) {
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      excusedDays: 0,
      attendancePercentage: 100,
    };
  }

  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let excusedDays = 0;

  for (const r of records) {
    if (r.status === 'present') presentDays++;
    else if (r.status === 'absent') absentDays++;
    else if (r.status === 'late') lateDays++;
    else if (r.status === 'excused') excusedDays++;
  }

  // Present + Late + Excused count toward attended sessions
  const attended = presentDays + lateDays + excusedDays;
  const attendancePercentage = Math.round((attended / totalDays) * 10000) / 100;

  return {
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    excusedDays,
    attendancePercentage,
  };
}
