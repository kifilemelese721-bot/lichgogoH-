# Testing & Verification Guide — Lich Gogo LMS

## 1. Automated Unit Tests (`src/lib/gradingEngine.test.ts`)

Run `npm test` (`tsx --test src/lib/gradingEngine.test.ts`):
- Rejects marks `< 0`, `> 100`, and `NaN`
- Computes weighted subject totals using configurable Natural Science vs Social Science stream weights
- Computes GPA against configurable grading scale
- Computes standard competition class rankings with tie handling
- Enforces financial fee clearance rule (`pending` / `rejected` / empty blocks access; `verified` unlocks)
- Enforces assessment submission deadline lock unless late submission is enabled
- Calculates attendance percentage accurately

## 2. Functional & Security Verification Scenarios

1. **Invalid Login Credentials**: Returns HTTP `401` and records `LOGIN_FAILED` in `audit_logs`.
2. **Role-Based Access Control (RBAC)**: Attempting `/api/admin/*` or `/api/finance/*` with a Student token returns HTTP `403` and logs `UNAUTHORIZED_ACCESS_ATTEMPT`.
3. **Duplicate Student ID Prevention**: Registering a duplicate `studentCode` returns HTTP `409`.
4. **Marks Validation (`0–100`)**: Entering `-5` or `105` in Gradebook is rejected by both UI and `/api/instructor/grades` (`400`).
5. **Duplicate Attendance Prevention**: Saving attendance twice for the same course and date returns HTTP `409 DUPLICATE_ATTENDANCE` unless `Authorized Correction Mode` is enabled.
6. **Student IDOR Protection**: `/api/student/results?studentId=1` when logged in as Student #2 returns HTTP `403` and logs `IDOR_BLOCKED`.
7. **Financial Clearance Gate**: Logging in as `yonas.g@lichgogo.edu.et` (Fee Pending) locks Academic Results (`403 FEE_CLEARANCE_REQUIRED`); verifying his payment as `finance@lichgogo.edu.et` generates a unique receipt (`RCPT-LGBS-2026-...`) and immediately unlocks his Academic Results and PDF Report Card.
