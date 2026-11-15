import { db } from '../db';
import {
  calculateAttendanceSummary,
  calculateClassRankings,
  calculateSemesterTotalsAndGPA,
  computeWeightedSubjectScore,
  hasFinancialClearance,
  resolveLetterGrade,
} from '../../src/lib/gradingEngine';
import type {
  AcademicStreamCode,
  GradingScaleBand,
  PaymentRecord,
  ReportCardPayload,
  StreamWeightConfig,
  StudentProfile,
  SubjectGradeResult,
} from '../../src/types/lms';

export function getActiveAcademicContext(): {
  academicYearId: number;
  academicYearName: string;
  semesterId: number;
  semesterName: string;
} {
  const year = db
    .prepare('SELECT id, name FROM academic_years WHERE is_active = 1 LIMIT 1')
    .get() as { id: number; name: string } | undefined;
  const fallbackYear =
    year ||
    (db.prepare('SELECT id, name FROM academic_years ORDER BY id DESC LIMIT 1').get() as {
      id: number;
      name: string;
    });

  const semester = db
    .prepare(
      'SELECT id, name FROM semesters WHERE academic_year_id = ? AND is_active = 1 LIMIT 1',
    )
    .get(fallbackYear.id) as { id: number; name: string } | undefined;
  const fallbackSemester =
    semester ||
    (db
      .prepare('SELECT id, name FROM semesters WHERE academic_year_id = ? ORDER BY id DESC LIMIT 1')
      .get(fallbackYear.id) as { id: number; name: string });

  return {
    academicYearId: fallbackYear.id,
    academicYearName: fallbackYear.name,
    semesterId: fallbackSemester.id,
    semesterName: fallbackSemester.name,
  };
}

export function getGradingScale(): GradingScaleBand[] {
  const rows = db
    .prepare(
      'SELECT id, letter_grade, min_score, max_score, grade_point, remark FROM grading_scales ORDER BY min_score DESC',
    )
    .all() as Array<{
    id: number;
    letter_grade: string;
    min_score: number;
    max_score: number;
    grade_point: number;
    remark: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    letterGrade: r.letter_grade,
    minScore: r.min_score,
    maxScore: r.max_score,
    gradePoint: r.grade_point,
    remark: r.remark,
  }));
}

export function getStreamWeightConfig(streamId: number): StreamWeightConfig {
  const row = db
    .prepare(
      `SELECT s.code, c.quiz_weight, c.assignment_weight, c.midterm_weight, c.final_exam_weight, c.passing_score
       FROM stream_grading_configs c
       JOIN academic_streams s ON s.id = c.stream_id
       WHERE c.stream_id = ?`,
    )
    .get(streamId) as
    | {
        code: AcademicStreamCode;
        quiz_weight: number;
        assignment_weight: number;
        midterm_weight: number;
        final_exam_weight: number;
        passing_score: number;
      }
    | undefined;

  if (!row) {
    return {
      streamCode: 'NATURAL_SCIENCE',
      quizWeight: 10,
      assignmentWeight: 15,
      midtermWeight: 25,
      finalExamWeight: 50,
      passingScore: 50,
    };
  }

  return {
    streamCode: row.code,
    quizWeight: row.quiz_weight,
    assignmentWeight: row.assignment_weight,
    midtermWeight: row.midterm_weight,
    finalExamWeight: row.final_exam_weight,
    passingScore: row.passing_score,
  };
}

