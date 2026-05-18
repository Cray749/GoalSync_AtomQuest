/**
 * email.service.js
 * GoalSync — Nodemailer email notification service.
 *
 * Supports two transports:
 *   • Dev/Demo  → Mailtrap SMTP (free, no real delivery, safe for hackathon)
 *   • Production → Any SMTP (Gmail, SendGrid, SES) via env vars
 *
 * All 5 trigger points from the manual are implemented:
 *   1. Employee submits goals          → manager notified
 *   2. Manager approves goals          → employee notified
 *   3. Manager returns for rework      → employee notified
 *   4. Quarter window opens            → all employees notified (bulk)
 *   5. Escalation triggered            → manager / HR notified
 *
 * Usage:
 *   const emailService = require('./email.service');
 *   await emailService.sendGoalsSubmittedEmail({ managerEmail, managerName, employeeName, goalCount, cycleId });
 */

const nodemailer = require('nodemailer');

// ─── Transport configuration ──────────────────────────────────────────────────

function createTransport() {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
    SMTP_SECURE, NODE_ENV,
  } = process.env;

  if (NODE_ENV === 'test') {
    // In-memory transport for unit tests — never sends real email
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host:   SMTP_HOST   || 'sandbox.smtp.mailtrap.io',
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_SECURE === 'true', // true for port 465, false for 587
    auth: {
      user: SMTP_USER || '',
      pass: SMTP_PASS || '',
    },
    // Reasonable timeouts to avoid hanging the request
    connectionTimeout: 5000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
  });
}

