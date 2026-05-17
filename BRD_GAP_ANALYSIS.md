# GoalSync — BRD Compliance & Gap Analysis Report
**Problem Statement: AtomQuest Hackathon 1.0 — In-House Goal Setting & Tracking Portal**
**Codebase: goalsync_backend_final.zip + goalsync_frontend_final.zip**

---

## VERDICT SUMMARY

| Section | Requirement | Status |
|---|---|---|
| 2.1 Goal Creation & Approval | Core flow | ✅ PASS |
| 2.1 Goal Creation & Approval | Shared Goals achievement sync | ❌ GAP |
| 2.1 Goal Creation & Approval | Manager can push shared goals | ⚠️ PARTIAL |
| 2.2 Achievement Tracking | Core quarterly check-in | ✅ PASS |
| 2.2 Achievement Tracking | Score formulas (all 4 UoM) | ✅ PASS |
| 2.3 Check-in Schedule / Windows | Enforcement | ✅ PASS |
| 3 User Roles | Employee, Manager, Admin | ✅ PASS |
| 3 Manager as Employee | Role context toggle | ✅ PASS |
| 4 Achievement Report (CSV/Excel) | Export | ⚠️ RUNTIME BUG |
| 4 Completion Dashboard | Real-time view | ✅ PASS |
| 4 Audit Trail | Post-lock change logging | ✅ PASS |
| 5.1 Azure AD SSO | Bonus | ❌ NOT IMPLEMENTED |
| 5.2 Email Notifications | Bonus | ✅ IMPLEMENTED |
| 5.3 Escalation Module | Bonus | ✅ IMPLEMENTED |
| 5.4 Analytics Module | Bonus | ✅ IMPLEMENTED |

---

## ✅ FULLY COMPLIANT (No Action Needed)

### Phase 1 — Goal Creation & Approval Core Flow
Everything the BRD mandates is present and working:
- Employee interface: create, edit, delete goals ✅
- Thrust Area selection ✅
- Goal Title + Description ✅
- UoM types: all 4 implemented (`min`, `max`, `timeline`, `zero`) with human-readable labels ("Higher is Better", "Lower is Better", "Date-Based", "Zero = Success") and inline formula hints ✅
- Validation: max 8 goals, min 10% per goal, total = 100% on submit — enforced on **both** frontend (real-time WeightageGauge) and backend (`goal.service.js → validateGoalSheet`) ✅
- Manager L1 approval: inline edit of target/weightage, approve, return-for-rework with mandatory comment ✅
- Goal lock on approval (`is_locked = TRUE`) ✅
- Admin unlock with mandatory reason + dual audit log entries ✅
- Shared goal recipients: title/target disabled in frontend (`isSharedChild` guard) + backend rejects updates to those fields for `is_shared=TRUE` goals ✅

### Phase 2 — Achievement Tracking & Check-ins
- Quarterly actual entry with UoM-appropriate fields ✅
- Status selection: Not Started / On Track / Completed (plus bonus "At Risk") ✅
- Score formulas exact match to BRD table:
  - Min: `actual ÷ target` ✅
  - Max: `target ÷ actual` ✅
  - Timeline: completion date vs deadline → 100% on-time, 50% late ✅
  - Zero: `actual === 0 ? 100% : 0%` ✅
- Real-time score preview as employee types actual ✅
- Window enforcement: server rejects achievement POST if window not open ✅

### Check-in Schedule (Section 2.3)
- Phase 1 (goal setting), Q1–Q4 windows configurable per cycle ✅
- Admin creates/edits cycles with all window dates ✅
- Frontend banner shows active window state ✅

### User Roles (Section 3)
- All 3 roles: employee, manager (`role='manager'`), admin ✅
- Manager role context toggle in Navbar ("My Goals" ↔ "My Team") ✅
- Manager can access both `/employee` routes (authorized) and `/manager` routes ✅
- Role guards on all API routes ✅
- Manager sees only their own direct reports (`WHERE manager_id = req.user.id`) ✅

