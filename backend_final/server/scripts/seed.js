// server/src/scripts/seed.js
// Run: npm run seed
// Creates/updates demo accounts with proper bcrypt hashes,
// then inserts the full demo journey data required for judges.

'use strict';

require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SALT_ROUNDS = 10;

const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Priya Sharma',
    email: 'admin@goalsynce.com',
    password: 'Admin@123',
    role: 'admin',
    department: 'HR',
    manager_id: null,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Rahul Verma',
    email: 'manager@goalsynce.com',
    password: 'Manager@123',
    role: 'manager',
    department: 'Sales',
    manager_id: '00000000-0000-0000-0000-000000000001',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Aarav Singh',
    email: 'employee@goalsynce.com',
    password: 'Employee@123',
    role: 'employee',
    department: 'Sales',
    manager_id: '00000000-0000-0000-0000-000000000002',
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Meera Patel',
    email: 'employee2@goalsynce.com',
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

    // ── 1. Upsert users with real bcrypt hashes ──────────────
    console.log('[Seed] Hashing passwords and upserting users…');
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

    // ── 2. Cycle + thrust areas ──────────────────────────────
    // (Already inserted by migration 010; this is idempotent)
    console.log('[Seed] Ensuring cycle and thrust areas exist…');
    const { rows: cycleRows } = await client.query(
      "SELECT id FROM goal_cycles WHERE id = '00000000-0000-0000-0000-000000000010'"
    );
    if (cycleRows.length === 0) {
      console.log('[Seed] Cycle not found — run npm run migrate first.');
      throw new Error('Missing cycle — run migrations before seed.');
    }

    // ── 3. Aarav's goals (4 approved, Q1 actuals submitted) ─
    console.log('[Seed] Creating Aarav Singh demo goals…');

    const aaravGoals = [
      {
        id: '00000000-0000-0000-0001-000000000001',
        employee_id: '00000000-0000-0000-0000-000000000003',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000020', // Sales Growth
        title: 'Achieve ₹50L quarterly sales revenue',
        description: 'Drive new business to hit ₹50 lakh in Q1 sales revenue.',
        uom_type: 'min',
        target_value: 5000000,
        weightage: 30,
        status: 'approved',
        is_locked: true,
      },
      {
        id: '00000000-0000-0000-0001-000000000002',
        employee_id: '00000000-0000-0000-0000-000000000003',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000021', // Customer Experience
        title: 'Maintain NPS score above 70',
        description: 'Ensure customer satisfaction stays above 70 NPS through the year.',
        uom_type: 'min',
        target_value: 70,
        weightage: 25,
        status: 'approved',
        is_locked: true,
      },
      {
        id: '00000000-0000-0000-0001-000000000003',
        employee_id: '00000000-0000-0000-0000-000000000003',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000022', // Operational Efficiency
        title: 'Reduce average deal closure time to 14 days',
        description: 'Optimise pipeline and follow-ups to close deals faster.',
        uom_type: 'max',
        target_value: 14,
        weightage: 25,
        status: 'approved',
        is_locked: true,
      },
      {
        id: '00000000-0000-0000-0001-000000000004',
        employee_id: '00000000-0000-0000-0000-000000000003',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000023', // People Development
        title: 'Complete 3 product certifications',
        description: 'Obtain 3 vendor certifications to improve solution selling.',
        uom_type: 'min',
        target_value: 3,
        weightage: 20,
        status: 'approved',
        is_locked: true,
      },
    ];

    for (const g of aaravGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, weightage, status, is_locked)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          status    = EXCLUDED.status,
          is_locked = EXCLUDED.is_locked
      `, [g.id, g.employee_id, g.cycle_id, g.thrust_area_id, g.title,
      g.description, g.uom_type, g.target_value, g.weightage, g.status, g.is_locked]);
    }

    // Q1 actuals for Aarav
    console.log('[Seed] Adding Q1 actuals for Aarav…');
    const aaravActuals = [
      { goal_id: '00000000-0000-0000-0001-000000000001', actual_value: 4600000, goal_status: 'on_track' },
      { goal_id: '00000000-0000-0000-0001-000000000002', actual_value: 74, goal_status: 'completed' },
      { goal_id: '00000000-0000-0000-0001-000000000003', actual_value: 12, goal_status: 'completed' },
      { goal_id: '00000000-0000-0000-0001-000000000004', actual_value: 1, goal_status: 'on_track' },
    ];

    for (const a of aaravActuals) {
      await client.query(`
        INSERT INTO goal_achievements (goal_id, quarter, actual_value, goal_status)
        VALUES ($1, 'Q1', $2, $3)
        ON CONFLICT (goal_id, quarter) DO UPDATE SET
          actual_value = EXCLUDED.actual_value,
          goal_status  = EXCLUDED.goal_status
      `, [a.goal_id, a.actual_value, a.goal_status]);
    }

    // Manager check-in for Aarav's first goal
    await client.query(`
      INSERT INTO manager_checkins (goal_id, manager_id, quarter, comment)
      VALUES (
        '00000000-0000-0000-0001-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'Q1',
        'Good progress on revenue. Keep pushing for the remaining ₹4L — focus on the two enterprise accounts in the pipeline.'
      )
      ON CONFLICT (goal_id, manager_id, quarter) DO NOTHING
    `);

    // ── 4. Meera's goals (3 submitted, awaiting approval) ───
    console.log('[Seed] Creating Meera Patel demo goals…');

    const meeraGoals = [
      {
        id: '00000000-0000-0000-0002-000000000001',
        thrust_area_id: '00000000-0000-0000-0000-000000000020',
        title: 'Generate 20 new qualified leads per month',
        uom_type: 'min',
        target_value: 20,
        weightage: 35,
        status: 'submitted',
      },
      {
        id: '00000000-0000-0000-0002-000000000002',
        thrust_area_id: '00000000-0000-0000-0000-000000000024', // Digital Transformation
        title: 'Implement CRM automation for follow-ups',
        uom_type: 'zero',
        target_value: null,
        weightage: 35,
        status: 'submitted',
      },
      {
        id: '00000000-0000-0000-0002-000000000003',
        thrust_area_id: '00000000-0000-0000-0000-000000000023',
        title: 'Mentor 2 junior sales associates',
        uom_type: 'min',
        target_value: 2,
        weightage: 30,
        status: 'submitted',
      },
    ];

    for (const g of meeraGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title,
           uom_type, target_value, weightage, status)
        VALUES ($1,'00000000-0000-0000-0000-000000000004',$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
      `, [g.id, '00000000-0000-0000-0000-000000000010', g.thrust_area_id,
      g.title, g.uom_type, g.target_value, g.weightage, g.status]);
    }

    // ── X. Rahul's goals (Manager) ──────────────────────────
    console.log('[Seed] Creating Rahul Verma demo goals…');

    const rahulGoals = [
      {
        id: '00000000-0000-0000-0005-000000000001',
        employee_id: '00000000-0000-0000-0000-000000000002',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000020',
        title: 'Drive team to achieve ₹1.5Cr quarterly sales',
        description: 'Manage the sales team to ensure overall revenue targets are met.',
        uom_type: 'min',
        target_value: 15000000,
        weightage: 50,
        status: 'approved',
        is_locked: true,
      },
      {
        id: '00000000-0000-0000-0005-000000000002',
        employee_id: '00000000-0000-0000-0000-000000000002',
        cycle_id: '00000000-0000-0000-0000-000000000010',
        thrust_area_id: '00000000-0000-0000-0000-000000000023',
        title: 'Complete leadership training program',
        description: 'Attend and complete the executive leadership workshop.',
        uom_type: 'zero',
        target_value: null,
        weightage: 50,
        status: 'approved',
        is_locked: true,
      },
    ];

    for (const g of rahulGoals) {
      await client.query(`
        INSERT INTO goals
          (id, employee_id, cycle_id, thrust_area_id, title, description,
           uom_type, target_value, weightage, status, is_locked)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          status    = EXCLUDED.status,
          is_locked = EXCLUDED.is_locked
      `, [g.id, g.employee_id, g.cycle_id, g.thrust_area_id, g.title,
      g.description, g.uom_type, g.target_value, g.weightage, g.status, g.is_locked]);
    }

    // ── 5. Shared goal (pushed to both Aarav and Meera) ─────
    console.log('[Seed] Creating shared company KPI goal…');

    // Template (parent)
    await client.query(`
      INSERT INTO goals
        (id, employee_id, cycle_id, thrust_area_id, title, description,
         uom_type, target_value, weightage, status, is_shared, is_locked)
      VALUES (
        '00000000-0000-0000-0099-000000000001',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000020',
        'Zero safety incidents for FY 2025-26',
        'Company-wide safety KPI. Zero recordable incidents across the full year.',
        'zero', NULL, 0, 'approved', TRUE, TRUE
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // Child for Aarav (weightage editable, title/target read-only)
    await client.query(`
      INSERT INTO goals
        (id, employee_id, cycle_id, thrust_area_id, title, description,
         uom_type, target_value, weightage, status, is_shared, is_locked, parent_goal_id)
      VALUES (
        '00000000-0000-0000-0003-000000000001',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000020',
        'Zero safety incidents for FY 2025-26',
        'Company-wide safety KPI.',
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
        '00000000-0000-0000-0000-000000000020',
        'Zero safety incidents for FY 2025-26',
        'Company-wide safety KPI.',
        'zero', NULL, 0, 'submitted', TRUE, FALSE,
        '00000000-0000-0000-0099-000000000001'
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // ── 6. Audit log entries ─────────────────────────────────
    console.log('[Seed] Adding audit log entries…');

    await client.query(`
      INSERT INTO audit_logs (goal_id, user_id, action, field_name, old_value, new_value, ip_address)
      VALUES
        (
          '00000000-0000-0000-0001-000000000001',
          '00000000-0000-0000-0000-000000000001',
          'goal_unlocked',
          'is_locked',
          'true', 'false',
          '192.168.1.100'
        ),
        (
          '00000000-0000-0000-0001-000000000001',
          '00000000-0000-0000-0000-000000000001',
          'goal_locked',
          'is_locked',
          'false', 'true',
          '192.168.1.100'
        )
    `);

    await client.query('COMMIT');
    console.log('\n[Seed] ✅ Seed complete! Demo credentials:');
    console.log('   Admin:    admin@goalsynce.com    /  Admin@123');
    console.log('   Manager:  manager@goalsynce.com  /  Manager@123');
    console.log('   Employee: employee@goalsynce.com /  Employee@123');
    console.log('   Employee: employee2@goalsynce.com/  Employee@123\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[Seed] ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