// Singleton transport — reuse across requests
let _transport = null;
function getTransport() {
  if (!_transport) _transport = createTransport();
  return _transport;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || '"Nucleas" <noreply@nucleas.app>';
const CLIENT_URL   = process.env.CLIENT_URL  || 'http://localhost:5173';

// ─── HTML template engine (no external dep) ───────────────────────────────────

/**
 * Wraps any content block in the GoalSync branded email shell.
 * Uses inline styles for maximum email client compatibility.
 */
function wrapInShell({ title, preheader, body, ctaText, ctaUrl }) {
  const cta = ctaText && ctaUrl
    ? `<tr><td align="center" style="padding:24px 0 8px;">
         <a href="${ctaUrl}"
            style="display:inline-block;padding:12px 28px;background:#185FA5;
                   color:#ffffff;text-decoration:none;border-radius:6px;
                   font-size:14px;font-weight:500;letter-spacing:0.3px;">
           ${ctaText}
         </a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${preheader}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f0;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="580"
             style="background:#ffffff;border-radius:8px;overflow:hidden;
                    border:1px solid #e8e8e2;">

        <!-- Header bar -->
        <tr>
          <td style="background:#0C447C;padding:20px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:600;color:#ffffff;
                                letter-spacing:-0.3px;">Nucleas</span>
                  <span style="font-size:11px;color:#85B7EB;margin-left:8px;">
                    Performance Portal
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;
                        color:#0C2340;line-height:1.3;">
              ${title}
            </h1>
            ${body}
          </td>
        </tr>

        <!-- CTA -->
        ${cta ? `<tr><td style="padding:0 32px;">${cta.replace(/<tr>|<\/tr>|<td[^>]*>|<\/td>/g,'')}</td></tr>` : ''}

        <!-- Divider -->
        <tr>
          <td style="padding:24px 32px 0;">
            <hr style="border:none;border-top:1px solid #e8e8e2;margin:0;"/>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <p style="margin:0;font-size:12px;color:#888780;line-height:1.6;">
              This is an automated message from Nucleas. Please do not reply directly
              to this email.<br/>
              &copy; ${new Date().getFullYear()} Nucleas · AtomQuest
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Standard paragraph block */
const p = (text, style = '') =>
  `<p style="margin:0 0 14px;font-size:14px;color:#2C2C2A;line-height:1.7;${style}">${text}</p>`;

/** Highlight box (used for goal counts, deadlines etc.) */
const highlight = (label, value, color = '#185FA5') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
          style="background:#f0f5fb;border-left:3px solid ${color};
                 border-radius:0 4px 4px 0;margin:0 0 16px;">
     <tr>
       <td style="padding:12px 16px;">
         <span style="font-size:12px;color:#5F5E5A;">${label}</span><br/>
         <span style="font-size:16px;font-weight:600;color:${color};">${value}</span>
       </td>
     </tr>
   </table>`;

/** Warning box */
const warning = (text) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
          style="background:#FAEEDA;border-left:3px solid #BA7517;
                 border-radius:0 4px 4px 0;margin:0 0 16px;">
     <tr><td style="padding:12px 16px;font-size:13px;color:#633806;">${text}</td></tr>
   </table>`;

// ─── Core send function ────────────────────────────────────────────────────────

/**
 * Send a single email. Wraps nodemailer.sendMail with error handling.
 * Errors are logged but NOT thrown — email failures should never crash the API.
 *
 * @param {object} opts - { to, subject, html, text? }
 * @returns {Promise<boolean>} true if sent, false if failed
 */
async function send({ to, subject, html, text }) {
  try {
    const transport = getTransport();
    const info = await transport.sendMail({
      from:    FROM_ADDRESS,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    console.log(`[email] ✓ sent to ${to} | subject: "${subject}" | id: ${info.messageId}`);
    return true;
  } catch (err) {
    // Log but do NOT throw — email is non-critical path
    console.error(`[email] ✗ failed to ${to} | subject: "${subject}" | error: ${err.message}`);
    return false;
  }
}

/**
 * Bulk send — fires all emails concurrently with a concurrency cap of 5.
 * Used for quarter-open broadcasts.
 *
 * @param {Array<{to, subject, html}>} emails
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function sendBulk(emails, concurrency = 5) {
  let sent = 0, failed = 0;
  // Process in batches
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(e => send(e)));
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) sent++;
      else failed++;
    });
    // Small delay between batches to avoid SMTP rate limits
    if (i + concurrency < emails.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log(`[email] bulk complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// ─── Trigger 1: Employee submits goals → Manager notified ─────────────────────

/**
 * @param {object} opts
 * @param {string} opts.managerEmail
 * @param {string} opts.managerName
 * @param {string} opts.employeeName
 * @param {number} opts.goalCount
 * @param {string} opts.cycleName
 * @param {string} opts.employeeId  - for deep link
 */
async function sendGoalsSubmittedEmail({ managerEmail, managerName, employeeName, goalCount, cycleName, employeeId }) {
  const body =
    p(`Hi ${managerName},`) +
    p(`<strong>${employeeName}</strong> has submitted their goals for review and is awaiting your approval.`) +
    highlight('Goals submitted', `${goalCount} goal${goalCount !== 1 ? 's' : ''} · ${cycleName}`) +
    p('Please review and either approve or return for rework. Unreviewed goals trigger an escalation reminder after 7 days.');

  return send({
    to:      managerEmail,
    subject: `[Nucleas] ${employeeName} has submitted goals for review`,
    html:    wrapInShell({
      title:    `${employeeName} submitted goals`,
      preheader: `${goalCount} goals awaiting your approval for ${cycleName}`,
      body,
      ctaText:  'Review Goals',
      ctaUrl:   `${CLIENT_URL}/manager/approvals?employee=${employeeId}`,
    }),
  });
}

// ─── Trigger 2: Manager approves → Employee notified ──────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.employeeEmail
 * @param {string} opts.employeeName
 * @param {string} opts.managerName
 * @param {string} opts.cycleName
 * @param {number} opts.approvedCount
 */
async function sendGoalsApprovedEmail({ employeeEmail, employeeName, managerName, cycleName, approvedCount }) {
  const body =
    p(`Hi ${employeeName},`) +
    p(`Great news! <strong>${managerName}</strong> has approved your goals. Your goals are now locked and the check-in cycle will begin at the next quarterly window.`) +
    highlight('Approved', `${approvedCount} goal${approvedCount !== 1 ? 's' : ''} finalized · ${cycleName}`, '#1D9E75') +
    p('You can view your approved goals and track your progress on the Nucleas dashboard.');

  return send({
    to:      employeeEmail,
    subject: `[Nucleas] Your goals have been approved ✅`,
    html:    wrapInShell({
      title:    'Your goals have been approved',
      preheader: `${managerName} approved ${approvedCount} goals for ${cycleName}`,
      body,
      ctaText:  'View My Goals',
      ctaUrl:   `${CLIENT_URL}/employee/goals`,
    }),
  });
}

// ─── Trigger 3: Manager returns for rework → Employee notified ────────────────

/**
 * @param {object} opts
 * @param {string} opts.employeeEmail
 * @param {string} opts.employeeName
 * @param {string} opts.managerName
 * @param {string} opts.goalTitle
 * @param {string} opts.reworkComment
 */
async function sendGoalsReworkEmail({ employeeEmail, employeeName, managerName, goalTitle, reworkComment }) {
  const body =
    p(`Hi ${employeeName},`) +
    p(`<strong>${managerName}</strong> has returned one of your goals for revision. Please update it and resubmit.`) +
    highlight('Goal returned for revision', `"${goalTitle}"`, '#BA7517') +
    (reworkComment
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background:#f9f9f7;border:1px solid #e8e8e2;border-radius:4px;margin:0 0 16px;">
           <tr>
             <td style="padding:12px 16px;">
               <span style="font-size:11px;color:#5F5E5A;text-transform:uppercase;letter-spacing:0.5px;">
                 Manager's comment
               </span><br/>
               <span style="font-size:14px;color:#2C2C2A;font-style:italic;line-height:1.6;">
                 "${reworkComment}"
               </span>
             </td>
           </tr>
         </table>`
      : '') +
    p('Please revise your goal and resubmit for approval. Your total weightage must still equal 100%.');

  return send({
    to:      employeeEmail,
    subject: `[Nucleas] Goals returned for revision`,
    html:    wrapInShell({
      title:    'Action required: goal revision',
      preheader: `${managerName} has returned "${goalTitle}" for changes`,
      body,
      ctaText:  'Revise Goal',
      ctaUrl:   `${CLIENT_URL}/employee/goals`,
    }),
  });
}

// ─── Trigger 4: Quarter window opens → All employees notified ─────────────────

/**
 * Sends a personalized email to each employee when a new check-in window opens.
 *
 * @param {object} opts
 * @param {Array<{email, name}>} opts.employees   - all active employees
 * @param {string} opts.quarter                   - 'Q1' | 'Q2' | 'Q3' | 'Q4'
 * @param {string} opts.cycleName
 * @param {Date}   opts.windowEnd                 - when the check-in window closes
 * @returns {Promise<{sent, failed}>}
 */
async function sendQuarterOpenEmail({ employees, quarter, cycleName, windowEnd }) {
  const deadline = new Date(windowEnd).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const emails = employees.map(({ email, name }) => {
    const body =
      p(`Hi ${name},`) +
      p(`The <strong>${quarter} check-in window</strong> is now open for ${cycleName}. Please log your actual achievements for each approved goal before the deadline.`) +
      highlight('Check-in deadline', deadline, '#D85A30') +
      p('For each goal, enter your actual value and set the appropriate status (On Track, Completed, or At Risk). Your manager will review and comment on your progress.');

    return {
      to:      email,
      subject: `[Nucleas] ${quarter} Check-in window is now open`,
      html:    wrapInShell({
        title:    `${quarter} Check-in is open`,
        preheader: `Log your achievements before ${deadline}`,
        body,
        ctaText:  'Log Achievements',
        ctaUrl:   `${CLIENT_URL}/employee/checkin`,
      }),
    };
  });

  return sendBulk(emails);
}

// ─── Trigger 5: Escalation triggered → Manager / HR notified ─────────────────

/**
 * @param {object} opts
 * @param {string} opts.notifyEmail      - recipient (manager or HR)
 * @param {string} opts.notifyName
 * @param {string} opts.targetName       - the person who hasn't acted
 * @param {string} opts.reason           - human-readable reason
 * @param {string} opts.ruleType         - 'goal_not_submitted' | 'goal_not_approved' | 'checkin_not_done'
 * @param {number} opts.daysOverdue
 */
async function sendEscalationEmail({ notifyEmail, notifyName, targetName, reason, ruleType, daysOverdue }) {
  const actionMap = {
    goal_not_submitted: { action: 'submit their goals', icon: '📋' },
    goal_not_approved:  { action: 'approve pending goals', icon: '✅' },
    checkin_not_done:   { action: 'complete their check-in', icon: '📊' },
  };
  const { action, icon } = actionMap[ruleType] || { action: 'take action', icon: '⚠' };

  const body =
    p(`Hi ${notifyName},`) +
    warning(`${icon} <strong>${targetName}</strong> has not yet ${action}. This is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`) +
    p(`<strong>Reason for escalation:</strong> ${reason}`) +
    p('Please follow up with them directly or take corrective action in Nucleas. Continued inaction may affect cycle completion metrics.');

  return send({
    to:      notifyEmail,
    subject: `[Nucleas] ⚠️ Action Required: ${targetName} — ${action}`,
    html:    wrapInShell({
      title:    `Action required: ${icon} ${targetName}`,
      preheader: `${targetName} has not ${action} — ${daysOverdue} days overdue`,
      body,
      ctaText:  'View in Nucleas',
      ctaUrl:   `${CLIENT_URL}/manager/team`,
    }),
  });
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Verify SMTP connection. Call on server startup to catch misconfigured creds early.
 */
async function verifyConnection() {
  try {
    await getTransport().verify();
    console.log('[email] SMTP connection verified ✓');
    return true;
  } catch (err) {
    console.warn(`[email] SMTP verification failed (non-fatal): ${err.message}`);
    return false;
  }
}

module.exports = {
  send,
  sendBulk,
  sendGoalsSubmittedEmail,
  sendGoalsApprovedEmail,
  sendGoalsReworkEmail,
  sendQuarterOpenEmail,
  sendEscalationEmail,
  verifyConnection,
};
