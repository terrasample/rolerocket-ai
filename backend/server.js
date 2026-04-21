const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env'),
  override: process.env.NODE_ENV !== 'production'
});
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { File } = require('buffer');
const OpenAI = require('openai');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { extractTextFromPDF, extractTextFromDocx } = require('./pdfWordUtils');
const { extractTextFromPDFWithOCR } = require('./ocrUtils');
const { getDailyGenerationStatus, recordDailyGenerationUsage } = require('./services/aiGenerationLimits');
const LearningRoadmap = require('./models/LearningRoadmap');




const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

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


// Register ATS API routes
app.use('/api/ats', require('./routes/ats'));
// Register Cover Letter API route
app.use('/api/cover-letter', require('./routes/coverLetter'));

// Register plan-based access control middleware and feature routes
const planAccess = require('./middleware/planAccess');
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
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
app.use('/api/features', authenticateToken, require('./routes/features'));

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
const JobAlert = require('./models/JobAlert');
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

app.post('/api/contact', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    const contactRecipient = process.env.CONTACT_TO || 'Prince@rolerocketai.com';
    await sendEmail({
      to: contactRecipient,
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:720px;">
          <h2 style="margin:0 0 12px;">New RoleRocket AI contact form message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <div style="padding:16px;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;white-space:pre-wrap;">${message}</div>
        </div>
      `
    });

    return res.json({ ok: true, message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Could not send your message right now.' });
  }
});

function ensureDbReady(res, operation = 'Request') {
  if (mongoose.connection.readyState === 1) return true;
  return res.status(503).json({
    error: `${operation} temporarily unavailable. Database connection is not ready.`
  });
}

function normalizeMongoUri(rawUri) {
  if (!rawUri) return rawUri;

  try {
    const parsed = new URL(rawUri);
    const isMongoProtocol = parsed.protocol === 'mongodb:' || parsed.protocol === 'mongodb+srv:';

    if (!isMongoProtocol || !parsed.username || parsed.searchParams.has('authSource')) {
      return rawUri;
    }

    parsed.searchParams.set('authSource', 'admin');
    return parsed.toString();
  } catch (error) {
    return rawUri;
  }
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
    .connect(normalizeMongoUri(process.env.MONGODB_URI))
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
      lastDbEvent = {
        type: 'connect-failed',
        message: String(err?.message || 'Initial MongoDB connect failed'),
        at: new Date().toISOString()
      };

      if (err?.code === 8000 || /authentication failed/i.test(String(err?.message || ''))) {
        console.error('❌ MongoDB authentication failed. The MONGODB_URI credentials are invalid for the Atlas cluster.');
        console.error('Update the MongoDB username/password in your local env file and in the Render dashboard before restarting the server.');
        return;
      }

      console.error('❌ MongoDB error:', err);
    });
}



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

async function requireAdminAccess(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select('email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = String(user.email || '').toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.length ? ADMIN_EMAILS.includes(email) : false;
    if (!isAdminEmail) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.currentUser = user;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Admin access check failed' });
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
  const isConfiguredAdmin = ADMIN_EMAILS.length && ADMIN_EMAILS.includes(email);
  const isInternalAdmin = email.endsWith('@rolerocketai.com');
  if (isConfiguredAdmin || isInternalAdmin) {
    return true;
  }
  return getPlanLevel(user.plan || 'free') >= getPlanLevel(requiredPlan);
}

function hasOneClickApplyAccess(user) {
  if (!user) return false;
  return hasRequiredPlan(user, 'premium') || user.isSubscribed === true;
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
  const finalJobs = jobs;

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

const JOB_ALERT_FREQUENCIES = ['instant', 'daily', 'weekly'];
const JOB_ALERT_WORK_MODES = ['remote', 'hybrid', 'onsite'];
const JOB_ALERT_EMPLOYMENT_TYPES = ['full-time', 'contract', 'part-time', 'temporary', 'internship'];
const JOB_ALERT_SENIORITY_LEVELS = ['internship', 'entry', 'associate', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'];
const JOB_ALERT_MIN_MATCH_SCORE = 90;
const JOB_ALERT_SCHEDULE_INTERVAL_MS = 1000 * 60 * 5;
const JOB_ALERT_FREQUENCY_MS = {
  instant: 1000 * 60 * 60 * 2,
  daily: 1000 * 60 * 60 * 24,
  weekly: 1000 * 60 * 60 * 24 * 7
};
let jobAlertSchedulerTimer = null;
let jobAlertSchedulerRunning = false;

function cleanAlertString(value, maxLen = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function toAlertList(value, maxItems = 10, maxLen = 60) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,|]/)
        .map((item) => item.trim());

  return raw
    .map((item) => cleanAlertString(item, maxLen))
    .filter(Boolean)
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
    .slice(0, maxItems);
}

function toAllowedList(value, allowed) {
  return toAlertList(value, allowed.length, 30).filter((item) => allowed.includes(String(item || '').toLowerCase()));
}

function normalizeJobAlertDefaults(input = {}) {
  const frequency = cleanAlertString(input.frequency || 'daily', 20).toLowerCase();
  const salaryMinRaw = Number(input.salaryMin);
  return {
    location: cleanAlertString(input.location || 'Remote', 120) || 'Remote',
    frequency: JOB_ALERT_FREQUENCIES.includes(frequency) ? frequency : 'daily',
    workModes: toAllowedList((input.workModes || []).map ? input.workModes.map((item) => String(item).toLowerCase()) : input.workModes, JOB_ALERT_WORK_MODES),
    employmentTypes: toAllowedList((input.employmentTypes || []).map ? input.employmentTypes.map((item) => String(item).toLowerCase()) : input.employmentTypes, JOB_ALERT_EMPLOYMENT_TYPES),
    seniorityLevels: toAllowedList((input.seniorityLevels || []).map ? input.seniorityLevels.map((item) => String(item).toLowerCase()) : input.seniorityLevels, JOB_ALERT_SENIORITY_LEVELS),
    industries: toAlertList(input.industries, 8, 50),
    includeKeywords: toAlertList(input.includeKeywords, 12, 40),
    excludeKeywords: toAlertList(input.excludeKeywords, 12, 40),
    excludedCompanies: toAlertList(input.excludedCompanies, 12, 60),
    salaryMin: Number.isFinite(salaryMinRaw) && salaryMinRaw > 0 ? Math.round(salaryMinRaw) : null,
    emailEnabled: input.emailEnabled !== false,
    inAppEnabled: input.inAppEnabled !== false,
    includeSimilarTitles: input.includeSimilarTitles !== false
  };
}

function computeNextJobAlertRunAt(frequency, fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate || Date.now());
  const delta = JOB_ALERT_FREQUENCY_MS[String(frequency || '').toLowerCase()] || JOB_ALERT_FREQUENCY_MS.daily;
  return new Date(base.getTime() + delta);
}

function sanitizeJobAlertPayload(input = {}, defaults = {}) {
  const normalizedDefaults = normalizeJobAlertDefaults(defaults || {});
  const normalizedInput = normalizeJobAlertDefaults(input || {});
  const merged = { ...normalizedDefaults, ...normalizedInput };
  const titles = toAlertList(input.titles || [input.title1, input.title2, input.title3], 3, 80);
  const resumeSource = ['dashboard', 'upload', 'none'].includes(String(input.resumeSource || '').toLowerCase())
    ? String(input.resumeSource || '').toLowerCase()
    : 'none';
  const resumeText = resumeSource === 'none' ? '' : String(input.resumeText || '').slice(0, 30000).trim();
  const name = cleanAlertString(input.name || titles.join(' / '), 120) || 'Job Alert';

  return {
    ...merged,
    name,
    titles,
    resumeSource,
    resumeText,
    resumeLabel: cleanAlertString(input.resumeLabel || '', 120),
    isPaused: Boolean(input.isPaused)
  };
}

function fingerprintJob(job) {
  return [job.title, job.company, job.link || job.location].map((item) => String(item || '').trim().toLowerCase()).join('::');
}

function expandSimilarTitles(titles = []) {
  const map = {
    'project manager': ['program manager', 'implementation manager', 'project coordinator', 'pmo analyst'],
    'program manager': ['project manager', 'implementation manager', 'operations program manager'],
    'operations manager': ['business operations manager', 'operations lead', 'operations coordinator'],
    'business analyst': ['data analyst', 'operations analyst', 'systems analyst'],
    'customer success manager': ['client success manager', 'account manager', 'customer success lead'],
    'product manager': ['associate product manager', 'program manager'],
    'administrative assistant': ['office coordinator', 'executive assistant', 'operations coordinator']
  };

  const expanded = new Set();
  titles.forEach((title) => {
    const clean = String(title || '').toLowerCase().trim();
    if (!clean) return;
    expanded.add(title);
    (map[clean] || []).forEach((related) => expanded.add(related));
  });
  return Array.from(expanded).slice(0, 8);
}

function recommendJobTitlesFromResume(resumeText = '') {
  const text = String(resumeText || '').toLowerCase();
  if (!text.trim()) return [];

  const patterns = [
    { title: 'Project Manager', terms: ['project manager', 'project coordination', 'stakeholder', 'timeline'] },
    { title: 'Program Manager', terms: ['program manager', 'cross-functional', 'roadmap'] },
    { title: 'Operations Manager', terms: ['operations', 'process improvement', 'workflow'] },
    { title: 'Business Analyst', terms: ['business analyst', 'requirements', 'analysis', 'reporting'] },
    { title: 'Product Manager', terms: ['product manager', 'product roadmap', 'launch'] },
    { title: 'Administrative Assistant', terms: ['administrative assistant', 'calendar', 'scheduling'] },
    { title: 'Customer Success Manager', terms: ['customer success', 'client relationship', 'retention'] },
    { title: 'Implementation Manager', terms: ['implementation', 'onboarding', 'rollout'] }
  ];

  return patterns
    .map((pattern) => ({
      title: pattern.title,
      score: pattern.terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.title)
    .slice(0, 5);
}

function detectWorkModes(job) {
  const haystack = `${job.title || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase();
  const matches = [];
  if (/\bremote\b/.test(haystack)) matches.push('remote');
  if (/\bhybrid\b/.test(haystack)) matches.push('hybrid');
  if (/\bonsite\b|on-site|in office|in-office/.test(haystack)) matches.push('onsite');
  return matches;
}

function detectEmploymentTypes(job) {
  const haystack = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const matches = [];
  if (/full[ -]?time|permanent/.test(haystack)) matches.push('full-time');
  if (/contract|contractor/.test(haystack)) matches.push('contract');
  if (/part[ -]?time/.test(haystack)) matches.push('part-time');
  if (/temporary|temp\b/.test(haystack)) matches.push('temporary');
  if (/intern(ship)?/.test(haystack)) matches.push('internship');
  return matches;
}

function detectSeniority(job) {
  const haystack = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const matches = [];
  if (/intern(ship)?/.test(haystack)) matches.push('internship');
  if (/entry|junior|associate/.test(haystack)) matches.push('entry');
  if (/associate/.test(haystack)) matches.push('associate');
  if (/mid|ii\b|iii\b/.test(haystack)) matches.push('mid');
  if (/senior|sr\b/.test(haystack)) matches.push('senior');
  if (/lead|principal/.test(haystack)) matches.push('lead');
  if (/manager/.test(haystack)) matches.push('manager');
  if (/director|head of/.test(haystack)) matches.push('director');
  if (/vp|vice president|chief|cxo|executive/.test(haystack)) matches.push('executive');
  return matches;
}

function buildJobAlertReasons(job, alert, resumeText) {
  const reasons = [];
  const title = String(job.title || '').toLowerCase();
  const location = String(job.location || '').toLowerCase();
  const description = String(job.description || '').toLowerCase();
  const titleMatch = (alert.titles || []).find((item) => title.includes(String(item || '').toLowerCase()));

  if (titleMatch) reasons.push(`Title match: ${titleMatch}`);
  if (alert.location && (location.includes(alert.location.toLowerCase()) || location.includes('remote'))) {
    reasons.push(`Location fit: ${alert.location}`);
  }

  const keywordHit = (alert.includeKeywords || []).find((item) => description.includes(String(item || '').toLowerCase()) || title.includes(String(item || '').toLowerCase()));
  if (keywordHit) reasons.push(`Keyword match: ${keywordHit}`);

  const workModeHit = detectWorkModes(job).find((item) => (alert.workModes || []).includes(item));
  if (workModeHit) reasons.push(`Work mode: ${workModeHit}`);

  const seniorityHit = detectSeniority(job).find((item) => (alert.seniorityLevels || []).includes(item));
  if (seniorityHit) reasons.push(`Seniority: ${seniorityHit}`);

  const industryHit = (alert.industries || []).find((item) => description.includes(String(item || '').toLowerCase()));
  if (industryHit) reasons.push(`Industry: ${industryHit}`);

  if (resumeText && (job.matchScore || 0) >= 70) {
    reasons.push('Aligned with your imported resume');
  }

  return reasons.slice(0, 4);
}

function passesJobAlertFilters(job, alert) {
  const haystack = `${job.title || ''} ${job.company || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase();
  const company = String(job.company || '').toLowerCase();
  const workModes = detectWorkModes(job);
  const employmentTypes = detectEmploymentTypes(job);
  const seniority = detectSeniority(job);

  if ((alert.excludedCompanies || []).some((item) => company.includes(String(item || '').toLowerCase()))) {
    return false;
  }

  if ((alert.excludeKeywords || []).some((item) => haystack.includes(String(item || '').toLowerCase()))) {
    return false;
  }

  if ((alert.workModes || []).length && workModes.length && !workModes.some((item) => alert.workModes.includes(item))) {
    return false;
  }

  if ((alert.employmentTypes || []).length && employmentTypes.length && !employmentTypes.some((item) => alert.employmentTypes.includes(item))) {
    return false;
  }

  if ((alert.seniorityLevels || []).length && seniority.length && !seniority.some((item) => alert.seniorityLevels.includes(item))) {
    return false;
  }

  return true;
}

async function getAlertResumeText(alert) {
  if (!alert || alert.resumeSource === 'none') return '';
  if (alert.resumeSource === 'upload' && alert.resumeText) return alert.resumeText;
  const latestResume = await Resume.findOne({ userId: alert.userId }).sort({ createdAt: -1 }).lean();
  return String(latestResume?.content || alert.resumeText || '').trim();
}

async function runJobAlertSearch(alertDoc) {
  const alert = alertDoc.toObject ? alertDoc.toObject() : alertDoc;
  const resumeText = await getAlertResumeText(alert);
  const queries = alert.includeSimilarTitles ? expandSimilarTitles(alert.titles) : (alert.titles || []).slice(0, 3);

  const settled = await Promise.allSettled(
    queries.filter(Boolean).map((title) => searchJobsFast({
      title,
      location: alert.location || 'Remote',
      resume: resumeText
    }))
  );

  const combined = [];
  settled.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value?.jobs)) {
      combined.push(...result.value.jobs);
    }
  });

  const previousFingerprints = new Set((alert.latestResults || []).map((item) => item.fingerprint));

  const ranked = dedupeJobs(combined)
    .filter((job) => passesJobAlertFilters(job, alert))
    .map((job) => {
      const whyMatched = buildJobAlertReasons(job, alert, resumeText);
      const includeKeywordBonus = whyMatched.some((item) => item.startsWith('Keyword match')) ? 6 : 0;
      const titleBonus = whyMatched.some((item) => item.startsWith('Title match')) ? 10 : 0;
      const fingerprint = fingerprintJob(job);
      return {
        fingerprint,
        title: cleanAlertString(job.title, 140),
        company: cleanAlertString(job.company, 100),
        location: cleanAlertString(job.location, 100),
        link: cleanAlertString(job.link, 500),
        description: cleanAlertString(job.description, 1500),
        source: cleanAlertString(job.source, 60),
        postedAt: job.postedAt ? new Date(job.postedAt) : null,
        matchScore: Math.max(1, Math.min(99, Math.round(Number(job.matchScore || 60) + includeKeywordBonus + titleBonus))),
        whyMatched
      };
    })
    .filter((job) => job.matchScore >= JOB_ALERT_MIN_MATCH_SCORE)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);

  const newJobsFoundCount = ranked.filter((item) => !previousFingerprints.has(item.fingerprint)).length;
  return { results: ranked, newJobsFoundCount, resumeText };
}

async function executeJobAlertRun(alertDoc, options = {}) {
  const mode = options.mode || 'manual';
  const alert = alertDoc;
  const { results, newJobsFoundCount, resumeText } = await runJobAlertSearch(alert);
  const shouldEmail = typeof options.sendEmail === 'boolean'
    ? options.sendEmail
    : alert.emailEnabled && results.length && (mode === 'manual' || newJobsFoundCount > 0);

  alert.latestResults = results;
  alert.lastCheckedAt = new Date();
  alert.nextRunAt = alert.isPaused ? null : computeNextJobAlertRunAt(alert.frequency, alert.lastCheckedAt);
  alert.lastMatchCount = results.length;
  alert.newJobsFoundCount = newJobsFoundCount;
  alert.totalRuns = Number(alert.totalRuns || 0) + 1;

  if (alert.resumeSource !== 'none' && resumeText) {
    alert.resumeText = resumeText.slice(0, 30000);
  }

  if (shouldEmail) {
    const user = await User.findById(alert.userId).select('email name').lean();
    queueJobAlertSummaryEmail({
      to: user?.email,
      alert,
      results
    });
    alert.lastEmailedAt = new Date();
  }

  await alert.save();
  return alert;
}

async function runDueJobAlerts() {
  if (jobAlertSchedulerRunning || mongoose.connection.readyState !== 1) return;
  jobAlertSchedulerRunning = true;

  try {
    const now = new Date();
    const dueAlerts = await JobAlert.find({
      isPaused: false,
      $or: [
        { nextRunAt: { $exists: false } },
        { nextRunAt: null },
        { nextRunAt: { $lte: now } }
      ]
    }).sort({ nextRunAt: 1, updatedAt: 1 }).limit(25);

    for (const alert of dueAlerts) {
      try {
        await executeJobAlertRun(alert, { mode: 'scheduled' });
      } catch (err) {
        console.error(`Job alert scheduler failed for ${alert._id}:`, err.message);
        alert.nextRunAt = computeNextJobAlertRunAt(alert.frequency, new Date(Date.now() + 1000 * 60 * 30));
        await alert.save().catch(() => {});
      }
    }
  } finally {
    jobAlertSchedulerRunning = false;
  }
}

function startJobAlertScheduler() {
  if (process.env.NODE_ENV === 'test' || jobAlertSchedulerTimer) return;
  jobAlertSchedulerTimer = setInterval(() => {
    runDueJobAlerts().catch((err) => {
      console.error('Job alert scheduler loop failed:', err.message);
    });
  }, JOB_ALERT_SCHEDULE_INTERVAL_MS);
  runDueJobAlerts().catch((err) => {
    console.error('Initial job alert scheduler run failed:', err.message);
  });
}

function buildJobAlertEmailHtml(alert, results) {
  const top = (results || []).slice(0, 5);
  const items = top
    .map((job) => `
      <li style="margin:0 0 14px;">
        <strong>${job.title}</strong> at ${job.company}<br />
        <span style="color:#475569;">${job.location} · Match ${job.matchScore}%</span><br />
        <a href="${job.link}" style="color:#0284c7;">Open job</a>
      </li>
    `)
    .join('');

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;">
      <h2 style="margin:0 0 10px;">${alert.name}: ${results.length} fresh alert matches</h2>
      <p style="margin:0 0 14px;">Here are the latest matches from your RoleRocket AI alert profile.</p>
      <ol style="padding-left:18px;">${items}</ol>
    </div>
  `;
}

function queueJobAlertSummaryEmail({ to, alert, results }) {
  if (!to || !results.length) return;
  setImmediate(async () => {
    try {
      await sendEmail({
        to,
        subject: `${alert.name}: ${results.length} job alert matches`,
        html: buildJobAlertEmailHtml(alert, results)
      });
    } catch (err) {
      console.error('Job alert email send failed:', err.message);
    }
  });
}

const IN_DEMAND_JOBS_CACHE_MS = 24 * 60 * 60 * 1000;
const inDemandJobsCache = {
  createdAt: 0,
  payload: null
};

const IN_DEMAND_JOB_QUERIES = [
  { industry: 'Technology', title: 'software engineer', location: 'United States' },
  { industry: 'Healthcare', title: 'registered nurse', location: 'United States' },
  { industry: 'Finance', title: 'financial analyst', location: 'United States' },
  { industry: 'Education', title: 'instructional designer', location: 'United States' },
  { industry: 'Manufacturing', title: 'industrial engineer', location: 'United States' },
  { industry: 'Retail', title: 'store manager', location: 'United States' }
];

function buildFallbackIndustryJobs() {
  return {
    Technology: ['Software Engineer', 'Data Engineer', 'Cloud Engineer', 'Cybersecurity Analyst', 'DevOps Engineer'],
    Healthcare: ['Registered Nurse', 'Medical Assistant', 'Physical Therapist', 'Healthcare Administrator', 'Radiologic Technologist'],
    Finance: ['Financial Analyst', 'Accountant', 'Risk Analyst', 'Compliance Analyst', 'Controller'],
    Education: ['Instructional Designer', 'Teacher', 'School Counselor', 'Curriculum Specialist', 'Special Education Teacher'],
    Manufacturing: ['Industrial Engineer', 'Production Supervisor', 'Quality Engineer', 'Maintenance Technician', 'Supply Chain Analyst'],
    Retail: ['Store Manager', 'Merchandising Manager', 'Inventory Planner', 'Customer Experience Manager', 'Loss Prevention Manager']
  };
}

function normalizeJobTitleForDemand(title) {
  return String(title || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[-|/:].*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTopDemandTitles(jobs, fallbackTitles) {
  const counts = new Map();

  jobs.forEach((job) => {
    const normalizedTitle = normalizeJobTitleForDemand(job?.title);
    if (!normalizedTitle) {
      return;
    }
    counts.set(normalizedTitle, (counts.get(normalizedTitle) || 0) + 1);
  });

  const topTitles = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([title]) => title);

  if (topTitles.length >= 5) {
    return topTitles;
  }

  fallbackTitles.forEach((title) => {
    if (topTitles.length < 5 && !topTitles.includes(title)) {
      topTitles.push(title);
    }
  });

  return topTitles;
}

async function buildInDemandJobsPayload() {
  const fallback = buildFallbackIndustryJobs();
  const results = await Promise.all(
    IN_DEMAND_JOB_QUERIES.map(async ({ industry, title, location }) => {
      try {
        const { jobs } = await searchJobsFast({ title, location, resume: '' });
        return [industry, getTopDemandTitles(jobs, fallback[industry] || [])];
      } catch (error) {
        return [industry, fallback[industry] || []];
      }
    })
  );

  return {
    updatedAt: new Date().toISOString(),
    industries: Object.fromEntries(results)
  };
}

async function getInDemandJobsPayload() {
  if (inDemandJobsCache.payload && Date.now() - inDemandJobsCache.createdAt < IN_DEMAND_JOBS_CACHE_MS) {
    return { payload: inDemandJobsCache.payload, fromCache: true };
  }

  const payload = await buildInDemandJobsPayload();
  inDemandJobsCache.createdAt = Date.now();
  inDemandJobsCache.payload = payload;
  return { payload, fromCache: false };
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
    jobs: [],
    meta: {
      fromCache: false,
      source: 'warming-fetch',
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
  const fromLabel =
    text.match(/job title[:\s]+([^\n]+)/i)?.[1] ||
    text.match(/title[:\s]+([^\n]+)/i)?.[1] ||
    '';

  const firstLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 5) ||
    '';

  let titleLine = String(fromLabel || firstLine || 'Imported Role').replace(/\s+/g, ' ').trim();

  const markerMatch = titleLine.match(/(skip to main content|this button displays|jobs people learning|clear text|join or sign in)/i);
  if (markerMatch && markerMatch.index > 20) {
    titleLine = titleLine.slice(0, markerMatch.index).trim();
  }

  const splitMatch = titleLine.match(/^(.{8,120}?)(?:\s+[|\-]\s+|\s+at\s+|\s+in\s+)/i);
  if (splitMatch && splitMatch[1]) {
    titleLine = splitMatch[1].trim();
  }

  if (titleLine.length > 120) {
    titleLine = titleLine.slice(0, 120).replace(/\s+\S*$/, '').trim();
  }

  return titleLine || 'Imported Role';
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
      max_tokens: 1200,
      temperature: 0.5,
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

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function extractTextFromUploadedFile(file) {
  if (!file) return '';

  const mime = String(file.mimetype || '').toLowerCase();
  if (mime === 'application/pdf') {
    let content = await extractTextFromPDF(file.buffer);
    if (!content.trim()) {
      content = await extractTextFromPDFWithOCR(toArrayBuffer(file.buffer));
    }
    return content;
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(file.buffer);
  }

  if (mime.startsWith('text/')) {
    return file.buffer.toString('utf8');
  }

  throw new Error('Unsupported file type');
}

function extractCurrencyValues(text = '') {
  const matches = Array.from(
    text.matchAll(/\$\s?(\d{2,3}(?:,\d{3})+|\d{2,3}k)/gi)
  ).map((match) => match[1]);

  return matches
    .map((value) => {
      if (/k$/i.test(value)) {
        return Number.parseInt(value, 10) * 1000;
      }
      return Number.parseInt(value.replace(/,/g, ''), 10);
    })
    .filter((value) => Number.isFinite(value));
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return 'your target number';
  return `$${value.toLocaleString('en-US')}`;
}

function extractOfferRole(text = '') {
  const cleanedText = String(text || '').trim();
  const match =
    cleanedText.match(/position[:\s]+([^\n]+)/i)?.[1] ||
    cleanedText.match(/role[:\s]+([^\n]+)/i)?.[1] ||
    cleanedText.match(/offer letter for\s+(.+?)(?:\s+at\s+[^\n]+)?(?:\n|$)/i)?.[1] ||
    extractJobTitle(cleanedText);

  return String(match || 'Imported Role')
    .replace(/^offer letter for\s+/i, '')
    .trim();
}

function extractOfferCompany(text = '') {
  const cleanedText = String(text || '').trim();
  const match =
    cleanedText.match(/company[:\s]+([^\n]+)/i)?.[1] ||
    cleanedText.match(/offer letter for\s+.+?\s+at\s+([^\n]+)/i)?.[1] ||
    cleanedText.match(/\bat\s+([A-Z][A-Za-z0-9&.,\- ]+)/)?.[1] ||
    extractCompanyName(cleanedText);

  return String(match || 'Imported Company').trim();
}

function buildOfferNegotiationReport({ offerText, targetComp, priorities }) {
  const role = extractOfferRole(offerText);
  const company = extractOfferCompany(offerText);
  const location = extractLocation(offerText);
  const currencyValues = extractCurrencyValues(offerText);
  const currentOffer = currencyValues.length ? Math.max(...currencyValues) : null;
  const targetValue = Number.parseInt(String(targetComp || '').replace(/[^\d]/g, ''), 10) || null;
  const askValue = targetValue || (currentOffer ? Math.round(currentOffer * 1.08) : null);
  const prioritiesLine = priorities && priorities.trim()
    ? priorities.trim()
    : 'base compensation, signing support, remote flexibility, and clear growth scope';

  return [
    `Offer Negotiation Plan for ${role} at ${company}`,
    '',
    `Offer snapshot: ${company} is hiring for ${role} in ${location}. ${currentOffer ? `The offer appears to center around ${formatMoney(currentOffer)}.` : 'The uploaded offer did not expose a clear base salary, so anchor your ask to market data and the role scope.'}`,
    '',
    'Recommended approach:',
    '1. Open by expressing clear enthusiasm for the role and appreciation for the offer details.',
    `2. Re-anchor the discussion around your impact, the scope of the role, and your top priorities: ${prioritiesLine}.`,
    `3. Ask for ${formatMoney(askValue)}${currentOffer && askValue ? `, which preserves a reasonable move from the current offer while staying specific.` : ' and keep the request concrete and easy for the recruiter to take back to compensation review.'}`,
    '4. If base pay is fixed, shift immediately to signing bonus, equity, start-date flexibility, PTO, and remote or hybrid support.',
    '',
    'Suggested script:',
    `"Thank you again for the offer. I am excited about the chance to join ${company} as a ${role}. Based on the scope of the role, the value I can bring quickly, and current market benchmarks, I would be more comfortable moving forward at ${formatMoney(askValue)}. If base compensation is constrained, I would also be open to discussing other levers such as a signing bonus, equity, or flexibility around ${prioritiesLine}."`,
    '',
    'Coaching notes:',
    '- Keep the tone collaborative, not defensive.',
    '- Stop after making the ask and let the recruiter respond.',
    '- Have one ideal outcome and one acceptable fallback ready before the call.',
    '- If they cannot move immediately, ask when compensation review can happen and what approvals are needed.'
  ].join('\n');
}

function buildJobScoutReport({ title, location, preferences, jobs }) {
  const lines = [
    `AI Job Agent Report for ${title} in ${location}`,
    ''
  ];

  if (preferences) {
    lines.push(`Search priorities: ${preferences}`);
    lines.push('');
  }

  jobs.forEach((job, index) => {
    lines.push(
      `${index + 1}. ${job.title} at ${job.company}`,
      `   Location: ${job.location}`,
      `   Source: ${job.source}`,
      `   Match score: ${Math.round(Number(job.matchScore || 0))}`,
      `   Link: ${job.link}`,
      ''
    );
  });

  if (!jobs.length) {
    lines.push('No roles were returned. Try broadening the target role or location.');
  }

  return lines.join('\n');
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

app.post('/api/telemetry/bulk', authenticateToken, async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.events) ? req.body.events : [];
    if (!incoming.length) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const trimmed = incoming.slice(0, 100);
    const docs = trimmed
      .map((evt) => {
        const event = String(evt?.event || '').trim().slice(0, 80);
        if (!event) return null;
        return {
          userId: req.user.userId,
          event,
          funnel: String(evt?.funnel || '').slice(0, 80),
          sessionId: String(evt?.sessionId || '').slice(0, 80),
          page: String(evt?.page || '').slice(0, 120),
          variant: String(evt?.variant || '').slice(0, 20),
          ts: evt?.ts ? new Date(evt.ts) : new Date(),
          meta: typeof evt?.meta === 'object' && evt.meta !== null ? evt.meta : {},
          userAgent: String(req.headers['user-agent'] || '').slice(0, 280),
          ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').slice(0, 120)
        };
      })
      .filter(Boolean);

    if (!docs.length) {
      return res.status(400).json({ error: 'No valid events were provided' });
    }

    await Telemetry.insertMany(docs, { ordered: false });
    return res.json({ ok: true, inserted: docs.length });
  } catch (err) {
    console.error('Telemetry bulk error:', err.message);
    return res.status(500).json({ error: 'Failed to store telemetry batch' });
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

app.get('/api/admin/quickstart/conversion', authenticateToken, requireAnalyticsAccess, async (req, res) => {
  try {
    const rawDays = Number(req.query.days || 30);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 180) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await Telemetry.find({
      ts: { $gte: since },
      event: { $in: ['quickstart_step_completed', 'quickstart_completed_all'] }
    })
      .select('userId sessionId event meta ts')
      .lean();

    const startedActors = new Set();
    const completedActors = new Set();
    const stepActors = {
      resume: new Set(),
      tailor: new Set(),
      interview: new Set(),
      pipeline: new Set()
    };

    events.forEach((evt) => {
      const actor = evt.userId
        ? `u:${String(evt.userId)}`
        : (evt.sessionId ? `s:${String(evt.sessionId)}` : '');
      if (!actor) return;

      if (evt.event === 'quickstart_step_completed') {
        startedActors.add(actor);
        const step = String(evt.meta?.step || '').trim().toLowerCase();
        if (stepActors[step]) {
          stepActors[step].add(actor);
        }
      }

      if (evt.event === 'quickstart_completed_all') {
        startedActors.add(actor);
        completedActors.add(actor);
      }
    });

    const started = startedActors.size;
    const completedAll = completedActors.size;
    const conversionRate = started ? Number(((completedAll / started) * 100).toFixed(1)) : 0;

    const steps = ['resume', 'tailor', 'interview', 'pipeline'].map((step) => {
      const users = stepActors[step].size;
      const rate = started ? Number(((users / started) * 100).toFixed(1)) : 0;
      return { step, users, rate };
    });

    return res.json({
      windowDays: days,
      startedUsers: started,
      completedAllUsers: completedAll,
      conversionRate,
      steps
    });
  } catch (err) {
    console.error('Quickstart conversion error:', err.message);
    return res.status(500).json({ error: 'Failed to load quickstart conversion metrics' });
  }
});

app.get('/api/admin/outcomes/kpis', authenticateToken, requireAnalyticsAccess, async (req, res) => {
  try {
    const rawDays = Number(req.query.days || 30);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 7), 180) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const CORE_EVENTS = [
      'quickstart_step_completed',
      'quickstart_completed_all',
      'find_jobs_success',
      'one_click_apply_success',
      'ia_question_submitted',
      'saved_resume_updated',
      'saved_resume_uploaded'
    ];

    const [
      users,
      jobsWindow,
      jobsAllApplied,
      jobsAllOffers,
      resumesAll,
      applicationsAll,
      recentCoreTelemetry,
      recentTelemetryAny
    ] = await Promise.all([
      User.find({}).select('_id plan').lean(),
      Job.find({ createdAt: { $gte: since }, status: { $in: ['applied', 'interview', 'offer'] } })
        .select('userId status createdAt')
        .lean(),
      Job.find({ status: { $in: ['applied', 'interview', 'offer'] } })
        .select('userId createdAt status')
        .lean(),
      Job.find({ status: 'offer' })
        .select('userId createdAt')
        .lean(),
      Resume.find({}).select('userId createdAt').lean(),
      Application.find({}).select('userId createdAt status').lean(),
      Telemetry.find({ ts: { $gte: sevenDaysAgo }, event: { $in: CORE_EVENTS } })
        .select('userId event ts')
        .lean(),
      Telemetry.find({ ts: { $gte: fourteenDaysAgo } })
        .select('userId ts')
        .lean()
    ]);

    const userPlanMap = new Map(users.map((u) => [String(u._id), normalizePlan(u.plan || 'free')]));

    const byPlan = {
      free: { applied: 0, interview: 0, offer: 0 },
      pro: { applied: 0, interview: 0, offer: 0 },
      premium: { applied: 0, interview: 0, offer: 0 },
      elite: { applied: 0, interview: 0, offer: 0 },
      lifetime: { applied: 0, interview: 0, offer: 0 }
    };

    let paidApplied = 0;
    let paidInterview = 0;
    let paidOffer = 0;
    let totalApplied = 0;
    let totalInterview = 0;
    let totalOffer = 0;

    jobsWindow.forEach((job) => {
      const userId = String(job.userId || '');
      const plan = userPlanMap.get(userId) || 'free';
      const status = String(job.status || '').toLowerCase();
      if (!byPlan[plan] || byPlan[plan][status] === undefined) return;

      byPlan[plan][status] += 1;
      if (status === 'applied') totalApplied += 1;
      if (status === 'interview') totalInterview += 1;
      if (status === 'offer') totalOffer += 1;

      if (plan !== 'free') {
        if (status === 'applied') paidApplied += 1;
        if (status === 'interview') paidInterview += 1;
        if (status === 'offer') paidOffer += 1;
      }
    });

    const freeInterviewRate = byPlan.free.applied ? byPlan.free.interview / byPlan.free.applied : 0;
    const paidInterviewRate = paidApplied ? paidInterview / paidApplied : 0;
    const freeOfferRate = byPlan.free.interview ? byPlan.free.offer / byPlan.free.interview : 0;
    const paidOfferRate = paidInterview ? paidOffer / paidInterview : 0;

    const firstResumeByUser = new Map();
    resumesAll.forEach((row) => {
      const uid = String(row.userId || '');
      if (!uid || !row.createdAt) return;
      const ts = new Date(row.createdAt).getTime();
      const prev = firstResumeByUser.get(uid);
      if (!prev || ts < prev) firstResumeByUser.set(uid, ts);
    });

    const firstAppliedByUser = new Map();
    jobsAllApplied.forEach((row) => {
      const uid = String(row.userId || '');
      if (!uid || !row.createdAt) return;
      const ts = new Date(row.createdAt).getTime();
      const prev = firstAppliedByUser.get(uid);
      if (!prev || ts < prev) firstAppliedByUser.set(uid, ts);
    });

    applicationsAll.forEach((row) => {
      const uid = String(row.userId || '');
      if (!uid || !row.createdAt) return;
      const ts = new Date(row.createdAt).getTime();
      const prev = firstAppliedByUser.get(uid);
      if (!prev || ts < prev) firstAppliedByUser.set(uid, ts);
    });

    const timeToApplyHours = [];
    firstAppliedByUser.forEach((appliedAt, uid) => {
      const resumeAt = firstResumeByUser.get(uid);
      if (!resumeAt) return;
      if (appliedAt < resumeAt) return;
      timeToApplyHours.push((appliedAt - resumeAt) / (1000 * 60 * 60));
    });

    const sortedHours = timeToApplyHours.slice().sort((a, b) => a - b);
    const medianHours = sortedHours.length
      ? (sortedHours.length % 2
        ? sortedHours[(sortedHours.length - 1) / 2]
        : (sortedHours[sortedHours.length / 2 - 1] + sortedHours[sortedHours.length / 2]) / 2)
      : 0;

    const weeklyCoreUsers = new Set();
    let weeklyCoreActions = 0;
    recentCoreTelemetry.forEach((evt) => {
      const uid = String(evt.userId || '');
      if (!uid) return;
      weeklyCoreUsers.add(uid);
      weeklyCoreActions += 1;
    });

    const firstOfferByUser = new Map();
    jobsAllOffers.forEach((row) => {
      const uid = String(row.userId || '');
      if (!uid || !row.createdAt) return;
      const ts = new Date(row.createdAt).getTime();
      const prev = firstOfferByUser.get(uid);
      if (!prev || ts < prev) firstOfferByUser.set(uid, ts);
    });

    const activeRecentUsers = new Set();
    recentTelemetryAny.forEach((evt) => {
      const uid = String(evt.userId || '');
      if (uid) activeRecentUsers.add(uid);
    });

    let eligibleWinners = 0;
    let retainedWinners = 0;
    firstOfferByUser.forEach((offerAt, uid) => {
      if (offerAt > fourteenDaysAgo.getTime()) return;
      eligibleWinners += 1;
      if (activeRecentUsers.has(uid)) retainedWinners += 1;
    });

    const interviewRate = totalApplied ? totalInterview / totalApplied : 0;
    const offerRate = totalInterview ? totalOffer / totalInterview : 0;
    const interviewLift = freeInterviewRate > 0 ? paidInterviewRate / freeInterviewRate : 0;
    const offerLift = freeOfferRate > 0 ? paidOfferRate / freeOfferRate : 0;
    const postWinRetention14d = eligibleWinners ? retainedWinners / eligibleWinners : 0;

    return res.json({
      windowDays: days,
      timeToApplication: {
        medianHours: Number(medianHours.toFixed(1)),
        sampleUsers: sortedHours.length
      },
      interviewRate: {
        overall: Number((interviewRate * 100).toFixed(1)),
        free: Number((freeInterviewRate * 100).toFixed(1)),
        paid: Number((paidInterviewRate * 100).toFixed(1)),
        paidLiftVsFree: Number(interviewLift.toFixed(2))
      },
      offerRate: {
        overall: Number((offerRate * 100).toFixed(1)),
        free: Number((freeOfferRate * 100).toFixed(1)),
        paid: Number((paidOfferRate * 100).toFixed(1)),
        paidLiftVsFree: Number(offerLift.toFixed(2))
      },
      coreWorkflowUsage: {
        weeklyActiveUsers: weeklyCoreUsers.size,
        weeklyCoreActions
      },
      postWinRetention: {
        retention14dPct: Number((postWinRetention14d * 100).toFixed(1)),
        eligibleWinners,
        retainedWinners
      }
    });
  } catch (err) {
    console.error('Outcome KPI error:', err);
    return res.status(500).json({ error: 'Failed to load outcome KPIs' });
  }
});

app.get('/api/quickstart/timeline', authenticateToken, async (req, res) => {
  try {
    const rawDays = Number(req.query.days || 60);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 60;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await Telemetry.find({
      userId: req.user.userId,
      ts: { $gte: since },
      event: { $in: ['quickstart_step_completed', 'quickstart_step_reopened', 'quickstart_completed_all'] }
    })
      .select('event meta ts sessionId')
      .sort({ ts: 1 })
      .lean();

    const state = {
      resume: false,
      tailor: false,
      interview: false,
      pipeline: false
    };

    const timeline = [];
    const daily = {};

    function countCompleted(nextState) {
      return Object.values(nextState).filter(Boolean).length;
    }

    events.forEach((evt) => {
      const eventName = String(evt.event || '').trim();
      const step = String(evt.meta?.step || '').trim().toLowerCase();
      const day = new Date(evt.ts || Date.now()).toISOString().slice(0, 10);

      if (eventName === 'quickstart_step_completed' && state[step] !== undefined) {
        state[step] = true;
      }
      if (eventName === 'quickstart_step_reopened' && state[step] !== undefined) {
        state[step] = false;
      }
      if (eventName === 'quickstart_completed_all') {
        state.resume = true;
        state.tailor = true;
        state.interview = true;
        state.pipeline = true;
      }

      const completed = countCompleted(state);
      const snapshot = {
        ts: evt.ts,
        day,
        event: eventName,
        step: step || null,
        completed,
        total: 4,
        state: { ...state }
      };

      timeline.push(snapshot);

      if (!daily[day]) {
        daily[day] = {
          day,
          completed,
          events: 0,
          stepsCompleted: []
        };
      }

      daily[day].completed = completed;
      daily[day].events += 1;
      if (eventName === 'quickstart_step_completed' && step && !daily[day].stepsCompleted.includes(step)) {
        daily[day].stepsCompleted.push(step);
      }
    });

    const finalCompleted = countCompleted(state);
    const completionRate = Number(((finalCompleted / 4) * 100).toFixed(1));

    return res.json({
      windowDays: days,
      summary: {
        completed: finalCompleted,
        total: 4,
        completionRate,
        state
      },
      timeline,
      daily: Object.values(daily)
    });
  } catch (err) {
    console.error('Quickstart timeline error:', err.message);
    return res.status(500).json({ error: 'Failed to load quickstart timeline' });
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

app.get('/api/admin/users', authenticateToken, requireAnalyticsAccess, async (req, res) => {
  try {
    const rawLimit = Number(req.query.limit || 500);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 2000) : 500;

    const users = await User.find({})
      .select('name email plan isSubscribed emailVerified createdAt referralCode referralCount veteranVerified')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      total: users.length,
      users: users.map((user) => ({
        name: user.name || '',
        email: user.email || '',
        plan: normalizePlan(user.plan || 'free'),
        subscribed: Boolean(user.isSubscribed),
        emailVerified: user.emailVerified !== false,
        veteranVerified: Boolean(user.veteranVerified),
        referralCode: user.referralCode || '',
        referralCount: Number(user.referralCount || 0),
        createdAt: user.createdAt || null
      }))
    });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ error: 'Failed to load signed up users' });
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
    if (!jobDescription) {
      return res.status(400).json({ error: 'jobDescription is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const generationStatus = getDailyGenerationStatus(user, 'resume');
    if (!generationStatus.allowed) {
      return res.status(429).json({ error: generationStatus.message });
    }

    const hasResume = resume && String(resume).trim().length > 0;
    const latestRoadmap = await LearningRoadmap
      .findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select('roadmapText targetRole')
      .lean();

    const learningContext = latestRoadmap && latestRoadmap.roadmapText
      ? [
          `Latest Learning Roadmap (${latestRoadmap.targetRole || 'Target Role'}):`,
          String(latestRoadmap.roadmapText || '').slice(0, 1600),
          'Use relevant roadmap insights to strengthen PROFILE and SKILLS while staying truthful to provided resume context.'
        ].join('\n')
      : '';
    
    let systemMessage, userMessage;
    
    if (hasResume) {
      // Rewrite existing resume for the job
      systemMessage = 'Rewrite resumes to be ATS-friendly, measurable, strong, clear, and professional. Analyze the job description first and mirror its most important keywords in the resume naturally.';
      userMessage = [
        `Job Description:\n${jobDescription}`,
        `Resume:\n${resume}`,
        learningContext,
        'Instructions:',
        '- Keep the resume realistic and fact-based. Do not add, invent, or infer any employers, job titles, dates, tools, certifications, or skills that are not explicitly present in the candidate resume or the job description.',
        '- Include a PROFILE or SUMMARY section near the top with 2 to 3 sentences tailored to the target role using language drawn only from the resume and job description.',
        '- Add a dedicated SKILLS section with 8 to 12 concise skill phrases. Only include skills that appear in the candidate resume OR are explicitly stated in the job description — never infer or add tools, certifications, or credentials not found in either source.',
        '- Avoid generic filler such as Team Player, Hardworking, Strong Work Ethic, or Collaborator unless those ideas are explicitly required in the job description.',
        '- Keep the output in clean resume text with clear section headers.'
      ].filter(Boolean).join('\n\n');
    } else {
      // Generate a template from scratch — no real data, placeholders only
      systemMessage = 'Create a professional ATS-friendly resume TEMPLATE tailored to the job description. Use only placeholder entries for all experience and education — never invent real employers, company names, dates, schools, or certifications.';
      userMessage = [
        `Job Description:\n${jobDescription}`,
        learningContext,
        'Instructions:',
        '- CRITICAL: Do NOT invent or use any real employer names, company names, job titles held, dates, schools, or certifications. Every experience and education entry MUST be a clearly labelled placeholder such as "[Job Title] | [Company Name] | [City, State] | [Month Year – Month Year]" so the user knows what to replace.',
        '- Include a PROFILE or SUMMARY section with 2 to 3 sentences drawn strictly from the job description requirements.',
        '- In the SKILLS section, include 8 to 12 concise, ATS-friendly skill phrases that are explicitly stated in the job description only. Do not add tools, software, or certifications that are not mentioned in the job description.',
        '- Avoid weak filler such as Team Player, Strong Work Ethic, or Creative Thinking unless the posting explicitly requires them.',
        '- Use clean resume text with clear section headers.'
      ].filter(Boolean).join('\n\n');
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    await recordDailyGenerationUsage(user, 'resume');

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
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const generationStatus = getDailyGenerationStatus(user, 'cover-letter');
    if (!generationStatus.allowed) {
      return res.status(429).json({ error: generationStatus.message });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
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

    await recordDailyGenerationUsage(user, 'cover-letter');

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
      max_tokens: 1200,
      temperature: 0.5,
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
    const { role, jobDescription, mode, questions } = req.body;

    if (!role && !jobDescription) {
      return res.status(400).json({ error: 'role or jobDescription is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'premium')) {
      return res.status(403).json({ error: 'Upgrade to Premium to use Interview Prep AI.' });
    }

    const wantsAnswers = String(mode || '').toLowerCase() === 'answers';
    const cleanedQuestions = String(questions || '').trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
      messages: wantsAnswers
        ? [
            {
              role: 'system',
              content:
                'You are an interview coach. Using the provided interview questions, return concise, legible model answers. For each question, include: 1) a direct sample answer (70-120 words), 2) why this answer works (one line), and 3) one metric/result line when applicable.'
            },
            {
              role: 'user',
              content: `Role: ${role || 'Not provided'}\n\nJob Description:\n${jobDescription || 'Not provided'}\n\nQuestions:\n${cleanedQuestions || 'Not provided'}`
            }
          ]
        : [
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

    return res.json({
      result: completion.choices[0].message.content,
      mode: wantsAnswers ? 'answers' : 'questions'
    });
  } catch (err) {
    console.error('Interview prep error:', err);
    return res.status(500).json({ error: 'Interview prep failed' });
  }
});

app.post('/api/learning/plan', authenticateToken, async (req, res) => {
  try {
    const {
      targetRole,
      currentLevel,
      timePerWeek,
      jobDescription,
      resumeText
    } = req.body || {};

    if (!targetRole || !jobDescription) {
      return res.status(400).json({ error: 'targetRole and jobDescription are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use RoleRocketAI Learning.' });
    }

    const generationStatus = getDailyGenerationStatus(user, 'learning');
    if (!generationStatus.allowed) {
      return res.status(429).json({ error: generationStatus.message });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert instructor and career skills trainer. Your job is to TEACH skills directly, like a tutor sitting with the candidate.',
            'First diagnose missing skills from the job description vs candidate resume context, then teach each skill as if you are the instructor.',
            'Use plain text only. Do not use markdown symbols such as #, *, -, or ** anywhere in the response.',
            'Do not invent certifications or work history not supported by provided context.',
            'Use this output format exactly:',
            '1) Missing Skills Diagnosis (Top 5 gaps, each with evidence from job description)',
            '2) Skill Teaching Modules (for each skill, output on separate lines with each key on its own line:',
            'Module X: <skill name>',
            'Why this matters: [2-3 sentences on business impact and why this skill is required for the role]',
            'Learn: [Write this as a direct lesson from instructor to student. Do NOT describe the skill—TEACH it. Include: step-by-step how it actually works, specific techniques the student should know and apply, concrete examples from the relevant industry, what mistakes beginners make and how to avoid them, and what mastery looks like in practice. Write 5-8 sentences of real instructional content as if you are explaining it live. Do not reference any external books, courses, websites, or resources.]',
            'Practice: [2-3 specific hands-on tasks the student should do right now to apply what they just learned]',
            'Proof of mastery: [one concrete deliverable or test that proves the student has learned this skill])',
            '3) 30-Day Skill-Building Plan (Week 1 to Week 4 mapped to those modules)',
            '4) Practice Projects (3 projects with scope + deliverable + which skill gaps they close)',
            '5) Interview Readiness Drills (5 drills tied to the missing skills)',
            '6) Resume Upgrade Targets (5 bullet changes after learning, tied to completed skills)',
            '7) Weekly Checkpoint Scorecard (5 measurable metrics)',
            '8) Trending Industry Courses (5 courses popular in the current 2025-2026 job market that are highly relevant to this role; for each use this exact format on its own line: Course Name: <name> | Platform: <platform> | Why it is trending: <reason> | Best for: <audience>)',
            'CRITICAL RULE: The Learn field must read like a lesson from a human expert instructor—not a summary or overview. It must contain specific how-to knowledge, real techniques, concrete examples, and common mistakes. Never say "understand X", "learn X", "study X", "read X", "use X tool", or any variation that defers the teaching. Instead, do the teaching right there in the text.',
            'Keep all content specific, actionable, and role-aligned.'
          ].join(' ')
        },
        {
          role: 'user',
          content: [
            `Target Role: ${String(targetRole || '').trim()}`,
            `Current Level: ${String(currentLevel || 'Not provided').trim()}`,
            `Weekly Time Budget: ${String(timePerWeek || '5').trim()} hours`,
            '',
            'Target Job Description:',
            String(jobDescription || '').trim(),
            '',
            'Candidate Resume / Skills Context:',
            String(resumeText || 'Not provided').trim()
          ].join('\n')
        }
      ]
    });

    const roadmapText = String(completion.choices[0].message.content || '').trim();

    await LearningRoadmap.create({
      userId: user._id,
      targetRole: String(targetRole || '').trim(),
      currentLevel: String(currentLevel || '').trim(),
      timePerWeek: Number(timePerWeek || 5) || 5,
      jobDescription: String(jobDescription || '').trim(),
      resumeText: String(resumeText || '').trim(),
      roadmapText
    });

    await recordDailyGenerationUsage(user, 'learning');

    return res.json({ result: roadmapText });
  } catch (err) {
    console.error('Learning roadmap error:', err);
    return res.status(500).json({ error: 'Learning roadmap generation failed' });
  }
});

app.get('/api/learning/latest', authenticateToken, async (req, res) => {
  try {
    const roadmap = await LearningRoadmap
      .findOne({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .select('targetRole currentLevel timePerWeek roadmapText createdAt')
      .lean();

    return res.json({ roadmap: roadmap || null });
  } catch (err) {
    console.error('Learning latest error:', err);
    return res.status(500).json({ error: 'Failed to load latest learning roadmap' });
  }
});

app.get('/api/learning/history', authenticateToken, async (req, res) => {
  try {
    const items = await LearningRoadmap
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('targetRole currentLevel timePerWeek roadmapText createdAt')
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error('Learning history error:', err);
    return res.status(500).json({ error: 'Failed to load learning history' });
  }
});

app.post('/api/learning/course-content', authenticateToken, async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access full course content.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2800,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: 'You are a world-class technical instructor creating premium, full-length professional courses similar to enterprise learning platforms. Teach directly and concretely. Never reference external links, books, websites, or courses. Output only valid JSON.'
        },
        {
          role: 'user',
          content: `Create a full course for: ${topic}

Return ONLY a JSON object with this exact shape and key names:
{
  "courseTitle": "string",
  "subtitle": "string",
  "difficulty": "Beginner|Intermediate|Advanced",
  "estimatedDuration": "string",
  "marketDemand": "string",
  "overview": "string",
  "learningOutcomes": ["string", "string", "string", "string", "string"],
  "modules": [
    {
      "title": "string",
      "objective": "string",
      "lesson": "string",
      "workedExample": "string",
      "commonMistake": "string",
      "practiceTask": "string"
    }
  ],
  "capstoneProject": {
    "title": "string",
    "scenario": "string",
    "deliverables": ["string", "string", "string"]
  },
  "finalAssessment": [
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" },
    { "question": "string", "answer": "string" }
  ],
  "interviewPrep": ["string", "string", "string"],
  "resumeSignals": ["string", "string", "string"]
}

Rules:
- Create exactly 6 modules.
- Each module.lesson must be 120-180 words and must teach concrete how-to steps.
- Each module.workedExample must include a realistic scenario with numbers, constraints, or decisions.
- Avoid fluff and generic advice.
- No markdown, no code fences, no extra text outside JSON.`
        }
      ]
    });

    const rawContent = String(completion.choices?.[0]?.message?.content || '').trim();
    const cleaned = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let course = null;
    try {
      course = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('Course content JSON parse failed, returning fallback object.');
      course = {
        courseTitle: topic,
        subtitle: `Professional course for ${topic}`,
        difficulty: 'Intermediate',
        estimatedDuration: '4-6 weeks',
        marketDemand: `${topic} is highly demanded across 2025-2026 roles.`,
        overview: cleaned || `Course generation for ${topic} is temporarily unavailable.`,
        learningOutcomes: [
          `Explain core ${topic} concepts`,
          `Apply ${topic} in realistic job scenarios`,
          `Avoid common ${topic} mistakes`,
          `Execute hands-on ${topic} tasks`,
          `Communicate ${topic} outcomes clearly`
        ],
        modules: [],
        capstoneProject: {
          title: `${topic} Capstone`,
          scenario: `Build a practical deliverable using ${topic}.`,
          deliverables: ['Plan', 'Execution artifact', 'Results summary']
        },
        finalAssessment: [],
        interviewPrep: [],
        resumeSignals: []
      };
    }

    return res.json({ course });
  } catch (err) {
    console.error('Course content error:', err);
    return res.status(500).json({ error: 'Failed to generate course content.' });
  }
});

app.post('/api/video-interview-practice/questions', authenticateToken, async (req, res) => {
  try {
    const roleTitle = String(req.body?.roleTitle || '').trim();
    const count = Math.max(3, Math.min(8, Number(req.body?.count || 5)));

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Video Interview Practice.' });
    }

    const fallbackQuestions = [
      `Tell me about yourself${roleTitle ? ` as a ${roleTitle}` : ''}.`,
      `Why are you interested in this${roleTitle ? ` ${roleTitle}` : ''} role?`,
      'Describe a challenge you faced and how you handled it.',
      'What is your strongest professional skill, and how have you used it?',
      'How do you prioritize when handling multiple deadlines?'
    ].slice(0, count);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'You are an expert interviewer. Return ONLY a valid JSON array of interview questions. No markdown, no explanations.'
        },
        {
          role: 'user',
          content: `Generate ${count} interview questions for this role: ${roleTitle || 'General professional role'}. Include a mix of behavioral, situational, and role-specific questions.`
        }
      ]
    });

    const raw = String(completion.choices?.[0]?.message?.content || '').trim();
    let questions = [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        questions = parsed
          .map((q) => String(q || '').trim())
          .filter(Boolean)
          .slice(0, count);
      }
    } catch {
      // Fallback parsing for line-based model output.
      questions = raw
        .split(/\n+/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, count);
    }

    if (!questions.length) {
      questions = fallbackQuestions;
    }

    return res.json({ questions, roleTitle: roleTitle || null });
  } catch (err) {
    console.error('Video interview questions error:', err);
    return res.status(500).json({ error: 'Failed to generate video interview questions.' });
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
      max_tokens: 1200,
      temperature: 0.5,
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

app.post('/api/ai-application-tracker/analyze', authenticateToken, async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const focus = String(req.body?.focus || '').trim();

    if (!entries.length) {
      return res.status(400).json({ error: 'At least one application entry is required.' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use AI Application Tracker.' });
    }

    const normalizedEntries = entries
      .map((entry) => ({
        company: String(entry?.company || '').trim(),
        role: String(entry?.role || '').trim(),
        stage: String(entry?.stage || '').trim() || 'Applied',
        appliedDate: String(entry?.appliedDate || '').trim(),
        notes: String(entry?.notes || '').trim(),
        jobLink: String(entry?.jobLink || '').trim()
      }))
      .filter((entry) => entry.company && entry.role)
      .slice(0, 50);

    if (!normalizedEntries.length) {
      return res.status(400).json({ error: 'Entries must include company and role.' });
    }

    const stageSummary = normalizedEntries.reduce((acc, entry) => {
      const stage = entry.stage.toLowerCase();
      if (stage.includes('offer')) acc.offer += 1;
      else if (stage.includes('interview') || stage.includes('phone') || stage.includes('final')) acc.interview += 1;
      else if (stage.includes('reject')) acc.rejected += 1;
      else acc.waiting += 1;
      return acc;
    }, { interview: 0, offer: 0, waiting: 0, rejected: 0 });

    const compactEntries = normalizedEntries
      .map((entry, idx) => `${idx + 1}. ${entry.company} | ${entry.role} | ${entry.stage}${entry.appliedDate ? ` | ${entry.appliedDate}` : ''}${entry.notes ? ` | ${entry.notes}` : ''}`)
      .join('\n');

    if (E2E_MOCK_MODE) {
      return res.json({
        report: [
          'AI Application Tracker Summary',
          '',
          `Active applications logged: ${normalizedEntries.length}`,
          `Interviews in motion: ${stageSummary.interview}`,
          `Offers pending or received: ${stageSummary.offer}`,
          `Waiting for response: ${stageSummary.waiting}`,
          `Closed or rejected: ${stageSummary.rejected}`,
          '',
          `Current focus: ${focus || 'Improve conversion from applied to interview.'}`,
          '',
          'Recommended next actions:',
          '- Prioritize follow-ups for applications older than 7 business days.',
          '- Prepare role-specific interview stories for your top active roles.',
          '- Increase tailored applications in the role family with the highest response rate.'
        ].join('\n')
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'You are an expert job search operations coach. Produce a concise, actionable tracker summary in plain text with headings and bullet points. Focus on pipeline health, bottlenecks, and concrete next steps for the next 7 days.'
        },
        {
          role: 'user',
          content: [
            `Current focus: ${focus || 'Not provided'}`,
            '',
            'Application entries:',
            compactEntries,
            '',
            `Stage summary: interviews=${stageSummary.interview}, offers=${stageSummary.offer}, waiting=${stageSummary.waiting}, rejected=${stageSummary.rejected}`,
            '',
            'Return sections in this order:',
            '1) AI Application Tracker Summary',
            '2) Pipeline Snapshot',
            '3) Bottlenecks',
            '4) Recommended Next Actions (numbered)',
            '5) One-week execution plan'
          ].join('\n')
        }
      ]
    });

    const report = String(completion.choices?.[0]?.message?.content || '').trim();
    if (!report) {
      return res.status(500).json({ error: 'Could not generate tracker summary.' });
    }

    return res.json({ report });
  } catch (err) {
    console.error('AI application tracker analyze error:', err);
    return res.status(500).json({ error: 'Failed to generate AI tracker summary.' });
  }
});

