-- ============================================================
-- 010_seed_demo_data.sql
-- Passwords are bcrypt hashes of the values in comments.
-- Hash rounds: 10  (generate with: node -e "const b=require('bcrypt');b.hash('Admin@123',10).then(console.log)")
-- ============================================================

-- ──────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────
INSERT INTO users (id, name, email, password_hash, role, department, manager_id) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Priya Sharma',
    'admin@goalsynce.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@123  (placeholder; see note)
    'admin',
    'HR',
    NULL
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Rahul Verma',
    'manager@goalsynce.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Manager@123 (placeholder)
    'manager',
    'Sales',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Aarav Singh',
    'employee@goalsynce.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Employee@123 (placeholder)
    'employee',
    'Sales',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Meera Patel',
    'employee2@goalsynce.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Employee@123 (placeholder)
    'employee',
    'Sales',
    '00000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- NOTE: The password_hash above is the bcrypt hash of "password"
-- (the well-known test hash from Laravel).  The seed script
-- (server/src/scripts/seed.js) will RE-HASH the real passwords
-- at boot time so demo logins actually work.
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- ACTIVE CYCLE  (FY 2025-26, Q1 window currently open)
-- ──────────────────────────────────────────────
INSERT INTO goal_cycles (
  id, name, year,
  phase1_start, phase1_end,
  q1_start, q1_end,
  q2_start, q2_end,
  q3_start, q3_end,
  q4_start, q4_end,
  is_active, created_by
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  'FY 2025-26',
  2025,
  '2025-04-01', '2025-04-30',
  '2025-07-01', '2025-07-31',
  '2025-10-01', '2025-10-31',
  '2026-01-01', '2026-01-31',
  '2026-04-01', '2026-04-30',
  TRUE,
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- THRUST AREAS
-- ──────────────────────────────────────────────
INSERT INTO thrust_areas (id, name, description, cycle_id, created_by, is_active) VALUES
  ('00000000-0000-0000-0000-000000000020', 'Sales Growth',           'Revenue, new accounts, pipeline',   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', TRUE),
  ('00000000-0000-0000-0000-000000000021', 'Customer Experience',    'NPS, CSAT, retention',               '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', TRUE),
  ('00000000-0000-0000-0000-000000000022', 'Operational Efficiency', 'TAT, cost, process improvement',    '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', TRUE),
  ('00000000-0000-0000-0000-000000000023', 'People Development',     'Training, mentoring, skills',        '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', TRUE),
  ('00000000-0000-0000-0000-000000000024', 'Digital Transformation', 'Automation, tools, digital adoption','00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- ESCALATION RULES (defaults)
-- ──────────────────────────────────────────────
INSERT INTO escalation_rules (id, rule_type, days_threshold, is_active, created_by) VALUES
  ('00000000-0000-0000-0000-000000000030', 'goal_not_submitted', 7,  TRUE, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000031', 'goal_not_approved',  5,  TRUE, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000032', 'checkin_not_done',   3,  TRUE, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
