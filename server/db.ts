import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'lichgogo_lms.db');
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
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

  const roleCount = (db.prepare('SELECT COUNT(*) as c FROM roles').get() as { c: number }).c;
  if (roleCount === 0) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const tx = db.transaction(() => {
    // 1. Roles
    const insertRole = db.prepare('INSERT INTO roles (name, description) VALUES (?, ?)');
    const rAdmin = Number(insertRole.run('ADMIN', 'Full system administration and configuration').lastInsertRowid);
    const rInstructor = Number(insertRole.run('INSTRUCTOR', 'Course materials, assessments, grading, and attendance').lastInsertRowid);
    const rStudent = Number(insertRole.run('STUDENT', 'Course enrollment, materials, assessments, and results').lastInsertRowid);
    const rRegistrar = Number(insertRole.run('REGISTRAR', 'Student enrollment, streams, report cards, and certificates').lastInsertRowid);
    const rFinance = Number(insertRole.run('FINANCE', 'Tuition fee verification and official receipt issuance').lastInsertRowid);

    // 2. Permissions
    const perms: Array<[string, string, string]> = [
      ['USER_MANAGE', 'Administration', 'Create, edit, deactivate users and assign roles'],
      ['ROLE_MANAGE', 'Administration', 'Modify role permissions and security access'],
      ['COURSE_MANAGE', 'Academics', 'Create courses, categories, and class schedules'],
      ['SYSTEM_SETTINGS', 'System', 'Configure grading scales, stream weights, and school settings'],
      ['AUDIT_VIEW', 'Security', 'Inspect system audit logs and backups'],
      ['MATERIAL_UPLOAD', 'Instruction', 'Upload and manage course learning materials'],
      ['ASSESSMENT_MANAGE', 'Instruction', 'Create quizzes, assignments, and exams'],
      ['GRADE_ENTER', 'Grading', 'Enter and update student assessment marks'],
      ['ATTENDANCE_MARK', 'Attendance', 'Record classroom and dormitory attendance'],
      ['COURSE_ENROLL', 'Student', 'Browse and enroll in stream courses'],
      ['ASSESSMENT_TAKE', 'Student', 'Take online assessments and submit answers'],
      ['RESULTS_VIEW', 'Student', 'View semester grades, GPA, and report cards (subject to clearance)'],
      ['STUDENT_REGISTER', 'Registrar', 'Register students, generate IDs, and manage transfers'],
      ['STREAM_ASSIGN', 'Registrar', 'Assign students to Natural or Social Science stream'],
      ['GRADE_VERIFY', 'Registrar', 'Verify grades and generate report cards/certificates'],
      ['PAYMENT_VERIFY', 'Finance', 'Verify tuition payments and issue official receipts'],
    ];

    const insertPerm = db.prepare('INSERT INTO permissions (code, module, description) VALUES (?, ?, ?)');
    const permMap: Record<string, number> = {};
    for (const [code, mod, desc] of perms) {
      permMap[code] = Number(insertPerm.run(code, mod, desc).lastInsertRowid);
    }

    const assignRP = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    // Admin gets all permissions
    for (const pid of Object.values(permMap)) assignRP.run(rAdmin, pid);
    for (const code of ['MATERIAL_UPLOAD', 'ASSESSMENT_MANAGE', 'GRADE_ENTER', 'ATTENDANCE_MARK']) {
      assignRP.run(rInstructor, permMap[code]);
    }
    for (const code of ['COURSE_ENROLL', 'ASSESSMENT_TAKE', 'RESULTS_VIEW']) {
      assignRP.run(rStudent, permMap[code]);
    }
    for (const code of ['STUDENT_REGISTER', 'STREAM_ASSIGN', 'GRADE_VERIFY', 'ATTENDANCE_MARK']) {
      assignRP.run(rRegistrar, permMap[code]);
    }
    for (const code of ['PAYMENT_VERIFY']) {
      assignRP.run(rFinance, permMap[code]);
    }

    // 3. School settings
    const insertSetting = db.prepare('INSERT INTO school_settings (key, value) VALUES (?, ?)');
    insertSetting.run('school_name', 'Lich Gogo Excellence Boarding School');
    insertSetting.run('location', 'Hosanna, Hadiya Zone, Central Ethiopia');
    insertSetting.run('motto', 'Discipline, Inquiry, and Academic Distinction');
    insertSetting.run('contact_email', 'admissions@lichgogo.edu.et');
    insertSetting.run('contact_phone', '+251 46 555 2140');
    insertSetting.run('semester_tuition_etb', '14500');

    // 4. Academic Years & Semesters
    const year2026 = Number(
      db.prepare("INSERT INTO academic_years (name, start_date, end_date, is_active) VALUES ('2025/2026', '2025-09-12', '2026-06-30', 1)").run().lastInsertRowid,
    );
    const sem1 = Number(
      db.prepare("INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_active) VALUES (?, 'Semester I', '2025-09-12', '2026-01-30', 0)").run(year2026).lastInsertRowid,
    );
    const sem2 = Number(
      db.prepare("INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_active) VALUES (?, 'Semester II', '2026-02-05', '2026-06-30', 1)").run(year2026).lastInsertRowid,
    );

    // 5. Grades & Academic Streams
    const insertGrade = db.prepare('INSERT INTO grades (name, level_order) VALUES (?, ?)');
    insertGrade.run('Grade 9', 9);
    insertGrade.run('Grade 10', 10);
    const g11 = Number(insertGrade.run('Grade 11', 11).lastInsertRowid);
    const g12 = Number(insertGrade.run('Grade 12', 12).lastInsertRowid);

    const insertStream = db.prepare('INSERT INTO academic_streams (code, name, description) VALUES (?, ?, ?)');
    const sNatural = Number(
      insertStream.run(
        'NATURAL_SCIENCE',
        'Natural Science',
        'Physics, Chemistry, Biology, Advanced Mathematics, and Technical Drawing for STEM university pathways.',
      ).lastInsertRowid,
    );
    const sSocial = Number(
      insertStream.run(
        'SOCIAL_SCIENCE',
        'Social Science',
        'Economics, Geography, History, Civics, and Social Mathematics for law, governance, and business pathways.',
      ).lastInsertRowid,
    );

    // 6. Configurable Grading Scales & Stream Weight Configs
    const insertScale = db.prepare(
      'INSERT INTO grading_scales (letter_grade, min_score, max_score, grade_point, remark) VALUES (?, ?, ?, ?, ?)',
    );
    insertScale.run('A', 90, 100, 4.0, 'Distinction');
    insertScale.run('A-', 85, 89.99, 3.75, 'Excellent');
    insertScale.run('B+', 80, 84.99, 3.5, 'Very Good');
    insertScale.run('B', 70, 79.99, 3.0, 'Good');
    insertScale.run('C+', 60, 69.99, 2.5, 'Above Average');
    insertScale.run('C', 50, 59.99, 2.0, 'Satisfactory');
    insertScale.run('D', 40, 49.99, 1.0, 'Conditional Pass');
    insertScale.run('F', 0, 39.99, 0.0, 'Fail');

    const insertConfig = db.prepare(
      'INSERT INTO stream_grading_configs (stream_id, quiz_weight, assignment_weight, midterm_weight, final_exam_weight, passing_score) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insertConfig.run(sNatural, 10, 15, 25, 50, 50);
    insertConfig.run(sSocial, 15, 25, 20, 40, 50);

    // 7. Demo Users (Sample Data)
    const hashAdmin = bcrypt.hashSync('Admin@2026', 8);
    const hashTeacher = bcrypt.hashSync('Teacher@2026', 8);
    const hashStudent = bcrypt.hashSync('Student@2026', 8);
    const hashRegistrar = bcrypt.hashSync('Registrar@2026', 8);
    const hashFinance = bcrypt.hashSync('Finance@2026', 8);

    const insertUser = db.prepare(
      'INSERT INTO users (full_name, email, password_hash, role_id, phone, status, is_sample_data) VALUES (?, ?, ?, ?, ?, ?, 1)',
    );

    const uAdmin = Number(insertUser.run('Abebe Bekele', 'admin@lichgogo.edu.et', hashAdmin, rAdmin, '+251911220001', 'active').lastInsertRowid);
    const uInst1 = Number(insertUser.run('Dr. Dawit Tadesse', 'dawit.t@lichgogo.edu.et', hashTeacher, rInstructor, '+251911220002', 'active').lastInsertRowid);
    const uInst2 = Number(insertUser.run('Tigist Haile', 'tigist.h@lichgogo.edu.et', hashTeacher, rInstructor, '+251911220003', 'active').lastInsertRowid);
    const uRegistrar = Number(insertUser.run('Kebede Alemu', 'registrar@lichgogo.edu.et', hashRegistrar, rRegistrar, '+251911220004', 'active').lastInsertRowid);
    const uFinance = Number(insertUser.run('Mekdes Solomon', 'finance@lichgogo.edu.et', hashFinance, rFinance, '+251911220005', 'active').lastInsertRowid);
    const uStu1 = Number(insertUser.run('Sara Mekonnen', 'sara.m@lichgogo.edu.et', hashStudent, rStudent, '+251911220010', 'active').lastInsertRowid);
    const uStu2 = Number(insertUser.run('Yonas Girma', 'yonas.g@lichgogo.edu.et', hashStudent, rStudent, '+251911220011', 'active').lastInsertRowid);
    const uStu3 = Number(insertUser.run('Hanna Desta', 'hanna.d@lichgogo.edu.et', hashStudent, rStudent, '+251911220012', 'active').lastInsertRowid);
    const uStu4 = Number(insertUser.run('Bereket Tesfaye', 'bereket.t@lichgogo.edu.et', hashStudent, rStudent, '+251911220013', 'active').lastInsertRowid);

    // 8. Instructors & Students
    const insertInst = db.prepare(
      'INSERT INTO instructors (user_id, employee_code, department, qualification, is_sample_data) VALUES (?, ?, ?, ?, 1)',
    );
    const inst1 = Number(insertInst.run(uInst1, 'INST-2026-01', 'Natural Sciences & Mathematics', 'PhD in Applied Physics').lastInsertRowid);
    const inst2 = Number(insertInst.run(uInst2, 'INST-2026-02', 'Social Sciences & Economics', 'M.A. in Development Economics').lastInsertRowid);

    const insertStu = db.prepare(`
      INSERT INTO students (user_id, student_code, gender, date_of_birth, dormitory_block, guardian_name, guardian_phone, grade_id, stream_id, academic_year_id, enrollment_status, is_sample_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enrolled', 1)
    `);
    const st1 = Number(insertStu.run(uStu1, 'LGBS-2026-001', 'Female', '2008-04-18', 'Girls Dormitory — Block B', 'Mekonnen Ayele', '+251911300101', g11, sNatural, year2026).lastInsertRowid);
    const st2 = Number(insertStu.run(uStu2, 'LGBS-2026-002', 'Male', '2008-09-02', 'Boys Dormitory — Block A', 'Girma Wolde', '+251911300102', g11, sNatural, year2026).lastInsertRowid);
    const st3 = Number(insertStu.run(uStu3, 'LGBS-2026-003', 'Female', '2007-11-24', 'Girls Dormitory — Block C', 'Desta Lemma', '+251911300103', g12, sSocial, year2026).lastInsertRowid);
    const st4 = Number(insertStu.run(uStu4, 'LGBS-2026-004', 'Male', '2008-02-11', 'Boys Dormitory — Block A', 'Tesfaye Gebre', '+251911300104', g11, sNatural, year2026).lastInsertRowid);

    // 9. Course Categories & Courses
    const insertCat = db.prepare('INSERT INTO course_categories (name, description) VALUES (?, ?)');
    const catStem = Number(insertCat.run('Physical & Biological Sciences', 'Core Natural Science laboratory and theoretical courses').lastInsertRowid);
    const catMath = Number(insertCat.run('Mathematics & Computing', 'Analytical mathematics and quantitative reasoning').lastInsertRowid);
    const catHumanities = Number(insertCat.run('Economics & Social Studies', 'Social sciences, governance, and historical inquiry').lastInsertRowid);
    const catLang = Number(insertCat.run('Languages & Communication', 'Academic English and literary composition').lastInsertRowid);

    const insertCourse = db.prepare(`
      INSERT INTO courses (code, title, description, category_id, grade_id, stream_id, credit_hours, is_sample_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const cPhys = Number(insertCourse.run('PHYS-111', 'Mechanics, Waves & Electromagnetism', 'Rigorous Grade 11 Natural Science physics covering kinematics, Newtonian dynamics, wave optics, and circuit laws.', catStem, g11, sNatural, 4).lastInsertRowid);
    const cChem = Number(insertCourse.run('CHEM-111', 'Chemical Bonding & Thermodynamics', 'Atomic structure, stoichiometry, chemical kinetics, and laboratory titration methods.', catStem, g11, sNatural, 4).lastInsertRowid);
    const cMathNat = Number(insertCourse.run('MATH-111', 'Calculus & Analytic Geometry', 'Functions, limits, derivatives, vectors, and matrix algebra for Natural Science learners.', catMath, g11, sNatural, 5).lastInsertRowid);
    const cEng = Number(insertCourse.run('ENGL-111', 'Academic Writing & Literature', 'Critical essay writing, rhetorical analysis, and technical reading comprehension.', catLang, g11, null, 3).lastInsertRowid);
    const cEcon = Number(insertCourse.run('ECON-121', 'Macroeconomics & Ethiopian Fiscal Policy', 'National income accounting, monetary policy, development planning, and East African trade.', catHumanities, g12, sSocial, 4).lastInsertRowid);
    const cHist = Number(insertCourse.run('HIST-121', 'Modern Ethiopian & World History', 'Historical analysis of 19th and 20th century constitutional, diplomatic, and social transformations.', catHumanities, g12, sSocial, 4).lastInsertRowid);

    // 10. Course Assignments
    const assignCourse = db.prepare('INSERT INTO course_assignments (course_id, instructor_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)');
    assignCourse.run(cPhys, inst1, year2026, sem2);
    assignCourse.run(cChem, inst1, year2026, sem2);
    assignCourse.run(cMathNat, inst1, year2026, sem2);
    assignCourse.run(cEng, inst2, year2026, sem2);
    assignCourse.run(cEcon, inst2, year2026, sem2);
    assignCourse.run(cHist, inst2, year2026, sem2);

    // 11. Student Enrollments
    const enroll = db.prepare('INSERT INTO student_enrollments (student_id, course_id, academic_year_id, semester_id) VALUES (?, ?, ?, ?)');
    for (const st of [st1, st2, st4]) {
      enroll.run(st, cPhys, year2026, sem2);
      enroll.run(st, cChem, year2026, sem2);
      enroll.run(st, cMathNat, year2026, sem2);
      enroll.run(st, cEng, year2026, sem2);
    }
    enroll.run(st3, cEcon, year2026, sem2);
    enroll.run(st3, cHist, year2026, sem2);

    // 12. Sample Course Materials (create real downloadable text/markdown syllabus files inside uploads/)
    const matDir = path.join(UPLOAD_DIR, 'sample');
    if (!fs.existsSync(matDir)) fs.mkdirSync(matDir, { recursive: true });
    const sampleDoc1 = path.join(matDir, 'PHYS-111-Kinematics-Guide.txt');
    const sampleDoc2 = path.join(matDir, 'MATH-111-Derivatives-Workbook.txt');
    const sampleDoc3 = path.join(matDir, 'ECON-121-Fiscal-Policy-Notes.txt');
    fs.writeFileSync(sampleDoc1, 'Lich Gogo Excellence Boarding School — PHYS-111 Study Pack\nTopic: Kinematics, Uniform Acceleration & Projectile Motion\nInstructor: Dr. Dawit Tadesse\n');
    fs.writeFileSync(sampleDoc2, 'Lich Gogo Excellence Boarding School — MATH-111 Calculus Workbook\nTopic: Limits, Continuity and First Principles Differentiation\n');
    fs.writeFileSync(sampleDoc3, 'Lich Gogo Excellence Boarding School — ECON-121 Seminar Notes\nTopic: Macroeconomic Stability & Agricultural Productivity in Ethiopia\n');

    const insertMat = db.prepare(`
      INSERT INTO course_materials (course_id, uploaded_by_user_id, title, material_type, description, file_name, stored_path, file_size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMat.run(cPhys, uInst1, 'Unit 3: Kinematics & Projectile Motion Lecture Pack', 'pdf', 'Comprehensive study notes and solved problems for Grade 11 Natural Science.', 'PHYS-111-Kinematics-Guide.txt', sampleDoc1, fs.statSync(sampleDoc1).size);
    insertMat.run(cMathNat, uInst1, 'Calculus Worksheet: Limits & Derivatives', 'presentation', 'Practice problem set preparing for Midterm Examination.', 'MATH-111-Derivatives-Workbook.txt', sampleDoc2, fs.statSync(sampleDoc2).size);
    insertMat.run(cEcon, uInst2, 'Fiscal Policy & Development Lecture Slides', 'pdf', 'Case study on national budget allocation and inflation control.', 'ECON-121-Fiscal-Policy-Notes.txt', sampleDoc3, fs.statSync(sampleDoc3).size);

    // 13. Assessments & Questions
    const insertAssess = db.prepare(`
      INSERT INTO assessments (course_id, semester_id, created_by_user_id, title, assessment_type, description, total_marks, duration_minutes, deadline, allow_late_submission, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const aPhysQuiz = Number(insertAssess.run(cPhys, sem2, uInst1, 'Kinematics & Force Equilibrium Quiz', 'quiz', 'Timed online quiz covering vector decomposition and Newton second law applications.', 100, 25, '2026-12-20T23:59:00Z', 0).lastInsertRowid);
    const aMathAssign = Number(insertAssess.run(cMathNat, sem2, uInst1, 'Limits & Continuity Problem Set', 'assignment', 'Analytical evaluation of limits and trigonometric continuity.', 100, 45, '2026-12-22T23:59:00Z', 1).lastInsertRowid);
    const aExpiredQuiz = Number(insertAssess.run(cChem, sem2, uInst1, 'Closed Stoichiometry Diagnostic (Past Deadline)', 'quiz', 'Closed diagnostic quiz used to verify deadline lock behavior.', 100, 20, '2026-03-01T12:00:00Z', 0).lastInsertRowid);

    const insertQ = db.prepare('INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_option, max_marks) VALUES (?, ?, ?, ?, ?, ?)');
    insertQ.run(aPhysQuiz, 'An object starts from rest and accelerates uniformly at 4 m/s^2 for 5 seconds. What is its final velocity?', 'mcq', JSON.stringify(['10 m/s', '16 m/s', '20 m/s', '25 m/s']), '20 m/s', 50);
    insertQ.run(aPhysQuiz, 'Which SI unit corresponds to mechanical impulse?', 'mcq', JSON.stringify(['N·s', 'J/s', 'N/m', 'kg·m/s^2']), 'N·s', 50);
    insertQ.run(aMathAssign, 'What is the limit of (x^2 - 9) / (x - 3) as x approaches 3?', 'mcq', JSON.stringify(['0', '3', '6', 'Undefined']), '6', 50);
    insertQ.run(aMathAssign, 'Briefly state the Intermediate Value Theorem and one condition required for it to hold.', 'short_answer', '[]', '', 50);
    insertQ.run(aExpiredQuiz, 'What is Avogadro’s number approximately?', 'mcq', JSON.stringify(['6.022 × 10^23', '3.14 × 10^8', '9.81 × 10^2']), '6.022 × 10^23', 100);

    // 14. Grades Records (Automated calculation seeded)
    const insertGradeRec = db.prepare(`
      INSERT INTO grades_records (student_id, course_id, semester_id, quiz_score, assignment_score, midterm_score, final_exam_score, total_score, letter_grade, grade_point, verified_by_registrar, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // Sara (st1) - Natural Science (10%, 15%, 25%, 50%)
    insertGradeRec.run(st1, cPhys, sem2, 92, 94, 90, 93, 92.3, 'A', 4.0, 1, uInst1);
    insertGradeRec.run(st1, cChem, sem2, 88, 90, 86, 89, 88.3, 'A-', 3.75, 1, uInst1);
    insertGradeRec.run(st1, cMathNat, sem2, 95, 92, 94, 96, 94.8, 'A', 4.0, 1, uInst1);
    insertGradeRec.run(st1, cEng, sem2, 85, 88, 84, 86, 85.7, 'A-', 3.75, 1, uInst2);

    // Yonas (st2) - Natural Science (Has marks, but Fee is PENDING so results are gated!)
    insertGradeRec.run(st2, cPhys, sem2, 78, 82, 75, 80, 78.85, 'B', 3.0, 1, uInst1);
    insertGradeRec.run(st2, cChem, sem2, 74, 80, 72, 76, 75.4, 'B', 3.0, 1, uInst1);
    insertGradeRec.run(st2, cMathNat, sem2, 84, 85, 80, 82, 82.15, 'B+', 3.5, 1, uInst1);
    insertGradeRec.run(st2, cEng, sem2, 76, 79, 75, 78, 77.2, 'B', 3.0, 1, uInst2);

    // Bereket (st4) - Natural Science
    insertGradeRec.run(st4, cPhys, sem2, 86, 84, 88, 85, 85.7, 'A-', 3.75, 1, uInst1);
    insertGradeRec.run(st4, cChem, sem2, 82, 85, 80, 83, 82.45, 'B+', 3.5, 1, uInst1);
    insertGradeRec.run(st4, cMathNat, sem2, 90, 88, 87, 91, 89.45, 'A-', 3.75, 1, uInst1);
    insertGradeRec.run(st4, cEng, sem2, 80, 82, 79, 81, 80.55, 'B+', 3.5, 1, uInst2);

    // Hanna (st3) - Social Science (15%, 25%, 20%, 40%)
    insertGradeRec.run(st3, cEcon, sem2, 91, 93, 89, 92, 91.5, 'A', 4.0, 1, uInst2);
    insertGradeRec.run(st3, cHist, sem2, 87, 90, 85, 88, 87.75, 'A-', 3.75, 1, uInst2);

    // 15. Attendance
    const insertAtt = db.prepare(`
      INSERT INTO attendance (student_id, course_id, attendance_type, attendance_date, status, remarks, recorded_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAtt.run(st1, cPhys, 'classroom', '2026-11-10', 'present', 'Lab session complete', uInst1);
    insertAtt.run(st1, cPhys, 'classroom', '2026-11-12', 'present', '', uInst1);
    insertAtt.run(st1, cMathNat, 'classroom', '2026-11-12', 'present', '', uInst1);
    insertAtt.run(st1, null, 'dormitory', '2026-11-12', 'present', 'Evening study roll call', uRegistrar);

    insertAtt.run(st2, cPhys, 'classroom', '2026-11-10', 'present', '', uInst1);
    insertAtt.run(st2, cPhys, 'classroom', '2026-11-12', 'absent', 'Infirmary visit', uInst1);
    insertAtt.run(st2, cMathNat, 'classroom', '2026-11-12', 'late', 'Arrived 5 mins late', uInst1);

    insertAtt.run(st3, cEcon, 'classroom', '2026-11-11', 'present', '', uInst2);
    insertAtt.run(st3, cHist, 'classroom', '2026-11-12', 'present', '', uInst2);

    // 16. Schedules
    const insertSched = db.prepare('INSERT INTO schedules (course_id, semester_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?)');
    insertSched.run(cPhys, sem2, 'Monday', '08:30', '10:00', 'Science Lab B-02');
    insertSched.run(cMathNat, sem2, 'Tuesday', '10:15', '11:45', 'Hall N-104');
    insertSched.run(cChem, sem2, 'Wednesday', '08:30', '10:00', 'Chemistry Lab A-01');
    insertSched.run(cEng, sem2, 'Thursday', '14:00', '15:30', 'Humanities Wing 201');
    insertSched.run(cEcon, sem2, 'Monday', '10:15', '11:45', 'Social Wing 302');
    insertSched.run(cHist, sem2, 'Wednesday', '14:00', '15:30', 'Social Wing 304');

    // 17. Payments & Receipts (Sara, Hanna, Bereket verified; Yonas pending!)
    const insertPay = db.prepare(`
      INSERT INTO payments (student_id, academic_year_id, semester_id, amount_etb, payment_method, transaction_ref, status, notes, verified_by_user_id, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const p1 = Number(insertPay.run(st1, year2026, sem2, 14500, 'Bank Deposit', 'CBE-HOS-884210', 'verified', 'Semester II Tuition & Boarding Fee', uFinance, '2026-02-10T09:15:00Z').lastInsertRowid);
    insertPay.run(st2, year2026, sem2, 14500, 'Telebirr Reference', 'TBR-991042', 'pending', 'Awaiting cashier bank slip reconciliation', null, null);
    const p3 = Number(insertPay.run(st3, year2026, sem2, 14500, 'Bank Deposit', 'CBE-HOS-884509', 'verified', 'Semester II Full Clearance', uFinance, '2026-02-11T11:30:00Z').lastInsertRowid);
    const p4 = Number(insertPay.run(st4, year2026, sem2, 14500, 'Cashier Office', 'CSH-HOS-10442', 'verified', 'Cashier receipt verified', uFinance, '2026-02-12T10:00:00Z').lastInsertRowid);

    const insertRcpt = db.prepare('INSERT INTO payment_receipts (payment_id, receipt_number, issued_by_user_id) VALUES (?, ?, ?)');
    insertRcpt.run(p1, 'RCPT-LGBS-2026-0001', uFinance);
    insertRcpt.run(p3, 'RCPT-LGBS-2026-0002', uFinance);
    insertRcpt.run(p4, 'RCPT-LGBS-2026-0003', uFinance);

    // 18. Certificates
    db.prepare(`
      INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
      VALUES ('CERT-LGBS-2026-001', ?, ?, 'Honor Roll', ?, 'issued')
    `).run(st1, year2026, uRegistrar);
    db.prepare(`
      INSERT INTO certificates (certificate_number, student_id, academic_year_id, certificate_type, issued_by_user_id, status)
      VALUES ('CERT-LGBS-2026-002', ?, ?, 'Academic Completion', ?, 'issued')
    `).run(st3, year2026, uRegistrar);

    // 19. Announcements & Notifications
    const insertAnn = db.prepare('INSERT INTO announcements (title, body, target_role, course_id, author_user_id, is_public) VALUES (?, ?, ?, ?, ?, ?)');
    insertAnn.run('2025/2026 Semester II Mid-Term Examination Schedule Released', 'All Grade 9–12 boarding students must review their Natural Science and Social Science examination timetables via the student portal prior to Monday morning assembly.', 'ALL', null, uAdmin, 1);
    insertAnn.run('Fee Verification Deadline for Semester II Report Cards', 'Students with pending tuition reconciliation should submit bank deposit slips to the Finance Verification Office in Hosanna campus to unlock official report card downloads.', 'STUDENT', null, uFinance, 1);
    insertAnn.run('Physics Lab Practical Session — Group B', 'Please bring your lab manual and calculator for projectile motion verification in Science Lab B-02.', 'STUDENT', cPhys, uInst1, 0);

    const insertNotif = db.prepare('INSERT INTO notifications (user_id, title, message, category, is_read) VALUES (?, ?, ?, ?, ?)');
    insertNotif.run(uStu1, 'Semester II Grades Published', 'Your PHYS-111 and MATH-111 marks have been posted and verified.', 'grade', 0);
    insertNotif.run(uStu2, 'Fee Clearance Pending', 'Your Semester II payment (TBR-991042) is awaiting verification before official report cards unlock.', 'finance', 0);
    insertNotif.run(uInst1, 'New Submission Received', 'Kinematics & Force Equilibrium Quiz is open for Grade 11 Natural Science.', 'assessment', 0);

    // 20. Discussions
    const disc1 = Number(
      db.prepare('INSERT INTO discussions (course_id, author_user_id, title, body) VALUES (?, ?, ?, ?)').run(
        cPhys,
        uStu1,
        'Clarification on Projectile Range at Elevated Launch Height',
        'When a projectile is launched from a 15m platform at 30 degrees, should we use the quadratic time-of-flight equation instead of the symmetric ground range formula?',
      ).lastInsertRowid,
    );
    db.prepare('INSERT INTO discussion_replies (discussion_id, author_user_id, body) VALUES (?, ?, ?)').run(
      disc1,
      uInst1,
      'Yes, Sara. The symmetric formula R = (v^2 sin 2θ)/g only holds when Δy = 0. For elevated launches, solve y(t) = y0 + v0y*t - 0.5*g*t^2 = 0 first.',
    );

    // 21. Audit Log seed
    db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'SYSTEM_SEED', 'DATABASE', 'init', 'Initialized Lich Gogo Excellence Boarding School LMS sample dataset (Hosanna, Ethiopia)')").run(uAdmin);

    // Ensure sem1 is referenced so no unused warning
    void sem1;
  });

  tx();
}