// ─── Interview Assist ────────────────────────────────────────────────────────
app.post('/api/interview-assist/transcribe', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Interview Assist.' });
    }

    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ error: 'Audio sample is required.' });
    }

    const mimeType = String(req.file.mimetype || 'audio/webm');
    const extension = path.extname(req.file.originalname || '') || '.webm';
    const prompt = 'Transcribe interview audio accurately. Prioritize recruiter questions and return plain text only.';

    async function transcribeWithModel(modelName) {
      const audioFile = new File([req.file.buffer], `interview-live${extension}`, { type: mimeType });
      return openai.audio.transcriptions.create({
        file: audioFile,
        model: modelName,
        prompt
      });
    }

    let transcription;
    try {
      transcription = await transcribeWithModel('gpt-4o-mini-transcribe');
    } catch (firstErr) {
      // Fallback for environments where the newer transcription model is unavailable.
      transcription = await transcribeWithModel('whisper-1');
    }

    const text = String(
      typeof transcription === 'string'
        ? transcription
        : transcription?.text || transcription?.data?.text || ''
    ).trim();

    return res.json({ text });
  } catch (err) {
    const status = Number(err?.status || err?.statusCode || 500);
    const rawMessage = String(
      err?.error?.message || err?.message || err?.error || 'Live transcription failed.'
    );
    const lowerMessage = rawMessage.toLowerCase();
    const recoverableChunkError =
      status === 400 ||
      status === 413 ||
      status === 415 ||
      status === 422 ||
      lowerMessage.includes('too short') ||
      lowerMessage.includes('no speech') ||
      lowerMessage.includes('silence') ||
      lowerMessage.includes('empty audio') ||
      lowerMessage.includes('invalid file format') ||
      lowerMessage.includes('unsupported audio');

    if (recoverableChunkError) {
      return res.json({ text: '' });
    }

    console.error('Interview assist transcription error:', err);
    return res.status(500).json({ error: rawMessage || 'Live transcription failed.' });
  }
});

