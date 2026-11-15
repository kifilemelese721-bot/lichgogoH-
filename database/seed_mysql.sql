-- Lich Gogo Excellence Boarding School LMS — Sample Seed Data (MySQL)
USE lich_gogo_lms;

INSERT INTO roles (name, description) VALUES
('ADMIN', 'Full system administration and configuration'),
('INSTRUCTOR', 'Course materials, assessments, grading, and attendance'),
('STUDENT', 'Course enrollment, materials, assessments, and results'),
('REGISTRAR', 'Student enrollment, streams, report cards, and certificates'),
('FINANCE', 'Tuition fee verification and official receipt issuance');

INSERT INTO academic_years (name, start_date, end_date, is_active) VALUES
('2025/2026', '2025-09-12', '2026-06-30', 1);

INSERT INTO semesters (academic_year_id, name, start_date, end_date, is_active) VALUES
(1, 'Semester I', '2025-09-12', '2026-01-30', 0),
(1, 'Semester II', '2026-02-05', '2026-06-30', 1);

INSERT INTO grades (name, level_order) VALUES
('Grade 9', 9), ('Grade 10', 10), ('Grade 11', 11), ('Grade 12', 12);

INSERT INTO academic_streams (code, name, description) VALUES
('NATURAL_SCIENCE', 'Natural Science', 'Physics, Chemistry, Biology, Advanced Mathematics for STEM pathways.'),
('SOCIAL_SCIENCE', 'Social Science', 'Economics, Geography, History, and Civics for humanities pathways.');

INSERT INTO course_categories (name, description) VALUES
('Physical & Biological Sciences', 'Core Natural Science courses'),
('Mathematics & Computing', 'Analytical mathematics and quantitative reasoning'),
('Economics & Social Studies', 'Social sciences and historical inquiry'),
('Languages & Communication', 'Academic English and literature');
