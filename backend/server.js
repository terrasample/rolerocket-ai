
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const OpenAI = require('openai');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');




const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors());

console.log('DEBUG: server.js script started');

// --- PATCH: Always return isAdmin for admin emails in /api/me ---
app.get('/api/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (!token) return res.status(401).json({ error: 'No token' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    const user = await User.findById(decoded.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const email = String(user.email || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS.length && ADMIN_EMAILS.includes(email);
    return res.json({
      user: {
        ...user,
        isAdmin,
        plan: isAdmin ? 'lifetime' : user.plan,
        isSubscribed: isAdmin ? true : user.isSubscribed
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load user info' });
  }
});


// ...existing code...

// Start the Express server
// Start the Express server (must be at the end)
// Start the Express server (must be at the end)
// (moved to end of file)





// ...existing code...

// Global error handlers for debugging fatal errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});





// ─── Rate Limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many payment attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

let mailTransporter = null;

function getMailTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }
  return mailTransporter;
}

function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
  ]);
}

async function sendEmail({ to, subject, html }) {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('Email not configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env.');
    return;
  }
  const fromAddress = process.env.SMTP_FROM || 'noreply@rolerocketai.com';
  await withTimeout(transporter.sendMail({
    from: `"RoleRocket AI" <${fromAddress}>`,
    to,
    subject,
    html
  }), 8000, 'sendMail');
}

function queuePasswordResetEmail({ to, resetUrl }) {
  setImmediate(async () => {
    try {
      await sendEmail({
        to,
        subject: 'Reset your password for RoleRocket AI',
        html: `
          <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;">
            <h2 style="margin:0 0 10px;">Reset your password</h2>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="background:#0284c7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
            <p style="margin-top:16px;color:#888;">If you didn't request this, ignore this email.</p>
          </div>
        `
      });
    } catch (err) {
      console.error('Password reset email send failed:', err.message);
    }
  });
}

function queueWelcomeEmail({ to, name }) {
  setImmediate(async () => {
    try {
      const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
      const dashUrl = (process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
      await sendEmail({
        to,
        subject: `Welcome to RoleRocket AI, ${firstName} 🚀`,
        html: getWelcomeEmailHtml(name, dashUrl)
      });
    } catch (err) {
      console.error('Welcome email send failed:', err.message);
    }
  });
}

function queueEmailVerificationEmail({ to, name, verifyUrl }) {
  setImmediate(async () => {
    try {
      const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
      await sendEmail({
        to,
        subject: 'Verify your email for RoleRocket AI',
        html: `
          <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;">
            <h2 style="margin:0 0 10px;">Verify your email, ${firstName}</h2>
            <p style="margin:0 0 14px;">Before logging in, please confirm this email address so we can protect your account.</p>
            <a href="${verifyUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">Verify Email</a>
            <p style="margin:18px 0 0;color:#475569;font-size:13px;">This verification link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
          </div>
        `
      });
    } catch (err) {
      console.error('Verification email send failed:', err.message);
    }
  });
}


// Expose email verification queue globally for use in routes
global.queueEmailVerificationEmail = queueEmailVerificationEmail;

const { runATSAnalysis } = require('./services/atsScorer');

const User = require('./models/User');
const Resume = require('./models/Resume');
const Job = require('./models/Job');
const Application = require('./models/Application');
const Telemetry = require('./models/Telemetry');
const RoleProfile = require('./models/RoleProfile');
const LifetimeSale = require('./models/LifetimeSale');


// Register email verification route


app.use('/api/verify', require('./routes/verifyEmail'));
// Register resume API route BEFORE static file serving
app.use('/api/resume', require('./routes/resume'));

// (REMOVED) Admin-only endpoint for backfilling referral codes has been disabled for security.

const PORT = process.env.PORT || 5000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// DEBUG: Print Stripe-related environment variables at startup
console.log('--- Stripe Environment Variables ---');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '[set]' : '[missing]');
console.log('STRIPE_PRO_PRICE_ID:', process.env.STRIPE_PRO_PRICE_ID);
console.log('STRIPE_PREMIUM_PRICE_ID:', process.env.STRIPE_PREMIUM_PRICE_ID);
console.log('STRIPE_ELITE_PRICE_ID:', process.env.STRIPE_ELITE_PRICE_ID);
console.log('STRIPE_LIFETIME_PRICE_ID:', process.env.STRIPE_LIFETIME_PRICE_ID);
console.log('STRIPE_LIFETIME_REGULAR_PRICE_ID:', process.env.STRIPE_LIFETIME_REGULAR_PRICE_ID);
console.log('STRIPE_VETERAN_COUPON_ID:', process.env.STRIPE_VETERAN_COUPON_ID);
console.log('CLIENT_URL:', process.env.CLIENT_URL);
console.log('------------------------------------');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LIFETIME_PRICE_ID = process.env.STRIPE_LIFETIME_PRICE_ID || '';
const LIFETIME_REGULAR_PRICE_ID = String(process.env.STRIPE_LIFETIME_REGULAR_PRICE_ID || '').trim();
const RECRUITER_LIFETIME_PRICE_ID = process.env.STRIPE_RECRUITER_LIFETIME_PRICE_ID || '';
const LIFETIME_DISCOUNT_LIMIT = Math.max(1, Number(process.env.LIFETIME_DISCOUNT_LIMIT || 50));
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const PRO_YEARLY_PRICE_ID = process.env.STRIPE_PRO_YEARLY_PRICE_ID || '';
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || '';
const PREMIUM_YEARLY_PRICE_ID = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || '';
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID || '';
const ELITE_YEARLY_PRICE_ID = process.env.STRIPE_ELITE_YEARLY_PRICE_ID || '';
const RECRUITER_MONTHLY_PRICE_ID = process.env.STRIPE_RECRUITER_MONTHLY_PRICE_ID || '';
const RECRUITER_YEARLY_PRICE_ID = process.env.STRIPE_RECRUITER_YEARLY_PRICE_ID || '';
const STRIPE_VETERAN_COUPON_ID = String(process.env.STRIPE_VETERAN_COUPON_ID || '').trim();
const VETERAN_DISCOUNT_CODE = String(process.env.VETERAN_DISCOUNT_CODE || 'VETERAN10').trim();
const IDME_CALLBACK_TOKEN = String(process.env.IDME_CALLBACK_TOKEN || '').trim();

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';
const ADZUNA_COUNTRY = process.env.ADZUNA_COUNTRY || 'us';

const GREENHOUSE_BOARDS = (process.env.GREENHOUSE_BOARDS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const LEVER_BOARDS = (process.env.LEVER_BOARDS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const REMOTIVE_ENABLED = process.env.REMOTIVE_ENABLED !== '0';
const ARBEITNOW_ENABLED = process.env.ARBEITNOW_ENABLED !== '0';
const USAJOBS_API_KEY = process.env.USAJOBS_API_KEY || '';
const USAJOBS_USER_AGENT = process.env.USAJOBS_USER_AGENT || '';

const JOB_CACHE_MS = 1000 * 60 * 5;
const jobSearchCache = new Map();
const EXTERNAL_FETCH_TIMEOUT_MS = 1200;
const jobSearchInFlight = new Map();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);
const E2E_MOCK_MODE = process.env.E2E_MOCK === '1';
const DB_DIAGNOSTIC_TOKEN = String(process.env.DB_DIAGNOSTIC_TOKEN || '').trim();

let lastDbEvent = {
  type: 'startup',
  message: 'Mongo not connected yet',
  at: new Date().toISOString()
};

async function getLifetimeOfferStatus() {
  const sold = await LifetimeSale.countDocuments();
  const remaining = Math.max(LIFETIME_DISCOUNT_LIMIT - sold, 0);
  const offerActive = remaining > 0;

  return {
    limit: LIFETIME_DISCOUNT_LIMIT,
    sold,
    remaining,
    offerActive,
    discountedPriceId: LIFETIME_PRICE_ID || null,
    regularPriceId: LIFETIME_REGULAR_PRICE_ID || null,
    currentPrice: offerActive ? 199 : 249,
    currentPriceLabel: offerActive ? '$199' : '$249',
    regularPriceLabel: '$249',
    discountedPriceLabel: '$199'
  };
}

app.use(cors());

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          if (session.metadata?.type === 'lifetime') {
            await User.findByIdAndUpdate(userId, {
              isSubscribed: true,
              plan: 'lifetime'
            });

            if (session.id) {
              await LifetimeSale.findOneAndUpdate(
                { stripeSessionId: String(session.id) },
                {
                  stripeSessionId: String(session.id),
                  userId,
                  priceId: session.metadata?.lifetimePriceId || null,
                  purchasedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
              );
            }
          } else {
            const selectedPlan = session.metadata?.plan || 'premium';
            await User.findByIdAndUpdate(userId, {
              isSubscribed: true,
              plan: selectedPlan
            });
          }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            isSubscribed: false,
            plan: 'free'
          });
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).send('Webhook Error');
    }
  }
);

app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  return res.redirect(301, '/login.html');
});

