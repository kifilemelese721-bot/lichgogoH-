// server.ts
import express from "express";
import path3 from "path";
import { createServer as createViteServer } from "vite";

// server/db.ts
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
var DATA_DIR = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
var DB_PATH = path.join(DATA_DIR, "lichgogo_lms.db");
var UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
var db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      phone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      is_sample_data INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reset_token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      UNIQUE (academic_year_id, name),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      level_order INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS academic_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (code IN ('NATURAL_SCIENCE', 'SOCIAL_SCIENCE')),
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      student_code TEXT NOT NULL UNIQUE,
      gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
      date_of_birth TEXT NOT NULL,
      dormitory_block TEXT NOT NULL DEFAULT 'Block A',
      guardian_name TEXT NOT NULL DEFAULT '',
      guardian_phone TEXT NOT NULL DEFAULT '',
      grade_id INTEGER NOT NULL,
      stream_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      enrollment_status TEXT NOT NULL DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'transferred', 'graduated', 'suspended')),
      is_sample_data INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (grade_id) REFERENCES grades(id),
      FOREIGN KEY (stream_id) REFERENCES academic_streams(id),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    );

    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      employee_code TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      qualification TEXT NOT NULL,
      is_sample_data INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS course_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      grade_id INTEGER NOT NULL,
      stream_id INTEGER,
      credit_hours INTEGER NOT NULL DEFAULT 4 CHECK (credit_hours > 0),
      is_sample_data INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES course_categories(id),
      FOREIGN KEY (grade_id) REFERENCES grades(id),
      FOREIGN KEY (stream_id) REFERENCES academic_streams(id)
    );

    CREATE TABLE IF NOT EXISTS course_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      instructor_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      UNIQUE (course_id, academic_year_id, semester_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (semester_id) REFERENCES semesters(id)
    );

    CREATE TABLE IF NOT EXISTS student_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
      UNIQUE (student_id, course_id, semester_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (semester_id) REFERENCES semesters(id)
    );

    CREATE TABLE IF NOT EXISTS course_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      uploaded_by_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      material_type TEXT NOT NULL CHECK (material_type IN ('pdf', 'presentation', 'video', 'document')),
      description TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      assessment_type TEXT NOT NULL CHECK (assessment_type IN ('quiz', 'assignment', 'midterm', 'final_exam')),
      description TEXT NOT NULL DEFAULT '',
      total_marks REAL NOT NULL DEFAULT 100 CHECK (total_marks > 0 AND total_marks <= 100),
      duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
      deadline TEXT NOT NULL,
      allow_late_submission INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assessment_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'short_answer')),
      options_json TEXT NOT NULL DEFAULT '[]',
      correct_option TEXT NOT NULL DEFAULT '',
      max_marks REAL NOT NULL DEFAULT 10 CHECK (max_marks > 0),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      answers_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_late INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
      UNIQUE (assessment_id, student_id),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assessment_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL UNIQUE,
      assessment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      marks_obtained REAL NOT NULL CHECK (marks_obtained >= 0 AND marks_obtained <= 100),
      feedback TEXT NOT NULL DEFAULT '',
      graded_by_user_id INTEGER NOT NULL,
      graded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS grading_scales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      letter_grade TEXT NOT NULL UNIQUE,
      min_score REAL NOT NULL,
      max_score REAL NOT NULL,
      grade_point REAL NOT NULL,
      remark TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stream_grading_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL UNIQUE,
      quiz_weight REAL NOT NULL DEFAULT 10,
      assignment_weight REAL NOT NULL DEFAULT 15,
      midterm_weight REAL NOT NULL DEFAULT 25,
      final_exam_weight REAL NOT NULL DEFAULT 50,
      passing_score REAL NOT NULL DEFAULT 50,
      FOREIGN KEY (stream_id) REFERENCES academic_streams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grades_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      quiz_score REAL CHECK (quiz_score IS NULL OR (quiz_score >= 0 AND quiz_score <= 100)),
      assignment_score REAL CHECK (assignment_score IS NULL OR (assignment_score >= 0 AND assignment_score <= 100)),
      midterm_score REAL CHECK (midterm_score IS NULL OR (midterm_score >= 0 AND midterm_score <= 100)),
      final_exam_score REAL CHECK (final_exam_score IS NULL OR (final_exam_score >= 0 AND final_exam_score <= 100)),
      total_score REAL NOT NULL DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 100),
      letter_grade TEXT NOT NULL DEFAULT 'N/A',
      grade_point REAL NOT NULL DEFAULT 0,
      verified_by_registrar INTEGER NOT NULL DEFAULT 0,
      updated_by_user_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, course_id, semester_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      attendance_type TEXT NOT NULL DEFAULT 'classroom' CHECK (attendance_type IN ('classroom', 'dormitory')),
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
      remarks TEXT NOT NULL DEFAULT '',
      recorded_by_user_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_classroom
      ON attendance(student_id, course_id, attendance_date) WHERE course_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_dorm
      ON attendance(student_id, attendance_type, attendance_date) WHERE course_id IS NULL;

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (semester_id) REFERENCES semesters(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'ALL',
      course_id INTEGER,
      author_user_id INTEGER NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (author_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('academic', 'assessment', 'grade', 'finance', 'system')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (author_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS discussion_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discussion_id INTEGER NOT NULL,
      author_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
      FOREIGN KEY (author_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      semester_id INTEGER NOT NULL,
      amount_etb REAL NOT NULL CHECK (amount_etb > 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('Bank Deposit', 'Telebirr Reference', 'Cashier Office')),
      transaction_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
      notes TEXT NOT NULL DEFAULT '',
      verified_by_user_id INTEGER,
      verified_at TEXT,
      paid_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payment_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL UNIQUE,
      receipt_number TEXT NOT NULL UNIQUE,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      issued_by_user_id INTEGER NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_number TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL,
      academic_year_id INTEGER NOT NULL,
      certificate_type TEXT NOT NULL CHECK (certificate_type IN ('Academic Completion', 'Honor Roll', 'Stream Graduation')),
      issued_by_user_id INTEGER NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS academic_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      academic_year_id INTEGER NOT NULL,
      semester_id INTEGER,
      generated_by_user_id INTEGER NOT NULL,
      summary_json TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (generated_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS school_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
    CREATE INDEX IF NOT EXISTS idx_grades_records_student_sem ON grades_records(student_id, semester_id);
    CREATE INDEX IF NOT EXISTS idx_payments_student_sem ON payments(student_id, semester_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, attendance_date);
  `);
  const roleCount = db.prepare("SELECT COUNT(*) as c FROM roles").get().c;
  if (roleCount === 0) {
    seedInitialData();
  }
}
function seedInitialData() {
  const tx = db.transaction(() => {
    const insertRole = db.prepare("INSERT INTO roles (name, description) VALUES (?, ?)");
    const rAdmin = Number(insertRole.run("ADMIN", "Full system administration and configuration").lastInsertRowid);
    const rInstructor = Number(insertRole.run("INSTRUCTOR", "Course materials, assessments, grading, and attendance").lastInsertRowid);
    const rStudent = Number(insertRole.run("STUDENT", "Course enrollment, materials, assessments, and results").lastInsertRowid);
    const rRegistrar = Number(insertRole.run("REGISTRAR", "Student enrollment, streams, report cards, and certificates").lastInsertRowid);
    const rFinance = Number(insertRole.run("FINANCE", "Tuition fee verification and official receipt issuance").lastInsertRowid);
    const perms = [
      ["USER_MANAGE", "Administration", "Create, edit, deactivate users and assign roles"],
      ["ROLE_MANAGE", "Administration", "Modify role permissions and security access"],
      ["COURSE_MANAGE", "Academics", "Create courses, categories, and class schedules"],
      ["SYSTEM_SETTINGS", "System", "Configure grading scales, stream weights, and school settings"],
      ["AUDIT_VIEW", "Security", "Inspect system audit logs and backups"],
      ["MATERIAL_UPLOAD", "Instruction", "Upload and manage course learning materials"],
      ["ASSESSMENT_MANAGE", "Instruction", "Create quizzes, assignments, and exams"],
      ["GRADE_ENTER", "Grading", "Enter and update student assessment marks"],
      ["ATTENDANCE_MARK", "Attendance", "Record classroom and dormitory attendance"],
      ["COURSE_ENROLL", "Student", "Browse and enroll in stream courses"],
      ["ASSESSMENT_TAKE", "Student", "Take online assessments and submit answers"],
      ["RESULTS_VIEW", "Student", "View semester grades, GPA, and report cards (subject to clearance)"],
      ["STUDENT_REGISTER", "Registrar", "Register students, generate IDs, and manage transfers"],
      ["STREAM_ASSIGN", "Registrar", "Assign students to Natural or Social Science stream"],
      ["GRADE_VERIFY", "Registrar", "Verify grades and generate report cards/certificates"],
      ["PAYMENT_VERIFY", "Finance", "Verify tuition payments and issue official receipts"]
    ];
    const insertPerm = db.prepare("INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)");
    const permMap = {};
    for (const [code, mod, desc] of perms) {
      permMap[code] = Number(insertPerm.run(code, mod, desc).lastInsertRowid);
    }
    const assignRP = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of Object.values(permMap)) assignRP.run(rAdmin, pid);
    for (const code of ["MATERIAL_UPLOAD", "ASSESSMENT_MANAGE", "GRADE_ENTER", "ATTENDANCE_MARK"]) {
      assignRP.run(rInstructor, permMap[code]);
    }
    for (const code of ["COURSE_ENROLL", "ASSESSMENT_TAKE", "RESULTS_VIEW"]) {
      assignRP.run(rStudent, permMap[code]);
    }
    for (const code of ["STUDENT_REGISTER", "STREAM_ASSIGN", "GRADE_VERIFY", "ATTENDANCE_MARK"]) {
      assignRP.run(rRegistrar, permMap[code]);
    }
    for (const code of ["PAYMENT_VERIFY"]) {
      assignRP.run(rFinance, permMap[code]);
    }
    const insertSetting = db.prepare("INSERT INTO school_settings (key, value) VALUES (?, ?)");
    insertSetting.run("school_name", "Lich Gogo Excellence Boarding School");
    insertSetting.run("location", "Hosanna, Hadiya Zone, Central Ethiopia");
    insertSetting.run("motto", "Discipline, Inquiry, and Academic Distinction");
    insertSetting.run("contact_email", "admissions@lichgogo.edu.et");
    insertSetting.run("contact_phone", "+251 46 555 2140");
    insertSetting.run("semester_tuition_etb", "14500");
    const year2026 = Number(
      db.prepare("INSERT INTO academic_years (name, start_date, end_date, is_active) VALUES ('2025/2026', '2025-09-12', '2026-06-30', 1)").run().lastInsertRowid
    );
    const sem1 = Number(
      db.prepare("INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_active) VALUES (?, 'Semester I', '2025-09-12', '2026-01-30', 0)").run(year2026).lastInsertRowid
    );
    const sem2 = Number(
      db.prepare("INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_active) VALUES (?, 'Semester II', '2026-02-05', '2026-06-30', 1)").run(year2026).lastInsertRowid
    );
    const insertGrade = db.prepare("INSERT INTO grades (name, level_order) VALUES (?, ?)");
    insertGrade.run("Grade 9", 9);
    insertGrade.run("Grade 10", 10);
    const g11 = Number(insertGrade.run("Grade 11", 11).lastInsertRowid);
    const g12 = Number(insertGrade.run("Grade 12", 12).lastInsertRowid);
    const insertStream = db.prepare("INSERT INTO academic_streams (code, name, description) VALUES (?, ?, ?)");
    const sNatural = Number(
      insertStream.run(
        "NATURAL_SCIENCE",
        "Natural Science",
        "Physics, Chemistry, Biology, Advanced Mathematics, and Technical Drawing for STEM university pathways."
      ).lastInsertRowid
    );
    const sSocial = Number(
      insertStream.run(
        "SOCIAL_SCIENCE",
        "Social Science",
        "Economics, Geography, History, Civics, and Social Mathematics for law, governance, and business pathways."
      ).lastInsertRowid
    );
    const insertScale = db.prepare(
      "INSERT INTO grading_scales (letter_grade, min_score, max_score, grade_point, remark) VALUES (?, ?, ?, ?, ?)"
    );
    insertScale.run("A", 90, 100, 4, "Distinction");
    insertScale.run("A-", 85, 89.99, 3.75, "Excellent");
    insertScale.run("B+", 80, 84.99, 3.5, "Very Good");
    insertScale.run("B", 70, 79.99, 3, "Good");
    insertScale.run("C+", 60, 69.99, 2.5, "Above Average");
    insertScale.run("C", 50, 59.99, 2, "Satisfactory");
    insertScale.run("D", 40, 49.99, 1, "Conditional Pass");
    insertScale.run("F", 0, 39.99, 0, "Fail");
    const insertConfig = db.prepare(
      "INSERT INTO stream_grading_configs (stream_id, quiz_weight, assignment_weight, midterm_weight, final_exam_weight, passing_score) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertConfig.run(sNatural, 10, 15, 25, 50, 50);
    insertConfig.run(sSocial, 15, 25, 20, 40, 50);
    const hashAdmin = bcrypt.hashSync("Admin@2026", 8);
    const hashTeacher = bcrypt.hashSync("Teacher@2026", 8);
    const hashStudent = bcrypt.hashSync("Student@2026", 8);
    const hashRegistrar = bcrypt.hashSync("Registrar@2026", 8);
    const hashFinance = bcrypt.hashSync("Finance@2026", 8);
    const insertUser = db.prepare(
      "INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, ?, 1)"
    );
    const uAdmin = Number(insertUser.run("Abebe Bekele", "admin@lichgogo.edu.et", hashAdmin, rAdmin, "+251911220001", "active").lastInsertRowid);
    const uInst1 = Number(insertUser.run("Dr. Dawit Tadesse", "dawit.t@lichgogo.edu.et", hashTeacher, rInstructor, "+251911220002", "active").lastInsertRowid);
    const uInst2 = Number(insertUser.run("Tigist Haile", "tigist.h@lichgogo.edu.et", hashTeacher, rInstructor, "+251911220003", "active").lastInsertRowid);
    const uRegistrar = Number(insertUser.run("Kebede Alemu", "registrar@lichgogo.edu.et", hashRegistrar, rRegistrar, "+251911220004", "active").lastInsertRowid);
    const uFinance = Number(insertUser.run("Mekdes Solomon", "finance@lichgogo.edu.et", hashFinance, rFinance, "+251911220005", "active").lastInsertRowid);
    const uStu1 = Number(insertUser.run("Sara Mekonnen", "sara.m@lichgogo.edu.et", hashStudent, rStudent, "+251911220010", "active").lastInsertRowid);
    const uStu2 = Number(insertUser.run("Yonas Girma", "yonas.g@lichgogo.edu.et", hashStudent, rStudent, "+251911220011", "active").lastInsertRowid);
    const uStu3 = Number(insertUser.run("Hanna Desta", "hanna.d@lichgogo.edu.et", hashStudent, rStudent, "+251911220012", "active").lastInsertRowid);
    const uStu4 = Number(insertUser.run("Bereket Tesfaye", "bereket.t@lichgogo.edu.et", hashStudent, rStudent, "+251911220013", "active").lastInsertRowid);
    const insertInst = db.prepare(
      "INSERT INTO instructors (user_id, employee_code, department, qualification, is_sample_data) VALUES (?, ?, ?, ?, 1)"
    );
    const inst1 = Number(insertInst.run(uInst1, "INST-2026-01", "Natural Sciences & Mathematics", "PhD in Applied Physics").lastInsertRowid);
    const inst2 = Number(insertInst.run(uInst2, "INST-2026-02", "Social Sciences & Economics", "M.A. in Development Economics").lastInsertRowid);
    const insertStu = db.prepare(`
      INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 1)
    `);
    const st1 = Number(insertStu.run(uStu1, "LGBS-2026-001", "Female", "2008-04-18", "Girls Dormitory \u2014 Block B", "Mekonnen Ayele", "+251911300101", g11, sNatural, year2026).lastInsertRowid);
    const st2 = Number(insertStu.run(uStu2, "LGBS-2026-002", "Male", "2008-09-02", "Boys Dormitory \u2014 Block A", "Girma Wolde", "+251911300102", g11, sNatural, year2026).lastInsertRowid);
    const st3 = Number(insertStu.run(uStu3, "LGBS-2026-003", "Female", "2007-11-24", "Girls Dormitory \u2014 Block C", "Desta Lemma", "+251911300103", g12, sSocial, year2026).lastInsertRowid);
    const st4 = Number(insertStu.run(uStu4, "LGBS-2026-004", "Male", "2008-02-11", "Boys Dormitory \u2014 Block A", "Tesfaye Gebre", "+251911300104", g11, sNatural, year2026).lastInsertRowid);
    const insertCat = db.prepare("INSERT INTO course_categories (name, description) VALUES (?, ?)");
    const catStem = Number(insertCat.run("Physical & Biological Sciences", "Core Natural Science laboratory and theoretical courses").lastInsertRowid);
    const catMath = Number(insertCat.run("Mathematics & Computing", "Analytical mathematics and quantitative reasoning").lastInsertRowid);
    const catHumanities = Number(insertCat.run("Economics & Social Studies", "Social sciences, governance, and historical inquiry").lastInsertRowid);
    const catLang = Number(insertCat.run("Languages & Communication", "Academic English and literary composition").lastInsertRowid);
    const insertCourse = db.prepare(`
      INSERT INTO courses (code, title, description, category_id, grade_id, stream_id, credit_hours, is_sample_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const cPhys = Number(insertCourse.run("PHYS-111", "Mechanics, Waves & Electromagnetism", "Rigorous Grade 11 Natural Science physics covering kinematics, Newtonian dynamics, wave optics, and circuit laws.", catStem, g11, sNatural, 4).lastInsertRowid);
    const cChem = Number(insertCourse.run("CHEM-111", "Chemical Bonding & Thermodynamics", "Atomic structure, stoichiometry, chemical kinetics, and laboratory titration methods.", catStem, g11, sNatural, 4).lastInsertRowid);
    const cMathNat = Number(insertCourse.run("MATH-111", "Calculus & Analytic Geometry", "Functions, limits, derivatives, vectors, and matrix algebra for Natural Science learners.", catMath, g11, sNatural, 5).lastInsertRowid);
    const cEng = Number(insertCourse.run("ENGL-111", "Academic Writing & Literature", "Critical essay writing, rhetorical analysis, and technical reading comprehension.", catLang, g11, null, 3).lastInsertRowid);
    const cEcon = Number(insertCourse.run("ECON-121", "Macroeconomics & Ethiopian Fiscal Policy", "National income accounting, monetary policy, development planning, and East African trade.", catHumanities, g12, sSocial, 4).lastInsertRowid);
    const cHist = Number(insertCourse.run("HIST-121", "Modern Ethiopian & World History", "Historical analysis of 19th and 20th century constitutional, diplomatic, and social transformations.", catHumanities, g12, sSocial, 4).lastInsertRowid);
    const assignCourse = db.prepare("INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)");
    assignCourse.run(cPhys, inst1, year2026, sem2);
    assignCourse.run(cChem, inst1, year2026, sem2);
    assignCourse.run(cMathNat, inst1, year2026, sem2);
    assignCourse.run(cEng, inst2, year2026, sem2);
    assignCourse.run(cEcon, inst2, year2026, sem2);
    assignCourse.run(cHist, inst2, year2026, sem2);
    const enroll = db.prepare("INSERT INTO student_enrollments (student_id, course_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)");
    for (const st of [st1, st2, st4]) {
      enroll.run(st, cPhys, year2026, sem2);
      enroll.run(st, cChem, year2026, sem2);
      enroll.run(st, cMathNat, year2026, sem2);
      enroll.run(st, cEng, year2026, sem2);
    }
    enroll.run(st3, cEcon, year2026, sem2);
    enroll.run(st3, cHist, year2026, sem2);
    const matDir = path.join(UPLOAD_DIR, "sample");
    if (!fs.existsSync(matDir)) fs.mkdirSync(matDir, { recursive: true });
    const sampleDoc1 = path.join(matDir, "PHYS-111-Kinematics-Guide.txt");
    const sampleDoc2 = path.join(matDir, "MATH-111-Derivatives-Workbook.txt");
    const sampleDoc3 = path.join(matDir, "ECON-121-Fiscal-Policy-Notes.txt");
    fs.writeFileSync(sampleDoc1, "Lich Gogo Excellence Boarding School \u2014 PHYS-111 Study Pack\nTopic: Kinematics, Uniform Acceleration & Projectile Motion\nInstructor: Dr. Dawit Tadesse\n");
    fs.writeFileSync(sampleDoc2, "Lich Gogo Excellence Boarding School \u2014 MATH-111 Calculus Workbook\nTopic: Limits, Continuity and First Principles Differentiation\n");
    fs.writeFileSync(sampleDoc3, "Lich Gogo Excellence Boarding School \u2014 ECON-121 Seminar Notes\nTopic: Macroeconomic Stability & Agricultural Productivity in Ethiopia\n");
    const insertMat = db.prepare(`
      INSERT INTO course_materials (course_id, uploaded_by_user_id, title, material_type, description, file_name, stored_path, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMat.run(cPhys, uInst1, "Unit 3: Kinematics & Projectile Motion Lecture Pack", "pdf", "Comprehensive study notes and solved problems for Grade 11 Natural Science.", "PHYS-111-Kinematics-Guide.txt", sampleDoc1, fs.statSync(sampleDoc1).size);
    insertMat.run(cMathNat, uInst1, "Calculus Worksheet: Limits & Derivatives", "presentation", "Practice problem set preparing for Midterm Examination.", "MATH-111-Derivatives-Workbook.txt", sampleDoc2, fs.statSync(sampleDoc2).size);
    insertMat.run(cEcon, uInst2, "Fiscal Policy & Development Lecture Slides", "pdf", "Case study on national budget allocation and inflation control.", "ECON-121-Fiscal-Policy-Notes.txt", sampleDoc3, fs.statSync(sampleDoc3).size);
    const insertAssess = db.prepare(`
      INSERT INTO assessments (course_id, semester_id, created_by_user_id, title, assessment_type, description, total_marks, duration_minutes, deadline, allow_late_submission, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const aPhysQuiz = Number(insertAssess.run(cPhys, sem2, uInst1, "Kinematics & Force Equilibrium Quiz", "quiz", "Timed online quiz covering vector decomposition and Newton second law applications.", 100, 25, "2026-12-20T23:59:00Z", 0).lastInsertRowid);
    const aMathAssign = Number(insertAssess.run(cMathNat, sem2, uInst1, "Limits & Continuity Problem Set", "assignment", "Analytical evaluation of limits and trigonometric continuity.", 100, 45, "2026-12-22T23:59:00Z", 1).lastInsertRowid);
    const aExpiredQuiz = Number(insertAssess.run(cChem, sem2, uInst1, "Closed Stoichiometry Diagnostic (Past Deadline)", "quiz", "Closed diagnostic quiz used to verify deadline lock behavior.", 100, 20, "2026-03-01T12:00:00Z", 0).lastInsertRowid);
    const insertQ = db.prepare("INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_option, max_marks) VALUES (?, ?, ?, ?, ?, ?)");
    insertQ.run(aPhysQuiz, "An object starts from rest and accelerates uniformly at 4 m/s^2 for 5 seconds. What is its final velocity?", "mcq", JSON.stringify(["10 m/s", "16 m/s", "20 m/s", "25 m/s"]), "20 m/s", 50);
    insertQ.run(aPhysQuiz, "Which SI unit corresponds to mechanical impulse?", "mcq", JSON.stringify(["N\xB7s", "J/s", "N/m", "kg\xB7m/s^2"]), "N\xB7s", 50);
    insertQ.run(aMathAssign, "What is the limit of (x^2 - 9) / (x - 3) as x approaches 3?", "mcq", JSON.stringify(["0", "3", "6", "Undefined"]), "6", 50);
    insertQ.run(aMathAssign, "Briefly state the Intermediate Value Theorem and one condition required for it to hold.", "short_answer", "[]", "", 50);
    insertQ.run(aExpiredQuiz, "What is Avogadro\u2019s number approximately?", "mcq", JSON.stringify(["6.022 \xD7 10^23", "3.14 \xD7 10^8", "9.81 \xD7 10^2"]), "6.022 \xD7 10^23", 100);
    const insertGradeRec = db.prepare(`
      INSERT INTO grades_records (student_id, course_id, semester_id, quiz_score, assignment_score, midterm_score, final_exam_score, total_score, letter_grade, grade_point, verified_by_registrar, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertGradeRec.run(st1, cPhys, sem2, 92, 94, 90, 93, 92.3, "A", 4, 1, uInst1);
    insertGradeRec.run(st1, cChem, sem2, 88, 90, 86, 89, 88.3, "A-", 3.75, 1, uInst1);
    insertGradeRec.run(st1, cMathNat, sem2, 95, 92, 94, 96, 94.8, "A", 4, 1, uInst1);
    insertGradeRec.run(st1, cEng, sem2, 85, 88, 84, 86, 85.7, "A-", 3.75, 1, uInst2);
    insertGradeRec.run(st2, cPhys, sem2, 78, 82, 75, 80, 78.85, "B", 3, 1, uInst1);
    insertGradeRec.run(st2, cChem, sem2, 74, 80, 72, 76, 75.4, "B", 3, 1, uInst1);
    insertGradeRec.run(st2, cMathNat, sem2, 84, 85, 80, 82, 82.15, "B+", 3.5, 1, uInst1);
    insertGradeRec.run(st2, cEng, sem2, 76, 79, 75, 78, 77.2, "B", 3, 1, uInst2);
    insertGradeRec.run(st4, cPhys, sem2, 86, 84, 88, 85, 85.7, "A-", 3.75, 1, uInst1);
    insertGradeRec.run(st4, cChem, sem2, 82, 85, 80, 83, 82.45, "B+", 3.5, 1, uInst1);
    insertGradeRec.run(st4, cMathNat, sem2, 90, 88, 87, 91, 89.45, "A-", 3.75, 1, uInst1);
    insertGradeRec.run(st4, cEng, sem2, 80, 82, 79, 81, 80.55, "B+", 3.5, 1, uInst2);
    insertGradeRec.run(st3, cEcon, sem2, 91, 93, 89, 92, 91.5, "A", 4, 1, uInst2);
    insertGradeRec.run(st3, cHist, sem2, 87, 90, 85, 88, 87.75, "A-", 3.75, 1, uInst2);
    const insertAtt = db.prepare(`
      INSERT INTO attendance (student_id, course_id, attendance_type, attendance_date, status, remarks, recorded_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAtt.run(st1, cPhys, "classroom", "2026-11-10", "present", "Lab session complete", uInst1);
    insertAtt.run(st1, cPhys, "classroom", "2026-11-12", "present", "", uInst1);
    insertAtt.run(st1, cMathNat, "classroom", "2026-11-12", "present", "", uInst1);
    insertAtt.run(st1, null, "dormitory", "2026-11-12", "present", "Evening study roll call", uRegistrar);
    insertAtt.run(st2, cPhys, "classroom", "2026-11-10", "present", "", uInst1);
    insertAtt.run(st2, cPhys, "classroom", "2026-11-12", "absent", "Infirmary visit", uInst1);
    insertAtt.run(st2, cMathNat, "classroom", "2026-11-12", "late", "Arrived 5 mins late", uInst1);
    insertAtt.run(st3, cEcon, "classroom", "2026-11-11", "present", "", uInst2);
    insertAtt.run(st3, cHist, "classroom", "2026-11-12", "present", "", uInst2);
    const insertSched = db.prepare("INSERT INTO schedules (course_id, semester_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)");
    insertSched.run(cPhys, sem2, "Monday", "08:30", "10:00", "Science Lab B-02");
    insertSched.run(cMathNat, sem2, "Tuesday", "10:15", "11:45", "Hall N-104");
    insertSched.run(cChem, sem2, "Wednesday", "08:30", "10:00", "Chemistry Lab A-01");
    insertSched.run(cEng, sem2, "Thursday", "14:00", "15:30", "Humanities Wing 201");
    insertSched.run(cEcon, sem2, "Monday", "10:15", "11:45", "Social Wing 302");
    insertSched.run(cHist, sem2, "Wednesday", "14:00", "15:30", "Social Wing 304");
    const insertPay = db.prepare(`
      INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes, verified_by_user_id, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const p1 = Number(insertPay.run(st1, year2026, sem2, 14500, "Bank Deposit", "CBE-HOS-884210", "verified", "Semester II Tuition & Boarding Fee", uFinance, "2026-02-10T09:15:00Z").lastInsertRowid);
    insertPay.run(st2, year2026, sem2, 14500, "Telebirr Reference", "TBR-991042", "pending", "Awaiting cashier bank slip reconciliation", null, null);
    const p3 = Number(insertPay.run(st3, year2026, sem2, 14500, "Bank Deposit", "CBE-HOS-884509", "verified", "Semester II Full Clearance", uFinance, "2026-02-11T11:30:00Z").lastInsertRowid);
    const p4 = Number(insertPay.run(st4, year2026, sem2, 14500, "Cashier Office", "CSH-HOS-10442", "verified", "Cashier receipt verified", uFinance, "2026-02-12T10:00:00Z").lastInsertRowid);
    const insertRcpt = db.prepare("INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)");
    insertRcpt.run(p1, "RCPT-LGBS-2026-0001", uFinance);
    insertRcpt.run(p3, "RCPT-LGBS-2026-0002", uFinance);
    insertRcpt.run(p4, "RCPT-LGBS-2026-0003", uFinance);
    db.prepare(`
      INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
      VALUES ('CERT-LGBS-2026-001', ?, ?, 'Honor Roll', ?, 'issued')
    `).run(st1, year2026, uRegistrar);
    db.prepare(`
      INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
      VALUES ('CERT-LGBS-2026-002', ?, ?, 'Academic Completion', ?, 'issued')
    `).run(st3, year2026, uRegistrar);
    const insertAnn = db.prepare("INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, ?, ?, ?, ?)");
    insertAnn.run("2025/2026 Semester II Mid-Term Examination Schedule Released", "All Grade 9\u201312 boarding students must review their Natural Science and Social Science examination timetables via the student portal prior to Monday morning assembly.", "ALL", null, uAdmin, 1);
    insertAnn.run("Fee Verification Deadline for Semester II Report Cards", "Students with pending tuition reconciliation should submit bank deposit slips to the Finance Verification Office in Hosanna campus to unlock official report card downloads.", "STUDENT", null, uFinance, 1);
    insertAnn.run("Physics Lab Practical Session \u2014 Group B", "Please bring your lab manual and calculator for projectile motion verification in Science Lab B-02.", "STUDENT", cPhys, uInst1, 0);
    const insertNotif = db.prepare("INSERT INTO notifications (user_id, title, message, category, is_read) VALUES (?, ?, ?, ?, ?)");
    insertNotif.run(uStu1, "Semester II Grades Published", "Your PHYS-111 and MATH-111 marks have been posted and verified.", "grade", 0);
    insertNotif.run(uStu2, "Fee Clearance Pending", "Your Semester II payment (TBR-991042) is awaiting verification before official report cards unlock.", "finance", 0);
    insertNotif.run(uInst1, "New Submission Received", "Kinematics & Force Equilibrium Quiz is open for Grade 11 Natural Science.", "assessment", 0);
    const disc1 = Number(
      db.prepare("INSERT INTO discussions (course_id, author_user_id, title, body) VALUES (?, ?, ?, ?)").run(
        cPhys,
        uStu1,
        "Clarification on Projectile Range at Elevated Launch Height",
        "When a projectile is launched from a 15m platform at 30 degrees, should we use the quadratic time-of-flight equation instead of the symmetric ground range formula?"
      ).lastInsertRowid
    );
    db.prepare("INSERT INTO discussion_replies (discussion_id, author_user_id, body) VALUES (?, ?, ?)").run(
      disc1,
      uInst1,
      "Yes, Sara. The symmetric formula R = (v^2 sin 2\u03B8)/g only holds when \u0394y = 0. For elevated launches, solve y(t) = y0 + v0y*t - 0.5*g*t^2 = 0 first."
    );
    db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'SYSTEM_SEED', 'DATABASE', 'init', 'Initialized Lich Gogo Excellence Boarding School LMS sample dataset (Hosanna, Ethiopia)')").run(uAdmin);
    void sem1;
  });
  tx();
}

// server/routes/public.ts
import { Router } from "express";

// server/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "lich-gogo-hosanna-lms-secret-2026-dev";
var TOKEN_TTL_SECONDS = 60 * 60 * 4;
function signAuthToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}
function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function getUserPermissions(roleName) {
  const rows = db.prepare(
    `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = ?`
  ).all(roleName);
  return rows.map((r) => r.code);
}
function parseCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "lgbs_token") {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieToken = parseCookieToken(req.headers.cookie);
  const token = bearerToken || cookieToken;
  if (!token) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }
  const decoded = verifyAuthToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Session expired or invalid. Please log in again." });
    return;
  }
  const dbUser = db.prepare(
    `SELECT u.id, u.full_name, u.email, u.status, r.name as role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`
  ).get(decoded.userId);
  if (!dbUser || dbUser.status !== "active") {
    res.status(403).json({ error: "Account is inactive or unavailable." });
    return;
  }
  req.authUser = {
    userId: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name,
    role: dbUser.role_name,
    permissions: getUserPermissions(dbUser.role_name)
  };
  next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      logAudit(
        req.authUser.userId,
        "UNAUTHORIZED_ACCESS_ATTEMPT",
        "ROUTE",
        req.originalUrl,
        `Role ${req.authUser.role} denied access; required one of [${allowedRoles.join(", ")}]`,
        req.ip || ""
      );
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}.`
      });
      return;
    }
    next();
  };
}
function logAudit(userId, action, entityType, entityId = "", details = "", ipAddress = "") {
  try {
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, action, entityType, String(entityId), details, ipAddress);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
function sanitizeText(value, maxLen = 2e3) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim().slice(0, maxLen);
}

// server/routes/public.ts
var router = Router();
router.get("/overview", (_req, res) => {
  const settingsRows = db.prepare("SELECT key, value FROM school_settings").all();
  const settings = {};
  for (const row of settingsRows) settings[row.key] = row.value;
  const stats = {
    totalStudents: db.prepare("SELECT COUNT(*) as c FROM students WHERE enrollment_status = 'enrolled'").get().c,
    totalInstructors: db.prepare("SELECT COUNT(*) as c FROM instructors").get().c,
    totalCourses: db.prepare("SELECT COUNT(*) as c FROM courses").get().c,
    streamsCount: db.prepare("SELECT COUNT(*) as c FROM academic_streams").get().c
  };
  const streams = db.prepare("SELECT id, code, name, description FROM academic_streams").all();
  const courses = db.prepare(
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
       ORDER BY g.level_order, c.code`
  ).all();
  const announcements = db.prepare(
    `SELECT a.id, a.title, a.body, a.created_at, u.full_name as author_name, r.name as author_role
       FROM announcements a
       JOIN users u ON u.id = a.author_user_id
       JOIN roles r ON r.id = u.role_id
       WHERE a.is_public = 1
       ORDER BY a.created_at DESC
       LIMIT 6`
  ).all();
  res.json({ settings, stats, streams, courses, announcements });
});
router.post("/contact", (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160);
  const subject = sanitizeText(req.body?.subject, 160);
  const message = sanitizeText(req.body?.message, 2e3);
  if (!fullName || !email || !email.includes("@") || !subject || !message) {
    res.status(400).json({ error: "Please provide a valid name, email address, subject, and message." });
    return;
  }
  const result = db.prepare("INSERT INTO contact_messages (full_name, email, subject, message) VALUES (?, ?, ?, ?)").run(fullName, email, subject, message);
  res.status(201).json({
    id: result.lastInsertRowid,
    message: "Your inquiry has been received by the Lich Gogo Excellence Boarding School Admissions Office."
  });
});
var public_default = router;

// server/routes/auth.ts
import { Router as Router2 } from "express";
import bcrypt2 from "bcryptjs";
import crypto from "crypto";

// src/lib/gradingEngine.ts
function validateMark(mark) {
  if (typeof mark !== "number" || !Number.isFinite(mark)) {
    return { valid: false, error: "Mark must be a valid finite number." };
  }
  if (mark < 0 || mark > 100) {
    return { valid: false, error: "Mark must be between 0 and 100." };
  }
  const normalized = Math.round(mark * 100) / 100;
  return { valid: true, normalized };
}
function computeWeightedSubjectScore(marks, config, mode = "full") {
  const entries = [
    { score: marks.quizScore, weight: config.quizWeight },
    { score: marks.assignmentScore, weight: config.assignmentWeight },
    { score: marks.midtermScore, weight: config.midtermWeight },
    { score: marks.finalExamScore, weight: config.finalExamWeight }
  ];
  const totalConfigWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  if (totalConfigWeight <= 0) {
    return 0;
  }
  let weightedSum = 0;
  let activeWeight = 0;
  for (const item of entries) {
    if (item.score !== null && item.score !== void 0 && Number.isFinite(item.score)) {
      weightedSum += item.score * item.weight;
      activeWeight += item.weight;
    }
  }
  if (activeWeight === 0) return 0;
  const divisor = mode === "proportional" ? activeWeight : totalConfigWeight;
  const raw = weightedSum / divisor;
  return Math.round(raw * 100) / 100;
}
function resolveLetterGrade(score, scale) {
  const rounded = Math.round(score * 100) / 100;
  const sorted = [...scale].sort((a, b) => b.minScore - a.minScore);
  for (const band of sorted) {
    if (rounded >= band.minScore && rounded <= band.maxScore) {
      return {
        letterGrade: band.letterGrade,
        gradePoint: band.gradePoint,
        remark: band.remark
      };
    }
  }
  const fallback = sorted[sorted.length - 1];
  return fallback ? {
    letterGrade: fallback.letterGrade,
    gradePoint: fallback.gradePoint,
    remark: fallback.remark
  } : { letterGrade: "F", gradePoint: 0, remark: "Fail" };
}
function calculateSemesterTotalsAndGPA(subjects) {
  if (subjects.length === 0) {
    return { totalMarks: 0, averageScore: 0, gpa: 0 };
  }
  const totalMarks = Math.round(
    subjects.reduce((sum, s) => sum + s.totalScore, 0) * 100
  ) / 100;
  const averageScore = Math.round(totalMarks / subjects.length * 100) / 100;
  const totalCredits = subjects.reduce((sum, s) => sum + Math.max(1, s.creditHours), 0);
  const weightedPoints = subjects.reduce(
    (sum, s) => sum + s.gradePoint * Math.max(1, s.creditHours),
    0
  );
  const gpa = totalCredits > 0 ? Math.round(weightedPoints / totalCredits * 100) / 100 : 0;
  return { totalMarks, averageScore, gpa };
}
function calculateClassRankings(students) {
  const sorted = [...students].sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return b.totalMarks - a.totalMarks;
  });
  const results = [];
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && (sorted[i].averageScore !== sorted[i - 1].averageScore || sorted[i].totalMarks !== sorted[i - 1].totalMarks)) {
      currentRank = i + 1;
    }
    results.push({ studentId: sorted[i].studentId, rank: currentRank });
  }
  return results;
}
function hasFinancialClearance(payments, semesterId) {
  const scoped = semesterId !== void 0 ? payments.filter((p) => p.semesterId === semesterId) : payments;
  if (scoped.length === 0) {
    return {
      cleared: false,
      reason: "No verified tuition fee payment recorded for the current semester."
    };
  }
  const hasVerified = scoped.some((p) => p.status === "verified");
  const hasPending = scoped.some((p) => p.status === "pending");
  if (!hasVerified) {
    return {
      cleared: false,
      reason: hasPending ? "Your semester tuition payment is pending financial verification." : "Verified fee clearance is required before accessing final semester results and official report cards."
    };
  }
  if (hasPending) {
    return {
      cleared: false,
      reason: "An additional semester fee balance is currently pending financial verification."
    };
  }
  return { cleared: true };
}
function canSubmitAssessment(deadlineIso, allowLateSubmission, now = /* @__PURE__ */ new Date()) {
  const deadline = new Date(deadlineIso);
  if (Number.isNaN(deadline.getTime())) {
    return { allowed: false, isLate: false, reason: "Invalid assessment deadline." };
  }
  const isLate = now.getTime() > deadline.getTime();
  if (isLate && !allowLateSubmission) {
    return {
      allowed: false,
      isLate: true,
      reason: "Assessment submission deadline has passed and late submissions are disabled."
    };
  }
  return { allowed: true, isLate };
}
function calculateAttendanceSummary(records) {
  const totalDays = records.length;
  if (totalDays === 0) {
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      excusedDays: 0,
      attendancePercentage: 100
    };
  }
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let excusedDays = 0;
  for (const r of records) {
    if (r.status === "present") presentDays++;
    else if (r.status === "absent") absentDays++;
    else if (r.status === "late") lateDays++;
    else if (r.status === "excused") excusedDays++;
  }
  const attended = presentDays + lateDays + excusedDays;
  const attendancePercentage = Math.round(attended / totalDays * 1e4) / 100;
  return {
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    excusedDays,
    attendancePercentage
  };
}

// server/services/academicService.ts
function getActiveAcademicContext() {
  const year = db.prepare("SELECT id, name FROM academic_years WHERE is_active = 1 LIMIT 1").get();
  const fallbackYear = year || db.prepare("SELECT id, name FROM academic_years ORDER BY id DESC LIMIT 1").get();
  const semester = db.prepare(
    "SELECT id, name FROM semesters WHERE academic_year_id = ? AND is_active = 1 LIMIT 1"
  ).get(fallbackYear.id);
  const fallbackSemester = semester || db.prepare("SELECT id, name FROM semesters WHERE academic_year_id = ? ORDER BY id DESC LIMIT 1").get(fallbackYear.id);
  return {
    academicYearId: fallbackYear.id,
    academicYearName: fallbackYear.name,
    semesterId: fallbackSemester.id,
    semesterName: fallbackSemester.name
  };
}
function getGradingScale() {
  const rows = db.prepare(
    "SELECT id, letter_grade, min_score, max_score, grade_point, remark FROM grading_scales ORDER BY min_score DESC"
  ).all();
  return rows.map((r) => ({
    id: r.id,
    letterGrade: r.letter_grade,
    minScore: r.min_score,
    maxScore: r.max_score,
    gradePoint: r.grade_point,
    remark: r.remark
  }));
}
function getStreamWeightConfig(streamId) {
  const row = db.prepare(
    `SELECT s.code, c.quiz_weight, c.assignment_weight, c.midterm_weight, c.final_exam_weight, c.passing_score
       FROM stream_grading_configs c
       JOIN academic_streams s ON s.id = c.stream_id
       WHERE c.stream_id = ?`
  ).get(streamId);
  if (!row) {
    return {
      streamCode: "NATURAL_SCIENCE",
      quizWeight: 10,
      assignmentWeight: 15,
      midtermWeight: 25,
      finalExamWeight: 50,
      passingScore: 50
    };
  }
  return {
    streamCode: row.code,
    quizWeight: row.quiz_weight,
    assignmentWeight: row.assignment_weight,
    midtermWeight: row.midterm_weight,
    finalExamWeight: row.final_exam_weight,
    passingScore: row.passing_score
  };
}
function getStudentProfileById(studentId) {
  const row = db.prepare(
    `SELECT s.id, s.user_id, s.student_code, u.full_name, u.email, s.gender, s.date_of_birth,
              s.dormitory_block, s.guardian_name, s.guardian_phone, s.grade_id, g.name as grade_name,
              s.stream_id, st.code as stream_code, st.name as stream_name,
              s.academic_year_id, ay.name as academic_year_name, s.enrollment_status, s.is_sample_data
       FROM students s
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN academic_years ay ON ay.id = s.academic_year_id
       WHERE s.id = ?`
  ).get(studentId);
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
    isSampleData: Boolean(row.is_sample_data)
  };
}
function getStudentProfileByUserId(userId) {
  const row = db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId);
  return row ? getStudentProfileById(row.id) : null;
}
function recalculateAllGradesForSemester(semesterId) {
  const scale = getGradingScale();
  const records = db.prepare(
    `SELECT gr.id, gr.student_id, gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score, s.stream_id
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       WHERE gr.semester_id = ?`
  ).all(semesterId);
  const updateStmt = db.prepare(
    "UPDATE grades_records SET total_score = ?, letter_grade = ?, grade_point = ? WHERE id = ?"
  );
  const tx = db.transaction(() => {
    for (const r of records) {
      const cfg = getStreamWeightConfig(r.stream_id);
      const total = computeWeightedSubjectScore(
        {
          quizScore: r.quiz_score,
          assignmentScore: r.assignment_score,
          midtermScore: r.midterm_score,
          finalExamScore: r.final_exam_score
        },
        cfg,
        "full"
      );
      const resolved = resolveLetterGrade(total, scale);
      updateStmt.run(total, resolved.letterGrade, resolved.gradePoint, r.id);
    }
  });
  tx();
}
function buildStudentReportCard(studentId, semesterId, bypassClearanceForStaff = false) {
  const student = getStudentProfileById(studentId);
  if (!student) return null;
  const semRow = db.prepare(
    `SELECT sem.id, sem.name as semester_name, ay.name as academic_year_name
       FROM semesters sem
       JOIN academic_years ay ON ay.id = sem.academic_year_id
       WHERE sem.id = ?`
  ).get(semesterId);
  if (!semRow) return null;
  const payments = db.prepare("SELECT semester_id, status FROM payments WHERE student_id = ?").all(studentId);
  const clearance = hasFinancialClearance(
    payments.map((p) => ({ semesterId: p.semester_id, status: p.status })),
    semesterId
  );
  const streamConfig = getStreamWeightConfig(student.streamId);
  const attRows = db.prepare("SELECT status FROM attendance WHERE student_id = ?").all(studentId);
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
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const gradeRows = db.prepare(
    `SELECT gr.course_id, c.code as course_code, c.title as course_title, c.credit_hours,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM grades_records gr
       JOIN courses c ON c.id = gr.course_id
       WHERE gr.student_id = ? AND gr.semester_id = ?
       ORDER BY c.code`
  ).all(studentId, semesterId);
  const subjects = gradeRows.map((r) => ({
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
    verifiedByRegistrar: Boolean(r.verified_by_registrar)
  }));
  const summary = calculateSemesterTotalsAndGPA(subjects);
  const classmates = db.prepare(
    `SELECT s.id as student_id
       FROM students s
       WHERE s.grade_id = ? AND s.stream_id = ? AND s.enrollment_status = 'enrolled'`
  ).all(student.gradeId, student.streamId);
  const classInputs = classmates.map((peer) => {
    const peerGrades = db.prepare(
      `SELECT gr.total_score, c.credit_hours, gr.grade_point
         FROM grades_records gr
         JOIN courses c ON c.id = gr.course_id
         WHERE gr.student_id = ? AND gr.semester_id = ?`
    ).all(peer.student_id, semesterId);
    const peerSummary = calculateSemesterTotalsAndGPA(
      peerGrades.map((g) => ({
        totalScore: g.total_score,
        creditHours: g.credit_hours,
        gradePoint: g.grade_point
      }))
    );
    return {
      studentId: peer.student_id,
      averageScore: peerSummary.averageScore,
      totalMarks: peerSummary.totalMarks
    };
  });
  const rankings = calculateClassRankings(classInputs);
  const myRank = rankings.find((r) => r.studentId === studentId)?.rank ?? null;
  return {
    cleared: clearance.cleared,
    clearanceReason: clearance.cleared ? void 0 : clearance.reason,
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
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/routes/auth.ts
var router2 = Router2();
router2.post("/login", (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  const user = db.prepare(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.status, u.phone, u.is_sample_data, u.created_at,
              r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE lower(u.email) = ?`
  ).get(email);
  if (!user || !bcrypt2.compareSync(password, user.password_hash)) {
    logAudit(null, "LOGIN_FAILED", "AUTH", email, "Invalid credentials", req.ip || "");
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Your account has been deactivated. Contact the school administrator." });
    return;
  }
  const permissions = getUserPermissions(user.role_name);
  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role_name,
    permissions
  });
  logAudit(user.id, "LOGIN_SUCCESS", "AUTH", user.id, `Logged in as ${user.role_name}`, req.ip || "");
  res.cookie("lgbs_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 4 * 60 * 60 * 1e3
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
      permissions
    }
  });
});
router2.post("/register", (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const gender = req.body?.gender === "Female" ? "Female" : "Male";
  const dateOfBirth = sanitizeText(req.body?.dateOfBirth, 20) || "2008-01-15";
  const gradeId = Number(req.body?.gradeId || 3);
  const streamCode = req.body?.streamCode === "SOCIAL_SCIENCE" ? "SOCIAL_SCIENCE" : "NATURAL_SCIENCE";
  const guardianName = sanitizeText(req.body?.guardianName, 120) || "Parent / Guardian";
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40) || "+251900000000";
  const customStudentCode = sanitizeText(req.body?.studentCode, 40);
  if (!fullName || !email || !email.includes("@") || password.length < 6) {
    res.status(400).json({
      error: "Valid full name, email address, and password (at least 6 characters) are required."
    });
    return;
  }
  const existingEmail = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
  if (existingEmail) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }
  if (customStudentCode) {
    const dupCode = db.prepare("SELECT id FROM students WHERE student_code = ?").get(customStudentCode);
    if (dupCode) {
      res.status(409).json({ error: `Student ID ${customStudentCode} is already registered.` });
      return;
    }
  }
  const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'STUDENT'").get();
  const streamRow = db.prepare("SELECT id FROM academic_streams WHERE code = ?").get(streamCode);
  const ctx = getActiveAcademicContext();
  const hash = bcrypt2.hashSync(password, 8);
  const tx = db.transaction(() => {
    const userRes = db.prepare(
      "INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)"
    ).run(fullName, email, hash, roleRow.id, guardianPhone);
    const userId = Number(userRes.lastInsertRowid);
    const count = db.prepare("SELECT COUNT(*) as c FROM students").get().c;
    const studentCode = customStudentCode || `LGBS-2026-${String(count + 1).padStart(3, "0")}`;
    const stuRes = db.prepare(
      `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, ?, ?, 'Pending Dorm Assignment', ?, ?, ?, ?, ?, 'enrolled', 0)`
    ).run(userId, studentCode, gender, dateOfBirth, guardianName, guardianPhone, gradeId, streamRow.id, ctx.academicYearId);
    db.prepare(
      `INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes)
       VALUES (?, ?, ?, 14500, 'Bank Deposit', ?, 'pending', 'Initial semester tuition fee awaiting verification')`
    ).run(
      Number(stuRes.lastInsertRowid),
      ctx.academicYearId,
      ctx.semesterId,
      `REG-${Date.now()}-${userId}`
    );
    logAudit(userId, "STUDENT_SELF_REGISTER", "STUDENT", studentCode, `Registered in ${streamCode}`, req.ip || "");
    return { userId, studentCode };
  });
  const created = tx();
  const permissions = getUserPermissions("STUDENT");
  const token = signAuthToken({
    userId: created.userId,
    email,
    fullName,
    role: "STUDENT",
    permissions
  });
  res.cookie("lgbs_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 4 * 60 * 60 * 1e3
  });
  res.status(201).json({
    token,
    studentCode: created.studentCode,
    user: {
      id: created.userId,
      fullName,
      email,
      role: "STUDENT",
      status: "active",
      isSampleData: false,
      permissions
    }
  });
});
router2.post("/forgot-password", (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  if (!email) {
    res.status(400).json({ error: "Email is required." });
    return;
  }
  const user = db.prepare("SELECT id, email FROM users WHERE lower(email) = ?").get(email);
  if (!user) {
    res.json({
      message: "If an account matches that email, a password reset code has been generated."
    });
    return;
  }
  const resetToken = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
  db.prepare("INSERT INTO password_resets (user_id, reset_token, expires_at) VALUES (?, ?, ?)").run(
    user.id,
    resetToken,
    expiresAt
  );
  logAudit(user.id, "PASSWORD_RESET_REQUEST", "AUTH", user.id, "Generated password reset code", req.ip || "");
  res.json({
    message: "Password reset code generated (valid for 30 minutes).",
    // Provided in response because external SMTP is not configured in sandbox
    resetCodePreview: resetToken
  });
});
router2.post("/reset-password", (req, res) => {
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const token = sanitizeText(req.body?.resetCode, 32).toUpperCase();
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!email || !token || newPassword.length < 6) {
    res.status(400).json({ error: "Email, valid reset code, and new password (6+ chars) are required." });
    return;
  }
  const row = db.prepare(
    `SELECT pr.id, pr.user_id, pr.expires_at, pr.used
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE lower(u.email) = ? AND pr.reset_token = ?
       ORDER BY pr.id DESC LIMIT 1`
  ).get(email, token);
  if (!row || row.used || new Date(row.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "Invalid or expired reset code." });
    return;
  }
  const hash = bcrypt2.hashSync(newPassword, 8);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
    db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(row.id);
    logAudit(row.user_id, "PASSWORD_RESET_COMPLETE", "AUTH", row.user_id, "Password updated via reset token", req.ip || "");
  });
  tx();
  res.json({ message: "Password updated successfully. You may now sign in." });
});
router2.post("/logout", (req, res) => {
  res.clearCookie("lgbs_token");
  res.json({ message: "Signed out securely." });
});
router2.get("/session", (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieHeader = req.headers.cookie;
  let cookieToken = null;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k === "lgbs_token") cookieToken = decodeURIComponent(rest.join("="));
    }
  }
  const token = bearerToken || cookieToken;
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  requireAuth(req, res, () => {
    const user = req.authUser;
    const notifications = db.prepare(
      "SELECT id, user_id, title, message, category, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
    ).all(user.userId);
    res.json({
      authenticated: true,
      user,
      notifications,
      activeContext: getActiveAcademicContext()
    });
  });
});
router2.get("/me", requireAuth, (req, res) => {
  const user = req.authUser;
  const notifications = db.prepare(
    "SELECT id, user_id, title, message, category, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20"
  ).all(user.userId);
  res.json({
    user,
    notifications,
    activeContext: getActiveAcademicContext()
  });
});
router2.patch("/notifications/:id/read", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(
    id,
    req.authUser.userId
  );
  res.json({ success: true });
});
router2.get("/meta", requireAuth, (_req, res) => {
  const grades = db.prepare("SELECT id, name, level_order FROM grades ORDER BY level_order").all();
  const streams = db.prepare("SELECT id, code, name, description FROM academic_streams ORDER BY id").all();
  const categories = db.prepare("SELECT id, name, description FROM course_categories ORDER BY name").all();
  const academicYears = db.prepare("SELECT id, name, start_date, end_date, is_active FROM academic_years ORDER BY id DESC").all();
  const semesters = db.prepare("SELECT id, academic_year_id, name, start_date, end_date, is_active FROM semesters ORDER BY id DESC").all();
  res.json({
    grades,
    streams,
    categories,
    academicYears,
    semesters,
    activeContext: getActiveAcademicContext()
  });
});
var auth_default = router2;