app.post('/api/interview-assist', authenticateToken, async (req, res) => {
  try {
    const { question, role, resume, scenario, history, liveMode } = req.body || {};

    if (E2E_MOCK_MODE) {
      return res.json({
        type: 'behavioral',
        answer: 'I would answer this by briefly setting the context, explaining the action I took, and closing with the result so the interviewer gets a clear story fast.',
        bullets: ['Open with the core point first', 'Use a simple STAR flow', 'End with the measurable result'],
        tip: 'Pause first, then deliver the main point clearly.',
        coachPointers: ['Slow down to 80% speed.', 'Pause for one beat before key points.', 'Land one takeaway before details.'],
        freezeRescue: 'Give me one second. The key point is that I solved this by focusing on impact first.'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Interview Assist.' });
    }

    // If no question is provided, generate a first interview question based on role/scenario
    if (!question || !String(question).trim()) {
      // Use OpenAI to generate a first interview question
      const prompt = `You are an expert interviewer. Given the following role and scenario, generate a single realistic first interview question for a candidate. Only return the question, no preamble or explanation.

Role: ${role || 'N/A'}
Scenario: ${scenario || ''}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      });
      const firstQuestion = (completion.choices[0].message.content || '').trim();
      return res.json({
        firstQuestion
      });
    }

    const isLiveMode = Boolean(liveMode);

    const systemPrompt = `You are a live interview coach helping a candidate answer questions in real-time during an actual job interview.

Return ONLY a valid JSON object with this exact structure:
{
  "type": "behavioral|situational|general",
  "answer": "A strong, concise answer. If liveMode is true keep it under 110 words and easy to speak aloud. Behavioral: use STAR format. Situational: direct confident structure. General: clear and impactful.",
  "bullets": ["prompt or reminder 1", "prompt or reminder 2", "prompt or reminder 3"],
  "tip": "One short anti-freeze delivery reminder (max 15 words)",
  "coachPointers": ["delivery pointer 1", "delivery pointer 2", "delivery pointer 3"],
  "freezeRescue": "One line the user can say if they freeze"
}

Rules:
- If liveMode is true, answer must be under 110 words and sound natural out loud
- If liveMode is false, answer must be under 180 words
- Write in first person, naturally, confidently
- Behavioral questions (tell me about a time, describe a situation, give an example) → STAR format
- Situational / hypothetical → direct structured response
- The bullets should act like live prompts or reminders the user can glance at while answering
- coachPointers must include delivery cues, and at least one should mention pacing like "slow down"
- freezeRescue should be a short line the candidate can actually say to recover smoothly
- Help the user avoid freezing and keep the answer sharp, focused, and easy to speak aloud
- Return only valid JSON, no markdown fences`;

    const contextParts = [];
    if (role) contextParts.push(`Target role: ${role}`);
  if (scenario) contextParts.push(`Interview scenario:\n${String(scenario).slice(0, 1200)}`);
    if (resume) contextParts.push(`Candidate background:\n${String(resume).slice(0, 1200)}`);

    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-3).map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n');
      contextParts.push(`Prior questions in this interview session:\n${recent}`);
    }

    const userContent = contextParts.length
      ? `${contextParts.join('\n\n')}\n\nLive mode: ${isLiveMode ? 'true' : 'false'}\nInterview question: ${question}`
      : `Live mode: ${isLiveMode ? 'true' : 'false'}\nInterview question: ${question}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.5,
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
      tip: parsed.tip || '',
      coachPointers: Array.isArray(parsed.coachPointers) ? parsed.coachPointers.slice(0, 4) : [],
      freezeRescue: parsed.freezeRescue || ''
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

app.get('/api/in-demand-jobs', async (_req, res) => {
  try {
    const { payload, fromCache } = await getInDemandJobsPayload();
    return res.json({
      ...payload,
      cacheTtlMs: IN_DEMAND_JOBS_CACHE_MS,
      fromCache
    });
  } catch (error) {
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      industries: buildFallbackIndustryJobs(),
      cacheTtlMs: IN_DEMAND_JOBS_CACHE_MS,
      fromCache: false,
      fallback: true
    });
  }
});

app.post('/api/offer-negotiation-coach/analyze', upload.single('offerFile'), async (req, res) => {
  try {
    const uploadedText = req.file ? await extractTextFromUploadedFile(req.file) : '';
    const offerText = String(req.body.offerText || uploadedText || '').trim();
    const targetComp = String(req.body.targetComp || '').trim();
    const priorities = String(req.body.priorities || '').trim();

    if (!offerText) {
      return res.status(400).json({ error: 'Offer text or an offer file is required.' });
    }

    return res.json({
      report: buildOfferNegotiationReport({ offerText, targetComp, priorities }),
      extracted: {
        title: extractOfferRole(offerText),
        company: extractOfferCompany(offerText),
        location: extractLocation(offerText)
      }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to analyze offer.' });
  }
});

app.get('/api/jobs/scout', async (req, res) => {
  try {
    const title = String(req.query.title || 'software engineer').trim();
    const location = String(req.query.location || 'remote').trim();
    const preferences = String(req.query.preferences || '').trim();
    const limit = Math.max(1, Math.min(8, Number.parseInt(String(req.query.limit || '5'), 10) || 5));
    const { jobs } = await searchJobsFast({ title, location, resume: preferences });
    const topJobs = jobs.slice(0, limit);

    return res.json({
      query: { title, location, preferences },
      jobs: topJobs,
      report: buildJobScoutReport({ title, location, preferences, jobs: topJobs })
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to scout jobs.' });
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
    const { jobText, sourceUrl, additionalNotes } = req.body || {};
    const rawUrl = String(sourceUrl || '').trim();
    const pastedText = String(jobText || '').trim();
    const notesText = String(additionalNotes || '').trim();

    if (!rawUrl && !pastedText && !notesText) {
      return res.status(400).json({ error: 'Job URL or job text is required' });
    }

    let mergedText = [pastedText, notesText].filter(Boolean).join('\n\n').trim();

    if (rawUrl) {
      let validatedUrl;
      try {
        validatedUrl = new URL(rawUrl);
        if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(validatedUrl.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 RoleRocketAI/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          const extracted = String(html || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 12000);

          mergedText = [mergedText, extracted].filter(Boolean).join('\n\n').trim();
        } else if (!mergedText) {
          return res.status(400).json({ error: 'Could not fetch job details from the provided URL' });
        }
      } catch (fetchError) {
        if (!mergedText) {
          return res.status(400).json({ error: 'Could not fetch job details from the provided URL' });
        }
      }
    }

    if (!mergedText) {
      mergedText = rawUrl ? `Imported role from ${rawUrl}` : 'Imported role';
    }

    const job = await parseJobFromAnywhere(mergedText, rawUrl || '');
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

app.post('/api/ai-recruiter-assist/subscribe', authenticateToken, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Recruiter Assist subscribe') !== true) return;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { recruiterAssistSubscribed: true } },
      { new: true }
    ).select('recruiterAssistSubscribed');

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      success: true,
      recruiterAssistSubscribed: Boolean(user.recruiterAssistSubscribed)
    });
  } catch (err) {
    console.error('AI Recruiter Assist subscribe error:', err);
    return res.status(500).json({ error: 'Failed to subscribe to AI Recruiter Assist' });
  }
});

app.get('/api/jobs/tracker', authenticateToken, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.userId }).select('status').lean();
    const tracker = {
      saved: 0,
      ready: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0
    };

    for (const job of jobs) {
      const status = String(job.status || 'saved').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(tracker, status)) {
        tracker[status] += 1;
      }
    }

    return res.json(tracker);
  } catch (err) {
    console.error('Job tracker load error:', err);
    return res.status(500).json({ error: 'Failed to load job tracker' });
  }
});

app.get('/api/jobs/applied', authenticateToken, async (req, res) => {
  try {
    const jobs = await Job.find({
      userId: req.user.userId,
      status: { $in: ['applied', 'interview', 'offer', 'rejected'] }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ jobs });
  } catch (err) {
    console.error('Applied jobs load error:', err);
    return res.status(500).json({ error: 'Failed to load applied jobs' });
  }
});

app.get('/api/jobs/status-breakdown', authenticateToken, async (req, res) => {
  try {
    const statuses = ['saved', 'ready', 'applied', 'interview', 'offer', 'rejected'];
    const jobs = await Job.find({ userId: req.user.userId }).select('status').lean();
    const countsByStatus = new Map(statuses.map((status) => [status, 0]));

    for (const job of jobs) {
      const status = String(job.status || 'saved').toLowerCase();
      if (countsByStatus.has(status)) {
        countsByStatus.set(status, countsByStatus.get(status) + 1);
      }
    }

    return res.json({
      labels: statuses.map((status) => status.charAt(0).toUpperCase() + status.slice(1)),
      counts: statuses.map((status) => countsByStatus.get(status) || 0)
    });
  } catch (err) {
    console.error('Status breakdown error:', err);
    return res.status(500).json({ error: 'Failed to load status breakdown' });
  }
});

app.get('/api/jobs/activity', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const labels = [];
    const ranges = [];

    for (let i = 7; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setDate(now.getDate() - (i * 7));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      labels.push(`${start.getMonth() + 1}/${start.getDate()}`);
      ranges.push({ start, end });
    }

    const oldestStart = ranges[0].start;
    const jobs = await Job.find({
      userId: req.user.userId,
      createdAt: { $gte: oldestStart }
    })
      .select('createdAt')
      .lean();

    const counts = new Array(ranges.length).fill(0);
    for (const job of jobs) {
      const createdAt = new Date(job.createdAt);
      for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index];
        if (createdAt >= range.start && createdAt < range.end) {
          counts[index] += 1;
          break;
        }
      }
    }

    return res.json({ labels, counts });
  } catch (err) {
    console.error('Jobs activity error:', err);
    return res.status(500).json({ error: 'Failed to load jobs activity' });
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

app.get('/api/job-alerts/defaults', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return res.json({ defaults: normalizeJobAlertDefaults({}) });
    }

    const user = await User.findById(req.user.userId).select('jobAlertDefaults').lean();
    return res.json({ defaults: normalizeJobAlertDefaults(user?.jobAlertDefaults || {}) });
  } catch (err) {
    console.error('Job alert defaults load error:', err);
    return res.status(500).json({ error: 'Failed to load job alert defaults' });
  }
});

