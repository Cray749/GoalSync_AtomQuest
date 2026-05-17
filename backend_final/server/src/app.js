// server/src/app.js
// Express application — middleware stack, route mounting, global error handler.

'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');

const authRoutes        = require('./routes/auth.routes');
const goalRoutes        = require('./routes/goals.routes');
const achievementRoutes = require('./routes/achievements.routes');
const managerRoutes     = require('./routes/manager.routes');
const adminRoutes       = require('./routes/admin.routes');
const reportsRoutes     = require('./routes/reports.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
app.set('trust proxy', 1); // Trust Render's load balancer

// ──────────────────────────────────────────────
// Security headers
// ──────────────────────────────────────────────
app.use(helmet());

// ──────────────────────────────────────────────
// CORS — allow frontend origin
// ──────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ──────────────────────────────────────────────
// Body parsing
// ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ──────────────────────────────────────────────
// Rate limiting
// ──────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Too many requests — try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,                   // stricter for login endpoint
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Too many login attempts — try again later' },
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);

// ──────────────────────────────────────────────
// Health check (no auth, no rate limit)
// ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe — verifies DB connectivity (used by Render health checks)
app.get('/ready', async (_req, res) => {
  try {
    const { pool } = require('./config/db');
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', db: err.message });
  }
});

// ──────────────────────────────────────────────
// API routes
// ──────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/manager',      managerRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/reports',      reportsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Admin escalation manual trigger
const authenticate = require('./middleware/authenticate');
const authorize    = require('./middleware/authorize');
const { runEscalationsManually } = require('./controllers/notifications.controller');
app.post('/api/admin/escalations/run', authenticate, authorize('admin'), runEscalationsManually);

// ──────────────────────────────────────────────
// 404 catch-all
// ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Route not found' });
});

// ──────────────────────────────────────────────
// Global error handler
// ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err);
  const status  = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ success: false, data: null, message });
});

module.exports = app;
