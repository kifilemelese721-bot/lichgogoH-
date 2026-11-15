# Lich Gogo Excellence Boarding School — E-Learning Management System (LMS)

**Institution:** Lich Gogo Excellence Boarding School, Hosanna, Hadiya Zone, Ethiopia  
**Architecture:** Full-stack Three-Tier Web Application (React + TypeScript + Tailwind CSS / Express.js REST API / Relational SQL Database)

## Key Capabilities

1. **Public Institutional Website**: Home, About Us, filterable Course Directory (Natural Science & Social Science streams), Live Announcements, Contact Admissions Form, and Portal Authentication (Login, Student Registration, Password Reset).
2. **Role-Based Access Control (RBAC)**:
   - **Administrator**: KPI analytics (Chart.js), User & Account CRUD, Role/Permission Matrix, Course Categories/Courses/Schedules, Configurable Stream Grading Weights & Grading Scales, System JSON Backup, Institutional Reports, and Security Audit Logs.
   - **Instructor**: Course Materials upload/download, Assessment & Quiz builder with deadlines, Submissions review, Automated Gradebook (`0–100` validated), Duplicate-locked Daily Attendance tracking, and Course Announcements/Discussion Moderation.
   - **Student**: Scholar profile, Stream Course Enrollment & Timetable, Material Downloads, Timed Online Assessments with deadline locks, Academic Results / GPA / Class Rank (**enforces verified Financial Fee Clearance Gate**), Personal Attendance, Discussion Forum, and Payment Receipt PDFs.
   - **Registrar**: Student Enrollment with unique ID validation, Single-Stream Assignment (`Natural Science` / `Social Science`), Academic Grade Verification, Official Report Card Generator (Print + PDF), and Institutional Certificate Issuance (`CERT-LGBS-...`).
   - **Finance Verification**: Payment recording, Transaction Verification/Rejection, Automatic Unique Receipt Issuance (`RCPT-LGBS-...`), and Outstanding Fee Watchlist.

## Project Folder Structure

- `/server.ts` — Express + Vite server entrypoint (Port 3000)
- `/server/db.ts` — Normalized 30+ table relational schema (`better-sqlite3`) and deterministic sample seed
- `/server/auth.ts` — JWT session auth, `bcryptjs` hashing, RBAC guards, audit logging
- `/server/services/academicService.ts` — Backend grading, ranking, and clearance orchestration
- `/server/routes/` — Modular REST API routers (`public`, `auth`, `admin`, `instructor`, `student`, `registrar`, `finance`, `shared`)
- `/src/lib/gradingEngine.ts` — Pure domain calculations (marks validation, weighted GPA, class rank, fee clearance)
- `/src/lib/gradingEngine.test.ts` — Node test suite (`node:test`)
- `/src/components/` — Public site, Auth view, Dashboard shell, and all 5 role-based dashboards
- `/src/utils/pdfGenerator.ts` — `jspdf` Report Card, Certificate, and Receipt PDF generators
- `/database/schema_mysql.sql` & `/database/seed_mysql.sql` — MySQL 8.0 3NF DDL and sample data scripts

## Local Installation & Running

```bash
npm install
npm test        # Runs pure logic unit tests via tsx --test
npm run lint    # TypeScript verification
npm run dev     # Starts Express + Vite on http://localhost:3000
npm run build   # Builds production client & server.js bundle
npm start       # Runs production server on port 3000
```

## Sample Portal Credentials

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Administrator | `admin@lichgogo.edu.et` | `Admin@2026` | Full system access |
| Instructor | `dawit.t@lichgogo.edu.et` | `Teacher@2026` | Natural Science courses |
| Student (Cleared) | `sara.m@lichgogo.edu.et` | `Student@2026` | Verified fee clearance |
| Student (Pending) | `yonas.g@lichgogo.edu.et` | `Student@2026` | Demonstrates fee clearance gate |
| Registrar | `registrar@lichgogo.edu.et` | `Registrar@2026` | Enrollment, Report Cards, Certificates |
| Finance Staff | `finance@lichgogo.edu.et` | `Finance@2026` | Payment verification & receipts |