app.get('/index.html', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  return res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use(express.static(path.join(__dirname, '../frontend'), {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

app.get('/api/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  return res.json({ ok: true, dbReady, ts: Date.now() });
});

app.get('/api/health/deep', async (req, res) => {
  const providedToken = String(req.headers['x-db-diagnostic-token'] || req.query.token || '').trim();
  if (!DB_DIAGNOSTIC_TOKEN || providedToken !== DB_DIAGNOSTIC_TOKEN) {
    return res.status(404).json({ error: 'Not found' });
  }

  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const response = {
    ok: true,
    dbReady: mongoose.connection.readyState === 1,
    dbState: stateMap[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    lastDbEvent,
    ts: Date.now()
  };

  if (!response.dbReady) {
    return res.status(503).json({
      ...response,
      error: 'Database connection is not ready'
    });
  }

  try {
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    response.pingMs = Date.now() - pingStart;
    return res.json(response);
  } catch (err) {
    return res.status(503).json({
      ...response,
      error: String(err?.message || 'Ping failed')
    });
  }
});

app.get('/api/lifetime-offer-status', async (_req, res) => {
  try {
    const status = await getLifetimeOfferStatus();
    return res.json(status);
  } catch (err) {
    console.error('Lifetime offer status error:', err);
    return res.status(500).json({ error: 'Failed to load lifetime offer status' });
  }
});

app.get('/api/public/stats', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Stats temporarily unavailable' });
    }

    const [
      usersTotal,
      subscribedUsers,
      resumesTotal,
      jobsTrackedTotal,
      applicationsTotal
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSubscribed: true }),
      Resume.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments()
    ]);

    return res.json({
      usersTotal,
      subscribedUsers,
      resumesTotal,
      jobsTrackedTotal,
      applicationsTotal,
      usageTotal: resumesTotal + jobsTrackedTotal + applicationsTotal,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Public stats error:', err);
    return res.status(500).json({ error: 'Failed to load public stats' });
  }
});

app.post('/api/waitlist', async (req, res) => {
  try {
    const { name, email, source } = req.body || {};
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedSource = String(source || 'auth-outage').trim();

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    console.warn('Waitlist lead captured:', {
      name: normalizedName || null,
      email: normalizedEmail,
      source: normalizedSource,
      ts: new Date().toISOString()
    });

    if (ADMIN_EMAILS.length > 0) {
      sendEmail({
        to: ADMIN_EMAILS.join(','),
        subject: 'New waitlist lead captured',
        html: `
          <h3>RoleRocket waitlist lead</h3>
          <p><strong>Name:</strong> ${normalizedName || '(not provided)'}</p>
          <p><strong>Email:</strong> ${normalizedEmail}</p>
          <p><strong>Source:</strong> ${normalizedSource}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        `
      }).catch((err) => {
        console.warn('Waitlist notify email failed:', err.message);
      });
    }

    return res.json({ ok: true, message: 'You are on the priority waitlist.' });
  } catch (err) {
    console.error('Waitlist capture error:', err);
    return res.status(500).json({ error: 'Could not capture waitlist right now' });
  }
});

function ensureDbReady(res, operation = 'Request') {
  if (mongoose.connection.readyState === 1) return true;
  return res.status(503).json({
    error: `${operation} temporarily unavailable. Database connection is not ready.`
  });
}

if (process.env.NODE_ENV !== 'test') {
  mongoose.connection.on('connected', () => {
    lastDbEvent = {
      type: 'connected',
      message: 'MongoDB connected',
      at: new Date().toISOString()
    };
  });

  mongoose.connection.on('disconnected', () => {
    lastDbEvent = {
      type: 'disconnected',
      message: 'MongoDB disconnected',
      at: new Date().toISOString()
    };
  });

  mongoose.connection.on('error', (err) => {
    lastDbEvent = {
      type: 'error',
      message: String(err?.message || 'Unknown MongoDB error'),
      at: new Date().toISOString()
    };
  });

  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
      lastDbEvent = {
        type: 'connect-failed',
        message: String(err?.message || 'Initial MongoDB connect failed'),
        at: new Date().toISOString()
      };
      console.error('❌ MongoDB error:', err);
    });
}

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.id || decoded._id || decoded.sub || null
    };

    if (!req.user.userId) {
      return res.status(403).json({ error: 'Invalid token payload' });
    }

    return next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

async function requireAnalyticsAccess(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('email plan');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = String(user.email || '').toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.length ? ADMIN_EMAILS.includes(email) : false;
    const allowByPlan = !ADMIN_EMAILS.length && hasRequiredPlan(user, 'elite');

    if (!isAdminEmail && !allowByPlan) {
      return res.status(403).json({ error: 'Analytics access denied' });
    }

    req.currentUser = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Access check failed' });
  }
}

function normalizePlan(plan) {
  const allowedPlans = new Set(['free', 'pro', 'premium', 'elite', 'lifetime']);
  return allowedPlans.has(plan) ? plan : 'free';
}

function getPlanLevel(plan) {
  const normalized = normalizePlan(plan);

  if (normalized === 'free') return 0;
  if (normalized === 'pro') return 1;
  if (normalized === 'premium') return 2;
  if (normalized === 'elite') return 3;
  if (normalized === 'lifetime') return 4;

  return 0;
}

function hasRequiredPlan(user, requiredPlan) {
  if (!user) return false;
  // Admins always have access to everything
  const email = String(user.email || '').toLowerCase();
  if (ADMIN_EMAILS.length && ADMIN_EMAILS.includes(email)) {
    return true;
  }
  return getPlanLevel(user.plan || 'free') >= getPlanLevel(requiredPlan);
}

function makeLinkedInSearchUrl(title = '', location = '') {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}`;
}

function makeGoogleJobsUrl(title = '', location = '') {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location} jobs`)}`;
}

function timeoutPromise(promise, ms = 3500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${(job.title || '').toLowerCase()}|${(job.company || '').toLowerCase()}|${(job.location || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function scoreTitleRelevance(jobTitle = '', queryTitle = '') {
  const query = String(queryTitle || '').trim().toLowerCase();
  if (!query) return 6;

  const title = String(jobTitle || '').toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 6;

  const matched = tokens.filter((t) => title.includes(t)).length;
  return Math.min(16, Math.round((matched / tokens.length) * 16));
}

function scoreLocationRelevance(jobLocation = '', queryLocation = '') {
  const query = String(queryLocation || '').trim().toLowerCase();
  if (!query) return 4;

  const location = String(jobLocation || '').toLowerCase();
  if (!location) return 0;

  if (location.includes(query)) return 8;
  if (query.includes('remote') && (location.includes('remote') || location.includes('worldwide'))) return 8;
  return 2;
}

function scoreFreshness(postedAt) {
  if (!postedAt) return 8;

  const ts = new Date(postedAt).getTime();
  if (Number.isNaN(ts)) return 8;

  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return 10;

  return Math.max(0, Math.round(22 - ageDays * 1.3));
}

function sourceQualityWeight(source = '') {
  const table = {
    Adzuna: 7,
    Greenhouse: 8,
    Lever: 8,
    Remotive: 6,
    Arbeitnow: 5,
    USAJobs: 7,
    Imported: 4,
    'Fast Fallback': 2
  };

  return table[source] || 4;
}

function computeRankScore(job, query = {}) {
  const match = Math.max(0, Math.min(60, Math.round(Number(job.matchScore || 0) * 0.6)));
  const freshness = scoreFreshness(job.postedAt);
  const source = sourceQualityWeight(job.source);
  const title = scoreTitleRelevance(job.title, query.title);
  const location = scoreLocationRelevance(job.location, query.location);

  return match + freshness + source + title + location;
}

function rankJobs(jobs, query) {
  return [...jobs]
    .map((job) => ({
      ...job,
      rankScore: computeRankScore(job, query)
    }))
    .sort((a, b) => b.rankScore - a.rankScore);
}

function normalizeJob(raw) {
  return {
    title: raw.title || 'Untitled Job',
    company: raw.company || 'Unknown Company',
    location: raw.location || 'Remote',
    link: raw.link || '#',
    description: raw.description || '',
    postedAt: normalizeDate(raw.postedAt),
    matchScore: Number(raw.matchScore || 0),
    status: raw.status || 'saved',
    source: raw.source || 'Imported',
    linkedinSearchUrl:
      raw.linkedinSearchUrl ||
      makeLinkedInSearchUrl(raw.title || '', raw.location || ''),
    googleJobsUrl:
      raw.googleJobsUrl ||
      makeGoogleJobsUrl(raw.title || '', raw.location || '')
  };
}

function buildMockJobs(title, location) {
  return [
    normalizeJob({
      title: `${title} I`,
      company: 'RealSource Health',
      location,
      link: 'https://example.com/real-job-1',
      description: `We are looking for a ${title} with strong communication, planning, and leadership skills.`,
      matchScore: 92,
      source: 'Fast Fallback'
    }),
    normalizeJob({
      title: `Senior ${title}`,
      company: 'FuturePath Systems',
      location,
      link: 'https://example.com/real-job-2',
      description: `Seeking a ${title} with project delivery, stakeholder management, and reporting experience.`,
      matchScore: 86,
      source: 'Fast Fallback'
    }),
    normalizeJob({
      title: `${title} Analyst`,
      company: 'NorthBridge Labs',
      location,
      link: 'https://example.com/real-job-3',
      description: `Looking for a detail-oriented ${title} who can manage timelines, documentation, and cross-team coordination.`,
      matchScore: 79,
      source: 'Fast Fallback'
    })
  ];
}

function estimateMatchScore(title, description, resume = '') {
  const haystack = `${title} ${description}`.toLowerCase();
  const resumeText = (resume || '').toLowerCase();

  let score = 60;
  const keywords = [
    'project',
    'manager',
    'leadership',
    'stakeholder',
    'communication',
    'delivery',
    'timeline',
    'reporting',
    'agile',
    'implementation'
  ];

  for (const word of keywords) {
    if (haystack.includes(word)) score += 3;
    if (resumeText.includes(word)) score += 1;
  }

  return Math.min(score, 95);
}

async function fetchJson(url, options = {}, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });

    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Fetch timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAdzunaJobs(title, location, resume) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const url = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?app_id=${encodeURIComponent(
    ADZUNA_APP_ID
  )}&app_key=${encodeURIComponent(ADZUNA_APP_KEY)}&results_per_page=20&what=${encodeURIComponent(
    title
  )}&where=${encodeURIComponent(location)}&content-type=application/json`;

  const json = await fetchJson(url, {}, 1200);
  const results = Array.isArray(json.results) ? json.results : [];

  return results.map((job) =>
    normalizeJob({
      title: job.title,
      company: job.company?.display_name || 'Unknown Company',
      location: job.location?.display_name || location,
      link: job.redirect_url || '#',
      description: job.description || '',
      postedAt: job.created,
      matchScore: estimateMatchScore(job.title, job.description, resume),
      source: 'Adzuna'
    })
  );
}