app.put('/api/job-alerts/defaults', authenticateToken, async (req, res) => {
  try {
    const defaults = normalizeJobAlertDefaults(req.body || {});
    await User.findByIdAndUpdate(req.user.userId, { $set: { jobAlertDefaults: defaults } });
    return res.json({ defaults });
  } catch (err) {
    console.error('Job alert defaults save error:', err);
    return res.status(500).json({ error: 'Failed to save job alert defaults' });
  }
});

app.get('/api/job-alerts/recommendations', authenticateToken, async (req, res) => {
  try {
    const latestResume = await Resume.findOne({ userId: req.user.userId }).sort({ createdAt: -1 }).lean();
    const resumeText = String(latestResume?.content || '').trim();
    return res.json({
      resumeAvailable: Boolean(resumeText),
      titles: recommendJobTitlesFromResume(resumeText)
    });
  } catch (err) {
    console.error('Job alert recommendations error:', err);
    return res.status(500).json({ error: 'Failed to load recommendations' });
  }
});

app.get('/api/job-alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = await JobAlert.find({ userId: req.user.userId }).sort({ updatedAt: -1 }).lean();
    return res.json({ alerts });
  } catch (err) {
    console.error('Job alerts load error:', err);
    return res.status(500).json({ error: 'Failed to load job alerts' });
  }
});

