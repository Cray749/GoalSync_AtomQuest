# GoalSync — 6-Hour Sprint Plan
# What to open, what to upload, what to expect

---

## OPEN 3 CLAUDE CHATS SIMULTANEOUSLY

---

### CHAT 1 — Backend (Phase A)
**Upload to this chat:**
- PHASE_A_BACKEND_INTEGRATION.md  ← the manual
- session_1.zip
- session_2.zip
- session_3.zip
- session_7.zip

**First message to send:**
"You are integrating a Node.js/Express/PostgreSQL backend for GoalSync.
Read the attached manual PHASE_A_BACKEND_INTEGRATION.md carefully and completely
before writing a single line of code. Follow every step in order. At the end,
run the syntax check on all JS files and confirm all items in the verification
checklist pass. Deliver goalsync_backend_final.zip."

**Expected output:** `goalsync_backend_final.zip`
**Estimated time:** 45–60 min

---

### CHAT 2 — Frontend (Phase B)
**Upload to this chat:**
- PHASE_B_FRONTEND_INTEGRATION.md  ← the manual
- session_5.zip
- session_6.zip
- session_7.zip
- session_8.zip

**First message to send:**
"You are integrating a React 18 + Vite + Tailwind frontend for GoalSync.
Read the attached manual PHASE_B_FRONTEND_INTEGRATION.md carefully and completely
before writing a single line of code. Apply every fix listed — all 12 fixes
plus the merge steps. Verify every item in the verification checklist before
delivering. Deliver goalsync_frontend_final.zip."

**Expected output:** `goalsync_frontend_final.zip`
**Estimated time:** 45–60 min

---

### CHAT 3 (this chat) — QA Reviewer
**When Phase A delivers:** upload `goalsync_backend_final.zip` here
**When Phase B delivers:** upload `goalsync_frontend_final.zip` here

Send message: "Run Phase C QA audit on this"
I will run the PHASE_C_QA_CHECKLIST.md checks and tell you exactly what failed
and what to send back to which chat.

---

## TIMELINE (6 hours)

| Time | Action |
|------|--------|
| 0:00 | Open Chats 1 + 2, send first messages with zips + manuals |
| 1:00 | Both chats should be delivering. Upload to Chat 3 for QA |
| 1:30 | Send any fixes back to Chat 1 or 2 based on QA results |
| 2:00 | Clean passing zips from both chats |
| 2:30 | Deploy backend to Railway, frontend to Vercel |
| 3:00 | End-to-end smoke test with all 3 demo logins |
| 3:30 | Buffer for any deploy issues |
| 4:00 | Project submitted ✅ |

---

## DEMO CREDENTIALS (for judges)
| Role     | Email                    | Password      |
|----------|--------------------------|---------------|
| Admin    | admin@goalsynce.com      | Admin@123     |
| Manager  | manager@goalsynce.com    | Manager@123   |
| Employee | employee@goalsynce.com   | Employee@123  |
| Employee | employee2@goalsynce.com  | Employee@123  |

---

## DEPLOY COMMANDS

### Railway (Backend)
1. Push server/ folder to GitHub repo
2. railway.app → New Project → Deploy from GitHub → select /server as root
3. Add PostgreSQL service to same project
4. Set env vars (copy from .env.example, fill real values)
5. Run in Railway console: `npm run migrate && npm run seed`

### Vercel (Frontend)
1. Push client/ folder to GitHub repo
2. vercel.com → New Project → Import → select /client as root
3. Framework: Vite | Build: `npm run build` | Output: `dist`
4. Set env var: `VITE_API_URL=https://your-railway-url.railway.app/api`

---

## IF A CHAT GETS STUCK OR MAKES ERRORS
Upload its output here (to this QA chat) and say "this chat got stuck, what's wrong".
I'll diagnose and give you the exact fix to paste back.