### Reporting & Governance (Section 4)
- Completion Dashboard: real-time check-in completion with employee/quarter breakdown ✅
- Audit Trail: all post-lock changes logged with `user_id`, `action`, `field_name`, `old_value`, `new_value`, `ip_address`, timestamp ✅
- Audit log viewable in Admin UI at `/admin/audit` ✅

### Bonus Features (Section 5)
- **Email Notifications** (5.2): Nodemailer integrated, triggers on submit/approve/rework/escalation, fire-and-forget with `setImmediate` ✅
- **Escalation Module** (5.3): All 3 rule types (`goal_not_submitted`, `goal_not_approved`, `checkin_not_done`) with configurable day thresholds, daily cron at 8am, logs to `escalation_logs` table ✅
- **Analytics Module** (5.4): QoQ trend chart, Completion Heatmap, Goal Distribution charts, Manager Effectiveness chart — all built as separate Recharts components at `/admin/analytics` ✅

---

## ❌ GAP 1 — CRITICAL: Shared Goal Achievement Sync (BRD §2.1)

**BRD Requirement:**
> "Achievement updates by the primary owner sync across all linked goal sheets"

**What the code does:**
`achievements.controller.js → createAchievement()` saves the actual for the goal the employee is acting on — and **stops there**. There is no cascade query to update child goals (goals where `parent_goal_id = this goal's id`).

**Impact:** If Admin pushes a shared KPI to Aarav and Meera, and Aarav logs Q1 actuals, Meera's copy shows `null` actuals. The BRD explicitly requires Meera's actual to auto-update to match Aarav's (since it's a shared KPI — the achievement is organization-wide, not individual).

**Fix — add this block after the upsert in `createAchievement`, before the notify section:**

```js
// ── Cascade to shared-goal children (BRD §2.1) ────────────
if (goal.parent_goal_id === null) {
  // This goal MAY be a parent. Find all children.
  const { rows: children } = await query(
    `SELECT id FROM goals WHERE parent_goal_id = $1 AND status = 'approved'`,
    [goal_id]
  );
  if (children.length > 0) {
    for (const child of children) {
      await query(`
        INSERT INTO goal_achievements
          (goal_id, quarter, planned_value, actual_value, completion_date, goal_status)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (goal_id, quarter) DO UPDATE SET
          actual_value    = EXCLUDED.actual_value,
          completion_date = EXCLUDED.completion_date,
          goal_status     = EXCLUDED.goal_status,
          submitted_at    = NOW(),
          updated_at      = NOW()
      `, [
        child.id, quarter,
        goal.target_value ?? null,
        actual_value ?? null,
        completion_date ?? null,
        goal_status ?? 'not_started',
      ]);
    }
  }
}
// Also apply to updateAchievement() the same way
```

**Also apply the same cascade block** in `updateAchievement()` — same logic, same position (after the main UPDATE query).

---

## ⚠️ GAP 2 — RUNTIME CRASH: CSV Export (BRD §4)

**BRD Requirement:**
> "Achievement Report: Exportable (CSV / Excel)"

**Problem:**
`reports.controller.js` uses `const { Parser } = require('json2csv')` — the v5 synchronous API. The project has `json2csv@^6.0.0-alpha.2` which **removed the `Parser` class**. Clicking "Download CSV" throws `TypeError: Parser is not a constructor` at runtime.

**Fix (3 lines in `reports.controller.js`):**

```js
// Line 6 — CHANGE:
const { Parser } = require('json2csv');
// TO:
const { parse: csvParse } = require('json2csv');

// Lines 256–257 — CHANGE:
const parser = new Parser();
const csv    = parser.parse(data);
// TO:
const csv = csvParse(data);
```

**Alternative fix:** Downgrade in `server/package.json`:
```json
"json2csv": "^5.0.0"
```
Then `npm install` — the existing `new Parser()` code works perfectly with v5.

---

## ⚠️ GAP 3 — PARTIAL: Manager Cannot Push Shared Goals (BRD §2.1)

**BRD Requirement:**
> "Admin **or manager** can push a departmental KPI to multiple employees"