app.post('/api/job-alerts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('jobAlertDefaults').lean();
    const payload = sanitizeJobAlertPayload(req.body || {}, user?.jobAlertDefaults || {});

    if (!payload.titles.length) {
      return res.status(400).json({ error: 'At least one job title is required' });
    }

    const alert = await JobAlert.create({
      userId: req.user.userId,
      nextRunAt: payload.isPaused ? null : new Date(),
      ...payload
    });

    return res.json({ alert });
  } catch (err) {
    console.error('Job alert create error:', err);
    return res.status(500).json({ error: 'Failed to create job alert' });
  }
});

app.put('/api/job-alerts/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await JobAlert.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!existing) return res.status(404).json({ error: 'Job alert not found' });

    const user = await User.findById(req.user.userId).select('jobAlertDefaults').lean();
    const payload = sanitizeJobAlertPayload(req.body || {}, user?.jobAlertDefaults || {});

    if (!payload.titles.length) {
      return res.status(400).json({ error: 'At least one job title is required' });
    }

    Object.assign(existing, payload);
  existing.nextRunAt = payload.isPaused ? null : new Date();
    await existing.save();
    return res.json({ alert: existing });
  } catch (err) {
    console.error('Job alert update error:', err);
    return res.status(500).json({ error: 'Failed to update job alert' });
  }
});

