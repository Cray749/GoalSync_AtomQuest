# GoalSync — Phase B: Frontend Integration Manual
# Start this AFTER Phase A backend is complete (or in parallel if you understand both).

---

## CONTEXT
You are integrating a complete React 18 + Vite + Tailwind CSS frontend for "GoalSync".
Session 5 is the verified base (most complete). Sessions 6, 7, and 8 add analytics charts,
notification bell, error boundaries, and deployment config on top.

---

## INPUT FILES YOU WILL RECEIVE
Upload all of these to this chat before starting:
- session_5.zip  (base frontend — all pages, components, hooks, services)
- session_6.zip  (analytics charts — QoQTrendChart, CompletionHeatmap, etc.)
- session_7.zip  (NotificationBell.jsx, Navbar.jsx, notificationService.js, useNotifications.js)
- session_8.zip  (ErrorBoundary.jsx, App.jsx with lazy loading, vercel.json)

---

## OUTPUT REQUIRED
A single zip: `goalsync_frontend_final.zip`
Containing folder: `client/`

---

## COMPLETE LIST OF ALL FIXES — apply every single one

---

### FIX 1 — cycleService wrong URL
**File:** `client/src/services/index.js`

FIND:
```js
export const cycleService = {
  getActive: () => api.get('/cycle/active'),
};
```
REPLACE WITH:
```js
export const cycleService = {
  getActive: () => api.get('/goals/cycle'),
};
```

---

### FIX 2 — notificationService: wrong URLs + wrong HTTP methods
**File:** `client/src/services/index.js`

DELETE the entire `notificationService` export block from `index.js`.
It will be replaced by the standalone `notificationService.js` from Session 7.

Copy Session 7's `notificationService.js` into `client/src/services/notificationService.js`.

Then in every file that imports `notificationService` from `index.js`, change the import to:
```js
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../services/notificationService';
```

---

### FIX 3 — GoalForm fetches thrust areas from wrong endpoint (403 for employees)
**File:** `client/src/components/employee/GoalForm.jsx`

FIND the thrust areas fetch (will look something like):
```js
const res = await adminService.getThrustAreas(cycleId);
```
REPLACE WITH:
```js
import api from '../../services/api';
// ...
const res = await api.get('/goals/thrust-areas', { params: { cycle_id: cycleId } });
```
Use `res.data.data` for the array (same envelope as other endpoints).

---

### FIX 4 — Goals response shape: data.data is object not array
**File:** `client/src/hooks/useGoals.js`

Backend `GET /api/goals` returns:
`{ success, data: { goals: [...], overall_score, active_window, active_quarter, cycle_id } }`

FIND:
```js
const raw = goalsRes.data.data || [];
```
REPLACE WITH:
```js
const raw = goalsRes.data.data?.goals || [];
```

Also store the active window info:
```js
const cycleInfo = goalsRes.data.data;
// after setGoals(enriched):
if (cycleInfo) {
  setCycle(prev => ({
    ...prev,
    active_window:        cycleInfo.active_window,
    active_quarter:       cycleInfo.active_quarter,
    is_goal_setting_open: cycleInfo.active_window === 'phase1',
    is_checkin_open:      ['q1','q2','q3','q4'].includes(cycleInfo.active_window),
  }));
}
```

---

### FIX 5 — Same response shape fix in Dashboard.jsx and GoalsPage.jsx
**Files:** `client/src/pages/employee/Dashboard.jsx`
          `client/src/pages/employee/GoalsPage.jsx`

In both files, FIND any line like:
```js
setGoals(goalsRes.data.data || []);
```
REPLACE WITH:
```js
setGoals(goalsRes.data.data?.goals || []);
```

---

### FIX 6 — CheckinPage uses 'missed' status (violates DB constraint)
**File:** `client/src/pages/employee/CheckinPage.jsx`

