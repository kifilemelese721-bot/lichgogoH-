-- Lich Gogo Excellence Boarding School LMS — Normalized MySQL 8.0 Schema (3NF)
-- Location: Hosanna, Ethiopia

CREATE DATABASE IF NOT EXISTS lich_gogo_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lich_gogo_lms;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  module VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  is_sample_data TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE academic_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE semesters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year_id INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_year_sem (academic_year_id, name),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,
  level_order INT NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE academic_streams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code ENUM('NATURAL_SCIENCE', 'SOCIAL_SCIENCE') NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  student_code VARCHAR(40) NOT NULL UNIQUE,
  gender ENUM('Male', 'Female') NOT NULL,
  date_of_birth DATE NOT NULL,
  dormitory_block VARCHAR(80) NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  guardian_phone VARCHAR(40) NOT NULL,
  grade_id INT NOT NULL,
  stream_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  enrollment_status ENUM('enrolled', 'transferred', 'graduated', 'suspended') NOT NULL DEFAULT 'enrolled',
  is_sample_data TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (grade_id) REFERENCES grades(id),
  FOREIGN KEY (stream_id) REFERENCES academic_streams(id),
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
) ENGINE=InnoDB;

CREATE TABLE instructors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL,
  qualification VARCHAR(120) NOT NULL,
  is_sample_data TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE course_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(24) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category_id INT NOT NULL,
  grade_id INT NOT NULL,
  stream_id INT NULL,
  credit_hours INT NOT NULL DEFAULT 4,
  is_sample_data TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES course_categories(id),
  FOREIGN KEY (grade_id) REFERENCES grades(id),
  FOREIGN KEY (stream_id) REFERENCES academic_streams(id)
) ENGINE=InnoDB;

CREATE TABLE course_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  instructor_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  semester_id INT NOT NULL,
  UNIQUE KEY uq_course_term (course_id, academic_year_id, semester_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB;

CREATE TABLE student_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  semester_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active', 'dropped', 'completed') NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_stu_course_sem (student_id, course_id, semester_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB;

CREATE TABLE course_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  uploaded_by_user_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  material_type ENUM('pdf', 'presentation', 'video', 'document') NOT NULL,
  description TEXT NOT NULL,
  file_name VARCHAR(180) NOT NULL,
  stored_path VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  semester_id INT NOT NULL,
  created_by_user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  assessment_type ENUM('quiz', 'assignment', 'midterm', 'final_exam') NOT NULL,
  description TEXT NOT NULL,
  total_marks DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  duration_minutes INT NOT NULL DEFAULT 30,
  deadline DATETIME NOT NULL,
  allow_late_submission TINYINT(1) NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (semester_id) REFERENCES semesters(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE assessment_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('mcq', 'short_answer') NOT NULL,
  options_json JSON NOT NULL,
  correct_option VARCHAR(255) DEFAULT '',
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE student_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  student_id INT NOT NULL,
  answers_json JSON NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('submitted', 'graded') NOT NULL DEFAULT 'submitted',
  UNIQUE KEY uq_assess_stu (assessment_id, student_id),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE assessment_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL UNIQUE,
  assessment_id INT NOT NULL,
  student_id INT NOT NULL,
  marks_obtained DECIMAL(5,2) NOT NULL CHECK (marks_obtained BETWEEN 0 AND 100),
  feedback TEXT NOT NULL,
  graded_by_user_id INT NOT NULL,
  graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE grades_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  semester_id INT NOT NULL,
  quiz_score DECIMAL(5,2) NULL CHECK (quiz_score IS NULL OR quiz_score BETWEEN 0 AND 100),
  assignment_score DECIMAL(5,2) NULL CHECK (assignment_score IS NULL OR assignment_score BETWEEN 0 AND 100),
  midterm_score DECIMAL(5,2) NULL CHECK (midterm_score IS NULL OR midterm_score BETWEEN 0 AND 100),
  final_exam_score DECIMAL(5,2) NULL CHECK (final_exam_score IS NULL OR final_exam_score BETWEEN 0 AND 100),
  total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  letter_grade VARCHAR(8) NOT NULL DEFAULT 'N/A',
  grade_point DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  verified_by_registrar TINYINT(1) NOT NULL DEFAULT 0,
  updated_by_user_id INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grade_stu_crs_sem (student_id, course_id, semester_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (semester_id) REFERENCES semesters(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NULL,
  attendance_type ENUM('classroom', 'dormitory') NOT NULL DEFAULT 'classroom',
  attendance_date DATE NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
  remarks VARCHAR(255) DEFAULT '',
  recorded_by_user_id INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_att_unique (student_id, course_id, attendance_type, attendance_date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  semester_id INT NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(80) NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
) ENGINE=InnoDB;

CREATE TABLE announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  target_role VARCHAR(20) NOT NULL DEFAULT 'ALL',
  course_id INT NULL,
  author_user_id INT NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('academic', 'assessment', 'grade', 'finance', 'system') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE discussions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  author_user_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE discussion_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discussion_id INT NOT NULL,
  author_user_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  semester_id INT NOT NULL,
  amount_etb DECIMAL(10,2) NOT NULL CHECK (amount_etb > 0),
  payment_method ENUM('Bank Deposit', 'Telebirr Reference', 'Cashier Office') NOT NULL,
  transaction_ref VARCHAR(80) NOT NULL UNIQUE,
  status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  notes VARCHAR(300) DEFAULT '',
  verified_by_user_id INT NULL,
  verified_at TIMESTAMP NULL,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (semester_id) REFERENCES semesters(id),
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE payment_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL UNIQUE,
  receipt_number VARCHAR(64) NOT NULL UNIQUE,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issued_by_user_id INT NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_number VARCHAR(64) NOT NULL UNIQUE,
  student_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  certificate_type ENUM('Academic Completion', 'Honor Roll', 'Stream Graduation') NOT NULL,
  issued_by_user_id INT NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('issued', 'revoked') NOT NULL DEFAULT 'issued',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE academic_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(64) NOT NULL,
  academic_year_id INT NOT NULL,
  semester_id INT NULL,
  generated_by_user_id INT NOT NULL,
  summary_json JSON NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
  FOREIGN KEY (semester_id) REFERENCES semesters(id),
  FOREIGN KEY (generated_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) DEFAULT '',
  details TEXT,
  ip_address VARCHAR(64) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