app.post('/api/job-alerts/:id/run', authenticateToken, async (req, res) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!alert) return res.status(404).json({ error: 'Job alert not found' });

    await executeJobAlertRun(alert, { mode: 'manual' });

    return res.json({ alert });
  } catch (err) {
    console.error('Job alert run error:', err);
    return res.status(500).json({ error: 'Failed to run job alert' });
  }
});

app.post('/api/job-alerts/:id/email', authenticateToken, async (req, res) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!alert) return res.status(404).json({ error: 'Job alert not found' });

    const needsFreshResults = !Array.isArray(alert.latestResults) || !alert.latestResults.length || req.body?.refresh === true;
    if (needsFreshResults) {
      await executeJobAlertRun(alert, { mode: 'manual-email-refresh', sendEmail: false });
    }

    if (!Array.isArray(alert.latestResults) || !alert.latestResults.length) {
      return res.status(400).json({ error: 'No alert results available to email yet' });
    }

    const user = await User.findById(req.user.userId).select('email name').lean();
    if (!String(user?.email || '').trim()) {
      return res.status(400).json({ error: 'No email address is available for this account' });
    }

    queueJobAlertSummaryEmail({
      to: user.email,
      alert,
      results: alert.latestResults
    });
    alert.lastEmailedAt = new Date();
    await alert.save();

    return res.json({ alert, emailed: true });
  } catch (err) {
    console.error('Job alert email error:', err);
    return res.status(500).json({ error: 'Failed to email job alert results' });
  }
});