FIND:
```js
const GOAL_STATUSES = ['not_started', 'on_track', 'completed', 'missed'];
const STATUS_LABELS = { ..., missed: 'Missed' };
```
REPLACE WITH:
```js
const GOAL_STATUSES = ['not_started', 'on_track', 'completed', 'at_risk'];
const STATUS_LABELS = { not_started: 'Not Started', on_track: 'On Track', completed: 'Completed', at_risk: 'At Risk' };
```
Also find and replace any hardcoded string `'missed'` with `'at_risk'` in this file.

---

### FIX 7 — managerService.approveAllGoals wrong method + URL
**File:** `client/src/services/index.js`

FIND:
```js
approveAllGoals: (employeeId, cycleId) =>
  api.post('/manager/goals/approve-all', { employee_id: employeeId, cycle_id: cycleId }),
```
REPLACE WITH:
```js
approveAllGoals: (employeeId, cycleId) =>
  api.put(`/manager/goals/approve-all/${employeeId}`, cycleId ? { cycle_id: cycleId } : {}),
```

---

### FIX 8 — scoreCalc.js: timeline formula inconsistency + missing export aliases
**File:** `client/src/utils/scoreCalc.js`

**Part A — Fix timeline formula** to match server (flat 0.5 for any late completion):

FIND the timeline case (however it's written) and replace the entire case with:
```js
case 'timeline': {
  if (!completionDate) return 0;
  if (!targetDate) return 0;
  const deadlineMs  = new Date(targetDate).getTime();
  const completedMs = new Date(completionDate).getTime();
  if (isNaN(deadlineMs) || isNaN(completedMs)) return 0;
  return completedMs <= deadlineMs ? 1 : 0.5;
}
```

**Part B — Add export aliases** so Session 6 chart components work:
Add these lines at the END of `scoreCalc.js`:
```js
// Aliases for Session 6 analytics components
export const scoreToDisplay    = toDisplayPct;
export const calculateOverallScore = computeOverallScore;
```
(Only add if `toDisplayPct` and `computeOverallScore` are the names used in your file.
If the file already uses `scoreToDisplay` and `calculateOverallScore`, skip this.)

---

### FIX 9 — Analytics.jsx: remove localStorage, fix cycle fetch
**File:** `client/src/pages/admin/Analytics.jsx`

**Part A:** FIND any line using localStorage for the token:
```js
const token = localStorage.getItem('goalsynce_token');
```
DELETE that line. The Axios instance (`api.js`) already injects the token automatically.
Remove any manual `Authorization` header setting in this file.

**Part B:** FIND the hardcoded cycle selector options (will have fake IDs like `'demo-fy2425'`).
Replace with a useEffect that fetches real cycles:
```js
const [cycles, setCycles] = useState([]);
useEffect(() => {
  adminService.getCycles()
    .then(res => setCycles(res.data.data || []))
    .catch(() => {});
}, []);
```
Then map `cycles` array to render the `<select>` or cycle picker options.

---

### FIX 10 — Wire NotificationBell into Navbar
Copy Session 7's `NotificationBell.jsx` → `client/src/components/common/NotificationBell.jsx`
Copy Session 7's `useNotifications.js` → `client/src/hooks/useNotifications.js`

**File:** `client/src/components/common/Navbar.jsx`

Add import at top:
```js
import NotificationBell from './NotificationBell';
```

Find the area in the navbar where the right side icons/buttons are rendered.
Add `<NotificationBell />` there, right before the user menu/avatar.

---

### FIX 11 — Add ErrorBoundary + lazy loading to App.jsx
Take Session 8's `App.jsx` as reference. It wraps all routes in:
1. `<ErrorBoundary>` at the top level
2. `React.lazy()` for every page import
3. `<Suspense fallback={<PageLoader />}>` around routes

Apply the same pattern to Session 5's `App.jsx`.
Keep Session 5's route structure (it has the `/admin/analytics` route that Session 8 is missing).
Just add the lazy loading + ErrorBoundary wrapping on top.

The `ErrorBoundary` component: use Session 8's version (better than Session 5's).
Copy it to `client/src/components/common/ErrorBoundary.jsx`.