async function fetchGreenhouseJobs(title, location, resume) {
  if (!GREENHOUSE_BOARDS.length) return [];

  const boardCalls = GREENHOUSE_BOARDS.map(async (board) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;
    const json = await fetchJson(url, {}, 1000);
    const jobs = Array.isArray(json.jobs) ? json.jobs : [];

    return jobs
      .filter((job) => {
        const text = `${job.title || ''} ${(job.location?.name || '')}`.toLowerCase();
        return text.includes(title.toLowerCase()) || !title.trim();
      })
      .slice(0, 10)
      .map((job) =>
        normalizeJob({
          title: job.title,
          company: board,
          location: job.location?.name || location || 'Remote',
          link: job.absolute_url || '#',
          description: '',
          postedAt: job.updated_at || job.created_at,
          matchScore: estimateMatchScore(job.title, job.location?.name || '', resume),
          source: 'Greenhouse'
        })
      );
  });

  const settled = await Promise.allSettled(boardCalls);
  const merged = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled') merged.push(...r.value);
  });
  return merged;
}

async function fetchLeverJobs(title, location, resume) {
  if (!LEVER_BOARDS.length) return [];

  const boardCalls = LEVER_BOARDS.map(async (board) => {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`;
    const jobs = await fetchJson(url, {}, 1000);

    return (Array.isArray(jobs) ? jobs : [])
      .filter((job) => {
        const text = `${job.text || ''} ${(job.categories?.location || '')}`.toLowerCase();
        return text.includes(title.toLowerCase()) || !title.trim();
      })
      .slice(0, 10)
      .map((job) =>
        normalizeJob({
          title: job.text,
          company: board,
          location: job.categories?.location || location || 'Remote',
          link: job.hostedUrl || '#',
          description: '',
          postedAt: job.createdAt ? new Date(job.createdAt) : null,
          matchScore: estimateMatchScore(job.text, job.categories?.team || '', resume),
          source: 'Lever'
        })
      );
  });

  const settled = await Promise.allSettled(boardCalls);
  const merged = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled') merged.push(...r.value);
  });
  return merged;
}

async function fetchRemotiveJobs(title, location, resume) {
  if (!REMOTIVE_ENABLED) return [];

  const search = encodeURIComponent(title || '');
  const url = `https://remotive.com/api/remote-jobs?search=${search}`;
  const json = await fetchJson(url, {}, 1200);
  const jobs = Array.isArray(json.jobs) ? json.jobs : [];

  return jobs
    .filter((job) => {
      const haystack = `${job.title || ''} ${job.candidate_required_location || ''}`.toLowerCase();
      const hasTitle = !title.trim() || haystack.includes(title.toLowerCase());
      const hasLocation = !location.trim() || haystack.includes(location.toLowerCase()) || haystack.includes('worldwide') || haystack.includes('remote');
      return hasTitle && hasLocation;
    })
    .slice(0, 20)
    .map((job) =>
      normalizeJob({
        title: job.title,
        company: job.company_name || 'Unknown Company',
        location: job.candidate_required_location || 'Remote',
        link: job.url || '#',
        description: job.description || '',
        postedAt: job.publication_date,
        matchScore: estimateMatchScore(job.title, job.description, resume),
        source: 'Remotive'
      })
    );
}

async function fetchArbeitnowJobs(title, location, resume) {
  if (!ARBEITNOW_ENABLED) return [];

  const search = encodeURIComponent(title || '');
  const url = `https://www.arbeitnow.com/api/job-board-api?search=${search}`;
  const json = await fetchJson(url, {}, 1200);
  const jobs = Array.isArray(json.data) ? json.data : [];

  return jobs
    .filter((job) => {
      const haystack = `${job.title || ''} ${job.location || ''}`.toLowerCase();
      const hasTitle = !title.trim() || haystack.includes(title.toLowerCase());
      const hasLocation = !location.trim() || haystack.includes(location.toLowerCase()) || haystack.includes('remote');
      return hasTitle && hasLocation;
    })
    .slice(0, 20)
    .map((job) =>
      normalizeJob({
        title: job.title,
        company: job.company_name || 'Unknown Company',
        location: job.location || 'Remote',
        link: job.url || '#',
        description: job.description || '',
        postedAt: job.created_at,
        matchScore: estimateMatchScore(job.title, job.description, resume),
        source: 'Arbeitnow'
      })
    );
}

async function fetchUsaJobs(title, location, resume) {
  if (!USAJOBS_API_KEY || !USAJOBS_USER_AGENT) return [];

  const keyword = encodeURIComponent(title || '');
  const locationName = encodeURIComponent(location || '');
  const url = `https://data.usajobs.gov/api/search?Keyword=${keyword}&LocationName=${locationName}&ResultsPerPage=25`;
  const json = await fetchJson(
    url,
    {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': USAJOBS_USER_AGENT,
        'Authorization-Key': USAJOBS_API_KEY
      }
    },
    1500
  );

  const items = json?.SearchResult?.SearchResultItems;
  const jobs = Array.isArray(items) ? items : [];

  return jobs.map((item) => {
    const d = item?.MatchedObjectDescriptor || {};
    const desc = d?.UserArea?.Details || {};
    return normalizeJob({
      title: d.PositionTitle,
      company: d.OrganizationName || 'US Government',
      location: (Array.isArray(d.PositionLocationDisplay) && d.PositionLocationDisplay[0]) || location || 'United States',
      link: d.PositionURI || '#',
      description: desc?.JobSummary || '',
      postedAt: desc?.PublicationStartDate || d.PublicationStartDate || d.PositionStartDate,
      matchScore: estimateMatchScore(d.PositionTitle, desc?.JobSummary || '', resume),
      source: 'USAJobs'
    });
  });
}

function getSourceConfigSnapshot() {
  return {
    adzuna: {
      enabled: Boolean(ADZUNA_APP_ID && ADZUNA_APP_KEY),
      country: ADZUNA_COUNTRY
    },
    greenhouse: {
      enabled: GREENHOUSE_BOARDS.length > 0,
      boardCount: GREENHOUSE_BOARDS.length,
      boards: GREENHOUSE_BOARDS
    },
    lever: {
      enabled: LEVER_BOARDS.length > 0,
      boardCount: LEVER_BOARDS.length,
      boards: LEVER_BOARDS
    },
    remotive: {
      enabled: REMOTIVE_ENABLED
    },
    arbeitnow: {
      enabled: ARBEITNOW_ENABLED
    },
    usajobs: {
      enabled: Boolean(USAJOBS_API_KEY && USAJOBS_USER_AGENT),
      hasApiKey: Boolean(USAJOBS_API_KEY),
      hasUserAgent: Boolean(USAJOBS_USER_AGENT)
    }
  };
}

async function fetchAllSourcesSettled({ title, location, resume }) {
  return Promise.allSettled([
    timeoutPromise(fetchAdzunaJobs(title, location, resume), 1400),
    timeoutPromise(fetchGreenhouseJobs(title, location, resume), 1200),
    timeoutPromise(fetchLeverJobs(title, location, resume), 1200),
    timeoutPromise(fetchRemotiveJobs(title, location, resume), 1200),
    timeoutPromise(fetchArbeitnowJobs(title, location, resume), 1200),
    timeoutPromise(fetchUsaJobs(title, location, resume), 1600)
  ]);
}

async function searchJobsFast({ title, location, resume }) {
  const cacheKey = `${title}::${location}::${resume || ''}`.toLowerCase().trim();
  const cached = jobSearchCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) {
    return { jobs: cached.jobs, fromCache: true };
  }

  const settled = await fetchAllSourcesSettled({ title, location, resume });

  const combined = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      combined.push(...r.value);
    }
  });

  const ranked = rankJobs(dedupeJobs(combined), { title, location });
  const jobs = ranked.slice(0, 60);
  const finalJobs = jobs.length ? jobs : buildMockJobs(title, location);

  jobSearchCache.set(cacheKey, {
    createdAt: Date.now(),
    jobs: finalJobs
  });

  return { jobs: finalJobs, fromCache: false };
}

