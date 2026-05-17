// server/src/server.js
// Process entry point: loads env, connects DB, starts Express + cron.

'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app         = require('./app');
const { pool }    = require('./config/db');

const PORT = process.env.PORT || 4000;

async function startServer() {
  // ── 1. Verify database connection ──────────────────────────
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS now');
    console.log(`[DB] Connected — server time: ${rows[0].now}`);
    client.release();
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    console.error('     Make sure DATABASE_URL is set and PostgreSQL is running.');
    process.exit(1);
  }

  // ── 2. Start Express ──────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[Server] GoalSync API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
  });

  // ── 3. Cron jobs ───────────────────────────────────────────
  try {
    require('./jobs/escalation.job').startEscalationJob();
    console.log('[Server] Escalation cron job scheduled');
  } catch (err) {
    console.warn('[Server] Escalation job failed to start:', err.message);
  }
}

// ── Graceful shutdown ──────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully…`);
  await pool.end();
  console.log('[DB] Pool closed.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

startServer();