// server/routes/admin.ts
import { Router as Router3 } from "express";
import bcrypt3 from "bcryptjs";
var router3 = Router3();
router3.use(requireAuth, requireRole("ADMIN"));
router3.get("/dashboard", (_req, res) => {
  const ctx = getActiveAcademicContext();
  const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE enrollment_status = 'enrolled'").get().c;
  const totalInstructors = db.prepare("SELECT COUNT(*) as c FROM instructors").get().c;
  const totalCourses = db.prepare("SELECT COUNT(*) as c FROM courses").get().c;
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const activeCourses = db.prepare("SELECT COUNT(DISTINCT course_id) as c FROM course_assignments WHERE semester_id = ?").get(ctx.semesterId).c;
  const pendingPayments = db.prepare("SELECT COUNT(*) as c FROM payments WHERE status = 'pending'").get().c;
  const streamPerformance = db.prepare(
    `SELECT st.name as stream_name, ROUND(AVG(gr.total_score), 2) as avg_score, COUNT(DISTINCT gr.student_id) as student_count
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       JOIN academic_streams st ON st.id = s.stream_id
       WHERE gr.semester_id = ?
       GROUP BY st.id`
  ).all(ctx.semesterId);
  const gradeDistribution = db.prepare(
    `SELECT g.name as grade_name, COUNT(s.id) as student_count
       FROM grades g
       LEFT JOIN students s ON s.grade_id = g.id AND s.enrollment_status = 'enrolled'
       GROUP BY g.id
       ORDER BY g.level_order`
  ).all();
  const recentActivities = db.prepare(
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.created_at,
              COALESCE(u.full_name, 'System') as actor_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.id DESC LIMIT 12`
  ).all();
  res.json({
    kpis: {
      totalStudents,
      totalInstructors,
      totalCourses,
      totalUsers,
      activeCourses,
      pendingPayments
    },
    streamPerformance,
    gradeDistribution,
    recentActivities
  });
});
router3.get("/users", (_req, res) => {
  const users = db.prepare(
    `SELECT u.id, u.full_name, u.email, r.name as role, u.phone, u.status, u.is_sample_data, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.id DESC`
  ).all();
  res.json({ users });
});
router3.post("/users", (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const roleName = sanitizeText(req.body?.role, 32).toUpperCase();
  const phone = sanitizeText(req.body?.phone, 40);
  if (!fullName || !email || !email.includes("@") || password.length < 6 || !roleName) {
    res.status(400).json({ error: "Valid name, email, role, and 6+ character password are required." });
    return;
  }
  const role = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName);
  if (!role) {
    res.status(400).json({ error: "Invalid role specified." });
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
  if (exists) {
    res.status(409).json({ error: "Email is already registered." });
    return;
  }
  const hash = bcrypt3.hashSync(password, 8);
  const ctx = getActiveAcademicContext();
  const createdId = db.transaction(() => {
    const uRes = db.prepare("INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)").run(fullName, email, hash, role.id, phone);
    const uid = Number(uRes.lastInsertRowid);
    if (roleName === "INSTRUCTOR") {
      const dept = sanitizeText(req.body?.department, 120) || "General Academics";
      const qual = sanitizeText(req.body?.qualification, 120) || "B.Sc / B.Ed";
      db.prepare("INSERT INTO instructors (user_id, employee_code, department, qualification, is_sample_data) VALUES (?, ?, ?, ?, 0)").run(
        uid,
        `INST-2026-${String(uid).padStart(3, "0")}`,
        dept,
        qual
      );
    } else if (roleName === "STUDENT") {
      const gradeId = Number(req.body?.gradeId || 3);
      const streamCode = req.body?.streamCode === "SOCIAL_SCIENCE" ? "SOCIAL_SCIENCE" : "NATURAL_SCIENCE";
      const stream = db.prepare("SELECT id FROM academic_streams WHERE code = ?").get(streamCode);
      db.prepare(
        `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, 'Male', '2008-05-01', 'Block A', 'Guardian', ?, ?, ?, ?, 'enrolled', 0)`
      ).run(uid, `LGBS-2026-${String(uid).padStart(3, "0")}`, phone, gradeId, stream.id, ctx.academicYearId);
    }
    logAudit(req.authUser.userId, "USER_CREATE", "USER", uid, `Created user ${email} (${roleName})`, req.ip || "");
    return uid;
  })();
  res.status(201).json({ id: createdId, message: "User account created successfully." });
});
router3.patch("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const fullName = sanitizeText(req.body?.fullName, 120);
  const phone = sanitizeText(req.body?.phone, 40);
  const status = req.body?.status === "inactive" ? "inactive" : "active";
  const roleName = sanitizeText(req.body?.role, 32).toUpperCase();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (roleName) {
    const role = db.prepare("SELECT id FROM roles WHERE name = ?").get(roleName);
    if (!role) {
      res.status(400).json({ error: "Invalid role." });
      return;
    }
    db.prepare("UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name), phone = ?, status = ?, role_id = ? WHERE id = ?").run(
      fullName,
      phone,
      status,
      role.id,
      id
    );
  } else {
    db.prepare("UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name), phone = ?, status = ? WHERE id = ?").run(
      fullName,
      phone,
      status,
      id
    );
  }
  if (typeof req.body?.newPassword === "string" && req.body.newPassword.length >= 6) {
    const hash = bcrypt3.hashSync(req.body.newPassword, 8);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  }
  logAudit(req.authUser.userId, "USER_UPDATE", "USER", id, `Updated user status=${status}`, req.ip || "");
  res.json({ message: "User account updated." });
});
router3.delete("/users/:id", (req, res) => {
  const id = Number(req.params.id);
  if (id === req.authUser.userId) {
    res.status(400).json({ error: "You cannot delete your own active administrator account." });
    return;
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  logAudit(req.authUser.userId, "USER_DELETE", "USER", id, "Deleted user account", req.ip || "");
  res.json({ message: "User account deleted." });
});
router3.get("/roles-permissions", (_req, res) => {
  const roles = db.prepare("SELECT id, name, description FROM roles ORDER BY id").all();
  const permissions = db.prepare("SELECT id, code, module, description FROM permissions ORDER BY module, id").all();
  const mappings = db.prepare("SELECT role_id, permission_id FROM role_permissions").all();
  res.json({ roles, permissions, mappings });
});
router3.put("/roles-permissions/:roleId", (req, res) => {
  const roleId = Number(req.params.roleId);
  const permissionIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(Number).filter(Number.isFinite) : [];
  db.transaction(() => {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(roleId);
    const ins = db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
    for (const pid of permissionIds) ins.run(roleId, pid);
    logAudit(req.authUser.userId, "ROLE_PERMISSIONS_UPDATE", "ROLE", roleId, `Assigned ${permissionIds.length} permissions`, req.ip || "");
  })();
  res.json({ message: "Role permissions updated." });
});
router3.get("/categories", (_req, res) => {
  const categories = db.prepare("SELECT id, name, description FROM course_categories ORDER BY name").all();
  res.json({ categories });
});
router3.post("/categories", (req, res) => {
  const name = sanitizeText(req.body?.name, 100);
  const description = sanitizeText(req.body?.description, 300);
  if (!name) {
    res.status(400).json({ error: "Category name is required." });
    return;
  }
  try {
    const r = db.prepare("INSERT INTO course_categories (name, description) VALUES (?, ?)").run(name, description);
    logAudit(req.authUser.userId, "CATEGORY_CREATE", "COURSE_CATEGORY", Number(r.lastInsertRowid), name, req.ip || "");
    res.status(201).json({ id: r.lastInsertRowid, message: "Course category added." });
  } catch {
    res.status(409).json({ error: "Category already exists." });
  }
});
router3.delete("/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const inUse = db.prepare("SELECT COUNT(*) as c FROM courses WHERE category_id = ?").get(id).c;
  if (inUse > 0) {
    res.status(409).json({ error: "Cannot delete a category currently assigned to courses." });
    return;
  }
  db.prepare("DELETE FROM course_categories WHERE id = ?").run(id);
  res.json({ message: "Category removed." });
});
router3.get("/courses", (_req, res) => {
  const ctx = getActiveAcademicContext();
  const courses = db.prepare(
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
       ORDER BY g.level_order, c.code`
  ).all(ctx.semesterId, ctx.semesterId);
  const instructors = db.prepare(
    `SELECT i.id, i.employee_code, u.full_name, i.department
       FROM instructors i JOIN users u ON u.id = i.user_id
       WHERE u.status = 'active'
       ORDER BY u.full_name`
  ).all();
  const schedules = db.prepare(
    `SELECT s.id, s.course_id, c.code as course_code, c.title as course_title,
              g.name as grade_name, s.day_of_week, s.start_time, s.end_time, s.room
       FROM schedules s
       JOIN courses c ON c.id = s.course_id
       JOIN grades g ON g.id = c.grade_id
       WHERE s.semester_id = ?
       ORDER BY s.day_of_week, s.start_time`
  ).all(ctx.semesterId);
  res.json({ courses, instructors, schedules });
});
router3.post("/courses", (req, res) => {
  const code = sanitizeText(req.body?.code, 24).toUpperCase();
  const title = sanitizeText(req.body?.title, 150);
  const description = sanitizeText(req.body?.description, 1e3);
  const categoryId = Number(req.body?.categoryId);
  const gradeId = Number(req.body?.gradeId);
  const streamId = req.body?.streamId ? Number(req.body.streamId) : null;
  const creditHours = Number(req.body?.creditHours || 4);
  const instructorId = req.body?.instructorId ? Number(req.body.instructorId) : null;
  if (!code || !title || !categoryId || !gradeId) {
    res.status(400).json({ error: "Course code, title, category, and grade level are required." });
    return;
  }
  const ctx = getActiveAcademicContext();
  try {
    const courseId = db.transaction(() => {
      const cRes = db.prepare(
        "INSERT INTO courses (code, title, description, category_id, grade_id, stream_id, credit_hours, is_sample_data) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
      ).run(code, title, description, categoryId, gradeId, streamId, creditHours);
      const cid = Number(cRes.lastInsertRowid);
      if (instructorId) {
        db.prepare("INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)").run(
          cid,
          instructorId,
          ctx.academicYearId,
          ctx.semesterId
        );
      }
      logAudit(req.authUser.userId, "COURSE_CREATE", "COURSE", code, title, req.ip || "");
      return cid;
    })();
    res.status(201).json({ id: courseId, message: "Academic course created." });
  } catch {
    res.status(409).json({ error: `Course code ${code} already exists.` });
  }
});
router3.post("/courses/:id/assign-instructor", (req, res) => {
  const courseId = Number(req.params.id);
  const instructorId = Number(req.body?.instructorId);
  const ctx = getActiveAcademicContext();
  db.prepare(
    `INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(course_id, academic_year_id, semester_id) DO UPDATE SET instructor_id = excluded.instructor_id`
  ).run(courseId, instructorId, ctx.academicYearId, ctx.semesterId);
  logAudit(req.authUser.userId, "INSTRUCTOR_ASSIGN", "COURSE", courseId, `Assigned instructor #${instructorId}`, req.ip || "");
  res.json({ message: "Instructor assigned to course." });
});
router3.post("/schedules", (req, res) => {
  const courseId = Number(req.body?.courseId);
  const dayOfWeek = sanitizeText(req.body?.dayOfWeek, 20);
  const startTime = sanitizeText(req.body?.startTime, 10);
  const endTime = sanitizeText(req.body?.endTime, 10);
  const room = sanitizeText(req.body?.room, 80);
  const ctx = getActiveAcademicContext();
  if (!courseId || !dayOfWeek || !startTime || !endTime || !room) {
    res.status(400).json({ error: "All class schedule fields are required." });
    return;
  }
  const r = db.prepare("INSERT INTO schedules (course_id, semester_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)").run(courseId, ctx.semesterId, dayOfWeek, startTime, endTime, room);
  res.status(201).json({ id: r.lastInsertRowid, message: "Class schedule added." });
});
router3.delete("/schedules/:id", (req, res) => {
  db.prepare("DELETE FROM schedules WHERE id = ?").run(Number(req.params.id));
  res.json({ message: "Schedule entry deleted." });
});
router3.get("/system-config", (_req, res) => {
  const settings = db.prepare("SELECT key, value FROM school_settings").all();
  const gradingScales = db.prepare("SELECT id, letter_grade, min_score, max_score, grade_point, remark FROM grading_scales ORDER BY min_score DESC").all();
  const streamConfigs = db.prepare(
    `SELECT c.id, c.stream_id, s.code as stream_code, s.name as stream_name,
              c.quiz_weight, c.assignment_weight, c.midterm_weight, c.final_exam_weight, c.passing_score
       FROM stream_grading_configs c
       JOIN academic_streams s ON s.id = c.stream_id`
  ).all();
  const academicYears = db.prepare("SELECT * FROM academic_years ORDER BY id DESC").all();
  const semesters = db.prepare("SELECT * FROM semesters ORDER BY id DESC").all();
  res.json({ settings, gradingScales, streamConfigs, academicYears, semesters });
});
router3.put("/system-config/stream-weights/:streamId", (req, res) => {
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
     WHERE stream_id = ?`
  ).run(quizWeight, assignmentWeight, midtermWeight, finalExamWeight, passingScore, streamId);
  const ctx = getActiveAcademicContext();
  recalculateAllGradesForSemester(ctx.semesterId);
  logAudit(req.authUser.userId, "STREAM_GRADING_CONFIG_UPDATE", "STREAM", streamId, `Updated weights (${quizWeight}/${assignmentWeight}/${midtermWeight}/${finalExamWeight}), pass=${passingScore}`, req.ip || "");
  res.json({ message: "Stream grading weights updated and semester grades recalculated." });
});
router3.put("/system-config/settings", (req, res) => {
  const updates = req.body?.settings;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }
  const stmt = db.prepare("INSERT INTO school_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [k, v] of Object.entries(updates)) {
    stmt.run(sanitizeText(k, 80), sanitizeText(String(v), 500));
  }
  logAudit(req.authUser.userId, "SETTINGS_UPDATE", "SYSTEM", "school_settings", "Updated institutional settings", req.ip || "");
  res.json({ message: "School settings saved." });
});
router3.post("/semesters/:id/activate", (req, res) => {
  const id = Number(req.params.id);
  db.transaction(() => {
    db.prepare("UPDATE semesters SET is_active = 0").run();
    db.prepare("UPDATE semesters SET is_active = 1 WHERE id = ?").run(id);
  })();
  logAudit(req.authUser.userId, "SEMESTER_ACTIVATE", "SEMESTER", id, "Activated semester", req.ip || "");
  res.json({ message: "Active semester switched." });
});
router3.get("/audit-logs", (_req, res) => {
  const logs = db.prepare(
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at,
              COALESCE(u.full_name, 'Anonymous') as actor_name, COALESCE(r.name, '-') as actor_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY al.id DESC LIMIT 100`
  ).all();
  res.json({ logs });
});
router3.get("/backup", (req, res) => {
  const tables = [
    "users",
    "students",
    "instructors",
    "courses",
    "course_categories",
    "student_enrollments",
    "assessments",
    "grades_records",
    "attendance",
    "payments",
    "payment_receipts",
    "certificates",
    "announcements"
  ];
  const snapshot = {};
  for (const t of tables) {
    snapshot[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  logAudit(req.authUser.userId, "SYSTEM_BACKUP_EXPORT", "SYSTEM", "full_json", "Exported database backup snapshot", req.ip || "");
  res.json({
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    institution: "Lich Gogo Excellence Boarding School \u2014 Hosanna",
    snapshot
  });
});
router3.get("/reports", (_req, res) => {
  const ctx = getActiveAcademicContext();
  const enrollmentReport = db.prepare(
    `SELECT g.name as grade_name, st.name as stream_name, COUNT(s.id) as total_students
       FROM students s
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       WHERE s.enrollment_status = 'enrolled'
       GROUP BY g.id, st.id
       ORDER BY g.level_order`
  ).all();
  const instructorReport = db.prepare(
    `SELECT u.full_name, i.employee_code, i.department, COUNT(DISTINCT ca.course_id) as assigned_courses
       FROM instructors i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN course_assignments ca ON ca.instructor_id = i.id AND ca.semester_id = ?
       GROUP BY i.id`
  ).all(ctx.semesterId);
  const coursePerformanceReport = db.prepare(
    `SELECT c.code, c.title, COUNT(gr.id) as graded_students,
              ROUND(AVG(gr.total_score), 2) as average_score,
              ROUND(MIN(gr.total_score), 2) as min_score,
              ROUND(MAX(gr.total_score), 2) as max_score
       FROM courses c
       LEFT JOIN grades_records gr ON gr.course_id = c.id AND gr.semester_id = ?
       GROUP BY c.id
       ORDER BY c.code`
  ).all(ctx.semesterId);
  const attendanceReport = db.prepare(
    `SELECT attendance_type, status, COUNT(*) as total_count
       FROM attendance
       GROUP BY attendance_type, status`
  ).all();
  res.json({
    context: ctx,
    enrollmentReport,
    instructorReport,
    coursePerformanceReport,
    attendanceReport
  });
});
router3.post("/announcements", (req, res) => {
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2e3);
  const targetRole = sanitizeText(req.body?.targetRole, 20) || "ALL";
  const isPublic = req.body?.isPublic ? 1 : 0;
  if (!title || !body) {
    res.status(400).json({ error: "Announcement title and body are required." });
    return;
  }
  const r = db.prepare("INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, ?, NULL, ?, ?)").run(title, body, targetRole, req.authUser.userId, isPublic);
  logAudit(req.authUser.userId, "ANNOUNCEMENT_CREATE", "ANNOUNCEMENT", Number(r.lastInsertRowid), title, req.ip || "");
  res.status(201).json({ id: r.lastInsertRowid, message: "Institutional announcement published." });
});
var admin_default = router3;

// server/routes/instructor.ts
import { Router as Router4 } from "express";
import fs2 from "fs";
import path2 from "path";
var router4 = Router4();
router4.use(requireAuth, requireRole("INSTRUCTOR", "ADMIN"));
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".pdf", ".txt", ".md", ".ppt", ".pptx", ".doc", ".docx", ".mp4"]);
function getInstructorIdByUserId(userId) {
  const row = db.prepare("SELECT id FROM instructors WHERE user_id = ?").get(userId);
  return row ? row.id : null;
}
function ensureCourseAccess(req, courseId) {
  if (req.authUser.role === "ADMIN") return true;
  const instId = getInstructorIdByUserId(req.authUser.userId);
  if (!instId) return false;
  const ctx = getActiveAcademicContext();
  const row = db.prepare("SELECT id FROM course_assignments WHERE course_id = ? AND instructor_id = ? AND semester_id = ?").get(courseId, instId, ctx.semesterId);
  return Boolean(row);
}
router4.get("/dashboard", (req, res) => {
  const ctx = getActiveAcademicContext();
  const instId = getInstructorIdByUserId(req.authUser.userId);
  const courses = instId ? db.prepare(
    `SELECT c.id, c.code, c.title, c.description, g.name as grade_name, st.name as stream_name,
                  (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.semester_id = ?) as enrolled_count
           FROM course_assignments ca
           JOIN courses c ON c.id = ca.course_id
           JOIN grades g ON g.id = c.grade_id
           LEFT JOIN academic_streams st ON st.id = c.stream_id
           WHERE ca.instructor_id = ? AND ca.semester_id = ?
           ORDER BY c.code`
  ).all(ctx.semesterId, instId, ctx.semesterId) : db.prepare(
    `SELECT c.id, c.code, c.title, c.description, g.name as grade_name, st.name as stream_name,
                  (SELECT COUNT(*) FROM student_enrollments se WHERE se.course_id = c.id AND se.semester_id = ?) as enrolled_count
           FROM courses c
           JOIN grades g ON g.id = c.grade_id
           LEFT JOIN academic_streams st ON st.id = c.stream_id`
  ).all(ctx.semesterId);
  const courseIds = courses.map((c) => c.id);
  const placeholders = courseIds.length ? courseIds.map(() => "?").join(",") : "-1";
  const assessments = db.prepare(
    `SELECT a.*, c.code as course_code, c.title as course_title,
              (SELECT COUNT(*) FROM student_submissions ss WHERE ss.assessment_id = a.id) as submission_count,
              (SELECT COUNT(*) FROM student_submissions ss WHERE ss.assessment_id = a.id AND ss.status = 'submitted') as pending_grading_count
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.course_id IN (${placeholders}) AND a.semester_id = ?
       ORDER BY a.deadline ASC`
  ).all(...courseIds, ctx.semesterId);
  const announcements = db.prepare(
    `SELECT a.id, a.title, a.body, a.course_id, c.title as course_title, a.created_at, u.full_name as author_name
       FROM announcements a
       LEFT JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = a.author_user_id
       WHERE a.target_role IN ('ALL', 'INSTRUCTOR') OR a.author_user_id = ?
       ORDER BY a.created_at DESC LIMIT 10`
  ).all(req.authUser.userId);
  const courseStats = db.prepare(
    `SELECT c.code, c.title, ROUND(AVG(gr.total_score), 2) as avg_score, COUNT(gr.id) as graded_count
       FROM courses c
       LEFT JOIN grades_records gr ON gr.course_id = c.id AND gr.semester_id = ?
       WHERE c.id IN (${placeholders})
       GROUP BY c.id`
  ).all(ctx.semesterId, ...courseIds);
  res.json({ courses, assessments, announcements, courseStats, activeContext: ctx });
});
router4.get("/courses/:courseId/students", (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "You are not assigned to this course." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const students = db.prepare(
    `SELECT s.id as student_id, s.student_code, u.full_name, u.email, g.name as grade_name, st.name as stream_name,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM student_enrollments se
       JOIN students s ON s.id = se.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       LEFT JOIN grades_records gr ON gr.student_id = s.id AND gr.course_id = se.course_id AND gr.semester_id = se.semester_id
       WHERE se.course_id = ? AND se.semester_id = ? AND se.status = 'active'
       ORDER BY u.full_name`
  ).all(courseId, ctx.semesterId);
  const materials = db.prepare(
    `SELECT cm.id, cm.course_id, cm.title, cm.material_type, cm.description, cm.file_name, cm.file_size_bytes, cm.created_at,
              u.full_name as uploaded_by_name
       FROM course_materials cm
       JOIN users u ON u.id = cm.uploaded_by_user_id
       WHERE cm.course_id = ?
       ORDER BY cm.created_at DESC`
  ).all(courseId);
  res.json({ students, materials });
});
router4.post("/courses/:courseId/materials", (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "You are not assigned to this course." });
    return;
  }
  const title = sanitizeText(req.body?.title, 160);
  const materialType = req.body?.materialType;
  const description = sanitizeText(req.body?.description, 600);
  const rawFileName = sanitizeText(req.body?.fileName, 140) || "lecture-notes.txt";
  const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64 : "";
  if (!title || !["pdf", "presentation", "video", "document"].includes(materialType)) {
    res.status(400).json({ error: "Valid material title and type are required." });
    return;
  }
  const ext = path2.extname(rawFileName).toLowerCase() || ".txt";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    res.status(400).json({ error: `Unsupported file type ${ext}. Allowed: pdf, ppt/pptx, doc/docx, txt, md, mp4.` });
    return;
  }
  const safeBase = path2.basename(rawFileName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const finalName = `${safeBase}_${Date.now()}${ext}`;
  const courseDir = path2.join(UPLOAD_DIR, `course_${courseId}`);
  if (!fs2.existsSync(courseDir)) fs2.mkdirSync(courseDir, { recursive: true });
  const storedPath = path2.join(courseDir, finalName);
  const buffer = contentBase64 ? Buffer.from(contentBase64, "base64") : Buffer.from(`Lich Gogo Excellence Boarding School
Course Material: ${title}

${description}
`, "utf-8");
  if (buffer.byteLength > 5 * 1024 * 1024) {
    res.status(400).json({ error: "File size exceeds 5MB limit." });
    return;
  }
  fs2.writeFileSync(storedPath, buffer);
  const r = db.prepare(
    `INSERT INTO course_materials (course_id, uploaded_by_user_id, title, material_type, description, file_name, stored_path, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(courseId, req.authUser.userId, title, materialType, description, rawFileName, storedPath, buffer.byteLength);
  logAudit(req.authUser.userId, "MATERIAL_UPLOAD", "COURSE_MATERIAL", Number(r.lastInsertRowid), `${title} (${rawFileName})`, req.ip || "");
  res.status(201).json({ id: r.lastInsertRowid, message: "Learning material uploaded." });
});
router4.delete("/materials/:id", (req, res) => {
  const id = Number(req.params.id);
  const mat = db.prepare("SELECT id, course_id, stored_path FROM course_materials WHERE id = ?").get(id);
  if (!mat) {
    res.status(404).json({ error: "Material not found." });
    return;
  }
  if (!ensureCourseAccess(req, mat.course_id)) {
    res.status(403).json({ error: "Not authorized to remove this material." });
    return;
  }
  db.prepare("DELETE FROM course_materials WHERE id = ?").run(id);
  res.json({ message: "Learning material deleted." });
});
router4.post("/assessments", (req, res) => {
  const courseId = Number(req.body?.courseId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "You are not assigned to this course." });
    return;
  }
  const title = sanitizeText(req.body?.title, 180);
  const assessmentType = req.body?.assessmentType;
  const description = sanitizeText(req.body?.description, 800);
  const totalMarks = Number(req.body?.totalMarks || 100);
  const durationMinutes = Number(req.body?.durationMinutes || 30);
  const deadline = sanitizeText(req.body?.deadline, 40);
  const allowLate = req.body?.allowLateSubmission ? 1 : 0;
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
  if (!title || !["quiz", "assignment", "midterm", "final_exam"].includes(assessmentType) || !deadline) {
    res.status(400).json({ error: "Title, assessment type, and deadline are required." });
    return;
  }
  if (totalMarks <= 0 || totalMarks > 100) {
    res.status(400).json({ error: "Total marks must be between 1 and 100." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const assessmentId = db.transaction(() => {
    const aRes = db.prepare(
      `INSERT INTO assessments (course_id, semester_id, created_by_user_id, title, assessment_type, description, total_marks, duration_minutes, deadline, allow_late_submission, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(courseId, ctx.semesterId, req.authUser.userId, title, assessmentType, description, totalMarks, durationMinutes, deadline, allowLate);
    const aid = Number(aRes.lastInsertRowid);
    const insQ = db.prepare(
      "INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_option, max_marks) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const q of questions) {
      const qText = sanitizeText(q?.questionText, 600);
      if (!qText) continue;
      const qType = q?.questionType === "short_answer" ? "short_answer" : "mcq";
      const opts = Array.isArray(q?.options) ? q.options.map((o) => sanitizeText(o, 200)) : [];
      const correct = sanitizeText(q?.correctOption, 200);
      const qMarks = Number(q?.maxMarks || 10);
      insQ.run(aid, qText, qType, JSON.stringify(opts), correct, qMarks);
    }
    const enrolled = db.prepare(
      `SELECT u.id as user_id FROM student_enrollments se
         JOIN students s ON s.id = se.student_id
         JOIN users u ON u.id = s.user_id
         WHERE se.course_id = ? AND se.semester_id = ? AND se.status = 'active'`
    ).all(courseId, ctx.semesterId);
    const insNotif = db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, ?, ?, 'assessment')");
    for (const stu of enrolled) {
      insNotif.run(stu.user_id, `New Assessment: ${title}`, `Deadline: ${deadline.slice(0, 10)} (${durationMinutes} mins)`);
    }
    logAudit(req.authUser.userId, "ASSESSMENT_CREATE", "ASSESSMENT", aid, title, req.ip || "");
    return aid;
  })();
  res.status(201).json({ id: assessmentId, message: "Assessment created and published to enrolled students." });
});
router4.get("/assessments/:assessmentId/submissions", (req, res) => {
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db.prepare("SELECT id, course_id, title, total_marks FROM assessments WHERE id = ?").get(assessmentId);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  if (!ensureCourseAccess(req, assessment.course_id)) {
    res.status(403).json({ error: "Not authorized." });
    return;
  }
  const submissions = db.prepare(
    `SELECT ss.id as submission_id, ss.student_id, s.student_code, u.full_name as student_name,
              ss.answers_json, ss.submitted_at, ss.is_late, ss.status,
              ar.marks_obtained, ar.feedback
       FROM student_submissions ss
       JOIN students s ON s.id = ss.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN assessment_results ar ON ar.submission_id = ss.id
       WHERE ss.assessment_id = ?
       ORDER BY ss.submitted_at DESC`
  ).all(assessmentId);
  const questions = db.prepare("SELECT * FROM assessment_questions WHERE assessment_id = ?").all(assessmentId);
  res.json({ assessment, submissions, questions });
});
router4.post("/submissions/:submissionId/grade", (req, res) => {
  const submissionId = Number(req.params.submissionId);
  const marksCheck = validateMark(Number(req.body?.marksObtained));
  if (!marksCheck.valid) {
    res.status(400).json({ error: marksCheck.error });
    return;
  }
  const feedback = sanitizeText(req.body?.feedback, 500);
  const sub = db.prepare(
    `SELECT ss.id, ss.assessment_id, ss.student_id, a.course_id
       FROM student_submissions ss
       JOIN assessments a ON a.id = ss.assessment_id
       WHERE ss.id = ?`
  ).get(submissionId);
  if (!sub) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }
  if (!ensureCourseAccess(req, sub.course_id)) {
    res.status(403).json({ error: "Not authorized to grade this course submission." });
    return;
  }
  db.transaction(() => {
    db.prepare(
      `INSERT INTO assessment_results (submission_id, assessment_id, student_id, marks_obtained, feedback, graded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(submission_id) DO UPDATE SET marks_obtained = excluded.marks_obtained, feedback = excluded.feedback, graded_by_user_id = excluded.graded_by_user_id, graded_at = datetime('now')`
    ).run(sub.id, sub.assessment_id, sub.student_id, marksCheck.normalized, feedback, req.authUser.userId);
    db.prepare("UPDATE student_submissions SET status = 'graded' WHERE id = ?").run(sub.id);
    logAudit(req.authUser.userId, "SUBMISSION_GRADE", "SUBMISSION", sub.id, `Graded ${marksCheck.normalized}`, req.ip || "");
  })();
  res.json({ message: "Submission graded successfully." });
});
router4.post("/grades", (req, res) => {
  const courseId = Number(req.body?.courseId);
  const studentId = Number(req.body?.studentId);
  if (!ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "Unauthorized grade modification: you are not assigned to this course." });
    return;
  }
  const parseOptionalMark = (val, label) => {
    if (val === null || val === void 0 || val === "") return { ok: true, value: null };
    const check = validateMark(Number(val));
    if (!check.valid) return { ok: false, error: `${label}: ${check.error}` };
    return { ok: true, value: check.normalized };
  };
  const q = parseOptionalMark(req.body?.quizScore, "Quiz");
  const a = parseOptionalMark(req.body?.assignmentScore, "Assignment");
  const m = parseOptionalMark(req.body?.midtermScore, "Midterm");
  const f = parseOptionalMark(req.body?.finalExamScore, "Final Exam");
  for (const r of [q, a, m, f]) {
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
  }
  const student = db.prepare("SELECT id, user_id, stream_id FROM students WHERE id = ?").get(studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const cfg = getStreamWeightConfig(student.stream_id);
  const scale = getGradingScale();
  const totalScore = computeWeightedSubjectScore(
    {
      quizScore: q.ok ? q.value : null,
      assignmentScore: a.ok ? a.value : null,
      midtermScore: m.ok ? m.value : null,
      finalExamScore: f.ok ? f.value : null
    },
    cfg,
    "full"
  );
  const resolved = resolveLetterGrade(totalScore, scale);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO grades_records (student_id, course_id, semester_id, quiz_score, assignment_score, midterm_score, final_exam_score, total_score, letter_grade, grade_point, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, course_id, semester_id) DO UPDATE SET
         quiz_score = excluded.quiz_score,
         assignment_score = excluded.assignment_score,
         midterm_score = excluded.midterm_score,
         final_exam_score = excluded.final_exam_score,
         total_score = excluded.total_score,
         letter_grade = excluded.letter_grade,
         grade_point = excluded.grade_point,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = datetime('now')`
    ).run(
      studentId,
      courseId,
      ctx.semesterId,
      q.ok ? q.value : null,
      a.ok ? a.value : null,
      m.ok ? m.value : null,
      f.ok ? f.value : null,
      totalScore,
      resolved.letterGrade,
      resolved.gradePoint,
      req.authUser.userId
    );
    db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Course Grade Updated', ?, 'grade')").run(
      student.user_id,
      `Your updated mark (${totalScore}% \xB7 ${resolved.letterGrade}) has been recorded.`
    );
    logAudit(
      req.authUser.userId,
      "GRADE_UPSERT",
      "GRADE_RECORD",
      `${studentId}:${courseId}`,
      `Total=${totalScore}, Letter=${resolved.letterGrade}`,
      req.ip || ""
    );
  })();
  res.json({
    totalScore,
    letterGrade: resolved.letterGrade,
    gradePoint: resolved.gradePoint,
    message: "Marks validated and computed via automated grading engine."
  });
});
router4.get("/attendance", (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  const date = sanitizeText(req.query.date, 20);
  if (courseId && !ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "Not authorized for this course." });
    return;
  }
  let query = `
    SELECT att.id, att.student_id, s.student_code, u.full_name as student_name,
           att.course_id, c.title as course_title, att.attendance_type, att.attendance_date,
           att.status, att.remarks, rec.full_name as recorded_by_name
    FROM attendance att
    JOIN students s ON s.id = att.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN courses c ON c.id = att.course_id
    JOIN users rec ON rec.id = att.recorded_by_user_id
    WHERE 1=1
  `;
  const params = [];
  if (courseId) {
    query += " AND att.course_id = ?";
    params.push(courseId);
  }
  if (date) {
    query += " AND att.attendance_date = ?";
    params.push(date);
  }
  query += " ORDER BY att.attendance_date DESC, u.full_name ASC LIMIT 200";
  const records = db.prepare(query).all(...params);
  res.json({ records });
});
router4.post("/attendance", (req, res) => {
  const courseId = req.body?.courseId ? Number(req.body.courseId) : null;
  const attendanceType = req.body?.attendanceType === "dormitory" ? "dormitory" : "classroom";
  const attendanceDate = sanitizeText(req.body?.attendanceDate, 20);
  const isCorrection = Boolean(req.body?.isCorrection);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  if (attendanceType === "classroom" && (!courseId || !ensureCourseAccess(req, courseId))) {
    res.status(403).json({ error: "Valid assigned course is required for classroom attendance." });
    return;
  }
  if (!attendanceDate || entries.length === 0) {
    res.status(400).json({ error: "Attendance date and student entries are required." });
    return;
  }
  if (!isCorrection) {
    for (const entry of entries) {
      const sid = Number(entry.studentId);
      const existing = courseId ? db.prepare("SELECT id FROM attendance WHERE student_id = ? AND course_id = ? AND attendance_date = ?").get(sid, courseId, attendanceDate) : db.prepare("SELECT id FROM attendance WHERE student_id = ? AND attendance_type = 'dormitory' AND attendance_date = ?").get(sid, attendanceDate);
      if (existing) {
        res.status(409).json({
          error: `Duplicate attendance detected for ${attendanceDate}. Enable "Authorized Correction Mode" to update existing records.`,
          code: "DUPLICATE_ATTENDANCE"
        });
        return;
      }
    }
  }
  db.transaction(() => {
    for (const entry of entries) {
      const sid = Number(entry.studentId);
      const status = ["present", "absent", "late", "excused"].includes(entry.status) ? entry.status : "present";
      const remarks = sanitizeText(entry.remarks, 200);
      const existing = courseId ? db.prepare("SELECT id FROM attendance WHERE student_id = ? AND course_id = ? AND attendance_date = ?").get(sid, courseId, attendanceDate) : db.prepare("SELECT id FROM attendance WHERE student_id = ? AND attendance_type = 'dormitory' AND attendance_date = ?").get(sid, attendanceDate);
      if (existing) {
        db.prepare(
          "UPDATE attendance SET status = ?, remarks = ?, recorded_by_user_id = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(status, remarks, req.authUser.userId, existing.id);
      } else {
        db.prepare(
          "INSERT INTO attendance (student_id, course_id, attendance_type, attendance_date, status, remarks, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(sid, courseId, attendanceType, attendanceDate, status, remarks, req.authUser.userId);
      }
    }
    logAudit(
      req.authUser.userId,
      isCorrection ? "ATTENDANCE_CORRECTION" : "ATTENDANCE_RECORD",
      "ATTENDANCE",
      `${courseId ?? "DORM"}:${attendanceDate}`,
      `Recorded ${entries.length} student statuses`,
      req.ip || ""
    );
  })();
  res.json({ message: `Attendance saved for ${entries.length} students on ${attendanceDate}.` });
});
router4.post("/announcements", (req, res) => {
  const courseId = req.body?.courseId ? Number(req.body.courseId) : null;
  if (courseId && !ensureCourseAccess(req, courseId)) {
    res.status(403).json({ error: "Not authorized for this course." });
    return;
  }
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2e3);
  if (!title || !body) {
    res.status(400).json({ error: "Title and message are required." });
    return;
  }
  const r = db.prepare("INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, 'STUDENT', ?, ?, 0)").run(title, body, courseId, req.authUser.userId);
  res.status(201).json({ id: r.lastInsertRowid, message: "Course announcement posted." });
});
router4.get("/discussions", (req, res) => {
  const instId = getInstructorIdByUserId(req.authUser.userId);
  const ctx = getActiveAcademicContext();
  const topics = instId ? db.prepare(
    `SELECT d.id, d.course_id, c.code as course_code, c.title as course_title,
                  d.author_user_id, u.full_name as author_name, r.name as author_role,
                  d.title, d.body, d.created_at,
                  (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.discussion_id = d.id) as reply_count
           FROM discussions d
           JOIN courses c ON c.id = d.course_id
           JOIN course_assignments ca ON ca.course_id = c.id AND ca.instructor_id = ? AND ca.semester_id = ?
           JOIN users u ON u.id = d.author_user_id
           JOIN roles r ON r.id = u.role_id
           ORDER BY d.created_at DESC`
  ).all(instId, ctx.semesterId) : db.prepare(
    `SELECT d.id, d.course_id, c.code as course_code, c.title as course_title,
                  d.author_user_id, u.full_name as author_name, r.name as author_role,
                  d.title, d.body, d.created_at,
                  (SELECT COUNT(*) FROM discussion_replies dr WHERE dr.discussion_id = d.id) as reply_count
           FROM discussions d
           JOIN courses c ON c.id = d.course_id
           JOIN users u ON u.id = d.author_user_id
           JOIN roles r ON r.id = u.role_id
           ORDER BY d.created_at DESC`
  ).all();
  res.json({ topics });
});
router4.delete("/discussions/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM discussions WHERE id = ?").run(id);
  logAudit(req.authUser.userId, "DISCUSSION_MODERATE_DELETE", "DISCUSSION", id, "Removed post", req.ip || "");
  res.json({ message: "Discussion thread removed." });
});
router4.delete("/discussion-replies/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM discussion_replies WHERE id = ?").run(id);
  logAudit(req.authUser.userId, "REPLY_MODERATE_DELETE", "DISCUSSION_REPLY", id, "Removed reply", req.ip || "");
  res.json({ message: "Discussion reply removed." });
});
var instructor_default = router4;

// server/routes/student.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.use(requireAuth, requireRole("STUDENT"));
router5.get("/dashboard", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student profile not found." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const enrolledCourses = db.prepare(
    `SELECT c.id, c.code, c.title, c.description, c.credit_hours, cat.name as category_name,
              g.name as grade_name, st.name as stream_name, u.full_name as instructor_name
       FROM student_enrollments se
       JOIN courses c ON c.id = se.course_id
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = se.semester_id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       ORDER BY c.code`
  ).all(student.id, ctx.semesterId);
  const availableCourses = db.prepare(
    `SELECT c.id, c.code, c.title, c.description, c.credit_hours, cat.name as category_name,
              g.name as grade_name, st.name as stream_name, u.full_name as instructor_name,
              EXISTS(SELECT 1 FROM student_enrollments se WHERE se.student_id = ? AND se.course_id = c.id AND se.semester_id = ? AND se.status = 'active') as is_enrolled
       FROM courses c
       JOIN course_categories cat ON cat.id = c.category_id
       JOIN grades g ON g.id = c.grade_id
       LEFT JOIN academic_streams st ON st.id = c.stream_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = ?
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE (c.stream_id IS NULL OR c.stream_id = ?)
       ORDER BY g.level_order, c.code`
  ).all(student.id, ctx.semesterId, ctx.semesterId, student.streamId);
  const materials = db.prepare(
    `SELECT cm.id, cm.course_id, c.code as course_code, c.title as course_title,
              cm.title, cm.material_type, cm.description, cm.file_name, cm.file_size_bytes, cm.created_at,
              u.full_name as uploaded_by_name
       FROM course_materials cm
       JOIN courses c ON c.id = cm.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       JOIN users u ON u.id = cm.uploaded_by_user_id
       ORDER BY cm.created_at DESC`
  ).all(student.id, ctx.semesterId);
  const assessments = db.prepare(
    `SELECT a.id, a.course_id, c.code as course_code, c.title as course_title,
              a.title, a.assessment_type, a.description, a.total_marks, a.duration_minutes,
              a.deadline, a.allow_late_submission, a.is_published,
              ss.status as submission_status, ar.marks_obtained as obtained_marks
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       LEFT JOIN student_submissions ss ON ss.assessment_id = a.id AND ss.student_id = ?
       LEFT JOIN assessment_results ar ON ar.submission_id = ss.id
       WHERE a.semester_id = ? AND a.is_published = 1
       ORDER BY a.deadline ASC`
  ).all(student.id, ctx.semesterId, student.id, ctx.semesterId);
  const schedule = db.prepare(
    `SELECT s.id, s.course_id, c.code as course_code, c.title as course_title,
              COALESCE(u.full_name, 'TBA') as instructor_name, g.name as grade_name,
              s.day_of_week, s.start_time, s.end_time, s.room
       FROM schedules s
       JOIN courses c ON c.id = s.course_id
       JOIN grades g ON g.id = c.grade_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.semester_id = ? AND se.status = 'active'
       LEFT JOIN course_assignments ca ON ca.course_id = c.id AND ca.semester_id = s.semester_id
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       LEFT JOIN users u ON u.id = i.user_id
       WHERE s.semester_id = ?
       ORDER BY s.day_of_week, s.start_time`
  ).all(student.id, ctx.semesterId, ctx.semesterId);
  const announcements = db.prepare(
    `SELECT a.id, a.title, a.body, a.course_id, c.title as course_title, a.created_at, u.full_name as author_name
       FROM announcements a
       LEFT JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = a.author_user_id
       WHERE a.target_role IN ('ALL', 'STUDENT')
         AND (a.course_id IS NULL OR a.course_id IN (
           SELECT course_id FROM student_enrollments WHERE student_id = ? AND semester_id = ?
         ))
       ORDER BY a.created_at DESC LIMIT 12`
  ).all(student.id, ctx.semesterId);
  const attendanceRows = db.prepare(
    `SELECT att.id, att.course_id, COALESCE(c.title, 'Dormitory Roll Call') as course_title,
              att.attendance_type, att.attendance_date, att.status, att.remarks
       FROM attendance att
       LEFT JOIN courses c ON c.id = att.course_id
       WHERE att.student_id = ?
       ORDER BY att.attendance_date DESC`
  ).all(student.id);
  const attendanceSummary = calculateAttendanceSummary(attendanceRows);
  const payments = db.prepare(
    `SELECT p.id, p.student_id, p.academic_year_id, p.semester_id, sem.name as semester_name,
              p.amount_etb, p.payment_method, p.transaction_ref, p.status, p.paid_at, p.verified_at, p.notes,
              pr.receipt_number, v.full_name as verified_by_name
       FROM payments p
       JOIN semesters sem ON sem.id = p.semester_id
       LEFT JOIN payment_receipts pr ON pr.payment_id = p.id
       LEFT JOIN users v ON v.id = p.verified_by_user_id
       WHERE p.student_id = ?
       ORDER BY p.paid_at DESC`
  ).all(student.id);
  const clearance = hasFinancialClearance(
    payments.map((p) => ({ semesterId: p.semester_id, status: p.status })),
    ctx.semesterId
  );
  res.json({
    student,
    activeContext: ctx,
    enrolledCourses,
    availableCourses,
    materials,
    assessments,
    schedule,
    announcements,
    attendanceRows,
    attendanceSummary,
    payments,
    clearance
  });
});
router5.patch("/profile", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const phone = sanitizeText(req.body?.phone, 40);
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40);
  db.transaction(() => {
    if (phone) db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(phone, req.authUser.userId);
    if (guardianPhone) {
      db.prepare("UPDATE students SET guardian_phone = ? WHERE id = ?").run(guardianPhone, student.id);
    }
  })();
  res.json({ message: "Permitted profile contact details updated." });
});
router5.post("/enroll", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const courseId = Number(req.body?.courseId);
  const course = db.prepare("SELECT id, stream_id FROM courses WHERE id = ?").get(courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found." });
    return;
  }
  if (course.stream_id !== null && course.stream_id !== student.streamId) {
    res.status(403).json({ error: "You cannot enroll in courses outside your assigned academic stream." });
    return;
  }
  const ctx = getActiveAcademicContext();
  db.prepare(
    `INSERT INTO student_enrollments (student_id, course_id, academic_year_id, semester_id, status)
     VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(student_id, course_id, semester_id) DO UPDATE SET status = 'active'`
  ).run(student.id, courseId, ctx.academicYearId, ctx.semesterId);
  logAudit(req.authUser.userId, "STUDENT_COURSE_ENROLL", "COURSE", courseId, `Student ${student.studentCode} enrolled`, req.ip || "");
  res.json({ message: "Enrolled in course successfully." });
});
router5.get("/assessments/:assessmentId", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db.prepare(
    `SELECT a.*, c.code as course_code, c.title as course_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       JOIN student_enrollments se ON se.course_id = c.id AND se.student_id = ? AND se.status = 'active'
       WHERE a.id = ? AND a.is_published = 1`
  ).get(student.id, assessmentId);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found or you are not enrolled in this course." });
    return;
  }
  const questions = db.prepare("SELECT id, question_text, question_type, options_json, max_marks FROM assessment_questions WHERE assessment_id = ?").all(assessmentId);
  const submission = db.prepare("SELECT id, submitted_at, status FROM student_submissions WHERE assessment_id = ? AND student_id = ?").get(assessmentId, student.id);
  res.json({
    assessment,
    questions: questions.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: JSON.parse(q.options_json || "[]"),
      maxMarks: q.max_marks
    })),
    submission,
    deadlineStatus: canSubmitAssessment(assessment.deadline, Boolean(assessment.allow_late_submission))
  });
});
router5.post("/assessments/:assessmentId/submit", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const assessmentId = Number(req.params.assessmentId);
  const assessment = db.prepare(
    `SELECT a.*
       FROM assessments a
       JOIN student_enrollments se ON se.course_id = a.course_id AND se.student_id = ? AND se.status = 'active'
       WHERE a.id = ? AND a.is_published = 1`
  ).get(student.id, assessmentId);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not accessible." });
    return;
  }
  const existingSub = db.prepare("SELECT id FROM student_submissions WHERE assessment_id = ? AND student_id = ?").get(assessmentId, student.id);
  if (existingSub) {
    res.status(409).json({ error: "You have already submitted this assessment." });
    return;
  }
  const deadlineCheck = canSubmitAssessment(
    assessment.deadline,
    Boolean(assessment.allow_late_submission),
    /* @__PURE__ */ new Date()
  );
  if (!deadlineCheck.allowed) {
    res.status(403).json({ error: deadlineCheck.reason, code: "DEADLINE_PASSED" });
    return;
  }
  const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
  const questions = db.prepare("SELECT id, question_type, correct_option, max_marks FROM assessment_questions WHERE assessment_id = ?").all(assessmentId);
  const allMcq = questions.length > 0 && questions.every((q) => q.question_type === "mcq");
  let autoScore = 0;
  for (const q of questions) {
    if (q.question_type === "mcq") {
      const given = sanitizeText(answers[String(q.id)], 200);
      if (given && given === q.correct_option) {
        autoScore += q.max_marks;
      }
    }
  }
  const result = db.transaction(() => {
    const subRes = db.prepare("INSERT INTO student_submissions (assessment_id, student_id, answers_json, is_late, status) VALUES (?, ?, ?, ?, ?)").run(
      assessmentId,
      student.id,
      JSON.stringify(answers),
      deadlineCheck.isLate ? 1 : 0,
      allMcq ? "graded" : "submitted"
    );
    const submissionId = Number(subRes.lastInsertRowid);
    if (allMcq) {
      db.prepare(
        `INSERT INTO assessment_results (submission_id, assessment_id, student_id, marks_obtained, feedback, graded_by_user_id)
         VALUES (?, ?, ?, ?, 'Auto-graded objective assessment', ?)`
      ).run(submissionId, assessmentId, student.id, Math.min(100, autoScore), req.authUser.userId);
    }
    logAudit(req.authUser.userId, "ASSESSMENT_SUBMIT", "ASSESSMENT", assessmentId, `Student ${student.studentCode} submitted`, req.ip || "");
    return { submissionId, autoGraded: allMcq, score: allMcq ? Math.min(100, autoScore) : null };
  })();
  res.status(201).json({
    ...result,
    message: result.autoGraded ? `Assessment submitted and auto-graded: ${result.score} / ${assessment.total_marks}.` : "Assessment submitted successfully. Pending instructor grading."
  });
});
router5.get("/results", (req, res) => {
  const student = getStudentProfileByUserId(req.authUser.userId);
  if (!student) {
    res.status(404).json({ error: "Student profile not found." });
    return;
  }
  if (req.query.studentId && Number(req.query.studentId) !== student.id) {
    logAudit(req.authUser.userId, "IDOR_BLOCKED", "RESULTS", String(req.query.studentId), "Student attempted to access peer academic records", req.ip || "");
    res.status(403).json({ error: "Security violation: you may only access your own academic records." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const reportCard = buildStudentReportCard(student.id, semesterId, false);
  if (!reportCard) {
    res.status(404).json({ error: "Academic term not found." });
    return;
  }
  if (!reportCard.cleared) {
    res.status(403).json({
      error: reportCard.clearanceReason,
      code: "FEE_CLEARANCE_REQUIRED",
      cleared: false,
      clearanceReason: reportCard.clearanceReason,
      student: reportCard.student,
      semesterName: reportCard.semesterName,
      academicYearName: reportCard.academicYearName,
      attendancePercentage: reportCard.attendancePercentage
    });
    return;
  }
  res.json(reportCard);
});
var student_default = router5;

// server/routes/registrar.ts
import { Router as Router6 } from "express";
import bcrypt4 from "bcryptjs";
var router6 = Router6();
router6.use(requireAuth, requireRole("REGISTRAR", "ADMIN"));
router6.get("/students", (req, res) => {
  const search = sanitizeText(req.query.search, 100).toLowerCase();
  const streamCode = sanitizeText(req.query.streamCode, 30);
  let sql = `
    SELECT s.id, s.user_id, s.student_code, u.full_name, u.email, u.phone,
           s.gender, s.date_of_birth, s.dormitory_block, s.guardian_name, s.guardian_phone,
           s.grade_id, g.name as grade_name, s.stream_id, st.code as stream_code, st.name as stream_name,
           s.academic_year_id, ay.name as academic_year_name, s.enrollment_status, s.is_sample_data,
           (SELECT p.status FROM payments p WHERE p.student_id = s.id ORDER BY p.id DESC LIMIT 1) as latest_payment_status
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN grades g ON g.id = s.grade_id
    JOIN academic_streams st ON st.id = s.stream_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += " AND (lower(u.full_name) LIKE ? OR lower(s.student_code) LIKE ? OR lower(u.email) LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (streamCode) {
    sql += " AND st.code = ?";
    params.push(streamCode);
  }
  sql += " ORDER BY s.id DESC";
  const students = db.prepare(sql).all(...params);
  res.json({ students });
});
router6.post("/students", (req, res) => {
  const fullName = sanitizeText(req.body?.fullName, 120);
  const email = sanitizeText(req.body?.email, 160).toLowerCase();
  const password = typeof req.body?.password === "string" && req.body.password.length >= 6 ? req.body.password : "Student@2026";
  const studentCodeInput = sanitizeText(req.body?.studentCode, 40).toUpperCase();
  const gender = req.body?.gender === "Female" ? "Female" : "Male";
  const dateOfBirth = sanitizeText(req.body?.dateOfBirth, 20) || "2008-03-10";
  const dormitoryBlock = sanitizeText(req.body?.dormitoryBlock, 80) || "Boys Dormitory \u2014 Block A";
  const guardianName = sanitizeText(req.body?.guardianName, 120) || "Parent / Guardian";
  const guardianPhone = sanitizeText(req.body?.guardianPhone, 40) || "+251911000000";
  const gradeId = Number(req.body?.gradeId || 3);
  const streamCode = req.body?.streamCode === "SOCIAL_SCIENCE" ? "SOCIAL_SCIENCE" : "NATURAL_SCIENCE";
  if (!fullName || !email || !email.includes("@")) {
    res.status(400).json({ error: "Student full name and valid email are required." });
    return;
  }
  const dupEmail = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email);
  if (dupEmail) {
    res.status(409).json({ error: "Email address is already registered." });
    return;
  }
  if (studentCodeInput) {
    const dupCode = db.prepare("SELECT id FROM students WHERE student_code = ?").get(studentCodeInput);
    if (dupCode) {
      res.status(409).json({ error: `Duplicate Student ID: ${studentCodeInput} already exists.` });
      return;
    }
  }
  const roleRow = db.prepare("SELECT id FROM roles WHERE name = 'STUDENT'").get();
  const streamRow = db.prepare("SELECT id FROM academic_streams WHERE code = ?").get(streamCode);
  const ctx = getActiveAcademicContext();
  const hash = bcrypt4.hashSync(password, 8);
  const created = db.transaction(() => {
    const uRes = db.prepare("INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, 'active', 0)").run(fullName, email, hash, roleRow.id, guardianPhone);
    const uid = Number(uRes.lastInsertRowid);
    const count = db.prepare("SELECT COUNT(*) as c FROM students").get().c;
    const studentCode = studentCodeInput || `LGBS-2026-${String(count + 1).padStart(3, "0")}`;
    const sRes = db.prepare(
      `INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 0)`
    ).run(uid, studentCode, gender, dateOfBirth, dormitoryBlock, guardianName, guardianPhone, gradeId, streamRow.id, ctx.academicYearId);
    const studentId = Number(sRes.lastInsertRowid);
    const courses = db.prepare("SELECT id FROM courses WHERE grade_id = ? AND (stream_id IS NULL OR stream_id = ?)").all(gradeId, streamRow.id);
    const insEnroll = db.prepare("INSERT OR IGNORE INTO student_enrollments (student_id, course_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)");
    for (const c of courses) insEnroll.run(studentId, c.id, ctx.academicYearId, ctx.semesterId);
    logAudit(req.authUser.userId, "REGISTRAR_STUDENT_CREATE", "STUDENT", studentCode, `Registered ${fullName} in ${streamCode}`, req.ip || "");
    return { studentId, studentCode };
  })();
  res.status(201).json({
    ...created,
    message: `Student registered with ID ${created.studentCode}.`
  });
});
router6.patch("/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id, user_id FROM students WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const fullName = sanitizeText(req.body?.fullName, 120);
  const gradeId = req.body?.gradeId ? Number(req.body.gradeId) : null;
  const streamCode = req.body?.streamCode;
  const enrollmentStatus = req.body?.enrollmentStatus;
  const dormitoryBlock = sanitizeText(req.body?.dormitoryBlock, 80);
  db.transaction(() => {
    if (fullName) {
      db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(fullName, existing.user_id);
    }
    if (gradeId) {
      db.prepare("UPDATE students SET grade_id = ? WHERE id = ?").run(gradeId, id);
    }
    if (streamCode === "NATURAL_SCIENCE" || streamCode === "SOCIAL_SCIENCE") {
      const st = db.prepare("SELECT id FROM academic_streams WHERE code = ?").get(streamCode);
      db.prepare("UPDATE students SET stream_id = ? WHERE id = ?").run(st.id, id);
    }
    if (["enrolled", "transferred", "graduated", "suspended"].includes(enrollmentStatus)) {
      db.prepare("UPDATE students SET enrollment_status = ? WHERE id = ?").run(enrollmentStatus, id);
    }
    if (dormitoryBlock) {
      db.prepare("UPDATE students SET dormitory_block = ? WHERE id = ?").run(dormitoryBlock, id);
    }
    logAudit(req.authUser.userId, "REGISTRAR_STUDENT_UPDATE", "STUDENT", id, `Updated grade/stream/status`, req.ip || "");
  })();
  res.json({ message: "Student record updated." });
});
router6.get("/grades-overview", (req, res) => {
  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const records = db.prepare(
    `SELECT gr.id, gr.student_id, s.student_code, u.full_name as student_name, st.name as stream_name,
              g.name as grade_name, c.code as course_code, c.title as course_title,
              gr.quiz_score, gr.assignment_score, gr.midterm_score, gr.final_exam_score,
              gr.total_score, gr.letter_grade, gr.grade_point, gr.verified_by_registrar
       FROM grades_records gr
       JOIN students s ON s.id = gr.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN courses c ON c.id = gr.course_id
       WHERE gr.semester_id = ?
       ORDER BY u.full_name, c.code`
  ).all(semesterId);
  res.json({ records, semesterId });
});
router6.post("/grades/:id/verify", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE grades_records SET verified_by_registrar = 1 WHERE id = ?").run(id);
  logAudit(req.authUser.userId, "GRADE_VERIFY", "GRADE_RECORD", id, "Verified official grade record", req.ip || "");
  res.json({ message: "Academic grade verified." });
});
router6.get("/report-card/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  const ctx = getActiveAcademicContext();
  const semesterId = req.query.semesterId ? Number(req.query.semesterId) : ctx.semesterId;
  const reportCard = buildStudentReportCard(studentId, semesterId, true);
  if (!reportCard) {
    res.status(404).json({ error: "Student or semester not found." });
    return;
  }
  res.json(reportCard);
});
router6.get("/certificates", (_req, res) => {
  const certificates = db.prepare(
    `SELECT cert.id, cert.certificate_number, cert.student_id, s.student_code, u.full_name as student_name,
              g.name as grade_name, st.name as stream_name, ay.name as academic_year_name,
              cert.certificate_type, ib.full_name as issued_by_name, cert.issued_at, cert.status
       FROM certificates cert
       JOIN students s ON s.id = cert.student_id
       JOIN users u ON u.id = s.user_id
       JOIN grades g ON g.id = s.grade_id
       JOIN academic_streams st ON st.id = s.stream_id
       JOIN academic_years ay ON ay.id = cert.academic_year_id
       JOIN users ib ON ib.id = cert.issued_by_user_id
       ORDER BY cert.id DESC`
  ).all();
  res.json({ certificates });
});
router6.post("/certificates", (req, res) => {
  const studentId = Number(req.body?.studentId);
  const certificateType = req.body?.certificateType;
  if (!studentId || !["Academic Completion", "Honor Roll", "Stream Graduation"].includes(certificateType)) {
    res.status(400).json({ error: "Student and valid certificate type are required." });
    return;
  }
  const ctx = getActiveAcademicContext();
  const count = db.prepare("SELECT COUNT(*) as c FROM certificates").get().c;
  const certNumber = `CERT-LGBS-2026-${String(count + 1).padStart(3, "0")}`;
  const r = db.prepare(
    `INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
       VALUES (?, ?, ?, ?, ?, 'issued')`
  ).run(certNumber, studentId, ctx.academicYearId, certificateType, req.authUser.userId);
  logAudit(req.authUser.userId, "CERTIFICATE_ISSUE", "CERTIFICATE", certNumber, `Issued ${certificateType} to student #${studentId}`, req.ip || "");
  res.status(201).json({ id: r.lastInsertRowid, certificateNumber: certNumber, message: `Certificate ${certNumber} issued.` });
});
var registrar_default = router6;