function getJobSearchCacheKey({ title, location, resume }) {
  return `${title}::${location}::${resume || ''}`.toLowerCase().trim();
}

function warmJobSearchCache({ title, location, resume }) {
  const cacheKey = getJobSearchCacheKey({ title, location, resume });

  if (jobSearchInFlight.has(cacheKey)) {
    return jobSearchInFlight.get(cacheKey);
  }

  const task = searchJobsFast({ title, location, resume })
    .catch(() => null)
    .finally(() => {
      jobSearchInFlight.delete(cacheKey);
    });

  jobSearchInFlight.set(cacheKey, task);
  return task;
}

function getInstantJobs({ title, location, resume }) {
  const cacheKey = getJobSearchCacheKey({ title, location, resume });
  const cached = jobSearchCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) {
    return {
      jobs: cached.jobs,
      meta: {
        fromCache: true,
        source: 'warm-cache',
        hydrated: true,
        refreshAfterMs: 0
      }
    };
  }

  warmJobSearchCache({ title, location, resume });

  return {
    jobs: buildMockJobs(title, location),
    meta: {
      fromCache: false,
      source: 'instant-fallback',
      hydrated: false,
      refreshAfterMs: 1200
    }
  };
}

function parsePrewarmPairs() {
  const raw = process.env.JOB_PREWARM_QUERIES ||
    'project manager|remote;program manager|remote;operations manager|remote';

  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((pair) => {
      const [title = '', location = 'remote'] = pair.split('|').map((v) => v.trim());
      return { title, location };
    })
    .filter((v) => v.title && v.location);
}

async function prewarmJobSearches() {
  const pairs = parsePrewarmPairs();
  if (!pairs.length) return;

  for (const pair of pairs) {
    warmJobSearchCache({ ...pair, resume: '' });
  }
}

function extractCompanyName(text = '') {
  const companyLine =
    text.match(/company[:\s]+([^\n]+)/i)?.[1] ||
    text.match(/at\s+([A-Z][A-Za-z0-9&.,\-\s]{2,})/)?.[1] ||
    '';
  return companyLine.trim() || 'Imported Company';
}

function extractJobTitle(text = '') {
  const titleLine =
    text.match(/job title[:\s]+([^\n]+)/i)?.[1] ||
    text.match(/title[:\s]+([^\n]+)/i)?.[1] ||
    text.split('\n').find((line) => line.trim().length > 5)?.trim() ||
    'Imported Role';
  return titleLine.trim();
}

function extractLocation(text = '') {
  const locationLine =
    text.match(/location[:\s]+([^\n]+)/i)?.[1] ||
    (text.match(/remote/i) ? 'Remote' : '') ||
    'Remote';
  return locationLine.trim();
}

async function parseJobFromAnywhere(rawText, sourceUrl) {
  const fallback = normalizeJob({
    title: extractJobTitle(rawText),
    company: extractCompanyName(rawText),
    location: extractLocation(rawText),
    description: rawText.trim(),
    link: sourceUrl?.trim() || '#',
    matchScore: estimateMatchScore(extractJobTitle(rawText), rawText),
    source: sourceUrl ? 'Imported URL' : 'Pasted Job'
  });

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Extract job details from pasted job text. Return valid JSON only with keys: title, company, location, description.'
        },
        {
          role: 'user',
          content: `Job text:\n${rawText}`
        }
      ]
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');

    return normalizeJob({
      ...fallback,
      title: parsed.title || fallback.title,
      company: parsed.company || fallback.company,
      location: parsed.location || fallback.location,
      description: parsed.description || fallback.description
    });
  } catch {
    return fallback;
  }
}

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function authFailureMessage(prefix, err) {
  const fallback = `${prefix} failed`;
  if (process.env.NODE_ENV === 'production') return fallback;
  const detail = String(err?.message || '').trim();
  return detail ? `${fallback}: ${detail}` : fallback;
}

function createEmailVerificationTokenRecord() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
  return { rawToken, tokenHash, expiresAt };
}

function getEmailVerificationUrl(rawToken) {
  const baseUrl = (process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
  return `${baseUrl}/verify-email.html?token=${rawToken}`;
}

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Signup') !== true) return;

    const { name, email, password, referralCode } = req.body || {};
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');
    const normalizedReferralCode = String(referralCode || '').trim().toUpperCase();

    if (!normalizedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const verification = createEmailVerificationTokenRecord();

    let user = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        user = await User.create({
          name: normalizedName,
          email: normalizedEmail,
          password: hashedPassword,
          isSubscribed: false,
          plan: 'free',
          referralCode: generateReferralCode(),
          referredBy: normalizedReferralCode || null,
          emailVerified: false,
          emailVerificationToken: verification.tokenHash,
          emailVerificationExpires: verification.expiresAt
        });
        break;
      } catch (err) {
        if (err?.code === 11000 && err?.keyPattern?.email) {
          const existingUser = await User.findOne({ email: normalizedEmail })
            .select('_id name email password isSubscribed plan referralCode referralCount')
            .lean();

          if (existingUser) {
            const passwordMatches = await bcrypt.compare(rawPassword, existingUser.password);
            if (passwordMatches) {
              if (!existingUser.emailVerified) {
                const nextVerification = createEmailVerificationTokenRecord();
                await User.updateOne(
                  { _id: existingUser._id },
                  {
                    $set: {
                      emailVerificationToken: nextVerification.tokenHash,
                      emailVerificationExpires: nextVerification.expiresAt,
                      emailVerified: false
                    }
                  }
                );

                queueEmailVerificationEmail({
                  to: existingUser.email,
                  name: existingUser.name,
                  verifyUrl: getEmailVerificationUrl(nextVerification.rawToken)
                });

                return res.status(400).json({
                  error: 'Email not verified yet. We just sent a new verification link.'
                });
              }

              const token = jwt.sign(
                { userId: existingUser._id },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
              );

              return res.json({
                token,
                alreadyExisted: true,
                user: {
                  _id: existingUser._id,
                  name: existingUser.name,
                  email: existingUser.email,
                  isSubscribed: existingUser.isSubscribed,
                  plan: existingUser.plan,
                  referralCode: existingUser.referralCode,
                  referralCount: existingUser.referralCount
                }
              });
            }
          }

          return res.status(400).json({ error: 'Account already exists. Try logging in.' });
        }
        if (err?.code === 11000 && err?.keyPattern?.referralCode && attempt < 2) {
          continue;
        }
        throw err;
      }
    }

    if (!user) {
      throw new Error('Failed to create user');
    }

    queueEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: getEmailVerificationUrl(verification.rawToken)
    });

    if (normalizedReferralCode) {
      setImmediate(async () => {
        try {
          const refUser = await User.findOne({ referralCode: normalizedReferralCode });
          if (!refUser) return;

          refUser.referralCount += 1;

          if (refUser.referralCount >= 25) {
            refUser.plan = 'lifetime';
            refUser.isSubscribed = true;
          } else if (refUser.referralCount >= 10) {
            refUser.plan = 'premium';
            refUser.isSubscribed = true;
          } else if (refUser.referralCount >= 3) {
            refUser.plan = 'pro';
            refUser.isSubscribed = true;
          }

          await refUser.save();
        } catch (refErr) {
          console.error('Referral credit error:', refErr.message);
        }
      });
    }

    return res.json({
      requiresVerification: true,
      message: 'Account created. Please verify your email before logging in.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isSubscribed: user.isSubscribed,
        plan: user.plan,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        emailVerified: false
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: authFailureMessage('Signup', err) });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Login') !== true) return;

    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: normalizedEmail })
      .select('_id name email password isSubscribed plan referralCode referralCount emailVerified')
      .lean();

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(rawPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    // If admin, always set plan to 'lifetime' and isSubscribed true
    let plan = user.plan;
    let isSubscribed = user.isSubscribed;
    const isAdmin = ADMIN_EMAILS.length && ADMIN_EMAILS.includes(normalizedEmail);
    if (isAdmin) {
      plan = 'lifetime';
      isSubscribed = true;
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isSubscribed,
        plan,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        emailVerified: user.emailVerified !== false
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: authFailureMessage('Login', err) });
  }
});

