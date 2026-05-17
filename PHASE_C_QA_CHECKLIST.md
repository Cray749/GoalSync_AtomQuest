# GoalSync — Phase C: QA Audit Checklist
# This is for the REVIEWER (the orchestrating Claude chat).
# When Phase A and Phase B are complete, upload both zips here and run through this list.

---

## HOW TO USE THIS
Upload goalsync_backend_final.zip and goalsync_frontend_final.zip.
Check every item. Any FAIL = send back to the relevant phase chat with the exact fix needed.

---

## BACKEND AUDIT (goalsync_backend_final.zip)

### Syntax
```bash
for f in $(find server/src server/scripts -name "*.js"); do
  node --check "$f" && echo "✓ $f" || echo "FAIL: $f"
done
```
Expected: ALL PASS. Zero failures.

### File Presence
- [ ] `server/src/routes/notifications.routes.js` exists
- [ ] `server/src/controllers/notifications.controller.js` exists
- [ ] `server/src/services/email.service.js` exists
- [ ] `server/src/services/notification.service.js` exists
- [ ] `server/src/services/escalation.service.js` exists
- [ ] `server/src/jobs/escalation.job.js` exists
- [ ] `server/nixpacks.toml` exists
- [ ] `server/Procfile` exists

### Critical Content Checks
```bash
# 1. notifications route uses DEFAULT imports (not named)
grep "{ authenticate }" server/src/routes/notifications.routes.js
# Expected: NO OUTPUT (named import would be wrong)

# 2. app.js mounts notifications route
grep "notifications" server/src/app.js
# Expected: app.use('/api/notifications', ...)

# 3. server.js wires escalation cron
grep "escalation" server/src/server.js
# Expected: require('./jobs/escalation.job') NOT commented out

# 4. seed.js uses bcrypt (not placeholder hashes)
grep "bcrypt.hash\|bcrypt\.hash" server/scripts/seed.js
# Expected: at least one match

# 5. manager.routes has approval-queue alias
grep "approval-queue" server/src/routes/manager.routes.js
# Expected: router.get('/approval-queue', ...)

# 6. admin.routes has /stats alias
grep "'/stats'" server/src/routes/admin.routes.js
# Expected: router.get('/stats', ...)

# 7. reports.routes has qoq-trend
grep "qoq-trend" server/src/routes/reports.routes.js
# Expected: router.get('/qoq-trend', ...)

# 8. cycle.service returns is_goal_setting_open flag
grep "is_goal_setting_open" server/src/services/cycle.service.js
# Expected: at least one match

# 9. goals.controller getActiveCycle returns is_goal_setting_open
grep "is_goal_setting_open" server/src/controllers/goals.controller.js
# Expected: at least one match

# 10. email triggers wired (fire-and-forget pattern)
grep "setImmediate" server/src/controllers/goals.controller.js
# Expected: at least one match (from email trigger patch)

# 11. package.json has helmet, does NOT have excel4node
grep "helmet" server/package.json        # Expected: match
grep "excel4node" server/package.json    # Expected: NO OUTPUT

# 12. Migration 006 does NOT have REWORK in CHECK constraint
grep "REWORK" server/migrations/006_create_checkins.sql
# Expected: NO OUTPUT
```

---

## FRONTEND AUDIT (goalsync_frontend_final.zip)

### File Presence
- [ ] `client/src/services/notificationService.js` exists (standalone)
- [ ] `client/src/components/common/NotificationBell.jsx` exists
- [ ] `client/src/components/common/ErrorBoundary.jsx` exists
- [ ] `client/src/hooks/useNotifications.js` exists
- [ ] `client/src/pages/admin/Analytics.jsx` exists
- [ ] `client/vercel.json` exists
- [ ] `client/src/components/charts/QoQTrendChart.jsx` exists
- [ ] `client/src/components/charts/CompletionHeatmap.jsx` exists