// server/routes/finance.ts
import { Router as Router7 } from "express";
var router7 = Router7();
router7.use(requireAuth, requireRole("FINANCE", "ADMIN", "REGISTRAR"));
router7.get("/payments", (_req, res) => {
  const payments = db.prepare(
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
       ORDER BY p.id DESC`
  ).all();
  const ctx = getActiveAcademicContext();
  const outstandingStudents = db.prepare(
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
       ORDER BY s.student_code`
  ).all(ctx.semesterId);
  res.json({ payments, outstandingStudents, activeContext: ctx });
});
router7.post("/payments", (req, res) => {
  const studentId = Number(req.body?.studentId);
  const amountEtb = Number(req.body?.amountEtb);
  const paymentMethod = req.body?.paymentMethod;
  const transactionRef = sanitizeText(req.body?.transactionRef, 80).toUpperCase();
  const notes = sanitizeText(req.body?.notes, 300);
  const verifyImmediately = Boolean(req.body?.verifyImmediately);
  if (!studentId || !Number.isFinite(amountEtb) || amountEtb <= 0 || !["Bank Deposit", "Telebirr Reference", "Cashier Office"].includes(paymentMethod) || !transactionRef) {
    res.status(400).json({ error: "Student, positive amount (ETB), payment method, and unique transaction reference are required." });
    return;
  }
  const student = db.prepare("SELECT id, user_id, student_code FROM students WHERE id = ?").get(studentId);
  if (!student) {
    res.status(404).json({ error: "Student not found." });
    return;
  }
  const dupRef = db.prepare("SELECT id FROM payments WHERE transaction_ref = ?").get(transactionRef);
  if (dupRef) {
    res.status(409).json({ error: `Transaction reference ${transactionRef} is already recorded.` });
    return;
  }
  const ctx = getActiveAcademicContext();
  const created = db.transaction(() => {
    const status = verifyImmediately ? "verified" : "pending";
    const verifiedBy = verifyImmediately ? req.authUser.userId : null;
    const verifiedAt = verifyImmediately ? (/* @__PURE__ */ new Date()).toISOString() : null;
    const pRes = db.prepare(
      `INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes, verified_by_user_id, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(studentId, ctx.academicYearId, ctx.semesterId, amountEtb, paymentMethod, transactionRef, status, notes, verifiedBy, verifiedAt);
    const paymentId = Number(pRes.lastInsertRowid);
    let receiptNumber = null;
    if (verifyImmediately) {
      const rCount = db.prepare("SELECT COUNT(*) as c FROM payment_receipts").get().c;
      receiptNumber = `RCPT-LGBS-2026-${String(rCount + 1).padStart(4, "0")}`;
      db.prepare("INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)").run(
        paymentId,
        receiptNumber,
        req.authUser.userId
      );
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Tuition Payment Verified', ?, 'finance')").run(
        student.user_id,
        `Payment ${transactionRef} (${amountEtb} ETB) verified. Official Receipt: ${receiptNumber}. Semester results unlocked.`
      );
    }
    logAudit(req.authUser.userId, "PAYMENT_RECORD", "PAYMENT", paymentId, `${student.student_code} ${amountEtb} ETB (${status})`, req.ip || "");
    return { paymentId, receiptNumber, status };
  })();
  res.status(201).json({ ...created, message: "Payment recorded successfully." });
});
router7.patch("/payments/:id/verify", (req, res) => {
  const id = Number(req.params.id);
  const action = req.body?.status === "rejected" ? "rejected" : "verified";
  const notes = sanitizeText(req.body?.notes, 300);
  const payment = db.prepare(
    `SELECT p.id, p.student_id, p.amount_etb, p.transaction_ref, s.user_id, s.student_code
       FROM payments p
       JOIN students s ON s.id = p.student_id
       WHERE p.id = ?`
  ).get(id);
  if (!payment) {
    res.status(404).json({ error: "Payment record not found." });
    return;
  }
  const receiptNumber = db.transaction(() => {
    db.prepare(
      `UPDATE payments
       SET status = ?, verified_by_user_id = ?, verified_at = datetime('now'), notes = COALESCE(NULLIF(?, ''), notes)
       WHERE id = ?`
    ).run(action, req.authUser.userId, notes, id);
    let rcpt = null;
    if (action === "verified") {
      const existingReceipt = db.prepare("SELECT receipt_number FROM payment_receipts WHERE payment_id = ?").get(id);
      if (existingReceipt) {
        rcpt = existingReceipt.receipt_number;
      } else {
        const rCount = db.prepare("SELECT COUNT(*) as c FROM payment_receipts").get().c;
        rcpt = `RCPT-LGBS-2026-${String(rCount + 1).padStart(4, "0")}`;
        db.prepare("INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)").run(
          id,
          rcpt,
          req.authUser.userId
        );
      }
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Fee Clearance Approved', ?, 'finance')").run(
        payment.user_id,
        `Your payment ${payment.transaction_ref} has been verified (Receipt ${rcpt}). Your official semester results are now accessible.`
      );
    } else {
      db.prepare("INSERT INTO notifications (user_id, title, message, category) VALUES (?, 'Payment Verification Rejected', ?, 'finance')").run(
        payment.user_id,
        `Payment ${payment.transaction_ref} could not be verified. Please contact the Finance Office.`
      );
    }
    logAudit(req.authUser.userId, `PAYMENT_${action.toUpperCase()}`, "PAYMENT", id, `${payment.student_code} (${payment.transaction_ref})`, req.ip || "");
    return rcpt;
  })();
  res.json({
    status: action,
    receiptNumber,
    message: action === "verified" ? `Payment verified and receipt ${receiptNumber} generated.` : "Payment marked as rejected."
  });
});
var finance_default = router7;

// server/routes/shared.ts
import { Router as Router8 } from "express";
import fs3 from "fs";
var router8 = Router8();
router8.use(requireAuth);
router8.get("/materials/:id/download", (req, res) => {
  const id = Number(req.params.id);
  const mat = db.prepare("SELECT id, course_id, file_name, stored_path FROM course_materials WHERE id = ?").get(id);
  if (!mat || !fs3.existsSync(mat.stored_path)) {
    res.status(404).json({ error: "Learning material file not found." });
    return;
  }
  res.download(mat.stored_path, mat.file_name);
});
router8.get("/discussions", (req, res) => {
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
  const params = [];
  if (courseId) {
    sql += " AND d.course_id = ?";
    params.push(courseId);
  }
  sql += " ORDER BY d.created_at DESC";
  const topics = db.prepare(sql).all(...params);
  res.json({ topics });
});
router8.get("/discussions/:id/replies", (req, res) => {
  const id = Number(req.params.id);
  const replies = db.prepare(
    `SELECT dr.id, dr.discussion_id, dr.author_user_id, u.full_name as author_name, r.name as author_role,
              dr.body, dr.created_at
       FROM discussion_replies dr
       JOIN users u ON u.id = dr.author_user_id
       JOIN roles r ON r.id = u.role_id
       WHERE dr.discussion_id = ?
       ORDER BY dr.created_at ASC`
  ).all(id);
  res.json({ replies });
});
router8.post("/discussions", (req, res) => {
  const courseId = Number(req.body?.courseId);
  const title = sanitizeText(req.body?.title, 180);
  const body = sanitizeText(req.body?.body, 2e3);
  if (!courseId || !title || !body) {
    res.status(400).json({ error: "Course, topic title, and question body are required." });
    return;
  }
  const r = db.prepare("INSERT INTO discussions (course_id, author_user_id, title, body) VALUES (?, ?, ?, ?)").run(courseId, req.authUser.userId, title, body);
  res.status(201).json({ id: r.lastInsertRowid, message: "Discussion topic posted." });
});
router8.post("/discussions/:id/replies", (req, res) => {
  const discussionId = Number(req.params.id);
  const body = sanitizeText(req.body?.body, 2e3);
  if (!body) {
    res.status(400).json({ error: "Reply message cannot be empty." });
    return;
  }
  const r = db.prepare("INSERT INTO discussion_replies (discussion_id, author_user_id, body) VALUES (?, ?, ?)").run(discussionId, req.authUser.userId, body);
  res.status(201).json({ id: r.lastInsertRowid, message: "Reply posted." });
});
var shared_default = router8;

// server.ts
var PORT = Number(process.env.PORT || 3e3);
async function startServer() {
  initializeDatabase();
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/public", public_default);
  app.use("/api/auth", auth_default);
  app.use("/api/admin", admin_default);
  app.use("/api/instructor", instructor_default);
  app.use("/api/student", student_default);
  app.use("/api/registrar", registrar_default);
  app.use("/api/finance", finance_default);
  app.use("/api/shared", shared_default);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", institution: "Lich Gogo Excellence Boarding School" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path3.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lich Gogo LMS Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
