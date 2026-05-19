```markdown
# Nucleus — In-House Goal Setting & Tracking Portal

> Built for AtomQuest Hackathon 1.0 · Atomberg Technologies

---

## Live Demo

**Frontend:** https://nucleus-6q6e.onrender.com  
**Backend API:** https://goalsync-tzsv.onrender.com

> The backend runs on Render's free tier. If the app takes ~30 seconds  
> to load on first visit, the server is waking up from idle. This is  
> expected behavior on the free tier — it will be instant after that.

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin / HR | admin@nucleas.com | Admin@123 |
| Manager (L1) | manager@nucleas.com | Manager@123 |
| Employee 1 | employee@nucleas.com | Employee@123 |
| Employee 2 | employee2@nucleas.com | Employee@123 |

The demo data is pre-seeded to show a complete working journey:
- **Aarav Singh** has 5 approved goals with Q1 actuals already submitted
- **Meera Patel** has goals in submitted state, waiting for manager approval
- **Rahul Verma** (Manager) has his own 2 goals, plus manages both employees
- A shared KPI goal pushed by Admin is visible on both employee dashboards
- 16 audit log entries and escalation history are pre-populated

---

## What is Nucleus?

Nucleus is an end-to-end employee goal management portal that replaces 
spreadsheet-based performance tracking with a structured, auditable, 
role-aware system.

It covers the complete annual performance cycle:

```
Goal Setting → Manager Approval → Quarterly Check-ins → Analytics & Reports
```

Three roles, one platform. Every feature is scoped to what that role 
actually needs — employees never see other employees' data, managers 
only see their direct reports, and HR has org-wide visibility.

---

## The Problem It Solves

Most organizations track employee goals in Excel sheets or scattered 
email threads. This creates four real problems:

1. **No accountability** — goals get set in April and forgotten by July
2. **No auditability** — no record of who changed what and when
3. **No real-time visibility** — HR has no idea who has submitted goals 
   and who hasn't until they chase people manually
4. **No score standardization** — different managers compute achievement 
   percentages differently

Nucleus solves all four. Goals are locked after approval, every change 
is logged, HR has a real-time completion dashboard, and scores are 
computed by the same formula for everyone.

---

## Key Features

### For Employees
- Create up to 8 goals per cycle with weightage that must total exactly 100%
- Real-time weightage gauge — turns green at 100%, red if over
- Four Unit of Measurement types:
  - **Higher is Better** — e.g. Sales Revenue (score = actual ÷ target)
  - **Lower is Better** — e.g. TAT, Cost (score = target ÷ actual)
  - **Date-Based** — e.g. Project delivery (100% if on time, 50% if late)
  - **Zero = Success** — e.g. Safety incidents (100% if zero, 0% otherwise)
- Quarterly check-in form with live score preview as you type actual values
- Goals returned for rework show manager's comment inline

### For Managers
- Role context toggle — switch between "My Goals" (as employee) and 
  "My Team" (as manager) without logging out
- Approval queue with inline editing of target and weightage before approving
- Bulk approve all goals for an employee in one click
- Quarterly check-in comments per goal per employee
- Team progress bar chart showing overall scores across direct reports

### For Admin / HR
- Configure goal cycles with precise date windows for goal setting and 
  each quarterly check-in period
- Push shared KPI goals to multiple employees simultaneously — 
  achievement updates on the parent automatically cascade to all children
- Real-time completion dashboard showing who has submitted, who has been 
  approved, who has done check-ins
- Unlock approved goals with mandatory reason — every unlock is written 
  to the audit trail
- Full paginated audit log with timestamps, changed fields, old and new values
- Achievement report export in both CSV and Excel formats

---

## Bonus Features Implemented

### Email Notifications
Five trigger points wired with Nodemailer (fire-and-forget pattern so 
email failures never crash API responses):
- Employee submits goals → Manager gets notified
- Manager approves goals → Employee gets notified
- Manager returns for rework → Employee gets notified with comment
- Admin opens a new goal cycle → All employees notified
- Escalation triggered → Manager / HR notified

### Automated Escalation Engine
A `node-cron` job runs daily at 8AM and evaluates three configurable rules:
- Goals not submitted N days after the cycle opens
- Goals not approved N days after submission
- Check-ins not completed during an open quarter window

Escalation thresholds are configurable per rule in the database. Every 
escalation is logged to `escalation_logs` with the target user, 
notified user, rule, and reason.

### Analytics Module
Four charts available at `/admin/analytics`:
- Quarter-on-Quarter trend line chart (avg score per quarter, per employee/team)
- Completion heatmap (departments × quarters, color intensity = completion %)
- Goal distribution (pie chart by thrust area, bar chart by UoM type)
- Manager effectiveness (check-in completion % per L1 manager)

### Microsoft Azure AD SSO
OAuth 2.0 / OIDC login flow via `@azure/msal-node`. Users can sign in 
with their Microsoft work account. The backend matches the Microsoft email 
against the users table and issues a standard JWT — the session is 
identical to a regular login from that point. New Microsoft emails are 
auto-provisioned as employees and can be assigned roles by Admin.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite | Fast build, small bundle |
| Styling | Tailwind CSS | Consistent design system |
| Charts | Recharts | React-native, no license issues |
| HTTP Client | Axios | Interceptors for JWT injection |
| Backend | Node.js 20 + Express 4 | JavaScript end-to-end |
| Database | PostgreSQL 16 | ACID compliance, audit-ready |
| DB Client | node-postgres (pg) | Lightweight, no ORM abstraction |
| Auth | JSON Web Tokens | Stateless, role-encoded payload |
| SSO | @azure/msal-node | Microsoft OAuth 2.0 / OIDC |
| Password | bcrypt | Industry standard hashing |
| Email | Nodemailer + Mailtrap | Fire-and-forget, dev-safe |
| Cron | node-cron | In-process scheduler |
| Excel Export | exceljs | Full .xlsx with formatting |
| CSV Export | json2csv | Lightweight, zero dependencies |
| Hosting | Render | Frontend + Backend + DB, free tier |

---

## Database Design

12 tables covering the full domain:

```
users               — employees, managers, admins with hierarchy
goal_cycles         — annual cycles with phase1 + Q1-Q4 date windows
thrust_areas        — KPI categories per cycle
goals               — employee goals with UoM, weightage, lock status
goal_achievements   — quarterly planned vs actual per goal
manager_checkins    — manager comments per goal per quarter
audit_logs          — every post-approval change with before/after values
notifications       — in-app notifications per user
escalation_rules    — configurable rule types with day thresholds
escalation_logs     — history of every escalation fired
```

Key design decisions:
- Goals get `is_locked = TRUE` on approval — the backend returns 403 
  on any edit attempt on a locked goal
- Shared goals use `parent_goal_id` — achievement updates cascade from 
  parent to all children automatically
- Audit log captures `field_name`, `old_value`, `new_value`, `ip_address` 
  — suitable for compliance review
- All primary keys are UUIDs — no sequential IDs that expose record counts

---

## API Overview

45 REST endpoints across 6 route groups:

| Group | Base Path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | Login, logout, /me, Azure SSO |
| Goals | `/api/goals` | CRUD, submit, thrust areas, cycle |
| Achievements | `/api/achievements` | Quarterly actuals per goal |
| Manager | `/api/manager` | Team, approvals, check-ins |
| Admin | `/api/admin` | Cycles, users, shared goals, unlock, audit |
| Reports | `/api/reports` | Achievement data, QoQ trend, CSV/Excel export |
| Notifications | `/api/notifications` | Read, mark read, unread count |

All responses follow a consistent envelope:
```json
{
  "success": true,
  "data": {},
  "message": "Goal approved successfully"
}
```

---

## Score Calculation

The same formula runs on both backend (for reports and exports) and 
frontend (for live preview while typing actuals). They are kept in 
sync as a shared utility — `score.service.js` on the backend, 
`scoreCalc.js` on the frontend.

| UoM Type | Formula | Example |
|----------|---------|---------|
| Higher is Better | actual ÷ target | 90 actual / 100 target = 90% |
| Lower is Better | target ÷ actual | 100 target / 80 actual = 125% |
| Date-Based | on time = 100%, late = 50% | delivered before deadline = 100% |
| Zero = Success | actual = 0 → 100%, else 0% | 0 incidents = 100% |

Scores are capped at 150% for display to handle overachievement. 
Weighted overall score = sum of (individual score × weightage %).

---

## Project Structure

```
nucleus/
├── client/                  # React frontend (Render Static Site)
│   ├── src/
│   │   ├── pages/           # employee/, manager/, admin/ dashboards
│   │   ├── components/      # common/, employee/, manager/, admin/
│   │   ├── services/        # Axios API service functions
│   │   ├── hooks/           # useAuth, useGoals, useCycle
│   │   ├── context/         # AuthContext (JWT state)
│   │   └── utils/           # scoreCalc, formatters, cycleUtils
│   └── public/
│       └── _redirects       # SPA routing for Render
│
└── server/                  # Node.js + Express (Render Web Service)
    ├── src/
    │   ├── routes/          # auth, goals, achievements, manager, 
    │   │                    # admin, reports, notifications, azure
    │   ├── controllers/     # request handlers per route group
    │   ├── services/        # goal, score, cycle, email, audit,
    │   │                    # escalation, notification
    │   ├── middleware/      # authenticate.js, authorize.js
    │   ├── config/          # db.js (pg pool), azure.js (MSAL)
    │   └── jobs/            # escalation.job.js (node-cron)
    ├── migrations/          # 10 ordered SQL migration files
    └── scripts/             # migrate.js, seed.js
```

---

## Team

Built solo for AtomQuest Hackathon 1.0.

---

## License

MIT
```