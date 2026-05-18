// server/src/scripts/seed.js
// Run: npm run seed
// Resets the demo database to a rich, interactive state.
// Current date context: May 2026 → cycle is in Q1 check-in window.

'use strict';

require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SALT_ROUNDS = 10;

// ── Credentials ──────────────────────────────────────────────────────────────
const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Priya Sharma',
    email: 'admin@nucleas.com',
    password: 'Admin@123',
    role: 'admin',
    department: 'HR',
    manager_id: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Rahul Verma',
    email: 'manager@nucleas.com',
    password: 'Manager@123',
    role: 'manager',
    department: 'Sales',
    manager_id: '00000000-0000-0000-0000-000000000001',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Aarav Singh',
    email: 'employee@nucleas.com',
    password: 'Employee@123',
    role: 'employee',
    department: 'Sales',
    manager_id: '00000000-0000-0000-0000-000000000002',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Meera Patel',
    email: 'employee2@nucleas.com',
    password: 'Employee@123',
    role: 'employee',
    department: 'Sales',
    manager_id: '00000000-0000-0000-0000-000000000002',
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── 1. Upsert users ───────────────────────────────────────────────────────
    console.log('[Seed] Upserting users with bcrypt hashes…');
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, role, department, manager_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          name          = EXCLUDED.name,
          email         = EXCLUDED.email,
          role          = EXCLUDED.role,
          department    = EXCLUDED.department,
          manager_id    = EXCLUDED.manager_id,
          is_active     = TRUE
      `, [u.id, u.name, u.email, hash, u.role, u.department, u.manager_id]);
      console.log(`[Seed]   ✓ ${u.email}`);
    }

    // ── 2. Cycle — FY 2026-27, Q1 window currently open (May 2026) ───────────
    // Phase 1 (goal setting): 2026-04-01 → 2026-04-30  (closed — goals are set)
    // Q1  check-in window:    2026-05-01 → 2026-07-31  ← TODAY IS IN Q1
    // Q2  check-in window:    2026-08-01 → 2026-10-31
    // Q3  check-in window:    2026-11-01 → 2027-01-31
    // Q4  check-in window:    2027-02-01 → 2027-04-30
    console.log('[Seed] Updating cycle to FY 2026-27 with Q1 window open…');
    await client.query(`
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
        'FY 2026-27', 2026,
        '2026-04-01', '2026-04-30',
        '2026-05-01', '2026-07-31',
        '2026-08-01', '2026-10-31',
        '2026-11-01', '2027-01-31',
        '2027-02-01', '2027-04-30',
        TRUE,
        '00000000-0000-0000-0000-000000000001'
      )
      ON CONFLICT (id) DO UPDATE SET
        name         = EXCLUDED.name,
        year         = EXCLUDED.year,
        phase1_start = EXCLUDED.phase1_start,
        phase1_end   = EXCLUDED.phase1_end,
        q1_start     = EXCLUDED.q1_start,
        q1_end       = EXCLUDED.q1_end,
        q2_start     = EXCLUDED.q2_start,
        q2_end       = EXCLUDED.q2_end,
        q3_start     = EXCLUDED.q3_start,
        q3_end       = EXCLUDED.q3_end,
        q4_start     = EXCLUDED.q4_start,
        q4_end       = EXCLUDED.q4_end,
        is_active    = TRUE
    `);
    console.log('[Seed]   ✓ Cycle updated — Q1 check-in window now active');

    // ── 3. Thrust areas ───────────────────────────────────────────────────────
    console.log('[Seed] Upserting thrust areas…');
    const thrustAreas = [
      { id: '00000000-0000-0000-0000-000000000020', name: 'Sales Growth',           desc: 'Revenue, new accounts, pipeline growth' },
      { id: '00000000-0000-0000-0000-000000000021', name: 'Customer Experience',    desc: 'NPS, CSAT, retention & satisfaction' },
      { id: '00000000-0000-0000-0000-000000000022', name: 'Operational Efficiency', desc: 'TAT, cost reduction, process improvement' },
      { id: '00000000-0000-0000-0000-000000000023', name: 'People Development',     desc: 'Training, mentoring, skills enhancement' },
      { id: '00000000-0000-0000-0000-000000000024', name: 'Digital Transformation', desc: 'Automation, tools & digital adoption' },
    ];
    for (const ta of thrustAreas) {
      await client.query(`
        INSERT INTO thrust_areas (id, name, description, cycle_id, created_by, is_active)
        VALUES ($1,$2,$3,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',TRUE)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = TRUE
      `, [ta.id, ta.name, ta.desc]);
    }
    console.log('[Seed]   ✓ 5 thrust areas');

    // ── 4. Wipe existing goals + achievements + check-ins for clean slate ─────
    console.log('[Seed] Clearing old goals data…');
    await client.query(`DELETE FROM manager_checkins WHERE goal_id IN (
      SELECT id FROM goals WHERE cycle_id = '00000000-0000-0000-0000-000000000010'
    )`);
    await client.query(`DELETE FROM goal_achievements WHERE goal_id IN (
      SELECT id FROM goals WHERE cycle_id = '00000000-0000-0000-0000-000000000010'
    )`);
    await client.query(`DELETE FROM goals WHERE cycle_id = '00000000-0000-0000-0000-000000000010'`);

    // ── 5. Aarav Singh — 4 approved goals + Q1 actuals already logged ─────────
    // Scenario: Aarav's goals were approved in Phase 1; Q1 actuals are submitted.
    console.log('[Seed] Creating Aarav Singh goals (approved + Q1 actuals)…');
    const aaravGoals = [
      {
        id: '00000000-0000-0000-0001-000000000001',
        thrust_area_id: '00000000-0000-0000-0000-000000000020',
        title: 'Achieve ₹50L quarterly sales revenue',
        description: 'Drive new business to hit ₹50 lakh in Q1 revenue. Focus on enterprise pipeline and upsell to existing accounts.',
        uom_type: 'min', target_value: 5000000, weightage: 30, status: 'approved', is_locked: true,
        q1_actual: 4600000, q1_status: 'on_track',
      },
      {
        id: '00000000-0000-0000-0001-000000000002',
        thrust_area_id: '00000000-0000-0000-0000-000000000021',
        title: 'Maintain NPS score above 70',
        description: 'Ensure customer satisfaction stays above 70 NPS through consistent follow-ups and quality service.',
        uom_type: 'min', target_value: 70, weightage: 25, status: 'approved', is_locked: true,
        q1_actual: 74, q1_status: 'completed',
      },
      {
        id: '00000000-0000-0000-0001-000000000003',
        thrust_area_id: '00000000-0000-0000-0000-000000000022',
        title: 'Reduce average deal closure time to 14 days',
        description: 'Optimise follow-up cadence and pipeline reviews to close deals in under 2 weeks.',
        uom_type: 'max', target_value: 14, weightage: 25, status: 'approved', is_locked: true,
        q1_actual: 11, q1_status: 'completed',
      },
      {
        id: '00000000-0000-0000-0001-000000000004',
        thrust_area_id: '00000000-0000-0000-0000-000000000023',
        title: 'Complete 3 product certifications',
        description: 'Obtain 3 vendor certifications by year-end to improve solution selling capability.',
        uom_type: 'min', target_value: 3, weightage: 20, status: 'approved', is_locked: true,
        q1_actual: 1, q1_status: 'on_track',
      },
    ];

    for (const g of aaravGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, weightage, status, is_locked)
        VALUES ($1,'00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000010',
                $2,$3,$4,$5,$6,$7,$8,$9)
      `, [g.id, g.thrust_area_id, g.title, g.description,
          g.uom_type, g.target_value, g.weightage, g.status, g.is_locked]);

      // Q1 actuals already submitted
      await client.query(`
        INSERT INTO goal_achievements (goal_id, quarter, actual_value, goal_status)
        VALUES ($1, 'Q1', $2, $3)
        ON CONFLICT (goal_id, quarter) DO UPDATE SET
          actual_value = EXCLUDED.actual_value, goal_status = EXCLUDED.goal_status
      `, [g.id, g.q1_actual, g.q1_status]);
    }
    console.log('[Seed]   ✓ Aarav: 4 approved goals + Q1 actuals');

    // Manager Q1 check-in comments for Aarav
    const aaravCheckins = [
      {
        goal_id: '00000000-0000-0000-0001-000000000001',
        comment: 'Good progress on revenue — ₹46L of ₹50L target. Push the two enterprise accounts in pipeline to close in Q2. Keep daily stand-ups with the BD team.',
      },
      {
        goal_id: '00000000-0000-0000-0001-000000000002',
        comment: 'NPS at 74 — excellent! This is above target. Maintain the follow-up SOP and ensure the new customers onboarded this quarter get a proper 30-day review.',
      },
      {
        goal_id: '00000000-0000-0000-0001-000000000003',
        comment: 'Closure time at 11 days — ahead of the 14-day target. Document the process improvements you made so the team can replicate this in Q2.',
      },
      {
        goal_id: '00000000-0000-0000-0001-000000000004',
        comment: 'One certification completed — good start. Aim for the second certification by mid-Q2. I will share the learning platform voucher by end of week.',
      },
    ];
    for (const c of aaravCheckins) {
      await client.query(`
        INSERT INTO manager_checkins (goal_id, manager_id, quarter, comment)
        VALUES ($1, '00000000-0000-0000-0000-000000000002', 'Q1', $2)
        ON CONFLICT (goal_id, manager_id, quarter) DO UPDATE SET comment = EXCLUDED.comment
      `, [c.goal_id, c.comment]);
    }
    console.log('[Seed]   ✓ Aarav: Q1 manager check-in comments added');

    // ── 6. Meera Patel — 3 approved goals, NO Q1 actuals yet ──────────────────
    // Scenario: Goals approved, but Meera hasn't logged Q1 actuals — she needs to.
    console.log('[Seed] Creating Meera Patel goals (approved, Q1 actuals pending)…');
    const meeraGoals = [
      {
        id: '00000000-0000-0000-0002-000000000001',
        thrust_area_id: '00000000-0000-0000-0000-000000000020',
        title: 'Generate 20 new qualified leads per month',
        description: 'Use LinkedIn outreach, referral programs and cold outreach to build a consistent pipeline of 20 qualified leads monthly.',
        uom_type: 'min', target_value: 20, weightage: 35, status: 'approved', is_locked: true,
      },
      {
        id: '00000000-0000-0000-0002-000000000002',
        thrust_area_id: '00000000-0000-0000-0000-000000000024',
        title: 'Implement CRM automation for follow-ups',
        description: 'Configure automated follow-up sequences in Zoho CRM to eliminate manual reminders and reduce response time.',
        uom_type: 'zero', target_value: null, weightage: 35, status: 'approved', is_locked: true,
      },
      {
        id: '00000000-0000-0000-0002-000000000003',
        thrust_area_id: '00000000-0000-0000-0000-000000000023',
        title: 'Mentor 2 junior sales associates',
        description: 'Conduct weekly 1:1s and shadow sessions with 2 junior BDs to improve their pitch quality and objection handling.',
        uom_type: 'min', target_value: 2, weightage: 30, status: 'approved', is_locked: true,
      },
    ];
    for (const g of meeraGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, weightage, status, is_locked)
        VALUES ($1,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000010',
                $2,$3,$4,$5,$6,$7,$8,$9)
      `, [g.id, g.thrust_area_id, g.title, g.description,
          g.uom_type, g.target_value, g.weightage, g.status, g.is_locked]);
    }
    // One check-in from manager for Meera
    await client.query(`
      INSERT INTO manager_checkins (goal_id, manager_id, quarter, comment)
      VALUES ('00000000-0000-0000-0002-000000000001',
              '00000000-0000-0000-0000-000000000002', 'Q1',
              'Meera, please log your Q1 actuals by end of this week. Target is 20 leads/month — track in the shared sheet.')
      ON CONFLICT (goal_id, manager_id, quarter) DO NOTHING
    `);
    console.log('[Seed]   ✓ Meera: 3 approved goals (Q1 actuals pending — she must log them)');

    // ── 7. Rahul Verma (manager) — 2 approved personal goals ─────────────────
    console.log('[Seed] Creating Rahul Verma manager goals…');
    const rahulGoals = [
      {
        id: '00000000-0000-0000-0005-000000000001',
        thrust_area_id: '00000000-0000-0000-0000-000000000020',
        title: 'Drive team to achieve ₹1.5Cr quarterly revenue',
        description: 'Lead the Sales team to collectively achieve ₹1.5 crore in Q1 revenue across all accounts.',
        uom_type: 'min', target_value: 15000000, weightage: 50, status: 'approved', is_locked: true,
        q1_actual: 12800000, q1_status: 'on_track',
      },
      {
        id: '00000000-0000-0000-0005-000000000002',
        thrust_area_id: '00000000-0000-0000-0000-000000000023',
        title: 'Complete executive leadership certification',
        description: 'Complete the IIM leadership program by Q3 to strengthen strategic management capabilities.',
        uom_type: 'zero', target_value: null, weightage: 50, status: 'approved', is_locked: true,
        q1_actual: 0, q1_status: 'on_track',
      },
    ];
    for (const g of rahulGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, weightage, status, is_locked)
        VALUES ($1,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000010',
                $2,$3,$4,$5,$6,$7,$8,$9)
      `, [g.id, g.thrust_area_id, g.title, g.description,
          g.uom_type, g.target_value, g.weightage, g.status, g.is_locked]);
      await client.query(`
        INSERT INTO goal_achievements (goal_id, quarter, actual_value, goal_status)
        VALUES ($1, 'Q1', $2, $3)
        ON CONFLICT (goal_id, quarter) DO UPDATE SET
          actual_value = EXCLUDED.actual_value, goal_status = EXCLUDED.goal_status
      `, [g.id, g.q1_actual, g.q1_status]);
    }
    console.log('[Seed]   ✓ Rahul: 2 approved goals + Q1 actuals');

    // ── 8. Shared company goal (pushed by admin to both employees) ────────────
    console.log('[Seed] Creating shared company KPI goal…');
    // Template (owned by admin)
    await client.query(`
      INSERT INTO goals
        (id, employee_id, cycle_id, thrust_area_id, title, description,
         uom_type, target_value, weightage, status, is_shared, is_locked)
      VALUES (
        '00000000-0000-0000-0099-000000000001',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000022',
        'Zero safety incidents — FY 2026-27',
        'Company-wide mandatory safety KPI. Zero recordable incidents across the full financial year.',
        'zero', NULL, 0, 'approved', TRUE, TRUE
      )
      ON CONFLICT (id) DO NOTHING
    `);
    // Child for Aarav
    await client.query(`
      INSERT INTO goals
        (id, employee_id, cycle_id, thrust_area_id, title, description,
         uom_type, target_value, weightage, status, is_shared, is_locked, parent_goal_id)
      VALUES (
        '00000000-0000-0000-0003-000000000001',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000022',
        'Zero safety incidents — FY 2026-27',
        'Company-wide mandatory safety KPI.',
        'zero', NULL, 0, 'approved', TRUE, TRUE,
        '00000000-0000-0000-0099-000000000001'
      )
      ON CONFLICT (id) DO NOTHING
    `);
    // Child for Meera
    await client.query(`
      INSERT INTO goals
        (id, employee_id, cycle_id, thrust_area_id, title, description,
         uom_type, target_value, weightage, status, is_shared, is_locked, parent_goal_id)
      VALUES (
        '00000000-0000-0000-0003-000000000002',
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000022',
        'Zero safety incidents — FY 2026-27',
        'Company-wide mandatory safety KPI.',
        'zero', NULL, 0, 'approved', TRUE, TRUE,
        '00000000-0000-0000-0099-000000000001'
      )
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('[Seed]   ✓ Shared safety goal pushed to Aarav & Meera');

    // ── 9. Audit log entries ──────────────────────────────────────────────────
    console.log('[Seed] Adding audit log entries…');
    await client.query(`
      INSERT INTO audit_logs (goal_id, user_id, action, field_name, old_value, new_value, ip_address)
      VALUES
        ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002',
         'goal_approved', 'status', 'submitted', 'approved', '10.0.0.1'),
        ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000002',
         'goal_approved', 'status', 'submitted', 'approved', '10.0.0.1'),
        ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000002',
         'goal_approved', 'status', 'submitted', 'approved', '10.0.0.1'),
        ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000002',
         'goal_approved', 'status', 'submitted', 'approved', '10.0.0.1'),
        ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
         'goal_unlocked', 'is_locked', 'true', 'false', '10.0.0.100'),
        ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
         'goal_locked',   'is_locked', 'false', 'true', '10.0.0.100')
      ON CONFLICT DO NOTHING
    `);

    // ── 10. Notifications ─────────────────────────────────────────────────────
    console.log('[Seed] Adding demo notifications…');
    await client.query(`
      INSERT INTO notifications (user_id, title, message, link, is_read)
      VALUES
        ('00000000-0000-0000-0000-000000000003',
         '✅ Goals Approved',
         'Your 4 goals for FY 2026-27 have been approved by Rahul Verma. You can now log Q1 check-in actuals.',
         '/employee/checkin', FALSE),
        ('00000000-0000-0000-0000-000000000003',
         '📊 Q1 Check-in Window Open',
         'The Q1 check-in window is now open (May–July 2026). Please log your actuals for all approved goals.',
         '/employee/checkin', FALSE),
        ('00000000-0000-0000-0000-000000000004',
         '✅ Goals Approved',
         'Your 3 goals for FY 2026-27 have been approved. Log your Q1 actuals now.',
         '/employee/checkin', FALSE),
        ('00000000-0000-0000-0000-000000000004',
         '📊 Q1 Check-in Window Open',
         'The Q1 check-in window is open. Please update your actuals for all approved goals before the window closes.',
         '/employee/checkin', FALSE),
        ('00000000-0000-0000-0000-000000000002',
         '📋 Q1 Check-in Reminder',
         'Aarav Singh has submitted Q1 actuals. Please review and add your manager comments.',
         '/manager/checkins', FALSE),
        ('00000000-0000-0000-0000-000000000002',
         '⚠ Meera Patel — Q1 Actuals Pending',
         'Meera Patel has not yet submitted Q1 actuals. Remind her to complete the check-in.',
         '/manager/checkins', FALSE),
        ('00000000-0000-0000-0000-000000000001',
         '📊 Q1 Check-in Window Active',
         'The Q1 check-in window is open for FY 2026-27. Monitor team completion from the Admin Analytics page.',
         '/admin/analytics', FALSE)
      ON CONFLICT DO NOTHING
    `);
    console.log('[Seed]   ✓ 7 notifications seeded');

    // ── 11. Escalation rules ──────────────────────────────────────────────────
    await client.query(`
      INSERT INTO escalation_rules (id, rule_type, days_threshold, is_active, created_by) VALUES
        ('00000000-0000-0000-0000-000000000030', 'goal_not_submitted', 7,  TRUE, '00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000031', 'goal_not_approved',  5,  TRUE, '00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000032', 'checkin_not_done',   3,  TRUE, '00000000-0000-0000-0000-000000000001')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');

    console.log('\n[Seed] ✅ Complete! Current state:');
    console.log('   • Cycle: FY 2026-27 — Q1 check-in window OPEN (May–Jul 2026)');
    console.log('   • Aarav: 4 approved goals + Q1 actuals submitted + manager comments');
    console.log('   • Meera: 3 approved goals + Q1 actuals PENDING (she must log them)');
    console.log('   • Rahul: 2 approved manager goals + Q1 actuals');
    console.log('\n   Demo credentials:');
    console.log('   Admin:     admin@nucleas.com     / Admin@123');
    console.log('   Manager:   manager@nucleas.com   / Manager@123');
    console.log('   Employee:  employee@nucleas.com  / Employee@123');
    console.log('   Employee2: employee2@nucleas.com / Employee@123\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Seed] ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