---

### FIX 12 — Add /admin/analytics route (verify it's present)
**File:** `client/src/App.jsx`

Session 5 already has this route. Verify it's there:
```jsx
<Route path="/admin/analytics" element={
  <RoleGuard roles={['admin']} fallback={<Navigate to="/admin" replace />}>
    <Analytics />
  </RoleGuard>
} />
```
If missing, add it inside the admin ProtectedRoute section.

Also verify `client/src/components/common/Sidebar.jsx` has the Analytics link
in the admin nav items. It should have:
```js
{ to: '/admin/analytics', label: 'Analytics', icon: ... }
```

---

### STEP: Merge Session 6 chart components
Session 5 already includes the chart components. Verify these files exist:
- `client/src/components/charts/QoQTrendChart.jsx`
- `client/src/components/charts/CompletionHeatmap.jsx`
- `client/src/components/charts/GoalDistributionCharts.jsx`
- `client/src/components/charts/ManagerEffectivenessChart.jsx`

If any are missing, copy from Session 6.

Session 6 also has a standalone `reports.controller.analytics.js` —
this is a backend file, ignore it in the frontend integration.

---

### STEP: Add deployment files

**File:** `client/vercel.json`
Use Session 8's version (has security headers). If Session 5 has one, replace it:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**File:** `client/.env.example`
```
VITE_API_URL=http://localhost:4000/api
VITE_USE_MOCK_DATA=false
```

---

## VERIFICATION CHECKLIST
Before zipping, verify:

**Services:**
- [ ] `cycleService.getActive()` calls `/goals/cycle` (NOT `/cycle/active`)
- [ ] No `notificationService` in `index.js` — it's a separate file
- [ ] `notificationService.js` exists in `services/` (from Session 7)
- [ ] `managerService.approveAllGoals` uses `api.put` with `:employeeId` in URL

**Components:**
- [ ] `GoalForm.jsx` fetches thrust areas from `/goals/thrust-areas` (NOT `/admin/thrust-areas`)
- [ ] `CheckinPage.jsx` has NO `'missed'` status — uses `'at_risk'`
- [ ] `NotificationBell.jsx` exists in `components/common/`
- [ ] `ErrorBoundary.jsx` exists in `components/common/`
- [ ] `Navbar.jsx` imports and renders `<NotificationBell />`

**Hooks:**
- [ ] `useGoals.js` uses `goalsRes.data.data?.goals` not `goalsRes.data.data`
- [ ] `useNotifications.js` exists in `hooks/`

**Pages:**
- [ ] `Dashboard.jsx` uses `data?.goals` for goals array
- [ ] `GoalsPage.jsx` uses `data?.goals` for goals array
- [ ] `Analytics.jsx` has NO `localStorage.getItem` call
- [ ] `Analytics.jsx` fetches cycles from `adminService.getCycles()`

**Routing:**
- [ ] `App.jsx` has `/admin/analytics` route
- [ ] `App.jsx` has lazy loading with `React.lazy()` + `<Suspense>`
- [ ] `App.jsx` is wrapped with `<ErrorBoundary>`
- [ ] `Sidebar.jsx` has Analytics link for admin role

**scoreCalc.js:**
- [ ] Timeline case returns flat `0.5` for late (NOT proportional penalty)
- [ ] Exports `scoreToDisplay` and `calculateOverallScore` (as aliases or primary names)

**Deployment:**
- [ ] `vercel.json` present with rewrites + security headers

---

## DO NOT TOUCH
- Do NOT modify `tailwind.config.js`, `vite.config.js`, `postcss.config.js`
- Do NOT modify `index.css` design tokens — the custom `gs-*` classes are intentional
- Do NOT change `AuthContext.jsx` — it's correct
- Do NOT change `api.js` (Axios instance) — the interceptors are correct
- Do NOT remove any existing routes from `App.jsx` — only add/fix