export function getStudentProfileById(studentId: number): StudentProfile | null {
  const row = db
    .prepare(
      `SELECT s.id, s.user_id, s.student_code, u.full_name, u.email, s.gender, s.date_of_birth,
              s.dormitory_block, s.guardian_name, s.guardian_phone, s.grade_id, g.name as grade_name,
              s.stream_id, st.code as stream_code, st.name as stream_name,
              s.academic_year_id, ay.name as academic_year_name, s.enrollment_status, s.is_sample_data
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN academic_years ay ON ay.id = s.academic_year_id
       WHERE s.id = ?`,
    )
    .get(studentId) as
    | {
        id: number;
        user_id: number;
        student_code: string;
        full_name: string;
        email: string;
        gender: 'Male' | 'Female';
        date_of_birth: string;
        dormitory_block: string;
        guardian_name: string;
        guardian_phone: string;
        grade_id: number;
        grade_name: string;
        stream_id: number;
        stream_code: AcademicStreamCode;
        stream_name: string;
        academic_year_id: number;
        academic_year_name: string;
        enrollment_status: 'enrolled' | 'transferred' | 'graduated' | 'suspended';
        is_sample_data: number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    studentCode: row.student_code,
    fullName: row.full_name,
    email: row.email,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    dormitoryBlock: row.dormitory_block,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    gradeId: row.grade_id,
    gradeName: row.grade_name,
    streamId: row.stream_id,
    streamCode: row.stream_code,
    streamName: row.stream_name,
    academicYearId: row.academic_year_id,
    academicYearName: row.academic_year_name,
    enrollmentStatus: row.enrollment_status,
    isSampleData: Boolean(row.is_sample_data),
  };
}

export function getStudentProfileByUserId(userId: number): StudentProfile | null {
  const row = db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as
    | { id: number }
    | undefined;
  return row ? getStudentProfileById(row.id) : null;
}

export function recalculateAllGradesForSemester(semesterId: number): void {
  const scale = getGradingScale();
  const records = db
    .prepare(
      `SELECT gr.id, gr.student_id, gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score, s.stream_id
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       WHERE gr.semester_id = ?`,
    )
    .all(semesterId) as Array<{
    id: number;
    student_id: number;
    quiz_score: number | null;
    assignment_score: number | null;
    midterm_score: number | null;
    final_exam_score: number | null;
    stream_id: number;
  }>;

  const updateStmt = db.prepare(
    'UPDATE grades_records SET total_score = ?, letter_grade = ?, grade_point = ? WHERE id = ?',
  );

  const tx = db.transaction(() => {
    for (const r of records) {
      const cfg = getStreamWeightConfig(r.stream_id);
      const total = computeWeightedSubjectScore(
        {
          quizScore: r.quiz_score,
          assignmentScore: r.assignment_score,
          midtermScore: r.midterm_score,
          finalExamScore: r.final_exam_score,
        },
        cfg,
        'full',
      );
      const resolved = resolveLetterGrade(total, scale);
      updateStmt.run(total, resolved.letterGrade, resolved.gradePoint, r.id);
    }
  });
  tx();
}