**What exists:**
- `POST /api/admin/shared-goals` exists and works ✅
- But this route uses `authorize('admin')` — managers cannot call it
- No equivalent route exists in `manager.routes.js`

**Impact:** Low for a hackathon demo (admin can push shared goals and judges will see it work), but technically non-compliant. The BRD explicitly says "or manager."

**Fix — add to `manager.routes.js`:**
```js
router.post('/shared-goals', ctrl.pushSharedGoal);
// Then import pushSharedGoal from admin.controller and re-export, or move to a shared service
```

The cleanest fix is to move `pushSharedGoal` into a shared `goal.service.js` function and call it from both admin and manager controllers.

---

## ⚠️ GAP 4 — DEMO: Manager Has No Own Goals in Seed

**BRD Requirement (Section 7):**
> "A working demo with at least one complete user journey per role (Employee, Manager, Admin) must be presented"

**Problem:**
The seed data gives Aarav (employee) and Meera (employee) demo goals. Rahul (manager) has **no goals of his own** in the seed. When a judge logs in as Manager and clicks "My Goals" in the role context toggle, they see an empty dashboard — which looks like a bug.

The BRD explicitly states managers are also employees with their own goals. The Manual even calls this out: *"A manager has their own goals too."*

**Fix — add to `seed.js` after section 4 (Meera's goals):**

```js
// ── 4b. Rahul's own goals (as employee) ──────────────────
console.log('[Seed] Creating Rahul Verma manager-as-employee goals…');
const rahulGoals = [
  {
    title: 'Team Delivery Rate',
    description: 'Ensure 90%+ sprint delivery across Q1–Q4',
    uom_type: 'min', target_value: 90, weightage: 50,
    thrust_area_name: 'Operational Efficiency',
  },
  {
    title: 'Team Check-in Completion',
    description: 'Complete all quarterly check-ins on time',
    uom_type: 'min', target_value: 100, weightage: 50,
    thrust_area_name: 'People Development',
  },
];
// Insert as approved goals for managerId
// (same pattern as Aarav's goals above)
```

---

## ℹ️ MINOR OBSERVATIONS (Non-blocking)

### UoM Naming Convention
The BRD uses "Numeric / %" and "Zero-based" as labels. The codebase uses `min`/`max`/`timeline`/`zero` internally and displays "Higher is Better" / "Lower is Better" / "Date-Based" / "Zero = Success" to users. This is **better than the BRD** (more intuitive), not worse. No change needed.

### `at_risk` Status (Bonus)
The DB `CHECK` constraint and frontend include `at_risk` as a 4th status. BRD only specifies 3 (Not Started, On Track, Completed). This is an additive enhancement — it doesn't break any BRD requirement. No change needed.

### Max Weightage 90%
The BRD says minimum 10% but does not specify a maximum per goal. The codebase enforces max 90%. This is logical (with min 8 goals × 10% = 80% minimum, one goal can be at most ~90% without violating the 100% total rule), and the BRD evaluators will consider it correct.

### Azure AD SSO (Bonus §5.1)
Not implemented. This is the only bonus feature missing. Azure AD integration requires an app registration, client credentials, and OAuth flow — it's a substantial standalone feature. For the hackathon, noting it in the README as "planned" with an architecture sketch is a viable approach.

---

## PRIORITY FIX ORDER

| Priority | Fix | Effort | BRD Section |
|---|---|---|---|
| 🔴 P1 | CSV export crash (`json2csv` API) | 3 lines | §4 |
| 🔴 P1 | Shared goal achievement sync | ~25 lines | §2.1 |
| 🟡 P2 | Manager can push shared goals | ~10 lines + service refactor | §2.1 |
| 🟡 P2 | Seed Rahul's own goals | ~30 lines in seed.js | §7 demo |
| 🟢 P3 | Azure AD SSO mention in README | 0 code | §5.1 |

**Estimated total fix time:** 45–60 minutes for all P1+P2 items.

---

*Report generated against: goalsync_backend_final.zip + goalsync_frontend_final.zip*
*BRD: AtomQuest Hackathon 1.0 Problem Statement*