app.post('/api/job-alerts/:id/save-match', authenticateToken, async (req, res) => {
  try {
    const alert = await JobAlert.findOne({ _id: req.params.id, userId: req.user.userId }).lean();
    if (!alert) return res.status(404).json({ error: 'Job alert not found' });

    const bodyMatch = req.body?.match || null;
    const fingerprint = cleanAlertString(req.body?.fingerprint || bodyMatch?.fingerprint || '', 300);
    const match = (alert.latestResults || []).find((item) => item.fingerprint === fingerprint) || bodyMatch;

    if (!match || !match.title) {
      return res.status(400).json({ error: 'Selected match is missing' });
    }

    const existing = await Job.findOne({
      userId: req.user.userId,
      $or: [
        { link: String(match.link || '').trim() },
        {
          title: String(match.title || '').trim(),
          company: String(match.company || '').trim()
        }
      ]
    });

    if (existing) {
      return res.json({ job: existing, alreadySaved: true });
    }

    const job = await Job.create({
      userId: req.user.userId,
      title: cleanAlertString(match.title, 140),
      company: cleanAlertString(match.company, 100),
      location: cleanAlertString(match.location, 100),
      link: cleanAlertString(match.link, 500),
      description: cleanAlertString(match.description, 2000),
      matchScore: Number(match.matchScore || 0),
      status: 'saved',
      notes: `Saved from alert: ${cleanAlertString(alert.name, 120)}`
    });

    return res.json({ job, alreadySaved: false });
  } catch (err) {
    console.error('Job alert save match error:', err);
    return res.status(500).json({ error: 'Failed to save match to pipeline' });
  }
});