app.post('/api/auth/verify-email', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Email verify') !== true) return;

    const rawToken = String(req.body?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Verification link is invalid or expired.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    queueWelcomeEmail({ to: user.email, name: user.name });

    return res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: authFailureMessage('Email verification', err) });
  }
});

app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Resend verification') !== true) return;

    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: normalizedEmail })
      .select('_id name email emailVerified');

    if (!user) {
      return res.json({ message: 'If this account exists, a verification email has been sent.' });
    }

    if (user.emailVerified !== false) {
      return res.json({ message: 'Email is already verified. Please log in.' });
    }

    const verification = createEmailVerificationTokenRecord();
    user.emailVerificationToken = verification.tokenHash;
    user.emailVerificationExpires = verification.expiresAt;
    await user.save();

    queueEmailVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: getEmailVerificationUrl(verification.rawToken)
    });

    return res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.status(500).json({ error: authFailureMessage('Resend verification', err) });
  }
});


app.get('/api/veteran/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('veteranVerified veteranVerifiedAt veteranDiscountPopupSeenAt');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      veteranVerified: Boolean(user.veteranVerified),
      veteranVerifiedAt: user.veteranVerifiedAt || null,
      popupSeen: Boolean(user.veteranDiscountPopupSeenAt)
    });
  } catch (err) {
    console.error('Veteran status error:', err);
    return res.status(500).json({ error: 'Failed to load veteran verification status' });
  }
});

app.get('/api/veteran/discount-code', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('veteranVerified veteranVerifiedAt veteranDiscountPopupSeenAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.veteranVerified) {
      return res.status(403).json({ error: 'Veteran verification is required before discount code access.' });
    }

    if (!user.veteranDiscountPopupSeenAt) {
      user.veteranDiscountPopupSeenAt = new Date();
      await user.save();
    }

    return res.json({
      code: VETERAN_DISCOUNT_CODE,
      veteranVerified: true,
      veteranVerifiedAt: user.veteranVerifiedAt || null
    });
  } catch (err) {
    console.error('Veteran discount code error:', err);
    return res.status(500).json({ error: 'Failed to load veteran discount code' });
  }
});

app.post('/api/veteran/idme/callback', async (req, res) => {
  try {
    const callbackToken = String(req.body?.token || req.query?.token || '').trim();
    if (!IDME_CALLBACK_TOKEN || callbackToken !== IDME_CALLBACK_TOKEN) {
      return res.status(401).json({ error: 'Invalid callback token' });
    }

    const userId = String(req.body?.userId || req.query?.userId || '').trim();
    const email = String(req.body?.email || req.query?.email || '').trim().toLowerCase();
    if (!userId && !email) {
      return res.status(400).json({ error: 'userId or email is required' });
    }

    const lookup = userId ? { _id: userId } : { email };
    const user = await User.findOne(lookup);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.veteranVerified = true;
    user.veteranVerifiedAt = new Date();
    await user.save();

    const redirectUrl = String(req.body?.redirect || req.query?.redirect || '').trim();
    if (redirectUrl) {
      return res.redirect(302, `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}veteran=verified`);
    }

    return res.json({ message: 'Veteran verification saved', userId: String(user._id) });
  } catch (err) {
    console.error('ID.me callback error:', err);
    return res.status(500).json({ error: 'Failed to process veteran verification callback' });
  }
});

app.get('/api/referral', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      'referralCode referralCount plan'
    );

    return res.json({
      referralCode: user.referralCode,
      referralCount: user.referralCount,
      plan: user.plan
    });
  } catch (err) {
    console.error('Referral load error:', err);
    return res.status(500).json({ error: 'Failed to load referral info' });
  }
});

app.post('/api/telemetry', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let userId = null;
    if (bearer) {
      try {
        const decoded = jwt.verify(bearer, process.env.JWT_SECRET);
        userId = decoded.userId || decoded.id || decoded._id || decoded.sub || null;
      } catch {
        userId = null;
      }
    }

    const {
      event = '',
      funnel = '',
      sessionId = '',
      page = '',
      variant = '',
      ts,
      meta = {}
    } = req.body || {};

    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }

    const safeMeta = typeof meta === 'object' && meta !== null ? meta : {};

    await Telemetry.create({
      userId,
      event: String(event).slice(0, 80),
      funnel: String(funnel).slice(0, 80),
      sessionId: String(sessionId).slice(0, 80),
      page: String(page).slice(0, 120),
      variant: String(variant).slice(0, 20),
      ts: ts ? new Date(ts) : new Date(),
      meta: safeMeta,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 280),
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').slice(0, 120)
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Telemetry error:', err.message);
    return res.status(500).json({ error: 'Failed to store telemetry' });
  }
});

app.get('/api/dashboard/mode-kpis', authenticateToken, async (req, res) => {
  try {
    const rawDays = Number(req.query.days || 14);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 60) : 14;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await Telemetry.find({
      userId: req.user.userId,
      ts: { $gte: since },
      page: 'dashboard'
    })
      .select('event sessionId meta ts')
      .lean();

    const result = {
      starter: { searches: 0, oneClickRuns: 0, upgradeClicks: 0, sessions: 0 },
      power: { searches: 0, oneClickRuns: 0, upgradeClicks: 0, sessions: 0 },
      unknown: { searches: 0, oneClickRuns: 0, upgradeClicks: 0, sessions: 0 }
    };

    const allSessions = new Set();
    const modeSessionMap = {
      starter: new Set(),
      power: new Set(),
      unknown: new Set()
    };

    events.forEach((evt) => {
      const modeRaw = String(evt.meta?.mode || '').toLowerCase();
      const mode = modeRaw === 'starter' || modeRaw === 'power' ? modeRaw : 'unknown';
      const sid = String(evt.sessionId || '');

      if (sid) {
        allSessions.add(sid);
        modeSessionMap[mode].add(sid);
      }

      const event = String(evt.event || '');
      if (event === 'find_jobs_success') result[mode].searches += 1;
      if (event === 'one_click_apply_success') result[mode].oneClickRuns += 1;
      if (event === 'upgrade_click') result[mode].upgradeClicks += 1;
    });

    result.starter.sessions = modeSessionMap.starter.size;
    result.power.sessions = modeSessionMap.power.size;
    result.unknown.sessions = modeSessionMap.unknown.size;

    return res.json({
      windowDays: days,
      totals: {
        sessions: allSessions.size,
        events: events.length
      },
      byMode: result
    });
  } catch (err) {
    console.error('Mode KPI error:', err.message);
    return res.status(500).json({ error: 'Failed to load mode KPIs' });
  }
});

app.get('/api/admin/telemetry/summary', authenticateToken, requireAnalyticsAccess, async (req, res) => {
  try {
    const rawDays = Number(req.query.days || 7);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 90) : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, users, jobs] = await Promise.all([
      Telemetry.find({ ts: { $gte: since } }).select('event funnel ts variant').lean(),
      User.find({}).select('_id plan createdAt').lean(),
      Job.find({ createdAt: { $gte: since } }).select('userId status createdAt').lean()
    ]);

    const eventCounts = {};
    const funnelCounts = {};
    const daily = {};

    events.forEach((evt) => {
      const event = evt.event || 'unknown';
      const funnel = evt.funnel || 'uncategorized';
      const day = new Date(evt.ts || Date.now()).toISOString().slice(0, 10);

      eventCounts[event] = (eventCounts[event] || 0) + 1;
      funnelCounts[funnel] = (funnelCounts[funnel] || 0) + 1;
      daily[day] = (daily[day] || 0) + 1;
    });

    const usersByPlan = { free: 0, pro: 0, premium: 0, elite: 0, lifetime: 0 };
    users.forEach((u) => {
      const p = normalizePlan(u.plan || 'free');
      usersByPlan[p] = (usersByPlan[p] || 0) + 1;
    });

    const cohort = {
      free: { users: usersByPlan.free, applied: 0, interview: 0, offer: 0 },
      pro: { users: usersByPlan.pro, applied: 0, interview: 0, offer: 0 },
      premium: { users: usersByPlan.premium, applied: 0, interview: 0, offer: 0 },
      elite: { users: usersByPlan.elite, applied: 0, interview: 0, offer: 0 },
      lifetime: { users: usersByPlan.lifetime, applied: 0, interview: 0, offer: 0 }
    };

    const userPlanMap = new Map(users.map((u) => [String(u._id), normalizePlan(u.plan || 'free')]));

    jobs.forEach((job) => {
      const plan = userPlanMap.get(String(job.userId)) || 'free';
      const status = String(job.status || '').toLowerCase();
      if (!cohort[plan]) return;
      if (status === 'applied') cohort[plan].applied += 1;
      if (status === 'interview') cohort[plan].interview += 1;
      if (status === 'offer') cohort[plan].offer += 1;
    });

    const cohortWithRates = Object.entries(cohort).map(([plan, c]) => ({
      plan,
      users: c.users,
      applied: c.applied,
      interview: c.interview,
      offer: c.offer,
      interviewRate: c.applied ? Number((c.interview / c.applied).toFixed(3)) : 0,
      offerRate: c.interview ? Number((c.offer / c.interview).toFixed(3)) : 0
    }));

    return res.json({
      windowDays: days,
      totals: {
        events: events.length,
        users: users.length,
        jobs: jobs.length
      },
      topEvents: Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([event, count]) => ({ event, count })),
      funnels: Object.entries(funnelCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([funnel, count]) => ({ funnel, count })),
      trend: Object.entries(daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => ({ day, count })),
      usersByPlan,
      cohorts: cohortWithRates
    });
  } catch (err) {
    console.error('Telemetry summary error:', err);
    return res.status(500).json({ error: 'Failed to load telemetry summary' });
  }
});

