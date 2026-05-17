# GoalSync — In-House Goal Setting & Tracking Portal

> **AtomQuest Hackathon 1.0** submission — full-stack goal management system with quarterly check-ins, shared KPI cascading, analytics, and email notifications.

---

## 🚀 Live Demo

**URL:** https://goalsynce.onrender.com

> ⚠️ **Cold Start Note:** The backend runs on Render's free tier and may take ~30 seconds to wake up on the first request. Please allow for this during the demo.

---

## 🔑 Demo Credentials

| Role     | Email                      | Password      |
|----------|----------------------------|---------------|
| Admin    | admin@goalsynce.com        | Admin@123     |
| Manager  | manager@goalsynce.com      | Manager@123   |
| Employee | employee@goalsynce.com     | Employee@123  |
| Employee | employee2@goalsynce.com    | Employee@123  |

---

## 🏗️ Architecture

```
GitHub Repo
    ├── server/   →  Render Web Service (Node.js/Express API)
    └── client/   →  Render Static Site (React/Vite frontend)
                           ↕
                  Render PostgreSQL (Free, 1GB)
```

---

## ✅ BRD Compliance

| Feature | Status |
|---|---|
| Goal Creation & Approval (submit → manager approve/rework) | ✅ |
| Shared Goal Achievement Sync (cascade actuals to child goals) | ✅ |
| Manager can push shared goals to team | ✅ |
| Manager-as-Employee (own goals + team view toggle) | ✅ |
| Quarterly Check-ins with UoM formulas (min/max/timeline/zero) | ✅ |
| Real-time score preview | ✅ |
| Check-in window enforcement | ✅ |
| Achievement Report (CSV + Excel export) | ✅ |
| Completion Dashboard | ✅ |
| Admin Audit Trail | ✅ |
| Email Notifications (Mailtrap) | ✅ |
| Escalation Module (daily cron) | ✅ |
| Analytics Module (4 charts) | ✅ |
| Azure AD SSO | 📋 Planned |

---

## 🛠️ Tech Stack

**Backend:** Node.js · Express · PostgreSQL · node-cron · Nodemailer  
**Frontend:** React · Vite · Recharts · TailwindCSS  
**Deployment:** Render (Web Service + Static Site + PostgreSQL)

---

## 🧑‍💻 Local Development

### Backend
```bash
cd server
cp .env.example .env   # fill in your DATABASE_URL and JWT_SECRET
npm install
npm run migrate        # runs all SQL migrations
npm run seed           # seeds demo users + goals
npm run dev            # starts nodemon dev server on :4000
```

### Frontend
```bash
cd client
cp .env.example .env   # set VITE_API_URL=http://localhost:4000/api
npm install
npm run dev            # starts Vite dev server on :5173
```

---

## 📦 Production Deploy (Render)

See [`PRODUCTION_DEPLOY_GUIDE.html`](./PRODUCTION_DEPLOY_GUIDE.html) for the full step-by-step guide.

**Quick steps:**
1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint → connect this repo → Render reads `render.yaml` and creates all 3 services
3. Open the backend Shell tab → `npm run migrate` → `npm run seed`
4. Set `CLIENT_URL` in backend env vars to your frontend URL
5. Set `VITE_API_URL` in frontend env vars to your backend URL + `/api`

---

## 🎯 Demo Journey

1. **Admin** — creates cycle, manages thrust areas, views analytics, downloads reports, unlocks goals
2. **Manager** — approves/reworks team goals, adds check-in comments, views team progress, pushes shared KPIs
3. **Employee** — creates goals, submits for approval, logs quarterly actuals, views score

---

*GoalSync · AtomQuest Hackathon 1.0*
