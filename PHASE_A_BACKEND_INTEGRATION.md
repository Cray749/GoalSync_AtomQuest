# GoalSync — Phase A: Backend Integration Manual
# DO THIS FIRST. Phase B (frontend) depends on this being done.

---

## CONTEXT
You are integrating a complete Node.js/Express/PostgreSQL backend for "GoalSync" — a
three-role goal management portal (employee / manager / admin).

Sessions 1 & 2 are the clean, verified base. Sessions 3 and 7 add email, escalation,
and notifications on top. Your job is to produce ONE merged, working backend folder.

---

## INPUT FILES YOU WILL RECEIVE
Upload all of these to this chat before starting:
- session_1.zip  (verified clean — database migrations + auth)
- session_2.zip  (verified clean — goals, achievements, manager, admin, reports)
- session_3.zip  (email service, escalation job, notification service)
- session_7.zip  (email triggers, notification routes + controller, escalation wiring)

---

## OUTPUT REQUIRED
A single zip: `goalsync_backend_final.zip`
Containing folder: `server/`
Structure must be exactly:
```
server/
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_cycles.sql
│   ├── 003_create_thrust_areas.sql
│   ├── 004_create_goals.sql
│   ├── 005_create_achievements.sql
│   ├── 006_create_checkins.sql
│   ├── 007_create_audit_logs.sql
│   ├── 008_create_notifications.sql
│   ├── 009_create_escalation_rules.sql
│   └── 010_seed_demo_data.sql
├── scripts/
│   ├── migrate.js
│   └── seed.js
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── authenticate.js
│   │   └── authorize.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── goals.routes.js
│   │   ├── achievements.routes.js
│   │   ├── manager.routes.js
│   │   ├── admin.routes.js
│   │   ├── reports.routes.js
│   │   └── notifications.routes.js   ← NEW from Session 7
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── goals.controller.js
│   │   ├── achievements.controller.js
│   │   ├── manager.controller.js
│   │   ├── admin.controller.js
│   │   ├── reports.controller.js
│   │   └── notifications.controller.js ← NEW from Session 7
│   ├── services/
│   │   ├── goal.service.js
│   │   ├── score.service.js
│   │   ├── cycle.service.js
│   │   ├── audit.service.js            ← REPLACE with Session 7 version
│   │   ├── email.service.js            ← NEW from Session 3/7
│   │   ├── notification.service.js     ← NEW from Session 7
│   │   └── escalation.service.js       ← NEW from Session 3/7
│   ├── jobs/
│   │   └── escalation.job.js           ← NEW from Session 3/7
│   └── utils/
│       └── response.js
├── .env.example
├── package.json
├── nixpacks.toml                        ← NEW from Session 8 (create if not present)
└── Procfile                             ← NEW from Session 8 (create if not present)
```

---

## STEP-BY-STEP INSTRUCTIONS

### STEP 1 — Base: Extract Session 1 + Session 2
Start with Session 2 as base (it is a superset of Session 1).
All Session 2 files are correct — do not modify them unless this manual explicitly says to.