app.get('/api/outcomes/proof', authenticateToken, async (req, res) => {
  try {
    const [user, userJobs, allUsers, allJobs] = await Promise.all([
      User.findById(req.user.userId).select('plan'),
      Job.find({ userId: req.user.userId }).select('status').lean(),
      User.find({}).select('_id plan').lean(),
      Job.find({ status: { $in: ['applied', 'interview', 'offer'] } }).select('userId status').lean()
    ]);

    const mine = { applied: 0, interview: 0, offer: 0 };
    userJobs.forEach((job) => {
      const status = String(job.status || '').toLowerCase();
      if (mine[status] !== undefined) mine[status] += 1;
    });

    const userPlanMap = new Map(allUsers.map((u) => [String(u._id), normalizePlan(u.plan || 'free')]));
    const cohorts = {
      free: { applied: 0, interview: 0, offer: 0 },
      pro: { applied: 0, interview: 0, offer: 0 },
      premium: { applied: 0, interview: 0, offer: 0 },
      elite: { applied: 0, interview: 0, offer: 0 },
      lifetime: { applied: 0, interview: 0, offer: 0 }
    };

    allJobs.forEach((job) => {
      const status = String(job.status || '').toLowerCase();
      const plan = userPlanMap.get(String(job.userId)) || 'free';
      if (cohorts[plan] && cohorts[plan][status] !== undefined) cohorts[plan][status] += 1;
    });

    const mineInterviewRate = mine.applied ? mine.interview / mine.applied : 0;
    const mineOfferRate = mine.interview ? mine.offer / mine.interview : 0;
    const currentPlan = normalizePlan(user?.plan || 'free');

    return res.json({
      mine: {
        plan: currentPlan,
        applied: mine.applied,
        interview: mine.interview,
        offer: mine.offer,
        interviewRate: Number(mineInterviewRate.toFixed(3)),
        offerRate: Number(mineOfferRate.toFixed(3))
      },
      cohorts
    });
  } catch (err) {
    console.error('Outcome proof error:', err);
    return res.status(500).json({ error: 'Failed to load outcome proof' });
  }
});

app.get('/api/role-profiles', authenticateToken, async (req, res) => {
  try {
    const profiles = await RoleProfile.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
    return res.json({ profiles });
  } catch (err) {
    console.error('Role profile list error:', err);
    return res.status(500).json({ error: 'Failed to load role profiles' });
  }
});

app.post('/api/role-profiles', authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};
    const profileId = payload._id ? String(payload._id) : null;

    const update = {
      profileName: String(payload.profileName || 'Primary Profile').trim(),
      targetRole: String(payload.targetRole || '').trim(),
      targetLocation: String(payload.targetLocation || 'Remote').trim(),
      salaryTarget: String(payload.salaryTarget || '').trim(),
      industries: Array.isArray(payload.industries) ? payload.industries.map((v) => String(v).trim()).filter(Boolean).slice(0, 12) : [],
      coreSkills: Array.isArray(payload.coreSkills) ? payload.coreSkills.map((v) => String(v).trim()).filter(Boolean).slice(0, 25) : [],
      workPreference: ['remote', 'hybrid', 'onsite', 'flexible'].includes(payload.workPreference) ? payload.workPreference : 'flexible',
      seniority: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'].includes(payload.seniority) ? payload.seniority : 'mid',
      notes: String(payload.notes || '').slice(0, 2000)
    };

    let profile;

    if (profileId) {
      profile = await RoleProfile.findOneAndUpdate(
        { _id: profileId, userId: req.user.userId },
        update,
        { new: true }
      );
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
    } else {
      profile = await RoleProfile.create({ userId: req.user.userId, ...update });
    }

    return res.json({ profile });
  } catch (err) {
    console.error('Role profile save error:', err);
    return res.status(500).json({ error: 'Failed to save role profile' });
  }
});

app.delete('/api/role-profiles/:id', authenticateToken, async (req, res) => {
  try {
    const profile = await RoleProfile.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Role profile delete error:', err);
    return res.status(500).json({ error: 'Failed to delete role profile' });
  }
});

app.get('/api/recommendations/adaptive', authenticateToken, async (req, res) => {
  try {
    const [profiles, jobs] = await Promise.all([
      RoleProfile.find({ userId: req.user.userId }).sort({ updatedAt: -1 }).limit(1),
      Job.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(80)
    ]);

    const profile = profiles[0] || null;
    const counts = { saved: 0, ready: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    jobs.forEach((job) => {
      const s = String(job.status || 'saved').toLowerCase();
      if (counts[s] !== undefined) counts[s] += 1;
    });

    const recs = [];

    if (!profile) {
      recs.push('Create a role profile to personalize job recommendations and interview prep.');
    } else {
      if (profile.coreSkills.length < 5) {
        recs.push('Add at least 5 core skills in your profile so matching can prioritize stronger-fit roles.');
      }
      if (!profile.salaryTarget) {
        recs.push('Set a salary target to filter out low-fit opportunities and focus your pipeline.');
      }
      if ((profile.targetLocation || '').toLowerCase() !== 'remote' && profile.workPreference === 'flexible') {
        recs.push('Mark work preference as remote or hybrid to improve role filtering quality.');
      }
    }

    if (counts.saved > counts.applied * 2) {
      recs.push('You are saving more jobs than applying. Convert your top 5 saved roles to ready this week.');
    }
    if (counts.applied >= 8 && counts.interview === 0) {
      recs.push('Your apply-to-interview rate is low. Prioritize ATS optimization before the next 5 applications.');
    }
    if (counts.interview > 0 && counts.offer === 0) {
      recs.push('Use Interview Assist after each mock session and track STAR examples by role profile.');
    }

    if (!recs.length) {
      recs.push('Momentum is strong. Keep applying to high-match roles and run interview simulations weekly.');
    }

    return res.json({
      profile,
      stats: counts,
      recommendations: recs.slice(0, 6)
    });
  } catch (err) {
    console.error('Adaptive recommendation error:', err);
    return res.status(500).json({ error: 'Failed to load recommendations' });
  }
});

app.post('/api/resume/generate', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resume } = req.body;
    if (!jobDescription || !resume) {
      return res.status(400).json({ error: 'jobDescription and resume are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'pro')) {
      return res.status(403).json({ error: 'Upgrade to Pro to use resume generation.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Rewrite resumes to be ATS-friendly, measurable, strong, clear, and professional.'
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`
        }
      ]
    });

    return res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('Resume generation error:', err);
    return res.status(500).json({ error: 'Resume generation failed' });
  }
});

app.post('/api/generate-cover-letter', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resume } = req.body;
    if (!jobDescription || !resume) {
      return res.status(400).json({ error: 'jobDescription and resume are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'pro')) {
      return res.status(403).json({ error: 'Upgrade to Pro to use cover letter generation.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Write a strong, concise, tailored cover letter.'
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`
        }
      ]
    });

    return res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('Cover letter generation error:', err);
    return res.status(500).json({ error: 'Cover letter generation failed' });
  }
});