### Critical Content Checks
```bash
# 1. cycleService calls correct URL
grep "cycleService" client/src/services/index.js | grep "getActive"
# Expected: api.get('/goals/cycle')  NOT /cycle/active

# 2. No broken notificationService in index.js
grep "notificationService" client/src/services/index.js
# Expected: NO OUTPUT (it's been moved to standalone file)

# 3. GoalForm uses correct thrust-areas endpoint
grep "thrust" client/src/components/employee/GoalForm.jsx | grep "api\|service"
# Expected: /goals/thrust-areas  NOT /admin/thrust-areas

# 4. Goals response shape fixed
grep "data\.data" client/src/hooks/useGoals.js
# Expected: data.data?.goals  NOT just data.data

# 5. No 'missed' status in CheckinPage
grep "'missed'" client/src/pages/employee/CheckinPage.jsx
# Expected: NO OUTPUT

# 6. approveAllGoals uses PUT not POST
grep "approveAllGoals" client/src/services/index.js
# Expected: api.put(  NOT api.post(

# 7. Analytics.jsx has no localStorage
grep "localStorage" client/src/pages/admin/Analytics.jsx
# Expected: NO OUTPUT

# 8. Navbar imports NotificationBell
grep "NotificationBell" client/src/components/common/Navbar.jsx
# Expected: import NotificationBell + <NotificationBell />

# 9. App.jsx has /admin/analytics route
grep "analytics" client/src/App.jsx
# Expected: Route path="/admin/analytics"

# 10. App.jsx uses React.lazy
grep "React.lazy\|lazy(" client/src/App.jsx
# Expected: multiple matches

# 11. scoreCalc has flat 0.5 for late timeline
grep "0.5" client/src/utils/scoreCalc.js
# Expected: return 0.5  (timeline case)

# 12. scoreCalc exports aliases
grep "scoreToDisplay\|calculateOverallScore" client/src/utils/scoreCalc.js
# Expected: export const scoreToDisplay or export function scoreToDisplay

# 13. Sidebar has analytics link
grep "analytics" client/src/components/common/Sidebar.jsx
# Expected: /admin/analytics

# 14. vercel.json has rewrites
grep "rewrites\|destination" client/vercel.json
# Expected: index.html rewrite present
```

---

## INTEGRATION SMOKE TEST
Once both are deployed or running locally:

### As Employee (employee@goalsynce.com / Employee@123)
- [ ] Login redirects to /employee
- [ ] Dashboard loads (no console errors, goals visible)
- [ ] "Add Goal" button visible (if in phase1 window)
- [ ] GoalForm opens, thrust area dropdown populates
- [ ] WeightageGauge updates in real time
- [ ] Notification bell renders in navbar (even if 0 unread)

### As Manager (manager@goalsynce.com / Manager@123)
- [ ] Login redirects to /manager
- [ ] Team Dashboard loads showing team members
- [ ] Approval Queue loads (no 500 errors)
- [ ] Can approve a submitted goal

### As Admin (admin@goalsynce.com / Admin@123)
- [ ] Login redirects to /admin
- [ ] Admin Dashboard loads (org stats visible)
- [ ] Settings page loads (cycles, users, thrust areas visible)
- [ ] Analytics page reachable at /admin/analytics
- [ ] Reports page loads with export buttons

### Backend Health
- [ ] GET /health returns { status: 'ok' }
- [ ] POST /api/auth/login with Admin@123 returns JWT
- [ ] GET /api/goals/cycle returns cycle with is_goal_setting_open field
- [ ] GET /api/notifications returns array (not 404)

---

## COMMON FAILURES AND FIXES

**"Cannot find module '../middleware/authenticate'"**
→ notifications.routes.js still uses named import. Change to default import.

**"goals.filter is not a function"**
→ useGoals.js or Dashboard.jsx still uses `data.data` not `data.data?.goals`

**"403 on thrust areas"**
→ GoalForm.jsx still calling /admin/thrust-areas. Change to /goals/thrust-areas.

**"404 on /cycle/active"**
→ cycleService in index.js still has old URL. Change to /goals/cycle.

**"404 on /notifications/unread"**
→ Navbar or old notificationService still using old URL. Make sure standalone notificationService.js is used everywhere.

**"500 on checkin save with status missed"**
→ CheckinPage.jsx still has 'missed' in GOAL_STATUSES array. Change to 'at_risk'.

**Analytics page blank / no cycle data**
→ Analytics.jsx still has hardcoded cycle IDs. Fix the cycle fetch.

**Notification bell missing**
→ Navbar.jsx not importing NotificationBell. Add import + render.

**App crashes on any page load**
→ App.jsx missing ErrorBoundary wrapper OR lazy import failed. Check browser console for specific module error.