app.delete('/api/job-alerts/:id', authenticateToken, async (req, res) => {
  try {
    const alert = await JobAlert.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!alert) return res.status(404).json({ error: 'Job alert not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Job alert delete error:', err);
    return res.status(500).json({ error: 'Failed to delete job alert' });
  }
});

function normalizeAutopilotSettings(rawConfig) {
  const modeRaw = String(rawConfig?.mode || 'manual').toLowerCase();
  const mode = ['manual', 'one-tap', 'autopilot'].includes(modeRaw) ? modeRaw : 'manual';

  const maxDailyApplicationsRaw = Number(rawConfig?.maxDailyApplications);
  const maxDailyApplications = Number.isFinite(maxDailyApplicationsRaw)
    ? Math.min(Math.max(Math.round(maxDailyApplicationsRaw), 1), 25)
    : 5;

  const excludedCompanies = Array.isArray(rawConfig?.excludedCompanies)
    ? rawConfig.excludedCompanies
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30)
    : [];

  const topJobMatchThresholdRaw = Number(rawConfig?.topJobMatchThreshold);
  const topJobMatchThreshold = Number.isFinite(topJobMatchThresholdRaw)
    ? Math.min(Math.max(Math.round(topJobMatchThresholdRaw), 1), 100)
    : 85;

  return {
    mode,
    maxDailyApplications,
    excludedCompanies,
    requireApprovalForTopJobs: rawConfig?.requireApprovalForTopJobs !== false,
    topJobMatchThreshold
  };
}

function normalizeAutopilotUsage(rawUsage) {
  return Array.isArray(rawUsage)
    ? rawUsage
      .map((entry) => ({
        day: String(entry?.day || '').slice(0, 10),
        count: Number(entry?.count || 0)
      }))
      .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.day) && Number.isFinite(entry.count) && entry.count >= 0)
      .slice(-30)
    : [];
}

app.get('/api/apply/autopilot/settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan autopilotConfig autopilotUsage');
    if (!hasOneClickApplyAccess(user)) {
      return res.status(403).json({ error: 'Upgrade to a paid plan to use 1-Click Apply Autopilot.' });
    }

    const settings = normalizeAutopilotSettings(user?.autopilotConfig || {});
    const usage = normalizeAutopilotUsage(user?.autopilotUsage || []);
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = usage.find((entry) => entry.day === today)?.count || 0;

    return res.json({
      settings,
      usage: {
        today,
        todayCount,
        remainingToday: Math.max(0, settings.maxDailyApplications - todayCount)
      }
    });
  } catch (err) {
    console.error('Autopilot settings load error:', err);
    return res.status(500).json({ error: 'Failed to load autopilot settings.' });
  }
});

app.put('/api/apply/autopilot/settings', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan autopilotConfig');
    if (!hasOneClickApplyAccess(user)) {
      return res.status(403).json({ error: 'Upgrade to a paid plan to use 1-Click Apply Autopilot.' });
    }

    const settings = normalizeAutopilotSettings(req.body || {});
    user.autopilotConfig = settings;
    await user.save();

    return res.json({ settings });
  } catch (err) {
    console.error('Autopilot settings save error:', err);
    return res.status(500).json({ error: 'Failed to save autopilot settings.' });
  }
});

app.post('/api/apply/autopilot/run', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan autopilotConfig autopilotUsage');
    if (!hasOneClickApplyAccess(user)) {
      return res.status(403).json({ error: 'Upgrade to a paid plan to use 1-Click Apply Autopilot.' });
    }

    const savedSettings = normalizeAutopilotSettings(user?.autopilotConfig || {});
    const requestedMode = String(req.body?.mode || '').toLowerCase();
    const runMode = ['manual', 'one-tap', 'autopilot'].includes(requestedMode) ? requestedMode : savedSettings.mode;
    const confirmed = req.body?.confirmed === true;

    const jobs = await Job.find({
      userId: req.user.userId,
      status: 'ready'
    }).sort({ matchScore: -1, createdAt: -1 });

    const eligibleJobs = jobs.filter((job) => {
      const link = String(job.link || '').trim();
      if (!/^https?:\/\//i.test(link)) return false;
      const company = String(job.company || '').trim().toLowerCase();
      if (!company) return true;
      return !savedSettings.excludedCompanies.some((blocked) => company.includes(blocked));
    });

    const today = new Date().toISOString().slice(0, 10);
    const usage = normalizeAutopilotUsage(user?.autopilotUsage || []);
    const todayUsage = usage.find((entry) => entry.day === today);
    const alreadyAppliedToday = todayUsage?.count || 0;
    const remainingToday = Math.max(0, savedSettings.maxDailyApplications - alreadyAppliedToday);

    const candidateJobs = eligibleJobs.slice(0, remainingToday);
    const needsApproval = savedSettings.requireApprovalForTopJobs
      ? candidateJobs.filter((job) => Number(job.matchScore || 0) >= savedSettings.topJobMatchThreshold)
      : [];
    const needsApprovalIds = new Set(needsApproval.map((job) => String(job._id)));

    const autoEligibleJobs = candidateJobs.filter((job) => !needsApprovalIds.has(String(job._id)));

    if (runMode === 'manual') {
      return res.json({
        mode: runMode,
        settings: savedSettings,
        previewJobs: candidateJobs.map((job) => ({
          id: String(job._id),
          title: job.title,
          company: job.company,
          link: job.link,
          matchScore: Number(job.matchScore || 0)
        })),
        approvalRequiredJobs: needsApproval.map((job) => ({
          id: String(job._id),
          title: job.title,
          company: job.company,
          link: job.link,
          matchScore: Number(job.matchScore || 0)
        })),
        appliedCount: 0,
        alreadyAppliedToday,
        remainingToday
      });
    }

    if (runMode === 'one-tap' && !confirmed) {
      return res.json({
        mode: runMode,
        requiresConfirmation: true,
        settings: savedSettings,
        previewJobs: candidateJobs.map((job) => ({
          id: String(job._id),
          title: job.title,
          company: job.company,
          link: job.link,
          matchScore: Number(job.matchScore || 0)
        })),
        approvalRequiredJobs: needsApproval.map((job) => ({
          id: String(job._id),
          title: job.title,
          company: job.company,
          link: job.link,
          matchScore: Number(job.matchScore || 0)
        })),
        appliedCount: 0,
        alreadyAppliedToday,
        remainingToday
      });
    }

    const appliedJobs = runMode === 'one-tap'
      ? candidateJobs
      : autoEligibleJobs;

    if (appliedJobs.length) {
      await Job.updateMany(
        {
          _id: { $in: appliedJobs.map((job) => job._id) },
          userId: req.user.userId
        },
        { $set: { status: 'applied' } }
      );
    }

    const appliedCount = appliedJobs.length;
    const updatedUsage = usage.filter((entry) => entry.day !== today);
    updatedUsage.push({ day: today, count: alreadyAppliedToday + appliedCount });
    user.autopilotUsage = updatedUsage.slice(-30);
    await user.save();

    return res.json({
      mode: runMode,
      settings: savedSettings,
      jobsToOpen: appliedJobs.map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        link: job.link,
        matchScore: Number(job.matchScore || 0)
      })),
      approvalRequiredJobs: needsApproval.map((job) => ({
        id: String(job._id),
        title: job.title,
        company: job.company,
        link: job.link,
        matchScore: Number(job.matchScore || 0)
      })),
      appliedCount,
      alreadyAppliedToday,
      remainingToday: Math.max(0, savedSettings.maxDailyApplications - (alreadyAppliedToday + appliedCount))
    });
  } catch (err) {
    console.error('Autopilot run error:', err);
    return res.status(500).json({ error: 'Failed to run autopilot apply flow.' });
  }
});

app.post('/api/apply/one-click', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!hasOneClickApplyAccess(user)) {
      return res.status(403).json({ error: 'Upgrade to a paid plan to use 1-Click Apply.' });
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
    startJobAlertScheduler();
    setTimeout(() => {
      prewarmJobSearches().catch((err) => {
        console.warn('Job prewarm failed:', err.message);
      });
    }, 500);
    console.log('DEBUG: app.listen callback completed');
  });
}

console.log('DEBUG: server bootstrap complete');

module.exports = app;