export function buildStudentReportCard(
  studentId: number,
  semesterId: number,
  bypassClearanceForStaff = false,
): ReportCardPayload | null {
  const student = getStudentProfileById(studentId);
  if (!student) return null;

  const semRow = db
    .prepare(
      `SELECT sem.id, sem.name as semester_name, ay.name as academic_year_name
       FROM semesters sem
       JOIN academic_years ay ON ay.id = sem.academic_year_id
       WHERE sem.id = ?`,
    )
    .get(semesterId) as
    | { id: number; semester_name: string; academic_year_name: string }
    | undefined;

  if (!semRow) return null;

  const payments = db
    .prepare('SELECT semester_id, status FROM payments WHERE student_id = ?')
    .all(studentId) as Array<{ semester_id: number; status: PaymentRecord['status'] }>;

  const clearance = hasFinancialClearance(
    payments.map((p) => ({ semesterId: p.semester_id, status: p.status })),
    semesterId,
  );

  const streamConfig = getStreamWeightConfig(student.streamId);

  const attRows = db
    .prepare('SELECT status FROM attendance WHERE student_id = ?')
    .all(studentId) as Array<{ status: 'present' | 'absent' | 'late' | 'excused' }>;
  const attSummary = calculateAttendanceSummary(attRows);

  if (!clearance.cleared && !bypassClearanceForStaff) {
    return {
      cleared: false,
      clearanceReason: clearance.reason,
      student,
      academicYearName: semRow.academic_year_name,
      semesterName: semRow.semester_name,
      subjects: [],
      totalMarks: 0,
      averageScore: 0,
      gpa: 0,
      classRank: null,
      totalInClass: 0,
      attendancePercentage: attSummary.attendancePercentage,
      totalDaysRecorded: attSummary.totalDays,
      presentDays: attSummary.presentDays,
      absentDays: attSummary.absentDays,
      generatedAt: new Date().toISOString(),
    };
  }

  const gradeRows = db
    .prepare(
      `SELECT gr.course_id, c.code as course_code, c.title as course_title, c.credit_hours,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM grades_records gr
       JOIN courses c ON c.id = gr.course_id
       WHERE gr.student_id = ? AND gr.semester_id = ?
       ORDER BY c.code`,
    )
    .all(studentId, semesterId) as Array<{
    course_id: number;
    course_code: string;
    course_title: string;
    credit_hours: number;
    quiz_score: number | null;
    assignment_score: number | null;
    midterm_score: number | null;
    final_exam_score: number | null;
    total_score: number;
    letter_grade: string;
    grade_point: number;
    verified_by_registrar: number;
  }>;

  const subjects: SubjectGradeResult[] = gradeRows.map((r) => ({
    courseId: r.course_id,
    courseCode: r.course_code,
    courseTitle: r.course_title,
    creditHours: r.credit_hours,
    quizScore: r.quiz_score,
    assignmentScore: r.assignment_score,
    midtermScore: r.midterm_score,
    finalExamScore: r.final_exam_score,
    totalScore: r.total_score,
    letterGrade: r.letter_grade,
    gradePoint: r.grade_point,
    passed: r.total_score >= streamConfig.passingScore,
    verifiedByRegistrar: Boolean(r.verified_by_registrar),
  }));

  const summary = calculateSemesterTotalsAndGPA(subjects);

  // Class rank among peers in same grade & stream
  const classmates = db
    .prepare(
      `SELECT s.id as student_id
       FROM students s
       WHERE s.grade_id = ? AND s.stream_id = ? AND s.enrollment_status = 'enrolled'`,
    )
    .all(student.gradeId, student.streamId) as Array<{ student_id: number }>;

  const classInputs = classmates.map((peer) => {
    const peerGrades = db
      .prepare(
        `SELECT gr.total_score, c.credit_hours, gr.grade_point
         FROM grades_records gr
         JOIN courses c ON c.id = gr.course_id
         WHERE gr.student_id = ? AND gr.semester_id = ?`,
      )
      .all(peer.student_id, semesterId) as Array<{
      total_score: number;
      credit_hours: number;
      grade_point: number;
    }>;

    const peerSummary = calculateSemesterTotalsAndGPA(
      peerGrades.map((g) => ({
        totalScore: g.total_score,
        creditHours: g.credit_hours,
        gradePoint: g.grade_point,
      })),
    );
    return {
      studentId: peer.student_id,
      averageScore: peerSummary.averageScore,
      totalMarks: peerSummary.totalMarks,
    };
  });

  const rankings = calculateClassRankings(classInputs);
  const myRank = rankings.find((r) => r.studentId === studentId)?.rank ?? null;

  return {
    cleared: clearance.cleared,
    clearanceReason: clearance.cleared ? undefined : clearance.reason,
    student,
    academicYearName: semRow.academic_year_name,
    semesterName: semRow.semester_name,
    subjects,
    totalMarks: summary.totalMarks,
    averageScore: summary.averageScore,
    gpa: summary.gpa,
    classRank: subjects.length > 0 ? myRank : null,
    totalInClass: classmates.length,
    attendancePercentage: attSummary.attendancePercentage,
    totalDaysRecorded: attSummary.totalDays,
    presentDays: attSummary.presentDays,
    absentDays: attSummary.absentDays,
    generatedAt: new Date().toISOString(),
  };
}