app.post('/api/job-match', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resume } = req.body;
    if (!jobDescription || !resume) {
      return res.status(400).json({ error: 'jobDescription and resume are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'pro')) {
      return res.status(403).json({ error: 'Upgrade to Pro to use job match analysis.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Return a concise job match analysis, strengths, missing skills, and improvement suggestions.'
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`
        }
      ]
    });

    return res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('Job match error:', err);
    return res.status(500).json({ error: 'Job match failed' });
  }
});

app.post('/api/interview-prep', authenticateToken, async (req, res) => {
  try {
    const { role, jobDescription } = req.body;

    if (!role && !jobDescription) {
      return res.status(400).json({ error: 'role or jobDescription is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'premium')) {
      return res.status(403).json({ error: 'Upgrade to Premium to use Interview Prep AI.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Create concise interview prep for this role: 8 likely questions, strong answer themes, and 3 smart questions to ask the interviewer.'
        },
        {
          role: 'user',
          content: `Role: ${role || 'Not provided'}\n\nJob Description:\n${jobDescription || 'Not provided'}`
        }
      ]
    });

    return res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('Interview prep error:', err);
    return res.status(500).json({ error: 'Interview prep failed' });
  }
});

app.post('/api/career-coach', authenticateToken, async (req, res) => {
  try {
    const { resume, goals } = req.body;

    if (!resume && !goals) {
      return res.status(400).json({ error: 'resume or goals is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Career Coach AI.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Act like an executive career coach. Give a focused career plan, role targets, skill gaps, salary positioning guidance, and next 3 actions.'
        },
        {
          role: 'user',
          content: `Resume:\n${resume || 'Not provided'}\n\nGoals:\n${goals || 'Not provided'}`
        }
      ]
    });

    return res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error('Career coach error:', err);
    return res.status(500).json({ error: 'Career coach failed' });
  }
});

// ─── Interview Assist ────────────────────────────────────────────────────────
app.post('/api/interview-assist', authenticateToken, async (req, res) => {
  try {
    const { question, role, resume, history } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    if (E2E_MOCK_MODE) {
      return res.json({
        type: 'behavioral',
        answer: 'I resolved conflict by clarifying goals, aligning stakeholders, and delivering a measurable outcome.',
        bullets: ['Clarify conflict quickly', 'Align priorities', 'Close with measurable results'],
        tip: 'Lead with ownership and outcome.'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Interview Assist.' });
    }

    const systemPrompt = `You are a live interview coach helping a candidate answer questions in real-time during an actual job interview.

Return ONLY a valid JSON object with this exact structure:
{
  "type": "behavioral|situational|general",
  "answer": "A strong, concise answer (max 180 words). Behavioral: use STAR format. Situational: direct confident structure. General: clear and impactful.",
  "bullets": ["key point to hit 1", "key point to hit 2", "key point to hit 3"],
  "tip": "One short coaching note for delivery (max 15 words)"
}

Rules:
- Answer must be under 180 words — this is used live during an interview
- Write in first person, naturally, confidently
- Behavioral questions (tell me about a time, describe a situation, give an example) → STAR format
- Situational / hypothetical → direct structured response
- Return only valid JSON, no markdown fences`;

    const contextParts = [];
    if (role) contextParts.push(`Target role: ${role}`);
    if (resume) contextParts.push(`Candidate background:\n${String(resume).slice(0, 1200)}`);

    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-3).map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n');
      contextParts.push(`Prior questions in this interview session:\n${recent}`);
    }

    const userContent = contextParts.length
      ? `${contextParts.join('\n\n')}\n\nInterview question: ${question}`
      : `Interview question: ${question}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');

    return res.json({
      type: parsed.type || 'general',
      answer: parsed.answer || '',
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 4) : [],
      tip: parsed.tip || ''
    });
  } catch (err) {
    console.error('Interview assist error:', err);
    return res.status(500).json({ error: 'Interview assist failed' });
  }
});

app.post('/api/jobs/find', authenticateToken, async (req, res) => {
  try {
    const { title, location, resume, forceRefresh } = req.body;

    if (!title || !location) {
      return res.status(400).json({ error: 'title and location are required' });
    }

    if (E2E_MOCK_MODE) {
      return res.json({
        jobs: buildMockJobs(title, location),
        meta: {
          fromCache: false,
          source: 'e2e-mock',
          hydrated: true,
          refreshAfterMs: 0,
          linkedinSearchUrl: makeLinkedInSearchUrl(title, location),
          googleJobsUrl: makeGoogleJobsUrl(title, location)
        }
      });
    }

    let jobs;
    let meta;

    if (forceRefresh) {
      const fresh = await searchJobsFast({ title, location, resume });
      jobs = fresh.jobs;
      meta = {
        fromCache: fresh.fromCache,
        source: fresh.fromCache ? 'warm-cache' : 'fresh-fetch',
        hydrated: true,
        refreshAfterMs: 0
      };
    } else {
      const instant = getInstantJobs({ title, location, resume });
      jobs = instant.jobs;
      meta = instant.meta;
    }

    return res.json({
      jobs,
      meta: {
        ...meta,
        linkedinSearchUrl: makeLinkedInSearchUrl(title, location),
        googleJobsUrl: makeGoogleJobsUrl(title, location)
      }
    });
  } catch (err) {
    console.error('Find jobs error:', err);
    return res.status(500).json({ error: 'Failed to find jobs' });
  }
});

app.get('/api/jobs/sources-diagnostics', authenticateToken, async (req, res) => {
  try {
    const title = String(req.query.title || 'software engineer').trim();
    const location = String(req.query.location || 'remote').trim();
    const resume = String(req.query.resume || '');

    const names = ['Adzuna', 'Greenhouse', 'Lever', 'Remotive', 'Arbeitnow', 'USAJobs'];
    const settled = await fetchAllSourcesSettled({ title, location, resume });

    const sourceStats = names.map((name, idx) => {
      const result = settled[idx];
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        return {
          source: name,
          ok: true,
          count: result.value.length,
          error: null
        };
      }

      return {
        source: name,
        ok: false,
        count: 0,
        error: String(result.reason?.message || 'failed')
      };
    });

    const combined = [];
    settled.forEach((r) => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) combined.push(...r.value);
    });

    const ranked = rankJobs(dedupeJobs(combined), { title, location });

    return res.json({
      query: { title, location },
      sourceConfig: getSourceConfigSnapshot(),
      sourceStats,
      totals: {
        raw: combined.length,
        deduped: ranked.length,
        returnedCap: Math.min(60, ranked.length)
      },
      topSamples: ranked.slice(0, 10)
    });
  } catch (err) {
    console.error('Source diagnostics error:', err);
    return res.status(500).json({ error: 'Failed to load source diagnostics' });
  }
});

app.post('/api/jobs/import', authenticateToken, async (req, res) => {
  try {
    const { jobText, sourceUrl } = req.body;

    if (!jobText || !jobText.trim()) {
      return res.status(400).json({ error: 'jobText is required' });
    }

    const job = await parseJobFromAnywhere(jobText, sourceUrl || '');
    return res.json({ job });
  } catch (err) {
    console.error('Import job error:', err);
    return res.status(500).json({ error: 'Failed to import job' });
  }
});

app.post('/api/jobs/save', authenticateToken, async (req, res) => {
  try {
    const job = await Job.create({
      userId: req.user.userId,
      ...req.body
    });

    return res.json({ job });
  } catch (err) {
    console.error('Save job error:', err);
    return res.status(500).json({ error: 'Failed to save job' });
  }
});

app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.json({ jobs });
  } catch (err) {
    console.error('Load jobs error:', err);
    return res.status(500).json({ error: 'Failed to load jobs' });
  }
});

app.put('/api/jobs/:id/status', authenticateToken, async (req, res) => {
  try {
    const allowedStatuses = ['saved', 'ready', 'applied', 'interview', 'offer', 'rejected'];
    const status = (req.body.status || '').toLowerCase();

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { status },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({ job });
  } catch (err) {
    console.error('Update job status error:', err);
    return res.status(500).json({ error: 'Failed to update job status' });
  }
});

app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete job error:', err);
    return res.status(500).json({ error: 'Failed to delete job' });
  }
});

app.post('/api/apply/one-click', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'premium')) {
      return res.status(403).json({ error: 'Upgrade to Premium to use 1-Click Apply.' });
    }

    const jobs = await Job.find({
      userId: req.user.userId,
      status: { $in: ['ready', 'saved'] }
    }).sort({ matchScore: -1, createdAt: -1 });

    const topJobs = jobs.slice(0, 3).map((job) => ({
      title: job.title,
      company: job.company,
      urgencyLabel: job.status === 'ready' ? 'High' : 'Medium',
      matchScore: job.matchScore || 0
    }));

    return res.json({ topJobs });
  } catch (err) {
    console.error('1-click apply error:', err);
    return res.status(500).json({ error: 'Failed to run 1-click apply' });
  }
});

app.post('/api/ats/analyze', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resume } = req.body;
    if (!jobDescription || !resume) {
      return res.status(400).json({ error: 'jobDescription and resume are required' });
    }

    const analysis = runATSAnalysis(jobDescription, resume);
    return res.json({ analysis });
  } catch (err) {
    console.error('ATS analyze error:', err);
    return res.status(500).json({ error: 'ATS failed' });
  }
});