### STEP 2 — Add Session 3/7 new service files
Copy these files into `src/services/`:
- `email.service.js` — from Session 7 (better than Session 3's version)
- `notification.service.js` — from Session 7
- `escalation.service.js` — from Session 3 or 7 (either works)
- Replace `audit.service.js` with Session 7's version (it adds `getAuditLogs()` — is a superset)

Copy into `src/jobs/`:
- `escalation.job.js` — from Session 7

Copy into `src/controllers/`:
- `notifications.controller.js` — from Session 7

### STEP 3 — Fix notifications.routes.js (Session 7) before using it
Session 7's `notifications.routes.js` uses NAMED imports which are incompatible
with our middleware. Fix these two lines at the top:

WRONG (Session 7 has this):
```js
const { authenticate } = require('../middleware/authenticate');
const { authorize }    = require('../middleware/authorize');
```

CORRECT (change to):
```js
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
```

Then copy the fixed file to `src/routes/notifications.routes.js`.

### STEP 4 — Fix reports.routes.js (Session 6 additions)
Session 2's reports.routes.js exports functions as:
  `achievementReport`, `completionRate`, `goalDistribution`, `teamScores`

Add these two new routes to the END of `src/routes/reports.routes.js`:
```js
// Aliases for analytics page (Session 6)
router.get('/qoq-trend',              ctrl.goalDistribution);   // returns qoq_trend inside
router.get('/manager-effectiveness',  ctrl.completionRate);     // returns manager stats
```

### STEP 5 — Add missing routes to manager.routes.js
Add these two routes to `src/routes/manager.routes.js`:
```js
// Aliases needed by frontend
router.get('/approval-queue',   ctrl.getTeam);          // frontend filters submitted goals
router.get('/team-progress',    ctrl.getTeam);          // frontend computes scores client-side
```

### STEP 6 — Add missing routes to admin.routes.js
Add these routes to `src/routes/admin.routes.js`:

```js
// Alias for frontend AdminDashboard
router.get('/stats', ctrl.getCompletionDashboard);

// Cycle activation shortcut
router.put('/cycles/:id/activate', async (req, res) => {
  req.body = { is_active: true };
  return ctrl.updateCycle(req, res);
});

// User management shortcuts
router.put('/users/:id/deactivate', async (req, res) => {
  req.body = { is_active: false };
  return ctrl.updateUser(req, res);
});

router.put('/users/:id/manager', async (req, res) => {
  // req.body already has { manager_id }
  return ctrl.updateUser(req, res);
});

// Thrust area delete
router.delete('/thrust-areas/:id', async (req, res) => {
  try {
    const { query } = require('../config/db');
    const { sendSuccess, sendError } = require('../utils/response');
    await query('UPDATE thrust_areas SET is_active = FALSE WHERE id = $1', [req.params.id]);
    return sendSuccess(res, null, 'Thrust area deleted');
  } catch (err) {
    const { sendError } = require('../utils/response');
    return sendError(res, err.message, 500);
  }
});
```

### STEP 7 — Add computed boolean fields to cycle.service.js
In `src/services/cycle.service.js`, update `getActiveCycleWindow()` to add
two boolean flags the frontend needs:

Find the return statement:
```js
return { cycle, window, quarter };
```

Change to:
```js
return {
  cycle,
  window,
  quarter,
  is_goal_setting_open: window === 'phase1',
  is_checkin_open: ['q1', 'q2', 'q3', 'q4'].includes(window),
};
```

Also update `getActiveCycle()` controller response in `goals.controller.js`
where it returns the cycle — add these flags to the response:
```js
return sendSuccess(res, {
  ...cycle,
  active_window:        window,
  active_quarter:       quarter,
  is_goal_setting_open: window === 'phase1',
  is_checkin_open:      ['q1','q2','q3','q4'].includes(window),
});
```

### STEP 8 — Wire email triggers into controllers
Session 7 provides `email-trigger-patches.js` which is a wiring guide.
Apply ALL 5 patches from that file — add them to these controllers:

1. `goals.controller.js` → `submitGoals()` function
2. `manager.controller.js` → `approveGoal()` function
3. `manager.controller.js` → `reworkGoal()` function
4. `goals.controller.js` or `cycle.service.js` → quarter window open trigger
5. `escalation.service.js` → already fires email internally

IMPORTANT: Use `setImmediate(async () => { ... })` pattern for ALL email calls
so a failed email NEVER causes the API response to fail. Example:
```js
setImmediate(async () => {
  try {
    await emailService.sendGoalsSubmittedEmail({ ... });
  } catch (e) {
    console.error('[email] Failed:', e.message);
  }
});
```

### STEP 9 — Mount notifications route in app.js
Add to `src/app.js` after the other route mounts:
```js
const notificationsRoutes = require('./routes/notifications.routes');
// ...
app.use('/api/notifications', notificationsRoutes);
```

### STEP 10 — Wire escalation cron in server.js
In `src/server.js`, find the commented-out cron line:
```js
// require('./jobs/escalation.job');
```
Replace with:
```js
try {
  require('./jobs/escalation.job').start();
  console.log('[Server] Escalation cron job scheduled');
} catch (err) {
  console.warn('[Server] Escalation job failed to start:', err.message);
}
```

### STEP 11 — Update package.json
Merge deps so the final `package.json` has ALL of these:
```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "date-fns": "^3.6.0",
    "dotenv": "^16.4.5",
    "exceljs": "^4.4.0",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "helmet": "^7.1.0",
    "json2csv": "^6.0.0-alpha.2",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.14",
    "pg": "^8.12.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
```
DO NOT include `excel4node` — it's redundant, we use `exceljs`.

### STEP 12 — Create nixpacks.toml (for Railway deploy)
Create `server/nixpacks.toml`:
```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run migrate"]

[start]
cmd = "npm start"
```

### STEP 13 — Create Procfile
Create `server/Procfile`:
```
web: npm start
```

### STEP 14 — Update .env.example
Make sure `server/.env.example` has ALL these vars:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/goalsynce
JWT_SECRET=change_me_to_a_random_32_char_secret
JWT_EXPIRES_IN=8h
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_username
SMTP_PASS=your_mailtrap_password
SMTP_SECURE=false
EMAIL_FROM=noreply@goalsynce.com
```

---

## VERIFICATION CHECKLIST
Before zipping, run this check on every .js file:
```bash
for f in $(find server/src server/scripts -name "*.js"); do
  node --check "$f" && echo "✓ $f" || echo "FAIL: $f"
done
```
ALL files must pass. Fix any syntax errors before delivering.

Also verify:
- [ ] `server/src/app.js` has `app.use('/api/notifications', ...)` mounted
- [ ] `server/src/server.js` has escalation cron wired (not commented out)
- [ ] `server/src/routes/notifications.routes.js` uses DEFAULT imports for middleware
- [ ] `server/src/routes/reports.routes.js` has `/qoq-trend` and `/manager-effectiveness`
- [ ] `server/src/routes/manager.routes.js` has `/approval-queue` and `/team-progress`
- [ ] `server/src/routes/admin.routes.js` has `/stats`, `/activate`, `/deactivate`, `/manager`, DELETE thrust-areas
- [ ] `server/scripts/seed.js` uses `bcrypt.hash()` — NOT placeholder hashes
- [ ] `package.json` has `helmet`, `morgan`, `exceljs` — does NOT have `excel4node`

---

## KNOWN THINGS TO NOT TOUCH
- Do NOT modify any migration files (001–010)
- Do NOT change `authenticate.js` or `authorize.js` — they use default exports, that's correct
- Do NOT change the score formulas in `score.service.js`
- Do NOT add `'REWORK'` to migration 006's CHECK constraint
- The seed.js from Session 1/2 is correct — use it, don't replace it with Session 8's version
