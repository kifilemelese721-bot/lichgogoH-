import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceSummary,
  calculateClassRankings,
  calculateSemesterTotalsAndGPA,
  canSubmitAssessment,
  computeWeightedSubjectScore,
  hasFinancialClearance,
  resolveLetterGrade,
  validateMark,
} from './gradingEngine';
import type { GradingScaleBand, StreamWeightConfig } from '../types/lms';

const sampleScale: GradingScaleBand[] = [
  { letterGrade: 'A', minScore: 90, maxScore: 100, gradePoint: 4.0, remark: 'Excellent' },
  { letterGrade: 'B+', minScore: 80, maxScore: 89.99, gradePoint: 3.5, remark: 'Very Good' },
  { letterGrade: 'B', minScore: 70, maxScore: 79.99, gradePoint: 3.0, remark: 'Good' },
  { letterGrade: 'C', minScore: 55, maxScore: 69.99, gradePoint: 2.0, remark: 'Satisfactory' },
  { letterGrade: 'F', minScore: 0, maxScore: 54.99, gradePoint: 0.0, remark: 'Fail' },
];

const naturalStreamConfig: StreamWeightConfig = {
  streamCode: 'NATURAL_SCIENCE',
  quizWeight: 10,
  assignmentWeight: 15,
  midtermWeight: 25,
  finalExamWeight: 50,
  passingScore: 55,
};

const socialStreamConfig: StreamWeightConfig = {
  streamCode: 'SOCIAL_SCIENCE',
  quizWeight: 15,
  assignmentWeight: 25,
  midtermWeight: 20,
  finalExamWeight: 40,
  passingScore: 55,
};

test('validateMark enforces strict 0 to 100 bounds', () => {
  assert.equal(validateMark(-1).valid, false);
  assert.equal(validateMark(100.01).valid, false);
  assert.equal(validateMark(Number.NaN).valid, false);
  assert.equal(validateMark(0).valid, true);
  assert.equal(validateMark(100).valid, true);
  assert.equal(validateMark(87.456).normalized, 87.46);
});

test('computeWeightedSubjectScore respects configurable stream weights', () => {
  const marks = {
    quizScore: 80,
    assignmentScore: 90,
    midtermScore: 84,
    finalExamScore: 92,
  };
  // Natural: 80*0.1 + 90*0.15 + 84*0.25 + 92*0.50 = 8 + 13.5 + 21 + 46 = 88.5
  assert.equal(computeWeightedSubjectScore(marks, naturalStreamConfig), 88.5);
  // Social: 80*0.15 + 90*0.25 + 84*0.20 + 92*0.40 = 12 + 22.5 + 16.8 + 36.8 = 88.1
  assert.equal(computeWeightedSubjectScore(marks, socialStreamConfig), 88.1);
});

test('resolveLetterGrade and calculateSemesterTotalsAndGPA compute weighted GPA', () => {
  const g1 = resolveLetterGrade(92, sampleScale);
  const g2 = resolveLetterGrade(84, sampleScale);
  assert.equal(g1.letterGrade, 'A');
  assert.equal(g2.letterGrade, 'B+');

  const summary = calculateSemesterTotalsAndGPA([
    { totalScore: 92, creditHours: 4, gradePoint: g1.gradePoint },
    { totalScore: 84, creditHours: 2, gradePoint: g2.gradePoint },
  ]);
  assert.equal(summary.totalMarks, 176);
  assert.equal(summary.averageScore, 88);
  // (4.0*4 + 3.5*2) / 6 = 23/6 = 3.83
  assert.equal(summary.gpa, 3.83);
});

test('calculateClassRankings handles ties using competition ranking', () => {
  const ranks = calculateClassRankings([
    { studentId: 1, averageScore: 88, totalMarks: 440 },
    { studentId: 2, averageScore: 92, totalMarks: 460 },
    { studentId: 3, averageScore: 88, totalMarks: 440 },
    { studentId: 4, averageScore: 81, totalMarks: 405 },
  ]);
  assert.deepEqual(ranks, [
    { studentId: 2, rank: 1 },
    { studentId: 1, rank: 2 },
    { studentId: 3, rank: 2 },
    { studentId: 4, rank: 4 },
  ]);
});

test('hasFinancialClearance blocks pending/unverified students and passes verified students', () => {
  assert.equal(hasFinancialClearance([], 1).cleared, false);
  assert.equal(
    hasFinancialClearance([{ semesterId: 1, status: 'pending' }], 1).cleared,
    false,
  );
  assert.equal(
    hasFinancialClearance([{ semesterId: 1, status: 'rejected' }], 1).cleared,
    false,
  );
  assert.equal(
    hasFinancialClearance([{ semesterId: 1, status: 'verified' }], 1).cleared,
    true,
  );
});

test('canSubmitAssessment blocks late submissions when disabled', () => {
  const past = '2026-01-01T10:00:00Z';
  const future = '2099-01-01T10:00:00Z';
  const now = new Date('2026-06-01T10:00:00Z');

  assert.equal(canSubmitAssessment(past, false, now).allowed, false);
  assert.equal(canSubmitAssessment(past, true, now).allowed, true);
  assert.equal(canSubmitAssessment(past, true, now).isLate, true);
  assert.equal(canSubmitAssessment(future, false, now).allowed, true);
});

test('calculateAttendanceSummary computes accurate percentages', () => {
  const stats = calculateAttendanceSummary([
    { status: 'present' },
    { status: 'present' },
    { status: 'late' },
    { status: 'absent' },
  ]);
  assert.equal(stats.totalDays, 4);
  assert.equal(stats.presentDays, 2);
  assert.equal(stats.absentDays, 1);
  assert.equal(stats.attendancePercentage, 75);
});