app.post('/api/ats/rewrite', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resume } = req.body;
    if (!jobDescription || !resume) {
      return res.status(400).json({ error: 'jobDescription and resume are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'premium')) {
      return res.status(403).json({ error: 'Upgrade to Premium to use AI resume rewrite.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Rewrite resume to be ATS optimized, strong, measurable, and professional.'
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`
        }
      ]
    });

    return res.json({
      rewritten: completion.choices[0].message.content
    });
  } catch (err) {
    console.error('ATS rewrite error:', err);
    return res.status(500).json({ error: 'Rewrite failed' });
  }
});

app.post('/api/resume/save', authenticateToken, async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Resume content required' });
    }

    const resume = await Resume.create({
      userId: req.user.userId,
      content,
      title: title || 'Saved Resume'
    });

    return res.json({ resume });
  } catch (err) {
    console.error('Resume save error:', err);
    return res.status(500).json({ error: 'Save failed' });
  }
});


// Compatibility: GET /api/resume returns latest resume in array for dashboard.js
app.get('/api/resume', authenticateToken, async (req, res) => {
  try {
    const latest = await Resume.findOne({ userId: req.user.userId }).sort({ createdAt: -1 });
    if (latest) {
      return res.json({ resumes: [latest] });
    } else {
      return res.json({ resumes: [] });
    }
  } catch (err) {
    console.error('Resume load error:', err);
    return res.status(500).json({ error: 'Load failed' });
  }
});

app.get('/api/resume/list', authenticateToken, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.json({ resumes });
  } catch (err) {
    console.error('Resume list error:', err);
    return res.status(500).json({ error: 'Load failed' });
  }
});

app.get('/api/resume/latest', authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.json({ resume });
  } catch (err) {
    console.error('Resume latest error:', err);
    return res.status(500).json({ error: 'Latest failed' });
  }
});

app.post('/api/create-checkout-session', paymentLimiter, authenticateToken, async (req, res) => {
  try {
    const { plan, priceId: requestedPriceId } = req.body || {};
    const userId = String(req.user?.userId || '').trim();

    const normalizedPlan = plan ? String(plan).toLowerCase().trim() : '';
    const normalizedPriceId = requestedPriceId ? String(requestedPriceId).trim() : '';

    if (!userId) {
      return res.status(401).json({ error: 'Authenticated user ID is missing' });
    }

    if (!normalizedPlan && !normalizedPriceId) {
      return res.status(400).json({ error: 'plan or priceId is required' });
    }

    if (E2E_MOCK_MODE) {
      return res.json({ url: 'https://checkout.test/session' });
    }

    const planToPriceMap = {
      pro: PRO_PRICE_ID,
      pro_yearly: PRO_YEARLY_PRICE_ID,
      premium: PREMIUM_PRICE_ID,
      premium_yearly: PREMIUM_YEARLY_PRICE_ID,
      elite: ELITE_PRICE_ID,
      elite_yearly: ELITE_YEARLY_PRICE_ID,
      recruiter: RECRUITER_MONTHLY_PRICE_ID,
      recruiter_yearly: RECRUITER_YEARLY_PRICE_ID
    };

    const priceId = normalizedPriceId || planToPriceMap[normalizedPlan];

    if (!priceId) {
      return res.status(400).json({ error: 'Unknown plan. Check your .env Stripe price IDs.' });
    }

    const user = await User.findById(userId).select('email plan veteranVerified');
    const email = String(user?.email || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS && ADMIN_EMAILS.includes(email);
    const isLifetime = (user?.plan || '').toLowerCase() === 'lifetime';
    // DEBUG LOGGING
    console.log('[CHECKOUT DEBUG]', {
      userId,
      email,
      plan: user?.plan,
      ADMIN_EMAILS,
      isAdmin,
      isLifetime
    });
    if (isAdmin || isLifetime) {
      console.log('[CHECKOUT BLOCKED] Admin or Lifetime user attempted checkout:', email, user?.plan);
      return res.status(403).json({ error: 'Already Unlocked' });
    }
    const shouldApplyVeteranDiscount = Boolean(user?.veteranVerified && STRIPE_VETERAN_COUPON_ID);
    const sessionPayload = {
      mode: 'subscription',
      allow_promotion_codes: !shouldApplyVeteranDiscount,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/index.html?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/index.html`,
      metadata: {
        userId,
        plan: normalizedPlan || 'custom',
        veteranDiscountApplied: shouldApplyVeteranDiscount ? 'true' : 'false'
      },
      subscription_data: {
        metadata: {
          userId,
          plan: normalizedPlan || 'custom',
          veteranDiscountApplied: shouldApplyVeteranDiscount ? 'true' : 'false'
        }
      }
    };
    if (shouldApplyVeteranDiscount) {
      sessionPayload.discounts = [{ coupon: STRIPE_VETERAN_COUPON_ID }];
    }
    const session = await stripe.checkout.sessions.create(sessionPayload);
    let checkoutUrl = session.url;
    if (!checkoutUrl && session.id) {
      const refreshed = await stripe.checkout.sessions.retrieve(session.id);
      checkoutUrl = refreshed?.url;
    }
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL.' });
    }
    return res.json({ url: checkoutUrl });
  } catch (err) {
    console.error('Subscription checkout error:', err);
    return res.status(500).json({
      error: err.message || err.raw?.message || String(err) || 'Failed to create checkout session',
      code: err.code || null,
      type: err.type || null,
      details: JSON.stringify(err, Object.getOwnPropertyNames(err))
    });
  }
});


app.post('/api/create-lifetime-checkout', paymentLimiter, authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const normalizedPlan = plan ? String(plan).toLowerCase().trim() : '';
    let selectedPriceId = null;
    let offerStatus = null;

    if (normalizedPlan === 'recruiter_lifetime') {
      selectedPriceId = RECRUITER_LIFETIME_PRICE_ID;
      if (!selectedPriceId) {
        return res.status(400).json({ error: 'Missing STRIPE_RECRUITER_LIFETIME_PRICE_ID.' });
      }
    } else {
      offerStatus = await getLifetimeOfferStatus();
      selectedPriceId = offerStatus.offerActive ? LIFETIME_PRICE_ID : LIFETIME_REGULAR_PRICE_ID;
      if (!selectedPriceId) {
        return res.status(400).json({
          error: offerStatus.offerActive
            ? 'Missing STRIPE_LIFETIME_PRICE_ID (limited $199 offer price).'
            : 'Missing STRIPE_LIFETIME_REGULAR_PRICE_ID ($249 regular price).'
        });
      }
    }

    const price = await stripe.prices.retrieve(selectedPriceId, { expand: ['product'] });
    if (!price.active) {
      return res.status(400).json({ error: 'Lifetime price is not active in Stripe.' });
    }
    if (price.type !== 'one_time') {
      return res.status(400).json({ error: `Lifetime price must be a one-time price, but Stripe says it is "${price.type}".` });
    }

    const user = await User.findById(req.user.userId).select('email plan veteranVerified');
    const email = String(user?.email || '').toLowerCase();
    const isAdmin = ADMIN_EMAILS && ADMIN_EMAILS.includes(email);
    const isLifetime = (user?.plan || '').toLowerCase() === 'lifetime';
    if (isAdmin || isLifetime) {
      return res.status(403).json({ error: 'Already Unlocked' });
    }
    const shouldApplyVeteranDiscount = Boolean(user?.veteranVerified && STRIPE_VETERAN_COUPON_ID);
    const sessionPayload = {
      mode: 'payment',
      allow_promotion_codes: !shouldApplyVeteranDiscount,
      payment_method_types: ['card'],
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/index.html?lifetime=true`,
      cancel_url: `${process.env.CLIENT_URL}/index.html`,
      metadata: {
        userId: req.user.userId,
        type: normalizedPlan === 'recruiter_lifetime' ? 'recruiter_lifetime' : 'lifetime',
        lifetimeOfferActive: offerStatus?.offerActive ? 'true' : 'false',
        lifetimePriceId: selectedPriceId,
        veteranDiscountApplied: shouldApplyVeteranDiscount ? 'true' : 'false'
      }
    };
    if (shouldApplyVeteranDiscount) {
      sessionPayload.discounts = [{ coupon: STRIPE_VETERAN_COUPON_ID }];
    }
    const session = await stripe.checkout.sessions.create(sessionPayload);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Lifetime checkout error:', err);
    return res.status(500).json({ error: err.message || 'Lifetime checkout failed' });
  }
});

// ─── Forgot Password ────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Forgot password') !== true) return;

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

    // Respond immediately so the UI is fast; send email in the background.
    queuePasswordResetEmail({ to: user.email, resetUrl });

    return res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ─── Reset Password ──────────────────────────────────────────────────────────
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Reset password') !== true) return;

    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ─── Stripe Customer Portal ──────────────────────────────────────────────────
app.post('/api/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email name');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const createdCustomer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: String(req.user.userId)
        }
      });
      customerId = createdCustomer.id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.CLIENT_URL}/index.html`
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    return res.status(500).json({ error: err.message || 'Failed to open billing portal' });
  }
});

// ─── Change Password ────────────────────────────────────────────────────────
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// ─── Delete Account ──────────────────────────────────────────────────────────
app.delete('/api/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await User.findByIdAndDelete(userId);
    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Ensure Google Search Console verification succeeds for both root and
// accidental URL-prefix checks under /sitemap.xml/.
// ─── Authenticated User Info ──────────────────────────────────────────────
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user' });
  }
});

app.get('/google1e7a24f124416c47.html', (_req, res) => {
  return res.type('text/plain').send('google-site-verification: google1e7a24f124416c47.html');
});

app.get('/sitemap.xml/google1e7a24f124416c47.html', (_req, res) => {
  return res.type('text/plain').send('google-site-verification: google1e7a24f124416c47.html');
});

app.get('/{*path}', (req, res) => {
  return res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    setTimeout(() => {
      prewarmJobSearches().catch((err) => {
        console.warn('Job prewarm failed:', err.message);
      });
    }, 500);
    console.log('DEBUG: app.listen callback completed');
  });
}

console.log('DEBUG: server.js script end (should not reach here if server stays running)');

module.exports = app;