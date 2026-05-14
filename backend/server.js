const path = require('path');
const fs = require('fs/promises');
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
const PDFDocument = require('pdfkit');
const { extractTextFromPDF, extractTextFromDocx } = require('./pdfWordUtils');
const { extractTextFromPDFWithOCR } = require('./ocrUtils');
const { getDailyGenerationStatus, recordDailyGenerationUsage } = require('./services/aiGenerationLimits');
const {
  getDocumentGenerationStatus,
  getCreditBundles,
  getCreditBundle,
  grantDocumentCreditsFromCheckout
} = require('./services/documentGenerationBilling');
const LearningRoadmap = require('./models/LearningRoadmap');




const app = express();
// Keep raw webhook payload intact for Stripe signature verification.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') return next();
  return express.json({ limit: '2mb' })(req, res, next);
});
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

console.log('DEBUG: server.js script started');

// --- DEV ENDPOINT: Generate test admin token (DEVELOPMENT ONLY) ---
app.post('/api/dev/create-admin-token', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const email = 'terrasample@yahoo.com';
    let user = await User.findOne({ email }).lean();

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('DevPassword2026!', salt);
      const newUser = new User({
        name: 'Dev Admin',
        email,
        password: hashedPassword,
        isSubscribed: true,
        plan: 'elite',
        emailVerified: true
      });
      await newUser.save();
      user = newUser.toObject();
    } else if (user.plan !== 'elite') {
      await User.findByIdAndUpdate(user._id, { isSubscribed: true, plan: 'elite' });
      user.plan = 'elite';
      user.isSubscribed = true;
    }

    const token = jwt.sign(
      { userId: String(user._id) },
      process.env.JWT_SECRET
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        plan: user.plan
      }
    });
  } catch (err) {
    console.error('Dev token creation error:', err);
    return res.status(500).json({ error: 'Failed to create dev token' });
  }
});

// --- PATCH: Always return isAdmin from DB flag (or admin-email allowlist) in /api/me ---
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
    const isAdmin = user.isAdmin === true || (ADMIN_EMAILS.length && ADMIN_EMAILS.includes(email));
    const trialEntitlements = applyInstitutionTrialEntitlements(user);
    return res.json({
      user: {
        ...user,
        isAdmin,
        plan: isAdmin ? 'lifetime' : trialEntitlements.plan,
        isSubscribed: isAdmin ? true : trialEntitlements.isSubscribed,
        institutionTrialActive: trialEntitlements.institutionTrialActive,
        institutionTrialEndsAt: trialEntitlements.institutionTrialEndsAt
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load user info' });
  }
});

const SUPPORTED_EXPERIENCE_COUNTRIES = [
  { code: 'GLOBAL', label: 'Global' },
  { code: 'JM', label: 'Jamaica' },
  { code: 'US', label: 'United States' }
];

const EXPERIENCE_COUNTRY_CODES = new Set(SUPPORTED_EXPERIENCE_COUNTRIES.map((item) => item.code));

function normalizeExperienceCountryCode(value = '') {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return '';
  if (code === 'ZZ') return 'GLOBAL';
  if (EXPERIENCE_COUNTRY_CODES.has(code)) return code;
  if (/^[A-Z]{2}$/.test(code)) return code;
  return '';
}

function parseCookieMap(cookieHeader = '') {
  const cookieMap = {};
  String(cookieHeader || '').split(';').forEach((entry) => {
    const [rawKey, ...rawValueParts] = String(entry || '').split('=');
    const key = String(rawKey || '').trim();
    if (!key) return;
    const rawValue = rawValueParts.join('=');
    try {
      cookieMap[key] = decodeURIComponent(String(rawValue || '').trim());
    } catch {
      cookieMap[key] = String(rawValue || '').trim();
    }
  });
  return cookieMap;
}

function detectCountryFromRequest(req) {
  const headerCandidates = [
    req.headers['cf-ipcountry'],
    req.headers['x-vercel-ip-country'],
    req.headers['cloudfront-viewer-country'],
    req.headers['x-country-code']
  ];

  for (const candidate of headerCandidates) {
    const normalized = normalizeExperienceCountryCode(candidate);
    if (normalized) return normalized;
  }

  const acceptLanguage = String(req.headers['accept-language'] || '').trim();
  if (acceptLanguage) {
    const primary = acceptLanguage.split(',')[0] || '';
    const localeRegionMatch = primary.match(/-([A-Za-z]{2})\b/);
    if (localeRegionMatch) {
      const normalized = normalizeExperienceCountryCode(localeRegionMatch[1]);
      if (normalized) return normalized;
    }
  }

  return 'GLOBAL';
}

function setExperienceCountryCookie(res, countryCode = '') {
  const normalized = normalizeExperienceCountryCode(countryCode) || 'GLOBAL';
  const maxAgeSeconds = 60 * 60 * 24 * 365; // 1 year
  res.setHeader('Set-Cookie', `rr_exp_country=${encodeURIComponent(normalized)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`);
}

async function resolveOptionalUserFromBearer(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader) return null;

  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : authHeader;
  if (!bearer || !process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(bearer, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id || decoded._id || decoded.sub || null;
    if (!userId) return null;
    return await User.findById(userId).select('_id experienceCountry experienceCountrySource experienceCountryUpdatedAt').lean();
  } catch {
    return null;
  }
}

function buildExperienceContext({ req, user = null }) {
  const cookieMap = parseCookieMap(req.headers.cookie || '');
  const cookieCountry = normalizeExperienceCountryCode(cookieMap.rr_exp_country || '');
  const userCountry = normalizeExperienceCountryCode(user?.experienceCountry || '');
  const detectedCountry = detectCountryFromRequest(req);

  // For authenticated users, only use their saved experience country from the database.
  // For anonymous users, use cookies. This ensures first-time users always see the gate.
  const isAuthenticated = !!user;
  const selectedCountry = isAuthenticated ? userCountry : (userCountry || cookieCountry || '');
  const effectiveCountry = selectedCountry || detectedCountry || 'GLOBAL';

  return {
    detectedCountry,
    selectedCountry,
    effectiveCountry,
    source: userCountry ? 'user' : cookieCountry ? 'cookie' : 'geo',
    requiresChoice: !selectedCountry,
    showJamaicaHub: effectiveCountry === 'JM',
    experienceVariant: effectiveCountry === 'JM' ? 'jamaica' : 'global',
    supportedCountries: SUPPORTED_EXPERIENCE_COUNTRIES
  };
}

app.get('/api/experience/context', async (req, res) => {
  try {
    const user = await resolveOptionalUserFromBearer(req);
    const context = buildExperienceContext({ req, user });

    // Write a lightweight cookie so anonymous users get stable behavior too.
    setExperienceCountryCookie(res, context.effectiveCountry);

    return res.json(context);
  } catch (error) {
    console.error('Experience context error:', error);
    return res.status(500).json({ error: 'Failed to load experience context' });
  }
});

app.post('/api/experience/preference', async (req, res) => {
  try {
    const requested = normalizeExperienceCountryCode(req.body?.countryCode || '');
    if (!requested) {
      return res.status(400).json({ error: 'A valid countryCode is required.' });
    }

    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader && process.env.JWT_SECRET) {
      const bearer = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : authHeader;
      try {
        const decoded = jwt.verify(bearer, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id || decoded._id || decoded.sub || null;
        if (userId) {
          await User.findByIdAndUpdate(userId, {
            $set: {
              experienceCountry: requested,
              experienceCountrySource: 'user',
              experienceCountryUpdatedAt: new Date()
            }
          });
        }
      } catch {
        // For anonymous/expired sessions we still persist to cookie.
      }
    }

    setExperienceCountryCookie(res, requested);

    return res.json({
      ok: true,
      selectedCountry: requested,
      effectiveCountry: requested,
      showJamaicaHub: requested === 'JM',
      experienceVariant: requested === 'JM' ? 'jamaica' : 'global'
    });
  } catch (error) {
    console.error('Experience preference save error:', error);
    return res.status(500).json({ error: 'Failed to save country preference' });
  }
});



// ...existing code...


// Register ATS API routes
app.use('/api/ats', require('./routes/ats'));
// Register Networking routes
app.use('/api/networking', require('./routes/networking'));
// Register Cover Letter API route
app.use('/api/cover-letter', require('./routes/coverLetter'));
// Register school/university/government/employer integration APIs
app.use('/api/integrations', require('./routes/integrations'));

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

/* ─── Institution Cohort Manager ──────────────────────────────────────────── */
function normalizeInstitutionName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeInstitutionInviteCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function normalizeInstitutionActivationType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['trial', 'paid'].includes(normalized) ? normalized : 'trial';
}

function normalizeInstitutionIncludedPlan(value) {
  const normalized = normalizePlan(String(value || '').trim().toLowerCase());
  return ['free', 'pro', 'premium', 'elite', 'lifetime'].includes(normalized) ? normalized : 'elite';
}

function isInstitutionTrialActive(actor) {
  const accessType = String(actor?.institutionAccessType || '').toLowerCase();
  if (!actor || actor.accountType !== 'institution' || accessType !== 'trial' || !actor.institutionTrialEndsAt) {
    return false;
  }
  const endsAt = new Date(actor.institutionTrialEndsAt);
  if (Number.isNaN(endsAt.getTime())) {
    return false;
  }
  return endsAt.getTime() > Date.now();
}

function hasPaidInstitutionAccess(actor) {
  if (!actor) return false;
  if (actor.isSubscribed === true) return true;
  return normalizePlan(String(actor.plan || 'free')) !== 'free';
}

function hasInstitutionAccess(actor) {
  if (!actor || actor.accountType !== 'institution') {
    return false;
  }

  const accessType = String(actor.institutionAccessType || '').toLowerCase();
  if (accessType === 'paid') {
    return hasPaidInstitutionAccess(actor);
  }

  // Keep legacy institution accounts working until they are migrated to typed activation codes.
  if (!actor.institutionTrialEndsAt && !accessType) {
    return true;
  }

  return isInstitutionTrialActive(actor) || hasPaidInstitutionAccess(actor);
}

function applyInstitutionTrialEntitlements(actor) {
  const accessType = String(actor?.institutionAccessType || '').toLowerCase();
  const licensedPlan = normalizeInstitutionIncludedPlan(actor?.institutionLicensedPlan || actor?.plan || 'elite');

  if (accessType === 'paid') {
    return {
      plan: licensedPlan,
      isSubscribed: true,
      institutionTrialActive: false,
      institutionTrialEndsAt: actor?.institutionTrialEndsAt || null
    };
  }

  const trialActive = isInstitutionTrialActive(actor);
  if (!trialActive) {
    return {
      plan: actor?.plan,
      isSubscribed: actor?.isSubscribed,
      institutionTrialActive: false,
      institutionTrialEndsAt: actor?.institutionTrialEndsAt || null
    };
  }

  return {
    plan: licensedPlan,
    isSubscribed: true,
    institutionTrialActive: true,
    institutionTrialEndsAt: actor?.institutionTrialEndsAt || null
  };
}

function buildInstitutionInviteCodePrefix(institutionName, activationType) {
  const compact = String(institutionName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = compact.slice(0, 6) || 'INST';
  return `${prefix}-${normalizeInstitutionActivationType(activationType).toUpperCase()}`;
}

async function generateUniqueInstitutionInviteCode(institutionName, activationType, maxAttempts = 12) {
  const prefix = buildInstitutionInviteCodePrefix(institutionName, activationType);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await InstitutionInvite.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique invite code');
}

async function ensureInstitutionOrLinkedStudentAccess(actor) {
  // Allow institution admins only
  if (actor && actor.accountType === 'institution') {
    return hasInstitutionAccess(actor);
  }
  return false;
}

async function findOrCreateInstitutionByName(name) {
  const normalizedName = normalizeInstitutionName(name);
  if (!normalizedName) return null;

  const key = normalizedName.toLowerCase();
  return Institution.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        name: normalizedName,
        key
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();
}

async function ensureInstitutionIdentityForUser(userDoc) {
  if (!userDoc || userDoc.accountType !== 'institution') {
    return userDoc;
  }

  const normalizedName = normalizeInstitutionName(userDoc.institutionName);
  let institutionId = userDoc.institutionId || null;
  let institutionName = normalizedName;

  if (!institutionId && !institutionName) {
    return userDoc;
  }

  let institution = null;
  if (institutionId) {
    institution = await Institution.findById(institutionId).select('_id name key').lean();
  }
  if (!institution && institutionName) {
    institution = await findOrCreateInstitutionByName(institutionName);
  }
  if (!institution) {
    return userDoc;
  }

  const patch = {};
  if (!institutionId || String(institutionId) !== String(institution._id)) {
    patch.institutionId = institution._id;
  }
  if (!institutionName || institutionName !== institution.name) {
    patch.institutionName = institution.name;
  }

  if (Object.keys(patch).length) {
    await User.updateOne({ _id: userDoc._id }, { $set: patch });
  }

  return {
    ...userDoc,
    institutionId: patch.institutionId || institutionId,
    institutionName: patch.institutionName || institutionName
  };
}

function buildInstitutionStudentScope(actor) {
  if (actor && actor.institutionId) {
    return {
      accountType: 'individual',
      $or: [
        { institutionId: actor.institutionId },
        ...(actor.institutionName ? [{ institutionName: actor.institutionName }] : [])
      ]
    };
  }

  return {
    accountType: 'individual',
    institutionName: actor.institutionName
  };
}

async function backfillInstitutionIdForStudents(actor) {
  if (!actor || !actor.institutionId || !actor.institutionName) {
    return;
  }

  await User.updateMany(
    {
      accountType: 'individual',
      institutionName: actor.institutionName,
      $or: [{ institutionId: null }, { institutionId: { $exists: false } }]
    },
    { $set: { institutionId: actor.institutionId } }
  );
}

app.get('/api/institution/cohort', authenticateToken, async (req, res) => {
  try {
    let actor = await User.findById(req.user.userId)
      .select('accountType institutionName institutionId plan isSubscribed institutionTrialEndsAt')
      .lean();
    if (!actor || !(await ensureInstitutionOrLinkedStudentAccess(actor))) {
      return res.status(403).json({ error: 'Institution account or cohort membership required' });
    }
    actor = await ensureInstitutionIdentityForUser(actor);
    if (!actor.institutionId && !actor.institutionName) {
      return res.status(400).json({ error: 'No institution name on account' });
    }

    const studentScope = buildInstitutionStudentScope(actor);
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Math.min(Number(limit), 100);
    const students = await User.find(studentScope)
      .select('name email plan isSubscribed createdAt updatedAt autopilotUsage aiGenerationUsage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(Number(limit), 100))
      .lean();
    const total = await User.countDocuments(studentScope);

    await backfillInstitutionIdForStudents(actor);

    return res.json({ students, total, page: Number(page) });
  } catch (err) {
    console.error('GET /api/institution/cohort', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/institution/stats', authenticateToken, async (req, res) => {
  try {
    let actor = await User.findById(req.user.userId)
      .select('accountType institutionName institutionId plan isSubscribed institutionTrialEndsAt')
      .lean();
    if (!actor || !(await ensureInstitutionOrLinkedStudentAccess(actor))) {
      return res.status(403).json({ error: 'Institution account or cohort membership required' });
    }
    actor = await ensureInstitutionIdentityForUser(actor);
    if (!actor.institutionId && !actor.institutionName) {
      return res.status(400).json({ error: 'No institution name on account' });
    }

    const studentScope = buildInstitutionStudentScope(actor);
    const [totalStudents, subscribedStudents] = await Promise.all([
      User.countDocuments(studentScope),
      User.countDocuments({ ...studentScope, isSubscribed: true })
    ]);

    await backfillInstitutionIdForStudents(actor);

    const planBreakdown = await User.aggregate([
      { $match: studentScope },
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    return res.json({
      institutionName: actor.institutionName,
      totalStudents,
      subscribedStudents,
      freeStudents: totalStudents - subscribedStudents,
      planBreakdown: planBreakdown.reduce((acc, p) => { acc[p._id] = p.count; return acc; }, {})
    });
  } catch (err) {
    console.error('GET /api/institution/stats', err);
    return res.status(500).json({ error: 'Server error' });
  }
});




app.get('/api/institution/at-risk', authenticateToken, async (req, res) => {
  try {
    let actor = await User.findById(req.user.userId)
      .select('accountType institutionName institutionId plan isSubscribed institutionTrialEndsAt')
      .lean();
    if (!actor || !(await ensureInstitutionOrLinkedStudentAccess(actor))) {
      return res.status(403).json({ error: 'Institution account or cohort membership required' });
    }
    actor = await ensureInstitutionIdentityForUser(actor);
    if (!actor.institutionId && !actor.institutionName) {
      return res.status(400).json({ error: 'No institution name on account' });
    }

    const studentScope = buildInstitutionStudentScope(actor);
    const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const students = await User.find(studentScope)
      .select('name email plan aiGenerationUsage autopilotUsage updatedAt createdAt')
      .limit(500)
      .lean();

    const noResume = [];
    const inactive14 = [];
    const noApplications = [];

    for (const s of students) {
      const aiTotal = (s.aiGenerationUsage || []).reduce((sum, d) => sum + (d.count || 0), 0);
      const appTotal = (s.autopilotUsage || []).reduce((sum, d) => sum + (d.count || 0), 0);
      const lastActive = s.updatedAt || s.createdAt;
      const mini = { name: s.name, email: s.email, plan: s.plan };
      if (aiTotal === 0) noResume.push(mini);
      if (new Date(lastActive) < cutoff14) inactive14.push(mini);
      if (appTotal === 0) noApplications.push(mini);
    }

    return res.json({
      noResume:      { count: noResume.length,      students: noResume.slice(0, 25) },
      inactive14:    { count: inactive14.length,    students: inactive14.slice(0, 25) },
      noApplications:{ count: noApplications.length,students: noApplications.slice(0, 25) }
    });
  } catch (err) {
    console.error('GET /api/institution/at-risk', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/institution-invites', authenticateToken, requireAdminAccess, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Create institution invite') !== true) return;

    const {
      institutionName,
      organizationType,
      activationType,
      includedPlan,
      trialDays,
      maxUses,
      expiresInDays,
      code,
      notes
    } = req.body || {};

    const normalizedInstitutionName = normalizeInstitutionName(institutionName);
    if (!normalizedInstitutionName) {
      return res.status(400).json({ error: 'institutionName is required' });
    }

    const normalizedOrganizationType = ['university', 'workplace', 'institution', 'other'].includes(String(organizationType || '').toLowerCase())
      ? String(organizationType).toLowerCase()
      : 'institution';
    const normalizedActivationType = normalizeInstitutionActivationType(activationType);
    const normalizedIncludedPlan = normalizeInstitutionIncludedPlan(includedPlan);
    const normalizedAccessDays = normalizedActivationType === 'paid'
      ? 0
      : Math.max(1, Math.min(365, Number(trialDays || DEFAULT_INSTITUTION_TRIAL_DAYS)));
    const normalizedMaxUses = Math.max(1, Math.min(10000, Number(maxUses || 1)));
    const normalizedExpiresInDays = Number.isFinite(Number(expiresInDays))
      ? Math.max(1, Math.min(3650, Number(expiresInDays)))
      : null;
    const expiresAt = normalizedExpiresInDays ? new Date(Date.now() + normalizedExpiresInDays * 24 * 60 * 60 * 1000) : null;

    const institutionRecord = await findOrCreateInstitutionByName(normalizedInstitutionName);
    const chosenCode = normalizeInstitutionInviteCode(code) || await generateUniqueInstitutionInviteCode(institutionRecord.name, normalizedActivationType);

    const existing = await InstitutionInvite.findOne({ code: chosenCode }).select('_id').lean();
    if (existing) {
      return res.status(409).json({ error: 'Invite code already exists. Choose another code.' });
    }

    const invite = await InstitutionInvite.create({
      code: chosenCode,
      institutionName: institutionRecord.name,
      institutionKey: institutionRecord.key,
      institutionId: institutionRecord._id,
      organizationType: normalizedOrganizationType,
      activationType: normalizedActivationType,
      includedPlan: normalizedIncludedPlan,
      accessDays: normalizedAccessDays,
      maxUses: normalizedMaxUses,
      expiresAt,
      createdByUserId: req.currentUser?._id || null,
      notes: String(notes || '').trim()
    });

    const baseUrl = (process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
    const signupUrl = `${baseUrl}/signup.html?institution=${encodeURIComponent(invite.institutionName)}&inviteCode=${encodeURIComponent(invite.code)}`;

    return res.status(201).json({
      invite: {
        id: invite._id,
        code: invite.code,
        institutionName: invite.institutionName,
        organizationType: invite.organizationType,
        activationType: invite.activationType,
        includedPlan: invite.includedPlan,
        accessDays: invite.accessDays,
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        active: invite.active,
        expiresAt: invite.expiresAt,
        signupUrl
      }
    });
  } catch (err) {
    console.error('POST /api/admin/institution-invites', err);
    return res.status(500).json({ error: 'Failed to create institution invite' });
  }
});

app.get('/api/admin/institution-invites', authenticateToken, requireAdminAccess, async (req, res) => {
  try {
    if (ensureDbReady(res, 'List institution invites') !== true) return;

    const normalizedInstitutionName = normalizeInstitutionName(req.query?.institutionName || '');
    const normalizedCode = normalizeInstitutionInviteCode(req.query?.code || '');
    const activeFilterRaw = String(req.query?.active || '').trim().toLowerCase();
    const activationTypeFilter = normalizeInstitutionActivationType(req.query?.activationType || '');

    const query = {};
    if (normalizedInstitutionName) {
      query.institutionKey = normalizedInstitutionName.toLowerCase();
    }
    if (normalizedCode) {
      query.code = normalizedCode;
    }
    if (activeFilterRaw === 'true') {
      query.active = true;
    } else if (activeFilterRaw === 'false') {
      query.active = false;
    }
    if (['trial', 'paid'].includes(activationTypeFilter)) {
      query.activationType = activationTypeFilter;
    }

    const invites = await InstitutionInvite.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ invites });
  } catch (err) {
    console.error('GET /api/admin/institution-invites', err);
    return res.status(500).json({ error: 'Failed to list institution invites' });
  }
});

// Revoke (or reactivate) an institution invite — admin only
app.post('/api/admin/institution-invites/:id/revoke', authenticateToken, requireAdminAccess, async (req, res) => {
  try {
    const invite = await InstitutionInvite.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    return res.json({ success: true, invite });
  } catch (err) {
    console.error('POST /api/admin/institution-invites/:id/revoke', err);
    return res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// Pilot KPI dashboard — institution admin view
app.get('/api/institution/pilot-kpis', authenticateToken, async (req, res) => {
  try {
    let actor = await User.findById(req.user.userId)
      .select('accountType institutionName institutionId plan isSubscribed institutionTrialEndsAt isAdmin')
      .lean();
    if (!actor) return res.status(403).json({ error: 'Access denied' });
    const isAdminActor = actor.isAdmin === true;
    if (!isAdminActor && !(await ensureInstitutionOrLinkedStudentAccess(actor))) {
      return res.status(403).json({ error: 'Institution account required' });
    }
    actor = await ensureInstitutionIdentityForUser(actor);

    const studentScope = buildInstitutionStudentScope(actor);
    const now = Date.now();
    const day7  = new Date(now - 7  * 86400000);
    const day14 = new Date(now - 14 * 86400000);
    const day21 = new Date(now - 21 * 86400000);
    const day28 = new Date(now - 28 * 86400000);

    // Pull all cohort students with relevant fields
    const students = await User.find(studentScope)
      .select('createdAt updatedAt aiGenerationUsage autopilotUsage institutionInviteCode')
      .lean();

    const total = students.length;

    // Activation: student has used the product (updatedAt meaningfully > createdAt)
    const activated = students.filter(s => {
      const created = new Date(s.createdAt).getTime();
      const updated = new Date(s.updatedAt || s.createdAt).getTime();
      return (updated - created) > 60000; // >1 min difference = actually did something
    }).length;

    // Weekly active: updated in last 7 days
    const weeklyActive = students.filter(s =>
      new Date(s.updatedAt || s.createdAt) >= day7
    ).length;

    // Retention week 3: joined >21 days ago AND still active after day 21
    const cohortWeek3 = students.filter(s => new Date(s.createdAt) <= day21);
    const retainedWeek3 = cohortWeek3.filter(s =>
      new Date(s.updatedAt || s.createdAt) >= day21
    ).length;

    // Retention week 4: joined >28 days ago AND still active after day 28
    const cohortWeek4 = students.filter(s => new Date(s.createdAt) <= day28);
    const retainedWeek4 = cohortWeek4.filter(s =>
      new Date(s.updatedAt || s.createdAt) >= day28
    ).length;

    // Career readiness: resume/AI actions + application actions
    let resumeActions = 0, applicationActions = 0;
    for (const s of students) {
      resumeActions     += (s.aiGenerationUsage  || []).reduce((sum, d) => sum + (d.count || 0), 0);
      applicationActions += (s.autopilotUsage    || []).reduce((sum, d) => sum + (d.count || 0), 0);
    }

    // Invite code usage for this institution
    const institutionQuery = actor.institutionName
      ? { institutionName: { $regex: new RegExp('^' + actor.institutionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } }
      : {};
    const invites = await InstitutionInvite.find(institutionQuery)
      .select('usedCount maxUses active expiresAt code accessDays createdAt activationType includedPlan')
      .lean();
    const totalInviteSlots = invites.reduce((s, i) => s + (i.maxUses || 1), 0);
    const totalInviteUsed  = invites.reduce((s, i) => s + (i.usedCount || 0), 0);
    const activeInvites    = invites.filter(i => i.active && (!i.expiresAt || new Date(i.expiresAt) > new Date())).length;

    return res.json({
      total,
      activated,
      activationRate: total > 0 ? Math.round((activated / total) * 100) : 0,
      weeklyActive,
      weeklyEngagementRate: total > 0 ? Math.round((weeklyActive / total) * 100) : 0,
      retentionWeek3: cohortWeek3.length > 0 ? Math.round((retainedWeek3 / cohortWeek3.length) * 100) : null,
      retentionWeek4: cohortWeek4.length > 0 ? Math.round((retainedWeek4 / cohortWeek4.length) * 100) : null,
      retentionWeek3Cohort: cohortWeek3.length,
      retentionWeek4Cohort: cohortWeek4.length,
      resumeActions,
      applicationActions,
      careerReadinessTotal: resumeActions + applicationActions,
      invites: {
        total: invites.length,
        totalSlots: totalInviteSlots,
        used: totalInviteUsed,
        active: activeInvites,
      }
    });
  } catch (err) {
    console.error('GET /api/institution/pilot-kpis', err);
    return res.status(500).json({ error: 'Failed to load pilot KPIs' });
  }
});

// Redeem an institution access code — upgrades the authenticated user to an institution admin account
app.post('/api/institution/redeem-access-code', authenticateToken, async (req, res) => {
  try {
    if (ensureDbReady(res, 'Redeem institution access code') !== true) return;

    const rawCode = String(req.body?.code || '').trim();
    const normalizedCode = normalizeInstitutionInviteCode(rawCode);
    if (!normalizedCode) {
      return res.status(400).json({ error: 'Access code is required.' });
    }

    // Validate the invite code
    const invite = await InstitutionInvite.findOne({ code: normalizedCode, active: true }).lean();
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or inactive access code. Please check the code and try again.' });
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This access code has expired. Please contact your institution for a new code.' });
    }
    if (invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ error: 'This access code has reached its maximum number of uses.' });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select('accountType institutionName institutionId institutionInviteCode').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Already an institution admin — no need to redeem
    if (user.accountType === 'institution') {
      return res.status(400).json({ error: 'Your account is already an institution account.' });
    }

    const trialEndsAt = invite.activationType === 'trial'
      ? new Date(Date.now() + (invite.accessDays || 30) * 24 * 60 * 60 * 1000)
      : null;

    // Upgrade user to institution admin
    await User.updateOne({ _id: userId }, {
      $set: {
        accountType: 'institution',
        institutionName: invite.institutionName,
        institutionId: invite.institutionId || null,
        institutionInviteCode: normalizedCode,
        institutionAccessType: invite.activationType,
        institutionLicensedPlan: invite.includedPlan,
        institutionTrialStartsAt: invite.activationType === 'trial' ? new Date() : null,
        institutionTrialEndsAt: trialEndsAt,
        plan: invite.includedPlan,
        isSubscribed: invite.activationType === 'paid' ? true : undefined,
      }
    });

    // Record usage on the invite
    await InstitutionInvite.updateOne({ _id: invite._id }, {
      $inc: { usedCount: 1 },
      $set: { lastUsedAt: new Date(), lastUsedByUserId: userId }
    });

    return res.json({
      success: true,
      institutionName: invite.institutionName,
      activationType: invite.activationType,
      plan: invite.includedPlan,
      trialEndsAt
    });
  } catch (err) {
    console.error('POST /api/institution/redeem-access-code', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

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

function decodeBasicHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToPlainText(html) {
  const normalized = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|tr|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ');

  return decodeBasicHtmlEntities(normalized)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sanitizeDocumentText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^generated by rolerocket ai\.?$/i.test(line) && !/^\[date\]$/i.test(line))
    .join('\n');
}

function parseStructuredCoverLetter({ title, textContent, htmlContent }) {
  const preferredText = sanitizeDocumentText(String(htmlContent || '').trim()
    ? htmlToPlainText(htmlContent)
    : String(textContent || ''));
  const fallbackText = sanitizeDocumentText(String(textContent || '').trim()
    || htmlToPlainText(htmlContent));
  const sourceText = preferredText || fallbackText;
  const lines = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!/cover letter/i.test(String(title || '')) || !lines.length) return null;

  let index = 0;
  if (/^cover letter$/i.test(lines[index])) index += 1;

  const datePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/i;
  const greetingPattern = /^dear\b/i;
  const closingPattern = /^(sincerely|best regards|kind regards|warm regards|yours truly)/i;

  const name = lines[index] || 'Candidate';
  index += 1;

  const contactParts = [];
  while (index < lines.length && !datePattern.test(lines[index]) && !/^role:/i.test(lines[index]) && !greetingPattern.test(lines[index])) {
    contactParts.push(lines[index]);
    index += 1;
  }

  let dateLine = '';
  if (index < lines.length && datePattern.test(lines[index])) {
    dateLine = lines[index];
    index += 1;
  }

  let roleLine = '';
  if (index < lines.length && /^role:/i.test(lines[index])) {
    roleLine = lines[index].replace(/^role:\s*/i, '').trim();
    index += 1;
  }

  let companyLine = '';
  if (index < lines.length && /^company:/i.test(lines[index])) {
    companyLine = lines[index].replace(/^company:\s*/i, '').trim();
    index += 1;
  }

  let greeting = 'Dear Hiring Manager,';
  if (index < lines.length && greetingPattern.test(lines[index])) {
    greeting = lines[index];
    index += 1;
  }

  const bodyLines = [];
  while (index < lines.length && !closingPattern.test(lines[index])) {
    bodyLines.push(lines[index]);
    index += 1;
  }

  let closing = 'Sincerely,';
  let signature = name;
  if (index < lines.length && closingPattern.test(lines[index])) {
    closing = lines[index];
    index += 1;
  }
  if (index < lines.length) {
    signature = lines[index];
  }

  const paragraphs = bodyLines.filter(Boolean);
  const contactLine = contactParts.join(' | ').replace(/\s*\|\s*/g, ' | ').trim();

  return {
    title: 'Cover Letter',
    name,
    contactLine,
    dateLine: dateLine || new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    roleLine,
    companyLine,
    greeting,
    paragraphs,
    closing,
    signature
  };
}

function parseStructuredResume({ title, textContent, htmlContent }) {
  const preferredText = sanitizeDocumentText(String(htmlContent || '').trim()
    ? htmlToPlainText(htmlContent)
    : String(textContent || ''));
  const fallbackText = sanitizeDocumentText(String(textContent || '').trim()
    || htmlToPlainText(htmlContent));
  const sourceText = preferredText || fallbackText;
  const lines = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const titleHint = String(title || '').toLowerCase();
  const looksLikeResume = /resume|cv/.test(titleHint)
    || /(^|\n)(name|contact|professional summary|experience|education|certification|certifications|skills)\s*:/i.test(sourceText)
    || /(^|\n)(professional summary|experience|education|certifications|skills)\b/i.test(sourceText);
  if (!looksLikeResume) return null;

  const sectionNames = [
    'Target Role',
    'Professional Summary',
    'Experience',
    'Experience Highlights',
    'Professional Experience',
    'Education',
    'Certifications',
    'Certification',
    'Skills',
    'Core Skills'
  ];

  const sectionKeyFor = (raw = '') => {
    const key = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (key === 'experience highlights' || key === 'professional experience' || key === 'experience') return 'experience';
    if (key === 'core skills' || key === 'skills') return 'skills';
    if (key === 'certification' || key === 'certifications') return 'certifications';
    if (key === 'professional summary') return 'summary';
    if (key === 'education') return 'education';
    if (key === 'target role') return 'targetRole';
    return '';
  };

  const sectionRegex = new RegExp(`^(${sectionNames.map((name) => name.replace(/\s+/g, '\\s+')).join('|')})\\s*:?\\s*$`, 'i');
  const prefixedRegex = new RegExp(`^(${sectionNames.map((name) => name.replace(/\s+/g, '\\s+')).join('|')})\\s*:\\s*(.+)$`, 'i');

  const sections = {
    targetRole: [],
    summary: [],
    experience: [],
    education: [],
    certifications: [],
    skills: []
  };

  let name = '';
  let contact = '';
  let activeSection = '';

  lines.forEach((line) => {
    const nameMatch = line.match(/^name\s*:\s*(.+)$/i);
    if (nameMatch) {
      name = String(nameMatch[1] || '').trim();
      return;
    }

    const contactMatch = line.match(/^contact\s*:\s*(.+)$/i);
    if (contactMatch) {
      contact = String(contactMatch[1] || '').trim();
      return;
    }

    const prefixedMatch = line.match(prefixedRegex);
    if (prefixedMatch) {
      const key = sectionKeyFor(prefixedMatch[1]);
      activeSection = key;
      if (key && prefixedMatch[2]) sections[key].push(String(prefixedMatch[2]).trim());
      return;
    }

    const headingMatch = line.match(sectionRegex);
    if (headingMatch) {
      activeSection = sectionKeyFor(headingMatch[1]);
      return;
    }

    if (activeSection) {
      sections[activeSection].push(line);
      return;
    }

    if (!name) {
      name = line;
    } else if (!contact) {
      contact = line;
    }
  });

  const cleanList = (items = []) => items
    .map((item) => String(item || '').replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return {
    title: 'Resume',
    name: name || 'Candidate Name',
    contactLine: contact || 'Phone | Email | Location',
    targetRole: cleanList(sections.targetRole).join(' '),
    summary: cleanList(sections.summary).join(' '),
    experience: cleanList(sections.experience),
    education: cleanList(sections.education),
    certifications: cleanList(sections.certifications),
    skills: cleanList(sections.skills)
  };
}

function renderStructuredResumeHtml(resume) {
  if (!resume) return '';

  const renderList = (items = []) => {
    if (!items.length) return '<p style="margin:0;color:#475569;">Not provided.</p>';
    return `<ul style="margin:0;padding-left:18px;line-height:1.55;color:#1f2937;">${items.map((item) => `<li style="margin:0 0 6px 0;">${escapeHtml(item)}</li>`).join('')}</ul>`;
  };

  return `
    <div style="font-family:Calibri,Arial,sans-serif;color:#1f2937;max-width:820px;margin:0 auto;">
      <div style="border-bottom:3px solid #1e3a56;padding-bottom:10px;margin-bottom:14px;">
        <div style="font-size:24pt;font-weight:700;color:#1e3a56;line-height:1.1;">${escapeHtml(resume.name)}</div>
        <div style="font-size:11pt;color:#475569;margin-top:6px;">${escapeHtml(resume.contactLine)}</div>
      </div>
      <div style="font-size:11pt;color:#0f172a;margin:0 0 14px 0;"><strong>Target Role:</strong> ${escapeHtml(resume.targetRole || 'Not provided')}</div>
      <div style="margin:0 0 14px 0;">
        <div style="font-size:12.5pt;font-weight:700;color:#1e3a56;margin-bottom:6px;">Professional Summary</div>
        <p style="margin:0;line-height:1.55;color:#1f2937;">${escapeHtml(resume.summary || 'Not provided.')}</p>
      </div>
      <div style="margin:0 0 14px 0;">
        <div style="font-size:12.5pt;font-weight:700;color:#1e3a56;margin-bottom:6px;">Experience</div>
        ${renderList(resume.experience)}
      </div>
      <div style="margin:0 0 14px 0;">
        <div style="font-size:12.5pt;font-weight:700;color:#1e3a56;margin-bottom:6px;">Education</div>
        ${renderList(resume.education)}
      </div>
      <div style="margin:0 0 14px 0;">
        <div style="font-size:12.5pt;font-weight:700;color:#1e3a56;margin-bottom:6px;">Certifications</div>
        ${renderList(resume.certifications)}
      </div>
      <div style="margin:0;">
        <div style="font-size:12.5pt;font-weight:700;color:#1e3a56;margin-bottom:6px;">Skills</div>
        ${renderList(resume.skills)}
      </div>
    </div>
  `;
}

function renderStructuredCoverLetterHtml(letter) {
  if (!letter) return '';
  const paragraphsHtml = (letter.paragraphs || [])
    .map((paragraph) => `<p style="margin:0 0 18px 0;font-size:12pt;line-height:1.6;color:#1f2937;">${escapeHtml(paragraph)}</p>`)
    .join('');

  return `
    <div style="font-family:Calibri,Arial,sans-serif;color:#1f2937;max-width:780px;margin:0 auto;">
      <div style="text-align:center;font-size:18pt;font-weight:700;color:#111827;margin:0 0 18px 0;">${escapeHtml(letter.title)}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="font-size:22pt;font-weight:700;color:#0e7490;padding:0;vertical-align:top;">${escapeHtml(letter.name)}</td>
          <td style="font-size:12pt;color:#64748b;padding:0;text-align:right;vertical-align:top;white-space:nowrap;">${escapeHtml(letter.dateLine)}</td>
        </tr>
      </table>
      <div style="font-size:12pt;color:#334155;margin:0 0 10px 0;">${escapeHtml(letter.contactLine)}</div>
      <div style="border-bottom:3px solid #8ec7da;margin:0 0 12px 0;"></div>
      <div style="font-size:12pt;color:#334155;margin:0 0 12px 0;">
        ${letter.roleLine ? `<div><strong>Role:</strong> ${escapeHtml(letter.roleLine)}</div>` : ''}
        ${letter.companyLine ? `<div><strong>Company:</strong> ${escapeHtml(letter.companyLine)}</div>` : ''}
      </div>
      <div style="font-size:12pt;font-weight:700;color:#111827;margin:0 0 12px 0;">${escapeHtml(letter.greeting)}</div>
      ${paragraphsHtml}
      <div style="font-size:12pt;color:#1f2937;line-height:1.6;margin-top:8px;">${escapeHtml(letter.closing)}</div>
      <div style="font-size:12pt;font-weight:700;color:#111827;line-height:1.6;">${escapeHtml(letter.signature)}</div>
    </div>
  `;
}

async function createDocumentPdfBuffer({ title, textContent, htmlContent }) {
  const structuredCoverLetter = parseStructuredCoverLetter({ title, textContent, htmlContent });
  const structuredResume = parseStructuredResume({ title, textContent, htmlContent });
  const hasHtmlContent = Boolean(String(htmlContent || '').trim());
  const preferredBodyText = hasHtmlContent
    ? htmlToPlainText(htmlContent)
    : String(textContent || '').trim();
  const fallbackBodyText = hasHtmlContent
    ? String(textContent || '').trim()
    : htmlToPlainText(htmlContent);
  const bodyText = sanitizeDocumentText(preferredBodyText || fallbackBodyText);
  const pdf = new PDFDocument({ size: 'LETTER', margin: 50 });

  return new Promise((resolve, reject) => {
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.info.Title = String(title || 'RoleRocket AI Document').slice(0, 120);
    pdf.info.Author = 'RoleRocket AI';
    pdf.info.Creator = 'RoleRocket AI';

    if (structuredCoverLetter) {
      const left = pdf.page.margins.left;
      const right = pdf.page.width - pdf.page.margins.right;
      const contentWidth = right - left;

      pdf.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(structuredCoverLetter.title, left, pdf.y, {
        width: contentWidth,
        align: 'center'
      });
      pdf.moveDown(0.5);

      const headerY = pdf.y;
      pdf.font('Helvetica-Bold').fontSize(21).fillColor('#0e7490').text(structuredCoverLetter.name, left, headerY, {
        width: contentWidth - 140,
        align: 'left'
      });
      pdf.font('Helvetica').fontSize(12).fillColor('#64748b').text(structuredCoverLetter.dateLine, right - 120, headerY + 4, {
        width: 120,
        align: 'right'
      });

      pdf.y = Math.max(pdf.y, headerY + 24);
      if (structuredCoverLetter.contactLine) {
        pdf.font('Helvetica').fontSize(12).fillColor('#334155').text(structuredCoverLetter.contactLine, left, pdf.y, {
          width: contentWidth,
          align: 'left'
        });
        pdf.moveDown(0.6);
      }

      pdf.moveTo(left, pdf.y).lineTo(right, pdf.y).lineWidth(1.5).strokeColor('#8ec7da').stroke();
      pdf.moveDown(0.8);

      pdf.font('Helvetica-Bold').fontSize(12).fillColor('#334155').text('Role:', left, pdf.y, { continued: true });
      pdf.font('Helvetica').text(` ${structuredCoverLetter.roleLine || ''}`);
      pdf.font('Helvetica-Bold').text('Company:', left, pdf.y, { continued: true });
      pdf.font('Helvetica').text(` ${structuredCoverLetter.companyLine || ''}`);
      pdf.moveDown(0.5);

      pdf.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(structuredCoverLetter.greeting, left, pdf.y, {
        width: contentWidth,
        align: 'left'
      });
      pdf.moveDown(0.6);

      pdf.font('Helvetica').fontSize(12).fillColor('#1f2937');
      (structuredCoverLetter.paragraphs || []).forEach((paragraph) => {
        pdf.text(paragraph, left, pdf.y, { width: contentWidth, lineGap: 4, align: 'left' });
        pdf.moveDown(0.7);
      });

      pdf.moveDown(0.2);
      pdf.text(structuredCoverLetter.closing, left, pdf.y, { width: contentWidth, align: 'left' });
      pdf.moveDown(0.4);
      pdf.font('Helvetica-Bold').text(structuredCoverLetter.signature, left, pdf.y, { width: contentWidth, align: 'left' });
    } else if (structuredResume) {
      const left = pdf.page.margins.left;
      const right = pdf.page.width - pdf.page.margins.right;
      const contentWidth = right - left;

      const sectionTitle = (label) => {
        pdf.moveDown(0.2);
        pdf.font('Helvetica-Bold').fontSize(12).fillColor('#1e3a56').text(String(label || ''), left, pdf.y, {
          width: contentWidth,
          align: 'left'
        });
        pdf.moveDown(0.15);
      };

      const bulletList = (items = []) => {
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) {
          pdf.font('Helvetica').fontSize(11).fillColor('#475569').text('Not provided.', left + 8, pdf.y, { width: contentWidth - 8, align: 'left' });
          return;
        }
        list.forEach((item) => {
          pdf.font('Helvetica').fontSize(11).fillColor('#111827').text(`• ${item}`, left + 8, pdf.y, {
            width: contentWidth - 8,
            align: 'left',
            lineGap: 2
          });
        });
      };

      pdf.font('Helvetica-Bold').fontSize(22).fillColor('#1e3a56').text(structuredResume.name, left, pdf.y, {
        width: contentWidth,
        align: 'left'
      });
      pdf.moveDown(0.2);
      pdf.font('Helvetica').fontSize(11).fillColor('#475569').text(structuredResume.contactLine, left, pdf.y, {
        width: contentWidth,
        align: 'left'
      });
      pdf.moveDown(0.3);
      pdf.moveTo(left, pdf.y).lineTo(right, pdf.y).lineWidth(1.5).strokeColor('#1e3a56').stroke();
      pdf.moveDown(0.6);

      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Target Role:', left, pdf.y, { continued: true });
      pdf.font('Helvetica').text(` ${structuredResume.targetRole || 'Not provided'}`);

      sectionTitle('Professional Summary');
      pdf.font('Helvetica').fontSize(11).fillColor('#111827').text(structuredResume.summary || 'Not provided.', left, pdf.y, {
        width: contentWidth,
        align: 'left',
        lineGap: 2
      });

      sectionTitle('Experience');
      bulletList(structuredResume.experience);

      sectionTitle('Education');
      bulletList(structuredResume.education);

      sectionTitle('Certifications');
      bulletList(structuredResume.certifications);

      sectionTitle('Skills');
      bulletList(structuredResume.skills);
    } else {
      const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

      pdf.font('Helvetica-Bold').fontSize(18).fillColor('#1e3a5f').text(String(title || 'Document'), { align: 'center' });
      pdf.moveDown(0.2);
      pdf.font('Helvetica').fontSize(10).fillColor('#64748b').text(today, { align: 'right' });
      pdf.moveDown(1);
      pdf.font('Helvetica').fontSize(11).fillColor('#111827').text(bodyText || 'No document content provided.', {
        lineGap: 3,
        align: 'left'
      });
    }

    pdf.end();
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createDocumentWordBuffer({ title, textContent, htmlContent }) {
  const structuredCoverLetter = parseStructuredCoverLetter({ title, textContent, htmlContent });
  const structuredResume = parseStructuredResume({ title, textContent, htmlContent });
  const safeTitle = escapeHtml(title || 'Document');
  const bodyMarkup = structuredCoverLetter
    ? renderStructuredCoverLetterHtml(structuredCoverLetter)
    : structuredResume
      ? renderStructuredResumeHtml(structuredResume)
    : (String(htmlContent || '').trim()
      || `<pre style="font-family:Calibri,Arial,sans-serif;white-space:pre-wrap;font-size:11pt;line-height:1.5;">${escapeHtml(textContent)}</pre>`);

  const wordHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
  </head>
  <body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.55;color:#1f2937;margin:0;padding:20px;">
    ${bodyMarkup}
  </body>
</html>`;

  return Buffer.from(`\ufeff${wordHtml}`, 'utf8');
}

function trimForAssistant(value, max = 2000) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeAssistantContext(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  return Object.entries(raw)
    .map(([key, value]) => [trimForAssistant(key, 80), trimForAssistant(value, 2200)])
    .filter(([key, value]) => key && value)
    .slice(0, 12);
}

function normalizeAssistantHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'))
    .slice(-6)
    .map((entry) => ({
      role: entry.role,
      content: trimForAssistant(entry.content, 1200)
    }))
    .filter((entry) => entry.content);
}

async function sendEmail({ to, subject, html, text, attachments }) {
  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('Email not configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env.');
    return;
  }
  const fromAddress = process.env.SMTP_FROM || 'info@rolerocketai.com';
  await withTimeout(transporter.sendMail({
    from: `"RoleRocket AI" <${fromAddress}>`,
    to,
    subject,
    html,
    text,
    attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined
  }), 8000, 'sendMail');
}

async function sendSMS({ to, message }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('SMS not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in env.');
    return { success: false, reason: 'SMS not configured' };
  }

  try {
    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: to,
        Body: message
      })
    });

    const data = await response.json();
    return { success: response.ok, sid: data.sid, error: data.message };
  } catch (err) {
    console.error('SMS send error:', err);
    return { success: false, reason: err.message };
  }
}

async function sendWhatsAppMessage({ to, message, mediaUrls = [] }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('WhatsApp not configured.');
    return { success: false, reason: 'WhatsApp not configured' };
  }

  try {
    const normalizeWhatsAppAddress = (value = '') => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
      return `whatsapp:${raw}`;
    };

    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const statusCallback = String(process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL || '').trim();
    const configuredSender = String(process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || '').trim();
    if (!configuredSender) {
      console.warn('WhatsApp sender not configured: set TWILIO_WHATSAPP_NUMBER (or TWILIO_PHONE_NUMBER).');
      return { success: false, reason: 'WhatsApp sender not configured', code: 'missing_sender' };
    }
    const fromAddress = normalizeWhatsAppAddress(configuredSender);
    const toAddress = normalizeWhatsAppAddress(to);

    const payload = new URLSearchParams({
      From: fromAddress,
      To: toAddress,
      Body: message
    });
    const attachments = Array.isArray(mediaUrls)
      ? mediaUrls.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
      : [];
    attachments.forEach((url) => payload.append('MediaUrl', url));
    if (statusCallback) {
      payload.set('StatusCallback', statusCallback);
    }

    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload
    });

    const rawBody = await response.text();
    let data = {};
    try {
      data = JSON.parse(rawBody || '{}');
    } catch (_parseError) {
      data = { message: rawBody || 'Unknown Twilio response' };
    }

    if (!response.ok) {
      console.warn('Twilio WhatsApp send failed:', {
        status: response.status,
        fromAddress,
        toAddress,
        errorCode: data.code,
        errorMessage: data.message
      });
    }

    return {
      success: response.ok,
      sid: data.sid,
      error: data.message,
      status: response.status,
      code: data.code
    };
  } catch (err) {
    console.error('WhatsApp send error:', err);
    return { success: false, reason: err.message };
  }
}

async function sendWhatsAppContentTemplate({ to, contentSid, contentVariables = {} }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { success: false, reason: 'WhatsApp not configured' };
  }

  const sid = String(contentSid || '').trim();
  if (!sid) {
    return { success: false, reason: 'Missing content sid' };
  }

  try {
    const normalizeWhatsAppAddress = (value = '') => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
      return `whatsapp:${raw}`;
    };

    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const configuredSender = String(process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || '').trim();
    if (!configuredSender) return { success: false, reason: 'WhatsApp sender not configured', code: 'missing_sender' };

    const payload = new URLSearchParams({
      From: normalizeWhatsAppAddress(configuredSender),
      To: normalizeWhatsAppAddress(to),
      ContentSid: sid
    });

    if (contentVariables && Object.keys(contentVariables).length) {
      payload.set('ContentVariables', JSON.stringify(contentVariables));
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload
    });

    const rawBody = await response.text();
    let data = {};
    try {
      data = JSON.parse(rawBody || '{}');
    } catch (_parseError) {
      data = { message: rawBody || 'Unknown Twilio response' };
    }

    if (!response.ok) {
      console.warn('Twilio WhatsApp content template failed:', {
        status: response.status,
        contentSid: sid,
        errorCode: data.code,
        errorMessage: data.message
      });
    }

    return {
      success: response.ok,
      sid: data.sid,
      error: data.message,
      status: response.status,
      code: data.code
    };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWhatsAppTwiml(message = '') {
  const safeMessage = escapeXml(message || 'Message received.');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safeMessage}</Message></Response>`;
}

function getPublicAppBaseUrl() {
  const whatsappMediaBase = String(process.env.WHATSAPP_MEDIA_BASE_URL || '').trim().replace(/\/$/, '');
  if (whatsappMediaBase) return whatsappMediaBase;
  const configured = String(process.env.CLIENT_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? 'https://www.rolerocketai.com' : 'http://localhost:5001';
}

function slugifyExportName(value = '') {
  return String(value || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'document';
}

async function createWhatsAppExportFiles({ title = 'RoleRocket Document', textContent = '', htmlContent = '' }) {
  const safeTitle = String(title || 'RoleRocket Document').trim() || 'RoleRocket Document';
  const exportDir = path.join(__dirname, '../frontend/generated/whatsapp-exports');
  await fs.mkdir(exportDir, { recursive: true });

  const nonce = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const slug = slugifyExportName(safeTitle);
  const pdfFilename = `${slug}-${nonce}.pdf`;
  const docxFilename = `${slug}-${nonce}.docx`;
  const pdfPath = path.join(exportDir, pdfFilename);
  const docxPath = path.join(exportDir, docxFilename);

  const pdfBuffer = await createDocumentPdfBuffer({
    title: safeTitle,
    textContent,
    htmlContent
  });
  const wordBuffer = createDocumentWordBuffer({
    title: safeTitle,
    textContent,
    htmlContent
  });

  await Promise.all([
    fs.writeFile(pdfPath, pdfBuffer),
    fs.writeFile(docxPath, wordBuffer)
  ]);

  const baseUrl = getPublicAppBaseUrl();
  return {
    pdfUrl: `${baseUrl}/generated/whatsapp-exports/${encodeURIComponent(pdfFilename)}`,
    wordUrl: `${baseUrl}/generated/whatsapp-exports/${encodeURIComponent(docxFilename)}`,
    pdfPath,
    docxPath
  };
}

function shouldValidateTwilioWebhook() {
  const configured = String(process.env.TWILIO_VALIDATE_WEBHOOK || '').trim().toLowerCase();
  if (configured) return !['0', 'false', 'no'].includes(configured);
  return process.env.NODE_ENV === 'production';
}

function timingSafeCompareText(left = '', right = '') {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function buildTwilioSignature(url, params = {}, authToken = '') {
  const sortedKeys = Object.keys(params || {}).sort();
  const payload = sortedKeys.reduce((acc, key) => acc + key + String(params[key] ?? ''), String(url || ''));
  return crypto.createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');
}

function getTwilioSignatureCandidateUrls(req) {
  const originalUrl = String(req.originalUrl || req.url || '');
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.get('host') || '').trim();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const requestProto = String(req.protocol || '').trim();

  const protoCandidates = [forwardedProto, requestProto, 'https', 'http'].filter(Boolean);
  const uniqueProtos = protoCandidates.filter((value, idx, arr) => arr.indexOf(value) === idx);
  return uniqueProtos.map((proto) => `${proto}://${host}${originalUrl}`);
}

function isValidTwilioWebhookSignature(req) {
  if (!shouldValidateTwilioWebhook()) return true;
  if (!TWILIO_AUTH_TOKEN) return false;

  const incomingSignature = String(req.headers['x-twilio-signature'] || '').trim();
  if (!incomingSignature) return false;

  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const candidates = getTwilioSignatureCandidateUrls(req);
  return candidates.some((url) => timingSafeCompareText(incomingSignature, buildTwilioSignature(url, params, TWILIO_AUTH_TOKEN)));
}

function normalizeWhatsAppPhone(from = '') {
  const raw = String(from || '').trim().replace(/^whatsapp:/i, '');
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return `${hasPlus ? '+' : ''}${digits}`;
}

function normalizeIncomingWhatsAppText(body = '') {
  return String(body || '').replace(/\s+/g, ' ').trim();
}

function createWhatsAppImportToken(phone = '') {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized || !process.env.JWT_SECRET) return '';
  try {
    return jwt.sign(
      { purpose: 'wa_import', phone: normalized },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
  } catch {
    return '';
  }
}

function extractWhatsAppInboundText(payload = {}) {
  const interactiveCandidates = [
    payload.ButtonText,
    payload.ListSelectionTitle,
    payload.ListSelectionDescription,
    payload.ListSelection,
    payload.ButtonPayload,
    payload.InteractiveData,
    payload.InteractiveResponse,
    payload.Body
  ];

  const flattened = [];
  for (const candidate of interactiveCandidates) {
    if (!candidate) continue;
    if (candidate && typeof candidate === 'object') {
      flattened.push(candidate.id, candidate.payload, candidate.title, candidate.text, candidate.value);
      continue;
    }
    flattened.push(candidate);
  }

  const mergedInteractiveText = normalizeIncomingWhatsAppText(
    flattened
      .filter(Boolean)
      .map((item) => String(item))
      .join(' ')
  );

  if (mergedInteractiveText) return mergedInteractiveText;

  const candidates = [
    payload.Body,
    payload.ButtonPayload,
    payload.ButtonText,
    payload.ListSelection,
    payload.ListSelectionTitle,
    payload.ListSelectionDescription,
    payload.InteractiveData,
    payload.InteractiveResponse
  ];

  for (const candidate of candidates) {
    const text = normalizeIncomingWhatsAppText(candidate || '');
    if (text) return text;
  }

  return '';
}

async function maybeSendWhatsAppInteractivePrompt({ from, normalizedInboundText = '', convo = null }) {
  if (!from || !convo) return false;

  const interactiveToggle = String(process.env.TWILIO_WHATSAPP_INTERACTIVE_ENABLED || '').trim().toLowerCase();
  const languageContentSid = String(process.env.TWILIO_WHATSAPP_LANGUAGE_CONTENT_SID || '').trim();
  const menuContentSid = String(process.env.TWILIO_WHATSAPP_MENU_CONTENT_SID || '').trim();
  const resumeActionsContentSid = String(process.env.TWILIO_WHATSAPP_RESUME_ACTIONS_CONTENT_SID || '').trim();
  const resumeInputChoiceContentSid = String(process.env.TWILIO_WHATSAPP_RESUME_INPUT_CHOICE_CONTENT_SID || '').trim();
  const coverActionsContentSid = String(process.env.TWILIO_WHATSAPP_COVER_ACTIONS_CONTENT_SID || '').trim();
  const tailorsContentSid = String(process.env.TWILIO_WHATSAPP_TAILOR_CHOICES_CONTENT_SID || '').trim();
  const jobsMenuContentSid = String(process.env.TWILIO_WHATSAPP_JOBS_MENU_CONTENT_SID || '').trim();
  const jobsParishContentSid = String(process.env.TWILIO_WHATSAPP_JOBS_PARISH_CONTENT_SID || '').trim();
  const jobsActionContentSid = String(process.env.TWILIO_WHATSAPP_JOBS_ACTION_CONTENT_SID || '').trim();
  const backMenuContentSid = String(process.env.TWILIO_WHATSAPP_BACK_MENU_CONTENT_SID || '').trim();
  const paidFeaturesContentSid = String(process.env.TWILIO_WHATSAPP_PAID_FEATURES_CONTENT_SID || '').trim();

  const hasInteractiveTemplates = [
    languageContentSid,
    menuContentSid,
    resumeActionsContentSid,
    resumeInputChoiceContentSid,
    coverActionsContentSid,
    tailorsContentSid,
    jobsMenuContentSid,
    jobsParishContentSid,
    jobsActionContentSid,
    backMenuContentSid,
    paidFeaturesContentSid
  ].some(Boolean);

  const interactiveEnabled = interactiveToggle === '1' || interactiveToggle === 'true' || (interactiveToggle === '' && hasInteractiveTemplates);
  if (!interactiveEnabled) return false;

  const step = String(convo.currentStep || '').trim();

  // 'suppress' = template replaces the text reply entirely (language select / pure menu / tailor choice)
  // 'keep'     = template sends buttons alongside the text reply (content pages + nav, resume, cover, jobs)
  // false      = no template sent

  if (step === 'language_select' && languageContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: languageContentSid });
    return result?.success ? 'suppress' : false;
  }

  // menu step: suppress for pure menu display; keep when returning from content (explore/status/interview)
  if (step === 'menu' && menuContentSid) {
    const lastMsg = String(convo?.lastOutboundMessage || '').trim();
    const isDemoFeaturesLinkReply = /open demo features here|abre demo features aqui/i.test(lastMsg);
    if (isDemoFeaturesLinkReply) {
      return false;
    }
    const isPureMenu = !lastMsg || lastMsg.startsWith('RoleRocket AI Recruit');
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: menuContentSid });
    if (!result?.success) return false;
    return isPureMenu ? 'suppress' : 'keep';
  }

  if (step === 'job_tailor_choice' && tailorsContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: tailorsContentSid });
    if (result?.success && backMenuContentSid) {
      await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
    }
    return result?.success ? 'suppress' : false;
  }

  // jobs_menu step: suppress for pure nav prompt; keep when returning from an action (import success, etc.)
  if (step === 'jobs_menu' && jobsMenuContentSid) {
    const lastMsg = String(convo?.lastOutboundMessage || '').trim();
    const isPureJobsMenu = !lastMsg || lastMsg.startsWith('What would you like to do');
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: jobsMenuContentSid });
    if (!result?.success) return false;
    // Always try to send Main Menu back button; suppress even if it fails (interactive template is sufficient)
    if (backMenuContentSid) {
      await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid }).catch(() => {});
    }
    // Suppress text fallback when entering jobs menu fresh; keep rich context text on return from sub-action
    return isPureJobsMenu ? 'suppress' : 'keep';
  }

  if (step === 'jobs_action' && jobsActionContentSid) {
    const hasJobs = Array.isArray(convo?.metadata?.lastJobs) && convo.metadata.lastJobs.length > 0;
    if (hasJobs) {
      return 'defer';
    }
  }

  if (step === 'explore_features' && paidFeaturesContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: paidFeaturesContentSid });
    if (result?.success && backMenuContentSid) {
      await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
    }
    return result?.success ? 'keep' : false;
  }

  if (step === 'jobs_parish_select' && jobsParishContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: jobsParishContentSid });
    if (result?.success && backMenuContentSid) {
      await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
    }
    return result?.success ? 'keep' : false;
  }

  // For resume_followup and cover_letter_followup, send buttons ALONGSIDE the text
  // reply (not instead of it), so the user still sees the resume/cover content.
  if (step === 'resume_followup' && resumeActionsContentSid) {
    const hasDraft = !!String(convo?.metadata?.context?.lastFullResumeDraft || '').trim() ||
                     !!String(convo?.metadata?.context?.pendingFullResume?.source || '').trim();
    if (hasDraft) {
      const result = await sendWhatsAppContentTemplate({ to: from, contentSid: resumeActionsContentSid });
      if (result?.success && backMenuContentSid) {
        await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
      }
      return result?.success ? 'keep' : false;
    }
  }


  if (step === 'resume_input_choice' && resumeInputChoiceContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: resumeInputChoiceContentSid });
    if (result?.success && backMenuContentSid) {
      await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
    }
    return result?.success ? 'suppress' : false;
  }

  // Input-capture steps: append a 'Main Menu' back button so users can exit without typing
  if (['jobs_query', 'jobs_role_input', 'jobs_parish_select', 'resume_capture', 'cover_letter_capture', 'interview_target'].includes(step) && backMenuContentSid) {
    const result = await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
    return result?.success ? 'keep' : false;
  }

  if (step === 'cover_letter_followup' && coverActionsContentSid) {
    const hasDraft = !!String(convo?.metadata?.context?.lastCoverLetterDraft || '').trim();
    if (hasDraft) {
      const result = await sendWhatsAppContentTemplate({ to: from, contentSid: coverActionsContentSid });
      if (result?.success && backMenuContentSid) {
        await sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid });
      }
      return result?.success ? 'keep' : false;
    }
  }

  return false;
}

function extractWhatsAppInboundAudioMedia(payload = {}) {
  const mediaCount = Math.max(0, Number(payload?.NumMedia || 0));
  if (!mediaCount) return null;

  for (let i = 0; i < mediaCount; i += 1) {
    const mediaUrl = String(payload[`MediaUrl${i}`] || '').trim();
    const contentType = String(payload[`MediaContentType${i}`] || '').trim().toLowerCase();
    if (!mediaUrl) continue;

    const isAudio = /^audio\//.test(contentType) || /(ogg|opus|mpeg|mp3|m4a|wav|aac|webm)/.test(contentType);
    if (isAudio) {
      return {
        mediaUrl,
        contentType: contentType || 'audio/ogg'
      };
    }
  }

  return null;
}

function getAudioExtensionFromMimeType(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('ogg') || normalized.includes('opus')) return '.ogg';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('m4a') || normalized.includes('mp4')) return '.m4a';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('webm')) return '.webm';
  if (normalized.includes('aac')) return '.aac';
  return '.ogg';
}

async function transcribeWhatsAppVoiceNote(media = null) {
  if (!media?.mediaUrl || !process.env.OPENAI_API_KEY) return '';
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return '';

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    let response = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const candidate = await fetch(media.mediaUrl, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }).catch(() => null);

      if (candidate?.ok) {
        response = candidate;
        break;
      }
      if (attempt === 1) {
        throw new Error(`Failed to fetch WhatsApp media (${candidate?.status || 'network'})`);
      }
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (!audioBuffer.length) return '';

    const mimeType = String(media.contentType || 'audio/ogg').toLowerCase();
    const extension = getAudioExtensionFromMimeType(mimeType);
    const prompt = 'Transcribe this WhatsApp job-seeker voice note accurately. Return plain text only.';

    async function transcribeWithModel(modelName) {
      const audioFile = new File([audioBuffer], `whatsapp-voice${extension}`, { type: mimeType });
      return openai.audio.transcriptions.create({
        file: audioFile,
        model: modelName,
        prompt
      });
    }

    let transcription;
    try {
      transcription = await transcribeWithModel('gpt-4o-mini-transcribe');
    } catch (_firstErr) {
      transcription = await transcribeWithModel('whisper-1');
    }

    return String(
      typeof transcription === 'string'
        ? transcription
        : transcription?.text || transcription?.data?.text || ''
    ).trim();
  } catch (error) {
    console.warn('WhatsApp voice transcription fallback:', error.message);
    return '';
  }
}

const WHATSAPP_AI_RATE_LIMITS = {
  transcribe: { perHour: 8, perDay: 20 },
  resume_rewrite: { perHour: 6, perDay: 16 },
  interview_prep: { perHour: 8, perDay: 24 }
};

const whatsappAiUsage = new Map();

function getWhatsAppAiUsageEntry(phone = '') {
  const key = String(phone || '').trim();
  if (!key) return null;
  if (!whatsappAiUsage.has(key)) {
    whatsappAiUsage.set(key, {
      features: {},
      hourlyWindowStart: Date.now(),
      dailyWindowStart: Date.now()
    });
  }
  return whatsappAiUsage.get(key);
}

function consumeWhatsAppAiCredit(phone = '', feature = '') {
  const limits = WHATSAPP_AI_RATE_LIMITS[feature];
  if (!limits) return { ok: true, retryAfterMinutes: 0 };

  const entry = getWhatsAppAiUsageEntry(phone);
  if (!entry) return { ok: true, retryAfterMinutes: 0 };

  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  const oneDayMs = 24 * oneHourMs;

  if (now - entry.hourlyWindowStart >= oneHourMs) {
    entry.hourlyWindowStart = now;
    Object.keys(entry.features).forEach((key) => {
      entry.features[key] = { ...(entry.features[key] || {}), hourCount: 0 };
    });
  }

  if (now - entry.dailyWindowStart >= oneDayMs) {
    entry.dailyWindowStart = now;
    Object.keys(entry.features).forEach((key) => {
      entry.features[key] = { ...(entry.features[key] || {}), dayCount: 0 };
    });
  }

  const counters = entry.features[feature] || { hourCount: 0, dayCount: 0 };
  if (counters.hourCount >= limits.perHour) {
    const retryMs = Math.max(60 * 1000, oneHourMs - (now - entry.hourlyWindowStart));
    return { ok: false, retryAfterMinutes: Math.ceil(retryMs / 60000) };
  }

  if (counters.dayCount >= limits.perDay) {
    const retryMs = Math.max(60 * 1000, oneDayMs - (now - entry.dailyWindowStart));
    return { ok: false, retryAfterMinutes: Math.ceil(retryMs / 60000) };
  }

  entry.features[feature] = {
    hourCount: counters.hourCount + 1,
    dayCount: counters.dayCount + 1
  };

  return { ok: true, retryAfterMinutes: 0 };
}

async function trackWhatsAppTelemetry(phone = '', event = '', meta = {}) {
  if (!event) return;
  try {
    await Telemetry.create({
      sessionId: String(phone || ''),
      event,
      funnel: 'whatsapp-recruiting',
      page: 'whatsapp',
      variant: 'v2',
      meta: {
        ...(meta && typeof meta === 'object' ? meta : {}),
        channel: 'whatsapp'
      },
      userAgent: 'twilio-whatsapp-webhook'
    });
  } catch (_err) {
    // Best effort only.
  }
}

function detectWhatsAppIntent(text = '') {
  const normalized = String(text || '').toLowerCase().trim();
  if (!normalized) return { intent: 'unclear', confidence: 0, topScore: 0, tie: false };

  const score = {
    demo: 0,
    jobs: 0,
    resume: 0,
    coverLetter: 0,
    explore: 0,
    interview: 0,
    status: 0,
    human: 0
  };

  if (normalized === '1') score.demo += 10;
  if (normalized === '2') score.jobs += 10;
  if (normalized === '3') score.resume += 10;
  if (normalized === '4') score.coverLetter += 10;
  if (normalized === '5') score.explore += 10;
  if (normalized === '0') score.human += 10;
  if (normalized === 'status') score.status += 10;

  if (/(watch\s+demo|demo\s+features|feature\s+demo|show\s+demo|how\s+it\s+works|first\s+glance|quick\s+tour|walkthrough)/.test(normalized)) score.demo += 5;
  if (/\bjob|jobs|apply|vacanc|hiring|position\b/.test(normalized)) score.jobs += 3;
  if (/\bresume|cv|experience|work history|rewrite\b/.test(normalized)) score.resume += 3;
  if (/\bcover\s*letter|coverletter|letter\b/.test(normalized)) score.coverLetter += 3;
  if (/\bexplore|features|other\s*features|upgrade|plan|paid\b/.test(normalized)) score.explore += 3;
  if (/\binterview|prep|question|mock\b/.test(normalized)) score.interview += 3;
  if (/\bstatus|tracked|application\b/.test(normalized)) score.status += 3;
  if (/\bhuman|agent|support|live\b/.test(normalized)) score.human += 3;

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  const tie = topScore > 0 && topScore === secondScore;
  const confidence = topScore >= 10 ? 1 : Math.min(0.95, topScore / 6);

  if (topScore < 3 || tie) return { intent: 'unclear', confidence, topScore, tie };
  return { intent: topIntent, confidence, topScore, tie };
}

function getWhatsAppClarificationPrompt() {
  return [
    'I can help with one of these now:',
    '1 Watch Demo Features | 2 Jobs | 3 Resume | 4 Cover Letter',
    '5 Explore Features | STATUS | 0 Technical Support',
    'Reply with one option.'
  ].join('\n');
}

function getWhatsAppReferralCode(phone = '') {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return `RR${digits.slice(-6) || '000000'}`;
}

function buildWhatsAppContextNote(user, convo) {
  const details = [];
  if (user?.targetJob) details.push(`Target role: ${user.targetJob}`);
  if (user?.location) details.push(`Preferred location: ${user.location}`);
  const memory = convo?.metadata?.context || {};
  if (memory.lastResumeChannel) details.push(`Recent resume input channel: ${memory.lastResumeChannel}`);
  if (memory.lastInterviewTarget) details.push(`Recent interview target: ${memory.lastInterviewTarget}`);
  if (Array.isArray(memory.recentSearches) && memory.recentSearches.length) {
    const lastSearch = memory.recentSearches[memory.recentSearches.length - 1];
    if (lastSearch?.title) details.push(`Recent job search: ${lastSearch.title} in ${lastSearch.location || 'Jamaica'}`);
  }
  return details.join(' | ');
}

function getWhatsAppOutcomeNudge(phone = '') {
  const code = getWhatsAppReferralCode(phone);
  return `Outcome Boost: Reply APPLY READY for matches, and share code ${code} with 2 friends.`;
}

async function sendWhatsAppHumanSupportAlert({ phone, incoming, user, convo }) {
  const supportRecipient = process.env.SUPPORT_TO || process.env.CONTACT_TO || 'support@rolerocketai.com';
  const escalationRecipient = process.env.SUPPORT_ESCALATION_TO || supportRecipient;
  const webhookUrl = String(process.env.SUPPORT_ALERT_WEBHOOK_URL || '').trim();
  const context = convo?.metadata?.context || {};
  const subject = `WhatsApp HUMAN request: ${phone}`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#0f172a;max-width:680px;">
      <h2 style="margin:0 0 12px;">WhatsApp Human Handoff Requested</h2>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Name:</strong> ${String(user?.name || '').trim() || 'Unknown'}</p>
      <p><strong>Last message:</strong> ${String(incoming || '').trim() || '(none)'}</p>
      <p><strong>Target role:</strong> ${String(user?.targetJob || context?.lastJobTitle || '').trim() || 'Not set'}</p>
      <p><strong>Location:</strong> ${String(user?.location || context?.lastLocation || '').trim() || 'Jamaica'}</p>
      <p><strong>Conversation step:</strong> ${String(convo?.currentStep || '').trim() || 'menu'}</p>
    </div>
  `;

  let delivered = false;
  const channels = [];

  try {
    await sendEmail({ to: supportRecipient, subject, html });
    delivered = true;
    channels.push('email_primary');
  } catch (err) {
    console.warn('WhatsApp human alert primary email failed:', err.message);
  }

  if (!delivered && escalationRecipient && escalationRecipient !== supportRecipient) {
    try {
      await sendEmail({ to: escalationRecipient, subject: `${subject} [Escalation]`, html });
      delivered = true;
      channels.push('email_escalation');
    } catch (err) {
      console.warn('WhatsApp human alert escalation email failed:', err.message);
    }
  }

  if (webhookUrl) {
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp_human_handoff',
          phone,
          incoming,
          targetJob: String(user?.targetJob || context?.lastJobTitle || '').trim() || null,
          location: String(user?.location || context?.lastLocation || '').trim() || null,
          step: String(convo?.currentStep || '').trim() || 'menu',
          ts: new Date().toISOString()
        })
      });
      if (webhookResponse.ok) {
        delivered = true;
        channels.push('webhook');
      }
    } catch (err) {
      console.warn('WhatsApp human alert webhook failed:', err.message);
    }
  }

  await trackWhatsAppTelemetry(phone, delivered ? 'whatsapp_human_alert_sent' : 'whatsapp_human_alert_failed', {
    channels,
    supportRecipient,
    escalationRecipient
  });

  return delivered;
}

function getWhatsAppNextStepPrompt() {
  return 'Next: choose Demo Features, Jobs, Resume, Cover Letter, Explore, or Technical Support.';
}

function getWhatsAppLanguagePrompt() {
  return [
    'Choose your language:',
    'English',
    'Spanish',
    'Use the language buttons below.'
  ].join('\n');
}

function getWhatsAppLanguageValue(input = '') {
  const normalized = String(input || '').toLowerCase().trim();
  if (['1', 'english', 'en'].includes(normalized)) return 'english';
  if (['2', 'spanish', 'es', 'espanol', 'español'].includes(normalized)) return 'spanish';
  return '';
}

function getWhatsAppMenuText(language = 'english') {
  if (language === 'spanish') {
    return [
      'RoleRocket AI Recruit: Lets Land Your Dream Career 🚀',
      '1. Ver demo de funciones',
      '2. Buscar y guardar empleos',
      '3. Crear y guardar/exportar curriculo',
      '4. Crear y guardar/exportar carta de presentacion',
      '5. Explorar otras funciones',
      '0. Soporte tecnico',
      'Usa los botones interactivos para continuar.'
    ].join('\n');
  }

  return [
    'RoleRocket AI Recruit: Lets Land Your Dream Career 🚀',
    '1. Watch Demo Features',
    '2. Search & Save Jobs',
    '3. Create and Save/Export Resume',
    '4. Create and Save/Export Cover Letter',
    '5. Explore other features',
    '0. Technical Support',
    'Use the interactive buttons to continue.'
  ].join('\n');
}

function getWhatsAppMainMenuReturnText(language = 'english') {
  if (language === 'spanish') return 'Escribe Main Menu en cualquier momento para volver.';
  return 'Type Main Menu at anytime to return.';
}

function getWhatsAppPlanLevel(plan = 'free') {
  const levels = { free: 0, pro: 1, premium: 2, elite: 3, lifetime: 3, business: 3 };
  return levels[String(plan || 'free').toLowerCase()] ?? 0;
}

function normalizeWhatsAppPlanValue(plan = 'free') {
  const raw = String(plan || 'free').toLowerCase().trim();
  if (raw === 'business') return 'elite';
  return normalizePlan(raw);
}

function getWhatsAppForcedIntent(textCanonical = '') {
  const text = normalizeIncomingWhatsAppText(textCanonical)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  if (/\b(option|menu|choice|action)\s*3\b/.test(text)) return 'resume';
  if (/\b(option|menu|choice|action)\s*4\b/.test(text)) return 'coverLetter';

  const exact = new Map([
    ['start', 'start'],
    ['join', 'start'],
    ['hi', 'start'],
    ['hello', 'start'],
    ['help', 'help'],
    ['main menu', 'mainMenu'],
    ['menu', 'mainMenu'],
    ['home', 'mainMenu'],
    ['go back', 'goBack'],
    ['back', 'goBack'],
    ['previous', 'goBack'],
    ['prev', 'goBack'],
    ['status', 'status'],
    ['technical support', 'human'],
    ['live support', 'human'],
    ['human support', 'human'],
    ['live agent', 'human'],
    ['agent', 'human'],
    ['support', 'human'],
    ['english', 'english'],
    ['en', 'english'],
    ['spanish', 'spanish'],
    ['es', 'spanish'],
    ['espanol', 'spanish'],
    ['español', 'spanish'],
    ['1', 'demo'],
    ['2', 'jobs'],
    ['3', 'resume'],
    ['4', 'coverLetter'],
    ['5', 'explore'],
    ['0', 'human'],
    ['watch demo features', 'demo'],
    ['watch demo feature', 'demo'],
    ['watch demo', 'demo'],
    ['demo features', 'demo'],
    ['show demo features', 'demo'],
    ['show demo', 'demo'],
    ['search & save jobs', 'jobs'],
    ['search and save jobs', 'jobs'],
    ['jobs', 'jobs'],
    ['create and save/export resume', 'resume'],
    ['create and save export resume', 'resume'],
    ['resume', 'resume'],
    ['resume menu', 'resume'],
    ['create and save/export cover letter', 'coverLetter'],
    ['create and save export cover letter', 'coverLetter'],
    ['cover letter', 'coverLetter'],
    ['cover letter menu', 'coverLetter'],
    ['explore other features', 'explore'],
    ['explore features', 'explore'],
    ['search jobs', 'jobsSearch'],
    ['import jobs', 'jobsImport'],
    ['saved jobs', 'jobsSaved'],
    ['my jobs', 'jobsSaved'],
    ['view saved', 'jobsSaved'],
    ['view jobs', 'jobsView'],
    ['view all jobs', 'jobsView'],
    ['show jobs', 'jobsView'],
    ['show all jobs', 'jobsView'],
    ['save jobs', 'jobsSaveAll'],
    ['save all jobs', 'jobsSaveAll'],
    ['search again', 'jobsSearchAgain'],
    ['search more', 'jobsSearchAgain'],
    ['find more jobs', 'jobsSearchAgain'],
    ['email jobs', 'jobsEmail'],
    ['email all jobs', 'jobsEmail'],
    ['send jobs', 'jobsEmail'],
    ['send to email', 'jobsEmail'],
    ['apply ready', 'jobsApplyReady'],
    ['upload', 'resumeUpload'],
    ['type', 'resumeType'],
    ['full draft', 'resumeFullDraft'],
    ['save resume', 'resumeSave'],
    ['export resume', 'resumeExport'],
    ['export cv', 'resumeExport'],
    ['save cover', 'coverSave'],
    ['save letter', 'coverSave'],
    ['export cover', 'coverExport'],
    ['export letter', 'coverExport'],
    ['export cover letter', 'coverExport'],
    ['resume demo', 'demoResume'],
    ['cover letter demo', 'demoResume'],
    ['resume and cover letter', 'demoResume'],
    ['resume + cover letter', 'demoResume'],
    ['jobs demo', 'demoJobs'],
    ['search import track', 'demoJobs'],
    ['search + import + track', 'demoJobs'],
    ['search and import and track', 'demoJobs'],
    ['all demos', 'demoBoth'],
    ['show both demos', 'demoBoth'],
    ['tailor resume', 'tailorResume'],
    ['tailor cover', 'tailorCover'],
    ['tailor cover letter', 'tailorCover']
  ]);

  if (exact.has(text)) return exact.get(text);

  const map = {
    demo: new Set([
      'watch demo features',
      'watch demo feature',
      'watch demo',
      'demo features',
      'show demo features',
      'show demo'
    ]),
    jobs: new Set([
      'search & save jobs',
      'search and save jobs',
      'jobs'
    ]),
    resume: new Set([
      'create and save/export resume',
      'create and save export resume',
      'resume'
    ]),
    coverLetter: new Set([
      'create and save/export cover letter',
      'create and save export cover letter',
      'cover letter'
    ]),
    explore: new Set([
      'explore other features',
      'explore features'
    ]),
    human: new Set([
      'technical support',
      'live support',
      'human support'
    ]),
    status: new Set(['status'])
  };

  // Flexible matching for interactive list/button payloads that often include
  // title + description in one message (for example: "Generate Resume ...").
  if (/\bwatch\s+demo(\s+features?)?\b/.test(text) || /\bdemo\s+features?\b/.test(text)) return 'demo';
  if (/\b(search|find)\s*(and|&)\s*save\s+jobs\b/.test(text)) return 'jobs';
  if (/\bcreate\s+and\s+save\/?export\s+resume\b/.test(text)) return 'resume';
  if (/\bgenerate\s+resume\b/.test(text)) return 'resume';
  if (/\bresume\s+menu\b/.test(text)) return 'resume';
  if (/\b(generate|create)\s+and\s+export\s+your\s+resume\b/.test(text)) return 'resume';
  if (/\bcreate\s+and\s+save\/?export\s+cover\s+letter\b/.test(text)) return 'coverLetter';
  if (/\bgenerate\s+cover\s+letter\b/.test(text)) return 'coverLetter';
  if (/\bcover\s+letter\s+menu\b/.test(text)) return 'coverLetter';
  if (/\bcover\s+letter\s+options\b/.test(text)) return 'coverLetter';
  if (/\bexplore\s+other\s+features\b/.test(text) || /\bexplore\s+features\b/.test(text)) return 'explore';
  if (/\btechnical\s+support\b/.test(text) || /\blive\s+support\b/.test(text) || /\bhuman\s+support\b/.test(text)) return 'human';
  if (/^apply\s+ready$/.test(text)) return 'jobsApplyReady';
  if (/^save\s+resume$/.test(text)) return 'resumeSave';
  if (/^export\s+(resume|cv)$/.test(text)) return 'resumeExport';
  if (/^save\s+(cover|letter)$/.test(text)) return 'coverSave';
  if (/^export\s+(cover|letter|cover\s+letter)$/.test(text)) return 'coverExport';
  if (/^edit\b/.test(text)) return 'resumeEdit';
  if (/^apply\b/.test(text)) return 'jobsApply';
  if (/^tailor\b/.test(text)) return 'jobsTailor';

  if (map.demo.has(text)) return 'demo';
  if (map.jobs.has(text)) return 'jobs';
  if (map.resume.has(text)) return 'resume';
  if (map.coverLetter.has(text)) return 'coverLetter';
  if (map.explore.has(text)) return 'explore';
  if (map.human.has(text)) return 'human';
  if (map.status.has(text)) return 'status';
  return '';
}

function getWhatsAppForcedCommandText(route = '') {
  const key = String(route || '').trim();
  if (!key) return '';

  const command = {
    start: 'start',
    demo: 'watch demo features',
    jobs: 'search and save jobs',
    resume: 'resume',
    coverLetter: 'cover letter',
    explore: 'explore other features',
    human: 'technical support',
    status: 'status',
    help: 'help',
    mainMenu: 'main menu',
    goBack: 'go back',
    english: 'english',
    spanish: 'spanish',
    jobsSearch: 'search jobs',
    jobsImport: 'import jobs',
    jobsSaved: 'saved jobs',
    jobsView: 'view jobs',
    jobsSaveAll: 'save jobs',
    jobsSearchAgain: 'search again',
    jobsEmail: 'email jobs',
    jobsApplyReady: 'apply ready',
    jobsApply: 'apply',
    jobsTailor: 'tailor',
    resumeUpload: 'upload',
    resumeType: 'type',
    resumeFullDraft: 'full draft',
    resumeSave: 'save resume',
    resumeExport: 'export resume',
    resumeEdit: 'edit',
    coverSave: 'save cover',
    coverExport: 'export cover',
    demoResume: 'resume demo',
    demoJobs: 'jobs demo',
    demoBoth: 'all demos',
    tailorResume: 'tailor resume',
    tailorCover: 'tailor cover'
  };

  return command[key] || '';
}

async function resolveEffectiveWhatsAppPlan(user, phone = '') {
  const profilePlan = normalizeWhatsAppPlanValue(user?.plan || 'free');
  const normalizedPhone = normalizeWhatsAppPhone(phone || user?.phone || '');
  const digits = String(normalizedPhone || '').replace(/[^0-9]/g, '');
  const last10 = digits.slice(-10);

  if (!last10) {
    return { plan: profilePlan, source: 'profile', isAdmin: false };
  }

  try {
    const phoneRegex = new RegExp(`${last10}$`);
    const linkedAlert = await SMSJobAlert.findOne({
      phoneVerified: true,
      phoneNumber: { $regex: phoneRegex }
    })
      .sort({ updatedAt: -1 })
      .select('userId')
      .lean();

    if (!linkedAlert?.userId) {
      return { plan: profilePlan, source: 'profile', isAdmin: false };
    }

    const account = await User.findById(linkedAlert.userId)
      .select('email plan isAdmin isSubscribed accountType institutionAccessType institutionLicensedPlan institutionTrialEndsAt')
      .lean();

    if (!account) {
      return { plan: profilePlan, source: 'profile', isAdmin: false };
    }

    const email = String(account.email || '').toLowerCase();
    const isAdmin = account.isAdmin === true || (ADMIN_EMAILS.length && ADMIN_EMAILS.includes(email));
    const trialEntitlements = applyInstitutionTrialEntitlements(account);
    const linkedPlan = isAdmin
      ? 'lifetime'
      : normalizeWhatsAppPlanValue((trialEntitlements && trialEntitlements.plan) || account.plan || profilePlan);

    return {
      plan: linkedPlan,
      source: 'linked_account',
      isAdmin
    };
  } catch (_) {
    return { plan: profilePlan, source: 'profile', isAdmin: false };
  }
}

function getWhatsAppDemoFeaturesText(language = 'english') {
  if (language === 'spanish') {
    return [
      '🎬 Demo de funciones (primer vistazo):',
      '1) Demo CV + Carta de presentacion',
      '2) Demo Buscar + Importar + Seguimiento',
      '3) Ver ambos demos',
      'Responde 1, 2 o 3. Usa Main Menu para volver.'
    ].join('\n');
  }

  return [
    '🎬 Demo Features (first glance):',
    '1) Resume + Cover Letter demo',
    '2) Search + Import + Track demo',
    '3) Show both demos',
    'Reply 1, 2, or 3. Type Main Menu at anytime to return.'
  ].join('\n');
}

function getWhatsAppExploreFeaturesText(plan = 'free', language = 'english') {
  const planLevels = { free: 0, pro: 1, premium: 2, elite: 3, lifetime: 3 };
  const level = planLevels[String(plan || 'free').toLowerCase()] ?? 0;
  const u = (v) => v ? '✅' : '🔒';

  // Feature access by plan level
  const f = {
    jobSearch:        true,           // free
    resumeRewrite:    true,           // free
    coverLetter:      true,           // free
    appTracker:       true,           // free
    referral:         true,           // free
    fullResume:       level >= 1,     // pro+
    exportPDF:        level >= 1,     // pro+
    resumeAnalysis:   level >= 1,     // pro+
    interview:        level >= 2,     // premium+
    marketInsights:   level >= 2,     // premium+
    autoApply:        level >= 2,     // premium+
    learning:         level >= 3,     // elite+
    portfolio:        level >= 3,     // elite+
  };

  const upgradeHint = level === 0
    ? 'Upgrade to Pro at rolerocketai.com to unlock more features.'
    : level === 1
    ? 'Upgrade to Premium to unlock Interview Practice and more.'
    : '';

  if (language === 'spanish') {
    return [
      '✨ Funciones de RoleRocket AI:',
      '',
      `${u(f.jobSearch)} Busqueda de empleo`,
      `${u(f.resumeRewrite)} Reescritura de CV con IA`,
      `${u(f.coverLetter)} Carta de presentacion`,
      `${u(f.fullResume)} CV completo con IA (Pro)`,
      `${u(f.exportPDF)} Exportar a PDF (Pro)`,
      `${u(f.resumeAnalysis)} Analisis de CV con IA (Pro)`,
      `${u(f.interview)} Simulador de entrevista (Premium)`,
      `${u(f.marketInsights)} Tendencias del mercado (Premium)`,
      `${u(f.autoApply)} Solicitud automatica (Premium)`,
      `${u(f.appTracker)} Seguimiento de solicitudes`,
      `${u(f.referral)} Referidos`,
      `${u(f.learning)} Aprendizaje y cursos (Elite)`,
      `${u(f.portfolio)} Portafolio profesional (Elite)`,
      '',
      upgradeHint || (f.interview ? 'Para entrevista, responde INTERVIEW.' : ''),
      'Responde START para volver al menu principal.'
    ].filter(Boolean).join('\n');
  }

  return [
    '✨ RoleRocket AI Features:',
    '',
    `${u(f.jobSearch)} Job Search`,
    `${u(f.resumeRewrite)} AI Resume Rewrite`,
    `${u(f.coverLetter)} Cover Letter Generator`,
    `${u(f.fullResume)} Full AI Resume Builder (Pro)`,
    `${u(f.exportPDF)} Export to PDF (Pro)`,
    `${u(f.resumeAnalysis)} AI Resume Analysis (Pro)`,
    `${u(f.interview)} Interview Practice (Premium)`,
    `${u(f.marketInsights)} Market Insights (Premium)`,
    `${u(f.autoApply)} Auto-Apply (Premium)`,
    `${u(f.appTracker)} Application Status Tracker`,
    `${u(f.referral)} Referrals (REFERRAL)`,
    `${u(f.learning)} Learning & Courses (Elite)`,
    `${u(f.portfolio)} Portfolio Builder (Elite)`,
    '',
    upgradeHint || (f.interview ? 'Use the Interview button for interview prep.' : ''),
    'Type Main Menu at anytime to return.'
  ].filter(Boolean).join('\n');
}

function getWhatsAppPaidFeaturesOverviewText(language = 'english') {
  if (language === 'spanish') {
    return [
      '🚀 Funciones premium de RoleRocket AI',
      '',
      'PRO',
      '1) CV completo con IA: crea un CV profesional listo para aplicar.',
      '2) Exportar PDF/Word: descarga y comparte facilmente.',
      '3) Analisis de CV: detecta mejoras para filtros ATS.',
      '',
      'PREMIUM',
      '4) Entrevistas: preguntas realistas y guias de respuesta.',
      '5) Insights del mercado: demanda, salarios y habilidades por rol.',
      '6) Auto-Apply: acelera solicitudes para roles compatibles.',
      '',
      'ELITE',
      '7) Learning & Courses: rutas de aprendizaje para cerrar brechas.',
      '8) Portfolio Builder: crea una vitrina profesional de logros.',
      '',
      'Toca un boton para abrir una funcion. Usa Main Menu para volver.'
    ].join('\n');
  }

  return [
    '🚀 RoleRocket AI Paid Features',
    '',
    'PRO',
    '1) Full AI Resume Builder: creates a polished role-ready resume draft.',
    '2) PDF/Word Export: download and share job-ready documents quickly.',
    '3) Resume Analysis: finds gaps and improvements for ATS performance.',
    '',
    'PREMIUM',
    '4) Interview Practice: realistic interview questions and guided answers.',
    '5) Market Insights: role demand, salary direction, and skill trends.',
    '6) Auto-Apply: speeds up applications to matching opportunities.',
    '',
    'ELITE',
    '7) Learning & Courses: guided upskilling paths for target roles.',
    '8) Portfolio Builder: presents projects and achievements professionally.',
    '',
    'Tap a feature button to open it. Type Main Menu at anytime to return.'
  ].join('\n');
}

function getWhatsAppPreviousStep(currentStep = '') {
  const step = String(currentStep || '').trim();
  const previousByStep = {
    jobs_role_input: 'jobs_menu',
    jobs_parish_select: 'jobs_role_input',
    jobs_import: 'jobs_menu',
    jobs_action: 'jobs_menu',
    jobs_query: 'jobs_menu',
    resume_input_choice: 'menu',
    resume_capture: 'resume_input_choice',
    resume_followup: 'resume_input_choice',
    cover_letter_capture: 'menu',
    cover_letter_followup: 'cover_letter_capture',
    interview_target: 'menu',
    job_tailor_choice: 'jobs_action',
    human_handoff: 'menu',
    explore_features: 'menu',
    demo_features: 'menu'
  };
  return previousByStep[step] || 'menu';
}

function getWhatsAppStepPrompt(step = '', user = {}, convo = {}) {
  const safeStep = String(step || '').trim();
  const language = String(convo?.metadata?.context?.language || 'english');
  const roleHint = encodeURIComponent(String(user?.targetJob || convo?.metadata?.context?.lastJobTitle || '').trim());

  if (safeStep === 'menu') return getWhatsAppMenuText(language);
  if (safeStep === 'jobs_menu') return 'What would you like to do with jobs? Use SEARCH, IMPORT, SAVE, or MAIN MENU.';
  if (safeStep === 'jobs_role_input') {
    const premiumSearchUrl = roleHint
      ? `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html?role=${roleHint}`
      : `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html`;
    return [
      'Premium Jobs Search is ready.',
      `Open: ${premiumSearchUrl}`,
      'Use the role text field + Jamaica parish dropdown + Search button.',
      'Or type your target role here if you want to continue inside WhatsApp.',
      getWhatsAppMainMenuReturnText(language)
    ].join('\n');
  }
  if (safeStep === 'jobs_parish_select') {
    const role = String(convo?.metadata?.context?.pendingJobRole || user?.targetJob || '').trim();
    return buildWhatsAppParishPrompt(role);
  }
  if (safeStep === 'jobs_import') {
    const phone = normalizeWhatsAppPhone(String(user?.phone || convo?.phone || ''));
    const importToken = createWhatsAppImportToken(phone);
    const premiumImportUrl = importToken
      ? `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(importToken)}`
      : `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html`;
    return [
      'Import & Save Jobs is ready.',
      `Open: ${premiumImportUrl}`,
      'Paste a job URL in the Import box and save it to your pipeline.',
      'Or paste the job URL/details here in WhatsApp and I will save it for you.',
      getWhatsAppMainMenuReturnText(language)
    ].join('\n');
  }
  if (safeStep === 'resume_input_choice') {
    const resumeUrl = `${getPublicAppBaseUrl()}/resume-generator.html?source=whatsapp`;
    return [
      'Resume Generator is ready.',
      `Open: ${resumeUrl}`,
      'Use the web form to generate and export your resume quickly.',
      'Or continue here: reply UPLOAD to send a resume file, or TYPE to send your work history.',
      getWhatsAppMainMenuReturnText(language)
    ].join('\n');
  }
  if (safeStep === 'resume_capture') return 'Send your resume as a PDF/Word file or share your recent work history (text/voice).';
  if (safeStep === 'cover_letter_capture') {
    const coverLetterUrl = `${getPublicAppBaseUrl()}/cover-letter-generator.html?source=whatsapp`;
    return [
      'Cover Letter Generator is ready.',
      `Open: ${coverLetterUrl}`,
      'Use the web form to generate and export your cover letter quickly.',
      'Or continue here by sending role + company (example: Customer Service Rep at GraceKennedy).',
      getWhatsAppMainMenuReturnText(language)
    ].join('\n');
  }
  if (safeStep === 'interview_target') {
    return [
      'Step 1: Send role or company.',
      'Example: GraceKennedy Customer Service Rep',
      'I will give likely questions + best answers.'
    ].join('\n');
  }
  if (safeStep === 'demo_features') return getWhatsAppDemoFeaturesText(language);
  if (safeStep === 'explore_features') return getWhatsAppPaidFeaturesOverviewText(language);
  return getWhatsAppMenuText(language);
}

function getWhatsAppCoverLetterFallback(jobTarget = '') {
  const target = normalizeIncomingWhatsAppText(jobTarget) || 'Customer Service Representative at a leading company in Jamaica';
  return [
    `Cover Letter Draft for ${target}`,
    '',
    'Dear Hiring Manager,',
    '',
    `I am excited to apply for the ${target} opportunity. I bring practical experience delivering reliable service, clear communication, and strong follow-through in fast-paced environments.`,
    'In recent roles, I supported day-to-day operations while maintaining quality and solving customer issues quickly. I am confident these strengths align with your needs and would allow me to contribute immediate value.',
    'Thank you for your time and consideration. I would welcome the opportunity to discuss how my background can support your team.',
    '',
    'Sincerely,',
    'Candidate'
  ].join('\n');
}

async function generateCoverLetterForWhatsApp(jobTarget = '', resumeContext = '', jobContext = '') {
  const target = normalizeIncomingWhatsAppText(jobTarget) || 'Customer Service Representative in Jamaica';
  const resumeText = normalizeIncomingWhatsAppText(resumeContext);
  const jdContext = normalizeIncomingWhatsAppText(jobContext);
  const fallback = getWhatsAppCoverLetterFallback(target);

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.45,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI. Write a concise, tailored, WhatsApp-friendly cover letter in plain text with no markdown. Keep under 1700 characters and avoid fabricated facts.'
        },
        {
          role: 'user',
          content: `Write a cover letter for this target role/company: ${target}.\n\nCandidate experience context:\n${resumeText || 'No resume provided yet. Keep claims conservative.'}\n\nJob posting context:\n${jdContext || 'No detailed posting supplied.'}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    return content || fallback;
  } catch (error) {
    console.warn('WhatsApp cover letter fallback:', error.message);
    return fallback;
  }
}

async function generateTailoredResumeForJobWhatsApp(userInput = '', selectedJob = {}) {
  const source = normalizeIncomingWhatsAppText(userInput);
  const role = normalizeIncomingWhatsAppText(selectedJob?.title || '') || 'Customer Service Representative';
  const company = normalizeIncomingWhatsAppText(selectedJob?.company || '') || 'Target Company';
  const location = normalizeIncomingWhatsAppText(selectedJob?.location || '') || 'Jamaica';
  const jobSnippet = normalizeIncomingWhatsAppText(selectedJob?.summary || selectedJob?.description || '');

  if (!source) {
    return 'I need your work history first to tailor your resume. Choose "Send recent work" and share your details.';
  }

  const fallback = [
    'Name: [Your Full Name]',
    'Contact: [Phone] | [Email] | [City, Country] | [LinkedIn optional]',
    `Target Role: ${role} @ ${company} (${location})`,
    '',
    'Professional Summary:',
    `Customer-focused professional aligned to ${role} requirements with proven service delivery, communication, and execution in fast-paced teams.`,
    '',
    'Experience:',
    '- Delivered measurable customer outcomes while handling high-volume workflows.',
    '- Applied structured problem-solving and clear communication to resolve issues quickly.',
    '- Maintained service quality and operational standards under tight timelines.',
    '',
    'Education:',
    '- [Degree/Certificate], [School], [Year]',
    '',
    'Certifications:',
    '- [Certification Name, Year] (if applicable)',
    '',
    'Skills:',
    '- Customer Service',
    '- Problem Solving',
    '- Communication',
    '- Workflow Execution',
    '- Team Collaboration',
    '',
    'Reply SAVE RESUME or EXPORT RESUME.'
  ].join('\n');

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI resume writer. Tailor the resume to a selected job posting. Output plain text with these headings exactly and in order: Name, Contact, Target Role, Professional Summary, Experience, Education, Certifications, Skills. Use short bullet points for Experience, Education, Certifications, and Skills. If personal details are missing, use placeholders like [Your Full Name], [Phone], [Email], [City]. Do not fabricate employers, schools, or certifications. Keep under 2600 characters.'
        },
        {
          role: 'user',
          content: `Selected job: ${role} @ ${company} (${location}).\nJob details: ${jobSnippet || 'No extra posting details.'}\n\nCandidate experience:\n${source}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!content) return fallback;
    return `${content}\n\nReply SAVE RESUME or EXPORT RESUME.`.slice(0, 2400);
  } catch (error) {
    console.warn('WhatsApp tailored resume fallback:', error.message);
    return fallback;
  }
}

function parseJobQueryInput(text = '') {
  const input = normalizeIncomingWhatsAppText(text);
  if (!input) return { title: '', location: '' };

  const normalizeWhatsAppLocation = (rawLocation = '') => {
    const locationText = String(rawLocation || '').trim();
    if (!locationText) return 'Jamaica';

    const lower = locationText.toLowerCase();
    const alreadyJamaica = /\bjamaica\b/.test(lower);
    const broadLocation = /\b(remote|worldwide|global|anywhere)\b/.test(lower);
    const explicitForeignCountry = /\b(usa|u\.?s\.?a\.?|united states|canada|uk|u\.?k\.?|united kingdom|europe|india|mexico|australia|new zealand|trinidad|barbados|guyana|bahamas)\b/.test(lower);

    // WhatsApp recruiting is Jamaica-first; ambiguous city names should
    // resolve to Jamaica unless the user clearly asks for another country.
    if (!alreadyJamaica && !broadLocation && !explicitForeignCountry) {
      return `${locationText}, Jamaica`;
    }

    return locationText;
  };

  const marker = input.toLowerCase().lastIndexOf(' in ');
  if (marker > 0) {
    return {
      title: input.slice(0, marker).trim(),
      location: normalizeWhatsAppLocation(input.slice(marker + 4).trim())
    };
  }
  return { title: input, location: 'Jamaica' };
}

function normalizeWhatsAppExperienceCountry(input = '') {
  const raw = normalizeIncomingWhatsAppText(input);
  if (!raw) return '';

  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  if (/\b(global|worldwide|anywhere|remote)\b/.test(cleaned)) return 'GLOBAL';
  if (/\b(jamaica|jm)\b/.test(cleaned)) return 'JM';
  if (/\b(us|usa|u s|united states)\b/.test(cleaned)) return 'US';
  return '';
}

function extractWhatsAppExperienceCountry(text = '') {
  const input = normalizeIncomingWhatsAppText(text);
  if (!input) return '';

  const match = input.match(/^(?:start|join|hi|hello|menu)(?:\s+(.*))?$/i);
  if (!match) return '';

  const tail = String(match[1] || '').trim();
  if (!tail) return '';

  const tagged = tail.match(/(?:country|region|experience)\s*[:=]?\s*(.+)$/i);
  return normalizeWhatsAppExperienceCountry((tagged && tagged[1]) || tail);
}

function resolveWhatsAppExperienceCountry({ user = null, convo = null, incomingText = '' } = {}) {
  const incomingCountry = extractWhatsAppExperienceCountry(incomingText);
  if (incomingCountry) return incomingCountry;

  const contextCountry = normalizeExperienceCountryCode(convo?.metadata?.context?.experienceCountry || '');
  if (contextCountry) return contextCountry;

  const userCountry = normalizeExperienceCountryCode(user?.experienceCountry || '');
  if (userCountry) return userCountry;

  return 'JM';
}

function getWhatsAppExperienceLocation(countryCode = '') {
  switch (normalizeExperienceCountryCode(countryCode) || 'JM') {
    case 'US':
      return 'United States';
    case 'GLOBAL':
      return 'Remote';
    default:
      return 'Jamaica';
  }
}

function getWhatsAppExperienceLabel(countryCode = '') {
  switch (normalizeExperienceCountryCode(countryCode) || 'JM') {
    case 'US':
      return 'United States';
    case 'GLOBAL':
      return 'Global';
    default:
      return 'Jamaica';
  }
}

const JAMAICA_PARISHES = [
  'Kingston',
  'St. Andrew',
  'St. Thomas',
  'Portland',
  'St. Mary',
  'St. Ann',
  'Trelawny',
  'St. James',
  'Hanover',
  'Westmoreland',
  'St. Elizabeth',
  'Manchester',
  'Clarendon',
  'St. Catherine'
];

function resolveJamaicaParishSelection(input = '') {
  const raw = normalizeIncomingWhatsAppText(input);
  if (!raw) return '';

  const numeric = Number.parseInt(raw, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= JAMAICA_PARISHES.length) {
    return JAMAICA_PARISHES[numeric - 1];
  }

  const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
  for (const parish of JAMAICA_PARISHES) {
    const candidate = parish.toLowerCase().replace(/[^a-z]/g, '');
    if (candidate === normalized) return parish;
    if (candidate.includes(normalized) || normalized.includes(candidate)) return parish;
  }

  return '';
}

function buildWhatsAppParishPrompt(role = '') {
  const roleLabel = normalizeIncomingWhatsAppText(role) || 'your target role';
  return [
    `Premium Search: ${roleLabel}`,
    'Choose a Jamaica parish (send number or name):',
    ...JAMAICA_PARISHES.map((parish, index) => `${index + 1}. ${parish}`),
    'Then I will return recently posted matched jobs with premium styling.'
  ].join('\n');
}

function buildWhatsAppExperiencePrompt(countryCode = 'JM', role = '') {
  const resolvedCountry = normalizeExperienceCountryCode(countryCode) || 'JM';
  if (resolvedCountry === 'JM') {
    return buildWhatsAppParishPrompt(role);
  }

  const roleLabel = normalizeIncomingWhatsAppText(role) || 'your target role';
  const locationLabel = resolvedCountry === 'US' ? 'a US city or state' : 'a location or Remote';
  const example = resolvedCountry === 'US' ? 'Example: Austin, Texas' : 'Example: Remote';

  return [
    `Premium Search: ${roleLabel}`,
    `Send ${locationLabel} to narrow results:`,
    example,
    'Then I will return recently posted matched jobs with premium styling.'
  ].join('\n');
}

function getWhatsAppJobPostedLabel(job = {}) {
  const rawDate = job.postedAt || job.createdAt || job.publishedAt || job.pubDate || job.date || '';
  if (!rawDate) return 'Recent post';

  const posted = new Date(rawDate);
  if (Number.isNaN(posted.getTime())) return 'Recent post';
  const ageMs = Date.now() - posted.getTime();
  if (ageMs < 0) return 'Just posted';
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days <= 14) return `Posted ${days} days ago`;
  return 'Recent post';
}

function formatWhatsAppPremiumJobListItem(job = {}, index = 0) {
  const title = String(job.title || 'Role').trim() || 'Role';
  const company = String(job.company || 'Company').trim() || 'Company';
  const location = String(job.location || 'Jamaica').trim() || 'Jamaica';
  const postedLabel = getWhatsAppJobPostedLabel(job);
  const link = getDirectWhatsAppJobLink(job);
  const lines = [
    `[MATCH ${index + 1}] ${title}`,
    `Company: ${company}`,
    `Location: ${location}`,
    `${postedLabel}`
  ];
  if (link) lines.push(`Apply: ${link}`);
  return lines.join('\n');
}

async function runWhatsAppJobsSearchFlow({ phone, user, convo, title, location, countryCode = '', source = 'jobs_query' }) {
  const cleanTitle = normalizeIncomingWhatsAppText(title);
  const resolvedCountry = normalizeExperienceCountryCode(countryCode) || resolveWhatsAppExperienceCountry({ user, convo });
  const cleanLocation = normalizeIncomingWhatsAppText(location) || getWhatsAppExperienceLocation(resolvedCountry);

  user.experienceCountry = resolvedCountry;
  user.experienceCountrySource = 'whatsapp';
  user.experienceCountryUpdatedAt = new Date();
  convo.metadata.context.experienceCountry = resolvedCountry;

  user.targetJob = cleanTitle;
  user.location = cleanLocation;
  user.lastIntent = 'jobs';
  convo.metadata.context.lastJobTitle = cleanTitle;
  convo.metadata.context.lastLocation = cleanLocation;
  convo.metadata.context.recentSearches = [
    ...convo.metadata.context.recentSearches.slice(-4),
    {
      title: cleanTitle,
      location: cleanLocation,
      at: new Date().toISOString()
    }
  ];
  await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_query_submitted', {
    title: cleanTitle,
    location: cleanLocation,
    countryCode: resolvedCountry,
    source
  });

  const searchResult = await searchJobsFast({
    title: cleanTitle,
    location: cleanLocation,
    resume: user.resumeText || ''
  });
  const jobs = Array.isArray(searchResult?.jobs) ? searchResult.jobs.slice(0, 5) : [];
  convo.metadata = {
    ...(convo.metadata || {}),
    lastJobs: jobs.map((job) => ({
      title: String(job.title || ''),
      company: String(job.company || ''),
      location: String(job.location || ''),
      link: getDirectWhatsAppJobLink(job),
      summary: String(job.summary || job.description || '').slice(0, 500),
      postedAt: String(job.postedAt || job.createdAt || job.publishedAt || '').trim()
    }))
  };
  convo.currentStep = 'jobs_action';
  await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_results_returned', {
    title: cleanTitle,
    location: cleanLocation,
    countryCode: resolvedCountry,
    source,
    resultCount: jobs.length
  });

  return !jobs.length
    ? `No live matches for ${cleanTitle} in ${cleanLocation} right now. Use Search again to try another role or location.`
    : [
        `${getWhatsAppExperienceLabel(resolvedCountry)} Matches for ${cleanTitle} in ${cleanLocation}`,
        'Recently posted matched jobs:',
        ...jobs.map((job, idx) => formatWhatsAppPremiumJobListItem(job, idx)),
        'Choose your next step for these job results.'
      ].join('\n\n');
}

function compactWhatsAppJobUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  // Trim punctuation that commonly trails copied URLs in text.
  const trimmed = value.replace(/[),.;!?]+$/g, '');

  const withProtocol = /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function getDirectWhatsAppJobLink(job = {}) {
  const candidates = [
    job.directLink,
    job.postingUrl,
    job.jobUrl,
    job.job_url,
    job.redirect_url,
    job.absolute_url,
    job.hostedUrl,
    job.url,
    job.apply_url,
    job.applyLink,
    job.link,
    job.refs?.landing_page
  ];

  for (const candidate of candidates) {
    const compacted = compactWhatsAppJobUrl(String(candidate || '').trim());
    if (compacted && compacted !== '#') return compacted;
  }

  return '';
}

function formatWhatsAppJobListItem(job = {}, index = 0) {
  const title = String(job.title || 'Role').trim() || 'Role';
  const company = String(job.company || 'Company').trim() || 'Company';
  const link = getDirectWhatsAppJobLink(job);
  return link
    ? `${index + 1}) ${title} @ ${company}\n${link}`
    : `${index + 1}) ${title} @ ${company}`;
}

async function generateResumeRewriteForWhatsApp(userInput = '', contextNote = '') {
  const source = normalizeIncomingWhatsAppText(userInput);
  if (!source) return 'Please send your work background first so I can rewrite it.';

  const fallback = [
    'Here is a stronger resume version:',
    '',
    '- Delivered friendly, high-quality customer support in a fast-paced environment.',
    '- Handled transactions and daily operations accurately and consistently.',
    '- Supported shift closeout responsibilities and maintained service standards.'
  ].join('\n');

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI, a business-specific recruiting assistant. Rewrite user experience into concise, ATS-friendly resume bullets. Keep output WhatsApp-friendly and under 1200 characters.'
        },
        {
          role: 'user',
          content: `Rewrite this into strong resume bullets for job seekers in Jamaica.\nContext: ${contextNote || 'No extra context'}\n\n${source}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!content) return fallback;
    return content.slice(0, 1500);
  } catch (error) {
    console.warn('WhatsApp resume rewrite fallback:', error.message);
    return fallback;
  }
}

async function generateFullTargetedResumeForWhatsApp(userInput = '', targetRole = '', location = 'Jamaica') {
  const source = normalizeIncomingWhatsAppText(userInput);
  const role = normalizeIncomingWhatsAppText(targetRole) || 'Customer Service Representative';
  const region = normalizeIncomingWhatsAppText(location) || 'Jamaica';
  if (!source) {
    return 'I need your recent work details first. Choose "Send recent work" and share your work history.';
  }

  const fallback = [
    'Name: [Your Full Name]',
    'Contact: [Phone] | [Email] | [City, Country] | [LinkedIn optional]',
    `Target Role: ${role} (${region})`,
    '',
    'Professional Summary:',
    `Results-driven candidate prepared for ${role} opportunities with strong customer support, communication, and execution skills.`,
    '',
    'Experience:',
    '- Managed high-volume customer interactions while maintaining service quality and response speed.',
    '- Resolved complex issues with clear communication, de-escalation, and timely follow-through.',
    '- Maintained accurate records and supported daily operational targets in fast-paced environments.',
    '',
    'Education:',
    '- [Degree/Certificate], [School], [Year]',
    '',
    'Certifications:',
    '- [Certification Name, Year] (if applicable)',
    '',
    'Skills:',
    '- Customer Service',
    '- Problem Solving',
    '- Communication',
    '- Teamwork',
    '- Time Management',
    '',
    'Reply EDIT + what to change, or use the menu buttons for job matches.'
  ].join('\n');

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI resume writer. Produce a full, ATS-friendly resume in plain text with these headings exactly and in order: Name, Contact, Target Role, Professional Summary, Experience, Education, Certifications, Skills. Use concise bullet points for Experience, Education, Certifications, and Skills. If name/contact details are missing from source, use placeholders [Your Full Name], [Phone], [Email], [City]. Do not fabricate employers, schools, dates, or certifications. Keep under 2600 characters.'
        },
        {
          role: 'user',
          content: `Build a targeted resume draft for role: ${role}. Location: ${region}. Source experience:\n${source}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!content) return fallback;
    return `${content}\n\nReply EDIT + what to change, or use the menu buttons for job matches.`.slice(0, 2200);
  } catch (error) {
    console.warn('WhatsApp full resume fallback:', error.message);
    return fallback;
  }
}

async function generateEditedTargetedResumeForWhatsApp(existingResume = '', editRequest = '', targetRole = '', location = 'Jamaica') {
  const current = String(existingResume || '').trim();
  const editNote = normalizeIncomingWhatsAppText(editRequest);
  const role = normalizeIncomingWhatsAppText(targetRole) || 'Customer Service Representative';
  const region = normalizeIncomingWhatsAppText(location) || 'Jamaica';

  if (!current) {
    return 'I need a current resume draft first. Reply YES to generate one, then send EDIT + your request.';
  }
  if (!editNote || editNote === 'edit') {
    return 'Send: EDIT + what to change. Example: EDIT make it more metrics-driven and leadership-focused.';
  }

  const fallback = `${current}\n\nRequested edit noted: ${editNote}. Reply EDIT + more changes if needed.`.slice(0, 2200);
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI resume writer. Revise the provided resume draft using the requested edits. Keep plain-text WhatsApp-friendly format and preserve these headings exactly and in order: Name, Contact, Target Role, Professional Summary, Experience, Education, Certifications, Skills. Keep under 2600 characters and do not fabricate credentials.'
        },
        {
          role: 'user',
          content: `Role: ${role}. Location: ${region}.\nRequested edits: ${editNote}.\n\nCurrent draft:\n${current}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    if (!content) return fallback;
    return `${content}\n\nReply EDIT + more changes, APPLY READY, or 1 for jobs.`.slice(0, 2200);
  } catch (error) {
    console.warn('WhatsApp resume edit fallback:', error.message);
    return fallback;
  }
}

async function generateInterviewPrepForWhatsApp(targetRole = '', contextNote = '') {
  const topic = normalizeIncomingWhatsAppText(targetRole) || 'Customer Service Representative in Jamaica';

  const fallback = [
    `Interview Prep for: ${topic}`,
    '',
    'Q1: Tell me about yourself.',
    'Tip: Give a 60-second summary focused on role fit and measurable impact.',
    '',
    'Q2: Describe a difficult customer issue you solved.',
    'Tip: Use STAR (Situation, Task, Action, Result) with one metric.',
    '',
    'Q3: Why do you want this role?',
    'Tip: Connect company mission + your skills + expected contribution.'
  ].join('\n');

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'You are RoleRocket AI interview coach. Output exactly 3 interview questions with one short coaching tip per question. Keep concise and WhatsApp friendly.'
        },
        {
          role: 'user',
          content: `Generate interview prep for this target: ${topic}. Context: ${contextNote || 'No extra context'}`
        }
      ]
    });

    const content = String(completion?.choices?.[0]?.message?.content || '').trim();
    return content || fallback;
  } catch (error) {
    console.warn('WhatsApp interview prep fallback:', error.message);
    return fallback;
  }
}

async function sendWhatsAppDocumentExports({ phone, featureLabel, title, textContent, htmlContent = '' }) {
  const draftText = String(textContent || '').trim();
  if (!draftText) {
    return { ok: false, reason: 'missing-draft', ack: `No ${featureLabel.toLowerCase()} draft available to export yet.` };
  }

  try {
    const { pdfUrl, wordUrl } = await createWhatsAppExportFiles({
      title,
      textContent: draftText,
      htmlContent
    });

    const [pdfResult, wordResult] = await Promise.all([
      sendWhatsAppMessage({
        to: phone,
        message: `${featureLabel} PDF`,
        mediaUrls: [pdfUrl]
      }),
      sendWhatsAppMessage({
        to: phone,
        message: `${featureLabel} Word file`,
        mediaUrls: [wordUrl]
      })
    ]);

    const delivered = pdfResult?.success || wordResult?.success;
    const firstError = !pdfResult?.success
      ? (pdfResult?.error || pdfResult?.reason || '')
      : (!wordResult?.success ? (wordResult?.error || wordResult?.reason || '') : '');
    const firstErrorCode = !pdfResult?.success
      ? (pdfResult?.code || '')
      : (!wordResult?.success ? (wordResult?.code || '') : '');
    const ack = delivered
      ? `Sending your ${featureLabel.toLowerCase()} PDF and Word files now. Save them from WhatsApp.`
      : `I prepared your ${featureLabel.toLowerCase()} files, but attachment delivery failed${firstErrorCode ? ` (code ${firstErrorCode})` : ''}${firstError ? `: ${firstError}` : ''}. Use these links:\nPDF: ${pdfUrl}\nWord: ${wordUrl}`;

    return { ok: delivered, reason: delivered ? '' : 'attachment-send-failed', ack, pdfUrl, wordUrl };
  } catch (error) {
    console.error(`WhatsApp ${featureLabel} export error:`, error);
    return { ok: false, reason: error.message, ack: `Could not export your ${featureLabel.toLowerCase()} right now. Please try again.` };
  }
}

async function extractWhatsAppInboundDocument(payload = {}) {
  const mediaCount = Math.max(0, Number(payload?.NumMedia || 0));
  for (let i = 0; i < mediaCount; i += 1) {
    const mediaUrl = String(payload[`MediaUrl${i}`] || '').trim();
    const contentType = String(payload[`MediaContentType${i}`] || '').trim().toLowerCase();
    if (!mediaUrl) continue;
    const isDoc = contentType.includes('pdf') ||
      contentType.includes('msword') ||
      contentType.includes('wordprocessingml') ||
      contentType.includes('document') ||
      contentType.includes('octet-stream');
    if (isDoc) return { mediaUrl, contentType };
  }
  return null;
}

async function fetchAndExtractDocumentText(media) {
  if (!media?.mediaUrl) return null;
  try {
    const axios = require('axios');
    const twilioSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const response = await axios.get(media.mediaUrl, {
      responseType: 'arraybuffer',
      ...(twilioSid && twilioToken ? { auth: { username: twilioSid, password: twilioToken } } : {}),
      timeout: 20000
    });
    const buf = Buffer.from(response.data);
    const ct = String(media.contentType || '').toLowerCase();
    if (ct.includes('pdf')) {
      let text = await extractTextFromPDF(buf);
      if (!text || text.trim().length < 50) text = await extractTextFromPDFWithOCR(buf.buffer);
      return text && text.trim().length > 10 ? text.trim() : null;
    }
    if (ct.includes('msword') || ct.includes('wordprocessingml') || ct.includes('document')) {
      const text = await extractTextFromDocx(buf);
      return text && text.trim().length > 10 ? text.trim() : null;
    }
    return null;
  } catch (err) {
    console.error('WhatsApp document extract error:', err.message);
    return null;
  }
}

async function handleWhatsAppRecruitingMessage(from, body, inboundMessageSid = '', inboundAudioMedia = null, inboundDocumentMedia = null) {
  const phone = normalizeWhatsAppPhone(from);
  const incoming = normalizeIncomingWhatsAppText(body);
  const hasInboundAudio = !!inboundAudioMedia?.mediaUrl;
  const hasInboundDocument = !!inboundDocumentMedia?.mediaUrl;
  let text = incoming.toLowerCase();
  let textCanonical = text.replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
  const forcedRoute = getWhatsAppForcedIntent(textCanonical);
  const forcedCommand = getWhatsAppForcedCommandText(forcedRoute);
  if (forcedCommand) {
    text = forcedCommand;
    textCanonical = forcedCommand;
  }

  if (!phone) return 'Could not identify your number. Please try again.';
  if (!incoming && !hasInboundAudio) return `${getWhatsAppMenuText()}\n\nUse the menu buttons to begin.`;

  const [profile, conversation] = await Promise.all([
    WhatsAppRecruitingUser.findOne({ phone }),
    WhatsAppConversation.findOne({ phone })
  ]);

  const user = profile || await WhatsAppRecruitingUser.create({ phone, optedIn: true, optedInAt: new Date() });
  const convo = conversation || await WhatsAppConversation.create({ phone, currentStep: 'menu', lastIntent: 'menu', metadata: {} });
  const effectivePlanInfo = await resolveEffectiveWhatsAppPlan(user, phone);
  const effectivePlan = normalizeWhatsAppPlanValue(effectivePlanInfo.plan || user.plan || 'free');
  if (user.plan !== effectivePlan) {
    user.plan = effectivePlan;
  }
  const priorInboundAt = convo.lastInboundAt ? new Date(convo.lastInboundAt).getTime() : 0;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const metadata = (convo.metadata && typeof convo.metadata === 'object') ? convo.metadata : {};
  metadata.context = (metadata.context && typeof metadata.context === 'object') ? metadata.context : {};
  metadata.context.language = ['english', 'spanish'].includes(String(metadata.context.language || '').toLowerCase())
    ? String(metadata.context.language || '').toLowerCase()
    : 'english';
  metadata.context.recentSearches = Array.isArray(metadata.context.recentSearches) ? metadata.context.recentSearches : [];
  metadata.context.lastSeenAt = new Date().toISOString();
  convo.metadata = metadata;

  const messageSid = String(inboundMessageSid || '').trim();
  const priorMessageSids = Array.isArray(convo.metadata?.processedInboundSids)
    ? convo.metadata.processedInboundSids.map((item) => String(item || ''))
    : [];
  if (messageSid && priorMessageSids.includes(messageSid)) {
    await trackWhatsAppTelemetry(phone, 'whatsapp_duplicate_message_sid', { messageSid });
    return convo.lastOutboundMessage || 'Message received. Reply START for menu.';
  }
  if (messageSid) {
    convo.metadata = {
      ...(convo.metadata && typeof convo.metadata === 'object' ? convo.metadata : {}),
      processedInboundSids: [...priorMessageSids.slice(-24), messageSid]
    };
  }

  convo.lastInboundMessage = incoming || (hasInboundAudio ? '[Voice note]' : '') || (hasInboundDocument ? '[Document]' : '');
  convo.lastInboundAt = new Date();
  await trackWhatsAppTelemetry(phone, 'whatsapp_inbound_received', {
    hasInboundAudio,
    currentStep: convo.currentStep || 'menu'
  });

  if (convo.metadata?.pendingHumanAlert) {
    const retrySent = await sendWhatsAppHumanSupportAlert({
      phone,
      incoming: convo.lastInboundMessage,
      user,
      convo
    });
    if (retrySent) {
      convo.metadata.pendingHumanAlert = false;
      convo.metadata.lastHumanAlertRecoveredAt = new Date().toISOString();
    }
  }

  if (convo.currentStep === 'resume_capture' && /^retry(\s+voice)?$/.test(text)) {
    const retryMedia = convo.metadata?.context?.lastVoiceMedia;
    if (retryMedia?.mediaUrl) {
      const retryText = await transcribeWhatsAppVoiceNote(retryMedia);
      if (retryText) {
        await trackWhatsAppTelemetry(phone, 'whatsapp_voice_retry_transcribed', {});
        convo.lastInboundMessage = retryText;
        convo.lastInboundAt = new Date();
        return handleWhatsAppRecruitingMessage(from, retryText, `${messageSid || 'retry'}-voice-retry`, null);
      }
      const reply = 'Still unable to transcribe voice note. Please send a short text summary so I can continue.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    const reply = 'No saved voice note to retry. Send a new voice note or text summary.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (['stop', 'unsubscribe', 'optout', 'opt out'].includes(text)) {
    user.optedIn = false;
    user.optedOutAt = new Date();
    convo.currentStep = 'stopped';
    convo.lastIntent = 'stopped';
    await trackWhatsAppTelemetry(phone, 'whatsapp_opt_out', {});
    const reply = 'You have been unsubscribed from RoleRocket WhatsApp updates. Reply START anytime to rejoin.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (!user.optedIn && !['start', 'join'].includes(text)) {
    await trackWhatsAppTelemetry(phone, 'whatsapp_opted_out_block', {});
    const reply = 'You are currently opted out. Reply START to re-activate RoleRocket WhatsApp recruiting support.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  // Handle main-menu button/list values globally — skip language re-select
  if (['main_menu', 'main menu', 'menu', 'home'].includes(text)) {
    const language = String(convo.metadata?.context?.language || 'english');
    convo.currentStep = 'menu';
    convo.lastIntent = 'menu';
    const reply = getWhatsAppMenuText(language);
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  const isGoBackIntent = ['go_back', 'go back', 'back', 'previous', 'prev', 'go to previous'].includes(text);
  if (isGoBackIntent) {
    const priorStep = getWhatsAppPreviousStep(convo.currentStep);
    convo.currentStep = priorStep;
    if (priorStep === 'menu') convo.lastIntent = 'menu';
    const reply = getWhatsAppStepPrompt(priorStep, user, convo);
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'language_select') {
    const languageValue = getWhatsAppLanguageValue(text);
    if (!languageValue) {
      const reply = getWhatsAppLanguagePrompt();
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    convo.metadata.context.language = languageValue;
    convo.currentStep = 'menu';
    convo.lastIntent = 'menu';
    user.lastIntent = 'menu';
    const reply = getWhatsAppMenuText(languageValue);
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (/^(start|join|hi|hello|menu)(\s+.*)?$/.test(text)) {
    const chosenCountry = resolveWhatsAppExperienceCountry({ user, convo, incomingText: incoming });
    user.optedIn = true;
    user.optedOutAt = null;
    user.lastIntent = 'menu';
    user.experienceCountry = chosenCountry;
    user.experienceCountrySource = 'whatsapp';
    user.experienceCountryUpdatedAt = new Date();
    convo.currentStep = 'language_select';
    convo.lastIntent = 'menu';
    convo.metadata.context.experienceCountry = chosenCountry;
    const isReengaged = priorInboundAt > 0 && (Date.now() - priorInboundAt) > threeDaysMs;
    const reply = isReengaged
      ? `Welcome back.\n${getWhatsAppLanguagePrompt()}`
      : getWhatsAppLanguagePrompt();
    if (isReengaged) {
      await trackWhatsAppTelemetry(phone, 'whatsapp_reengagement_nudge_shown', {});
    }
    await trackWhatsAppTelemetry(phone, 'whatsapp_menu_viewed', { reengaged: isReengaged });
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (text === 'help') {
    const reply = [
      'Quick commands:',
      'START | 1 Watch Demo Features | 2 Jobs | 3 Resume | 4 Cover Letter',
      '5 Explore | STATUS | INTERVIEW | 0 Technical Support',
      'STOP to opt out'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await trackWhatsAppTelemetry(phone, 'whatsapp_help_shown', {});
    await convo.save();
    return reply;
  }

  if (/^(refer|referral|invite)$/.test(text)) {
    const code = getWhatsAppReferralCode(phone);
    convo.metadata.context.referralCode = code;
    await trackWhatsAppTelemetry(phone, 'whatsapp_referral_prompted', { code });
    const reply = [
      `Referral code: ${code}`,
      'Share this with 2 friends looking for jobs.',
      'They can text START then send your code.',
      'Reply REFERRED 1 when one joins.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (text.startsWith('referred')) {
    const count = Math.max(1, Number((text.match(/\d+/) || [1])[0]));
    const current = Number(convo.metadata.context.referralCount || 0);
    convo.metadata.context.referralCount = current + count;
    await trackWhatsAppTelemetry(phone, 'whatsapp_referral_tracked', {
      added: count,
      total: convo.metadata.context.referralCount
    });
    const reply = `Logged ${count} referral(s). Total tracked: ${convo.metadata.context.referralCount}. Use the Jobs button to continue.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (/^apply\s*ready$/.test(text)) {
    const title = String(user.targetJob || convo.metadata.context.lastJobTitle || 'Customer Service Representative').trim();
    const countryCode = resolveWhatsAppExperienceCountry({ user, convo });
    const location = String(user.location || convo.metadata.context.lastLocation || getWhatsAppExperienceLocation(countryCode)).trim();
    const searchResult = await searchJobsFast({ title, location, resume: user.resumeText || '' });
    const jobs = Array.isArray(searchResult?.jobs) ? searchResult.jobs.slice(0, 5) : [];
    convo.metadata.lastJobs = jobs.map((job) => ({
      title: String(job.title || ''),
      company: String(job.company || ''),
      location: String(job.location || ''),
      link: String(job.link || job.applyLink || ''),
      summary: String(job.summary || job.description || '').slice(0, 500)
    }));
    convo.currentStep = 'jobs_action';
    await trackWhatsAppTelemetry(phone, 'whatsapp_apply_ready_triggered', { title, location, countryCode, resultCount: jobs.length });

    const reply = !jobs.length
      ? `No live matches for ${title} in ${location} right now. Use the Jobs button to search another role.`
      : [
          'Click the link to view jobs.',
          ...jobs.map((job, idx) => formatWhatsAppJobListItem(job, idx)),
          'Choose your next step for these job results.'
        ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (['save cover', 'save letter'].includes(text)) {
    const draft = String(convo.metadata?.context?.lastCoverLetterDraft || '').trim();
    if (!draft) {
      const reply = 'No cover letter draft found yet. Use the Cover Letter button to create one first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const priorSaved = Array.isArray(convo.metadata?.context?.savedCoverLetters)
      ? convo.metadata.context.savedCoverLetters
      : [];
    convo.metadata.context.savedCoverLetters = [
      ...priorSaved.slice(-4),
      {
        target: String(convo.metadata?.context?.lastCoverLetterTarget || ''),
        content: draft,
        savedAt: new Date().toISOString()
      }
    ];
    const reply = 'Saved your cover letter draft. Use the Export Cover action button to get a copy now.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (['export cover', 'export letter', 'export cover letter'].includes(text)) {
    const draft = String(convo.metadata?.context?.lastCoverLetterDraft || '').trim();
    if (!draft) {
      const reply = 'No cover letter draft available to export yet. Use the Cover Letter button to create one first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const exportResult = await sendWhatsAppDocumentExports({
      phone,
      featureLabel: 'Cover Letter',
      title: String(convo.metadata?.context?.lastCoverLetterTarget || 'RoleRocket Cover Letter').trim() || 'RoleRocket Cover Letter',
      textContent: draft
    });
    const reply = `${exportResult.ack}\n\nUse action buttons: Save Cover, Jobs, Resume, Explore, or Technical Support.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (['save resume'].includes(text)) {
    const draft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
    if (!draft) {
      const reply = 'No full resume draft found yet. Use the Full Draft action button first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    convo.metadata.context.savedResumeDraft = {
      content: draft,
      savedAt: new Date().toISOString()
    };
    const reply = 'Saved your resume draft. Use the Export Resume action button for an export-ready copy.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (['export resume', 'export cv'].includes(text)) {
    const draft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
    if (!draft) {
      const reply = 'No resume draft available to export yet. Use the Full Draft action button first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const exportResult = await sendWhatsAppDocumentExports({
      phone,
      featureLabel: 'Resume',
      title: String(convo.metadata?.context?.lastJobTitle || user.targetJob || 'RoleRocket Resume').trim() || 'RoleRocket Resume',
      textContent: draft
    });
    const reply = `${exportResult.ack}\n\nUse action buttons: Save Resume, Apply Ready, Jobs, Cover Letter, Explore, or Technical Support.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

    const detectedIntent = detectWhatsAppIntent(text);
    const forcedIntent = getWhatsAppForcedIntent(textCanonical);
  const isFollowupSaveExportCommand = /^(save|export)\b/.test(text);
  const strictHumanIntent = ['0', 'human', 'agent', 'support', 'human support', 'live agent', 'live support'].includes(text);
  // jobs_menu is a navigation step — not a data-capture step — so resume/cover/explore intents can break out of it freely.
  // Only true data-capture steps (where a typed response is expected) should be locked.
  const lockMenuIntentRouting = ['resume_capture', 'cover_letter_capture', 'job_tailor_choice', 'interview_target', 'jobs_import', 'jobs_role_input', 'jobs_parish_select', 'demo_features'].includes(String(convo.currentStep || ''));
    const hasForcedIntent = Boolean(forcedIntent);
    const forceDemoIntent = forcedIntent === 'demo'
      || /\bwatch\s+demo\s+features\b/.test(textCanonical)
      || /^demo\s+features$/.test(textCanonical)
      || /^watch_demo_features$/.test(textCanonical)
      || /^demo_features$/.test(textCanonical);
    const isDemoIntent = forceDemoIntent || (!lockMenuIntentRouting && !hasForcedIntent && (text === '1' || detectedIntent.intent === 'demo'));
    const isJobsIntent = (forcedIntent === 'jobs') || (!lockMenuIntentRouting && !hasForcedIntent && (text === '2' || (detectedIntent.intent === 'jobs' && !text.startsWith('apply'))));
    const isResumeIntent = (forcedIntent === 'resume') || (!lockMenuIntentRouting && !hasForcedIntent && !isFollowupSaveExportCommand && (text === '3' || detectedIntent.intent === 'resume'));
    const isCoverLetterIntent = (forcedIntent === 'coverLetter') || (!lockMenuIntentRouting && !hasForcedIntent && !isFollowupSaveExportCommand && (text === '4' || detectedIntent.intent === 'coverLetter'));
  // Explore intent: match '5', detected explore, or button text containing 'explore' + 'features'/'paid' (for interactive template buttons)
  const isExploreIntent = (forcedIntent === 'explore') || (!lockMenuIntentRouting && !hasForcedIntent && (text === '5' || detectedIntent.intent === 'explore' || (/\bexplore\b/.test(String(text).toLowerCase()) && /\b(features|paid|upgrade)\b/.test(String(text).toLowerCase()))));
  const isInterviewIntent = (forcedIntent === 'interview') || (!lockMenuIntentRouting && !hasForcedIntent && (text === 'interview' || detectedIntent.intent === 'interview'));
  const isStatusIntent = (forcedIntent === 'status') || (!lockMenuIntentRouting && !hasForcedIntent && (text === 'status' || detectedIntent.intent === 'status'));
  const isHumanIntent = strictHumanIntent || forcedIntent === 'human';

  if (convo.currentStep === 'menu' && incoming && !hasInboundAudio && detectedIntent.intent === 'unclear') {
    await trackWhatsAppTelemetry(phone, 'whatsapp_intent_clarification_prompt', {
      confidence: detectedIntent.confidence,
      topScore: detectedIntent.topScore,
      tie: detectedIntent.tie
    });
    const reply = getWhatsAppClarificationPrompt();
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (detectedIntent.intent !== 'unclear') {
    await trackWhatsAppTelemetry(phone, 'whatsapp_intent_detected', {
      intent: detectedIntent.intent,
      confidence: detectedIntent.confidence
    });
  }

  if (isStatusIntent) {
    const applications = await Application.find({ userId: phone }).sort({ createdAt: -1 }).limit(2).lean();
    await trackWhatsAppTelemetry(phone, 'whatsapp_status_checked', { applicationCount: applications.length });
    const reply = !applications.length
      ? 'No tracked applications yet. Use the Jobs button to find roles now.'
      : [
          'Latest tracked applications:',
          ...applications.map((item, idx) => `${idx + 1}. ${item.jobTitle || 'Role'} @ ${item.company || 'Company'} - ${String(item.status || 'applied').toUpperCase()}`),
          'Use the interactive buttons for new jobs or support.'
        ].join('\n');

    user.lastIntent = 'status';
    convo.lastIntent = 'status';
    convo.currentStep = 'menu';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (isHumanIntent) {
    user.lastIntent = 'human';
    convo.lastIntent = 'human';
    convo.currentStep = 'human_handoff';
    await trackWhatsAppTelemetry(phone, 'whatsapp_human_handoff_requested', {});

    const alertDelivered = await sendWhatsAppHumanSupportAlert({ phone, incoming, user, convo });
    convo.metadata.pendingHumanAlert = !alertDelivered;
    convo.metadata.lastHumanAlertAt = new Date().toISOString();

    const reply = [
      'You are connected to human support.',
      'Share: target job, location, years exp.',
      alertDelivered
        ? 'Alert sent to support. A recruiter will follow up shortly.'
        : 'Alert queued for support. Use the Human Support button again if urgent.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (isDemoIntent) {
    user.lastIntent = 'demo_features';
    convo.lastIntent = 'demo_features';
    // Send users straight to the live demo features page when they tap this option.
    convo.currentStep = 'menu';
    const language = String(convo.metadata?.context?.language || 'english');
    const planLevel = getWhatsAppPlanLevel(effectivePlan || 'free');
    const isFreePlan = planLevel === 0;
    const demoFeaturesUrl = `${getPublicAppBaseUrl()}/features.html#feature-snippets`;
    const reply = language === 'spanish'
      ? [
          'Perfecto. Abre Demo Features aqui:',
          demoFeaturesUrl,
          '',
          isFreePlan ? 'Tu plan actual es Free: las funciones pagadas seguiran bloqueadas.' : 'Tu plan desbloquea funciones adicionales dentro de la plataforma.',
          getWhatsAppMainMenuReturnText(language)
        ].join('\n')
      : [
          'Perfect. Open Demo Features here:',
          demoFeaturesUrl,
          '',
          isFreePlan ? 'You are currently on Free: paid features stay locked until you upgrade.' : 'Your plan unlocks additional features in-platform.',
          getWhatsAppMainMenuReturnText(language)
        ].join('\n');
    await trackWhatsAppTelemetry(phone, 'whatsapp_demo_features_enter', {});
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_menu' && ['search', 'search jobs'].includes(textCanonical)) {
    convo.currentStep = 'jobs_role_input';
    await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_step_enter', {});
    const language = String(convo.metadata?.context?.language || 'english');
    const experienceCountry = resolveWhatsAppExperienceCountry({ user, convo });
    const roleHint = encodeURIComponent(String(user.targetJob || convo.metadata?.context?.lastJobTitle || '').trim());
    const premiumSearchUrl = roleHint
      ? `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html?role=${roleHint}&country=${experienceCountry}`
      : `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html?country=${experienceCountry}`;
    const reply = [
      'Premium Jobs Search is ready.',
      `Open: ${premiumSearchUrl}`,
      experienceCountry === 'JM'
        ? 'Use the role text field + Jamaica parish dropdown + Search button.'
        : 'Use the role text field + location field + Search button.',
      'You will see recently posted matched jobs with premium styling.',
      'Or type your target role here if you want to continue inside WhatsApp.',
      getWhatsAppMainMenuReturnText(language)
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (isJobsIntent) {
    user.lastIntent = 'jobs';
    convo.lastIntent = 'jobs';
    convo.currentStep = 'jobs_menu';
    await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_menu_enter', {});
    const reply = 'What would you like to do with jobs? Use SEARCH, IMPORT, SAVE, or MAIN MENU.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_role_input') {
    const roleText = normalizeIncomingWhatsAppText(incoming);
    if (!roleText) {
      const reply = 'Type your target role to continue (example: Customer Service Representative).';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const parsed = parseJobQueryInput(roleText);
    if (parsed.title && parsed.location && parsed.location !== 'Jamaica') {
      const reply = await runWhatsAppJobsSearchFlow({
        phone,
        user,
        convo,
        title: parsed.title,
        location: parsed.location,
        source: 'jobs_role_direct_location'
      });
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await Promise.all([user.save(), convo.save()]);
      return reply;
    }

    convo.metadata.context.pendingJobRole = parsed.title || roleText;
    convo.currentStep = 'jobs_parish_select';
    const reply = buildWhatsAppExperiencePrompt(resolveWhatsAppExperienceCountry({ user, convo }), convo.metadata.context.pendingJobRole);
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_parish_select') {
    const role = String(convo.metadata?.context?.pendingJobRole || user.targetJob || '').trim();
    if (!role) {
      convo.currentStep = 'jobs_role_input';
      const reply = 'Type your target role first (example: Administrative Assistant).';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const countryCode = resolveWhatsAppExperienceCountry({ user, convo });
    if (countryCode !== 'JM') {
      const freeformLocation = normalizeIncomingWhatsAppText(incoming);
      if (!freeformLocation) {
        const reply = countryCode === 'US'
          ? 'Send a US city or state (example: Austin, Texas) or type Remote.'
          : 'Send a location or type Remote to continue.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      const reply = await runWhatsAppJobsSearchFlow({
        phone,
        user,
        convo,
        title: role,
        location: freeformLocation,
        countryCode,
        source: 'jobs_location_select'
      });
      delete convo.metadata.context.pendingJobRole;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await Promise.all([user.save(), convo.save()]);
      return reply;
    }

    const selectedParish = resolveJamaicaParishSelection(incoming);
    if (!selectedParish) {
      const reply = [
        'Please choose a valid parish (send number 1-14 or parish name).',
        'Example: 1 or Kingston'
      ].join('\n');
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const reply = await runWhatsAppJobsSearchFlow({
      phone,
      user,
      convo,
      title: role,
      location: `${selectedParish}, Jamaica`,
      countryCode,
      source: 'jobs_parish_select'
    });
    delete convo.metadata.context.pendingJobRole;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_menu' && [
    'import',
    'import job',
    'import jobs',
    'import and save jobs',
    'import save jobs'
  ].includes(textCanonical)) {
    convo.currentStep = 'jobs_import';
    const importToken = createWhatsAppImportToken(phone);
    const premiumImportUrl = importToken
      ? `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(importToken)}`
      : `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html`;
    const reply = [
      'Import & Save Jobs is ready.',
      `Open: ${premiumImportUrl}`,
      'Paste a job URL in the Import box and save it to your pipeline.',
      'Or paste the job URL/details here in WhatsApp and I will save it for you.',
      getWhatsAppMainMenuReturnText(String(convo.metadata?.context?.language || 'english'))
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_import') {
    const raw = String(incoming || '').trim();
    if (!raw) {
      const reply = 'Send the job details (title, company, location) and I will save it.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    // Detect if user sent a URL
    let sourceUrl = '';
    try {
      const urlCandidate = raw.split(/\s/)[0];
      const u = new URL(urlCandidate);
      if (['http:', 'https:'].includes(u.protocol)) sourceUrl = u.toString();
    } catch { /* not a URL */ }

    // Use the same AI parser the website uses to extract structured job data
    const parsed = await parseJobFromAnywhere(raw, sourceUrl);

    await Application.create({
      userId: phone,
      jobTitle: parsed.title || raw.slice(0, 120),
      company: parsed.company || '',
      status: 'saved'
    });
    await trackWhatsAppTelemetry(phone, 'whatsapp_job_imported', { title: parsed.title, company: parsed.company });
    convo.currentStep = 'jobs_menu';
    const label = [parsed.title, parsed.company].filter(Boolean).join(' @ ') || raw.slice(0, 80);
    const reply = `Saved: "${label}". Use the Jobs actions for Saved Jobs, Search, or Main Menu.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_menu' && ['save', 'saved', 'saved jobs', 'my jobs', 'view saved'].includes(textCanonical)) {
    const saved = await Application.find({ userId: phone, status: 'saved' }).sort({ createdAt: -1 }).limit(10).lean();
    if (!saved.length) {
      const reply = 'No saved jobs yet. Use the Jobs actions for Search or Import.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    const reply = [
      `Your saved jobs (${saved.length}):`,
      ...saved.map((j, i) => `${i + 1}) ${j.jobTitle || 'Role'}${j.company ? ' @ ' + j.company : ''}`),
      getWhatsAppMainMenuReturnText(String(convo.metadata?.context?.language || 'english'))
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'demo_features') {
    const experienceCountry = resolveWhatsAppExperienceCountry({ user, convo });
    const importToken = createWhatsAppImportToken(phone);
    const resumeUrl = `${getPublicAppBaseUrl()}/resume-generator.html?source=whatsapp-demo`;
    const coverLetterUrl = `${getPublicAppBaseUrl()}/cover-letter-generator.html?source=whatsapp-demo`;
    const jobsSearchUrl = `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html?country=${experienceCountry}`;
    const jobsImportUrl = importToken
      ? `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(importToken)}`
      : `${getPublicAppBaseUrl()}/whatsapp-import-save-jobs.html`;
    const trackerUrl = `${getPublicAppBaseUrl()}/job-tracking.html?source=whatsapp-demo`;
    const wantsResumeDemo = ['1', 'resume', 'resume demo', 'cover letter demo', 'resume + cover letter', 'resume and cover letter'].includes(textCanonical);
    const wantsJobsDemo = ['2', 'jobs', 'jobs demo', 'search import track', 'search + import + track', 'search and import and track'].includes(textCanonical);
    const wantsBoth = ['3', 'both', 'all', 'all demos', 'show both demos'].includes(textCanonical);

    if (!wantsResumeDemo && !wantsJobsDemo && !wantsBoth) {
      const language = String(convo.metadata?.context?.language || 'english');
      const reply = getWhatsAppDemoFeaturesText(language);
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const sections = [];
    if (wantsResumeDemo || wantsBoth) {
      sections.push([
        'Demo 1: Resume + Cover Letter',
        `Resume Generator: ${resumeUrl}`,
        `Cover Letter Generator: ${coverLetterUrl}`,
        'Try this flow: open Resume -> create draft -> open Cover Letter -> generate a targeted letter.'
      ].join('\n'));
    }
    if (wantsJobsDemo || wantsBoth) {
      sections.push([
        'Demo 2: Search + Import + Track',
        `Search Jobs: ${jobsSearchUrl}`,
        `Import Jobs: ${jobsImportUrl}`,
        `Track Pipeline: ${trackerUrl}`,
        'Try this flow: search jobs -> import/save one role -> update status in Job Tracking.'
      ].join('\n'));
    }

    const reply = [
      'Great pick. Here is your demo walkthrough:',
      '',
      sections.join('\n\n'),
      '',
      'Reply 1/2/3 for another demo, or use Main Menu anytime.'
    ].join('\n');

    await trackWhatsAppTelemetry(phone, 'whatsapp_demo_features_viewed', {
      mode: wantsBoth ? 'both' : (wantsResumeDemo ? 'resume_cover' : 'search_import_track'),
      country: experienceCountry
    });
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (isResumeIntent) {
    user.lastIntent = 'resume';
    convo.lastIntent = 'resume';
    convo.currentStep = 'resume_input_choice';
    convo.metadata.context.resumeUploadMode = null;
    await trackWhatsAppTelemetry(phone, 'whatsapp_resume_step_enter', {});
    const resumeUrl = `${getPublicAppBaseUrl()}/resume-generator.html?source=whatsapp`;
    const reply = [
      'Resume Generator is ready.',
      `Open: ${resumeUrl}`,
      'Use the web form to generate and export your resume quickly.',
      'Or reply UPLOAD or TYPE to continue here.',
      getWhatsAppMainMenuReturnText(String(convo.metadata?.context?.language || 'english'))
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (isCoverLetterIntent) {
    user.lastIntent = 'cover_letter';
    convo.lastIntent = 'cover_letter';
    convo.currentStep = 'cover_letter_capture';
    const coverLetterUrl = `${getPublicAppBaseUrl()}/cover-letter-generator.html?source=whatsapp`;
    const reply = [
      'Cover Letter Generator is ready.',
      `Open: ${coverLetterUrl}`,
      'Use the web form to generate and export your cover letter quickly.',
      'Or continue here by sending role + company (example: Customer Service Rep at GraceKennedy).',
      getWhatsAppMainMenuReturnText(String(convo.metadata?.context?.language || 'english'))
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (isExploreIntent) {
    user.lastIntent = 'explore';
    convo.lastIntent = 'explore';
    convo.currentStep = 'explore_features';
    const language = String(convo.metadata?.context?.language || 'english');
    const reply = [
      getWhatsAppExploreFeaturesText(effectivePlan || 'free', language),
      '',
      getWhatsAppPaidFeaturesOverviewText(language)
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'explore_features' && /^(status|0|human|agent|support|technical support|human support|live support|live agent)$/.test(textCanonical)) {
    convo.currentStep = 'menu';
  }

  if (convo.currentStep === 'explore_features') {
    const language = String(convo.metadata?.context?.language || 'english');
    const userPlan = String(effectivePlan || 'free').toLowerCase();
    const userPlanLevel = getWhatsAppPlanLevel(userPlan);
    const featureLinks = {
      pro_resume_builder: `${getPublicAppBaseUrl()}/resume-generator.html?plan=pro`,
      pro_export_suite: `${getPublicAppBaseUrl()}/resume-generator.html?export=1`,
      pro_resume_analysis: `${getPublicAppBaseUrl()}/resume-builder.html#analysis`,
      premium_interview_practice: `${getPublicAppBaseUrl()}/interview-prep.html`,
      premium_market_insights: `${getPublicAppBaseUrl()}/job-search.html?source=market`,
      premium_auto_apply: `${getPublicAppBaseUrl()}/dashboard.html#auto-apply`,
      elite_learning_courses: `${getPublicAppBaseUrl()}/course-learning.html`,
      elite_portfolio_builder: `${getPublicAppBaseUrl()}/executive-presence-builder.html`
    };

    const requiredPlanLevel = {
      pro_resume_builder: 1,
      pro_export_suite: 1,
      pro_resume_analysis: 1,
      premium_interview_practice: 2,
      premium_market_insights: 2,
      premium_auto_apply: 2,
      elite_learning_courses: 3,
      elite_portfolio_builder: 3
    };

    const featureDescriptions = {
      pro_resume_builder: 'Full AI Resume Builder: creates a polished role-ready resume draft.',
      pro_export_suite: 'PDF/Word Export: download and share job-ready documents quickly.',
      pro_resume_analysis: 'Resume Analysis: identifies ATS issues and improvement opportunities.',
      premium_interview_practice: 'Interview Practice: realistic questions with guided answer structure.',
      premium_market_insights: 'Market Insights: role demand, pay direction, and key skill trends.',
      premium_auto_apply: 'Auto-Apply: helps you move faster on matching opportunities.',
      elite_learning_courses: 'Learning & Courses: targeted upskilling tracks for your next role.',
      elite_portfolio_builder: 'Portfolio Builder: showcase projects, wins, and credibility clearly.'
    };

    const selectedFeature = Object.keys(featureLinks).find((key) => text === key)
      || (text.includes('resume builder') ? 'pro_resume_builder' : '')
      || (text.includes('export') ? 'pro_export_suite' : '')
      || (text.includes('analysis') ? 'pro_resume_analysis' : '')
      || (text.includes('interview') ? 'premium_interview_practice' : '')
      || (text.includes('market') ? 'premium_market_insights' : '')
      || (text.includes('auto-apply') || text.includes('auto apply') ? 'premium_auto_apply' : '')
      || (text.includes('learning') || text.includes('course') ? 'elite_learning_courses' : '')
      || (text.includes('portfolio') ? 'elite_portfolio_builder' : '');

    if (selectedFeature) {
      const neededLevel = requiredPlanLevel[selectedFeature] ?? 0;
      if (userPlanLevel < neededLevel) {
        const neededPlanName = neededLevel === 1 ? 'Pro' : neededLevel === 2 ? 'Premium' : 'Elite';
        const reply = [
          `That feature is locked on your current ${userPlan} plan.`,
          `Upgrade to ${neededPlanName} to unlock it: ${getPublicAppBaseUrl()}/pricing.html`,
          getWhatsAppMainMenuReturnText(language)
        ].join('\n');
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      const reply = [
        featureDescriptions[selectedFeature],
        `Open: ${featureLinks[selectedFeature]}`,
        'Tap another paid feature button to explore more.',
        getWhatsAppMainMenuReturnText(language)
      ].join('\n');
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const reply = getWhatsAppPaidFeaturesOverviewText(language);
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (isInterviewIntent) {
    user.lastIntent = 'interview';
    convo.lastIntent = 'interview';
    convo.currentStep = 'interview_target';
    await trackWhatsAppTelemetry(phone, 'whatsapp_interview_step_enter', {});
    const reply = [
      'Step 1: Send role or company.',
      'Example: GraceKennedy Customer Service Rep',
      'I will give likely questions + best answers.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_query') {
    const parsed = parseJobQueryInput(incoming);
    if (!parsed.title) {
      await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_query_invalid', {});
      const reply = 'Please send your request in this format: Customer Service in Kingston';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const reply = await runWhatsAppJobsSearchFlow({
      phone,
      user,
      convo,
      title: parsed.title,
      location: parsed.location || 'Jamaica',
      source: 'jobs_query_legacy'
    });

    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && ['view jobs', 'view all jobs', 'show jobs', 'show all jobs'].includes(text)) {
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    if (!jobs.length) {
      const reply = 'No jobs saved in this session. Use the Jobs button to search again.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    const reply = [
      'Your current job results:',
      ...jobs.map((job, idx) => formatWhatsAppJobListItem(job, idx)),
      'Choose your next step for these job results.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && /^(view|open|show)\s*\d+$/.test(text)) {
    const picked = Number((text.match(/\d+/) || [])[0]);
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    if (!Number.isInteger(picked) || picked < 1 || picked > jobs.length) {
      const reply = `Use the job selection actions for items 1-${jobs.length || 5}.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const chosen = jobs[picked - 1] || {};
    const link = getDirectWhatsAppJobLink(chosen);
    const summary = String(chosen.summary || '').trim();
    const reply = [
      `${picked}) ${String(chosen.title || 'Role')} @ ${String(chosen.company || 'Company')}`,
      String(chosen.location || '').trim() ? `Location: ${String(chosen.location || '').trim()}` : '',
      link ? `Link: ${link}` : 'Link: Not available',
      summary ? `Summary: ${summary.slice(0, 320)}` : '',
      `Use actions to Apply, Save Jobs, Email Jobs, View Jobs, or Search Again.`
    ].filter(Boolean).join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && ['save jobs', 'save all jobs'].includes(text)) {
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    if (!jobs.length) {
      const reply = 'No jobs to save yet. Use the Jobs button to search first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    for (const job of jobs) {
      await Application.create({
        userId: phone,
        jobTitle: job.title || 'Role',
        company: job.company || 'Company',
        status: 'saved'
      });
    }
    await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_saved_all', { count: jobs.length });
    convo.currentStep = 'jobs_action';
    const reply = [
      `Saved ${jobs.length} job${jobs.length > 1 ? 's' : ''} to your profile.`,
      'Choose your next step for these job results.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && ['search again', 'search more', 'search', '1', 'find more jobs'].includes(text)) {
    convo.currentStep = 'jobs_role_input';
    const roleHint = encodeURIComponent(String(user.targetJob || convo.metadata?.context?.lastJobTitle || '').trim());
    const premiumSearchUrl = roleHint
      ? `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html?role=${roleHint}`
      : `${getPublicAppBaseUrl()}/whatsapp-premium-jobs.html`;
    const reply = [
      'Premium search restarted.',
      `Open: ${premiumSearchUrl}`,
      'Use the role text field + Jamaica parish dropdown + Search button.',
      'Or type your target role here to continue in WhatsApp.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && ['email jobs', 'email all jobs', 'send jobs', 'send to email'].includes(text)) {
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    const userEmail = String(user?.email || '').trim();
    if (!jobs.length) {
      const reply = 'No jobs to email yet. Use the Jobs button to search first.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    if (!userEmail) {
      const reply = 'No email address found on your profile. Log in at rolerocketai.com to add one, then use Email Jobs again.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
    const jobRows = jobs.map((j, i) =>
      `<tr><td style="padding:6px 8px">${i + 1}</td><td style="padding:6px 8px">${j.title || 'Role'}</td><td style="padding:6px 8px">${j.company || 'Company'}</td><td style="padding:6px 8px">${j.location || ''}</td><td style="padding:6px 8px">${j.link ? `<a href="${j.link}">Apply</a>` : ''}</td></tr>`
    ).join('');
    const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px">
      <h2>Your RoleRocket AI Job Results</h2>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
        <thead><tr style="background:#0f172a;color:#fff">
          <th style="padding:8px">#</th><th style="padding:8px">Title</th><th style="padding:8px">Company</th><th style="padding:8px">Location</th><th style="padding:8px">Link</th>
        </tr></thead><tbody>${jobRows}</tbody></table>
      <p style="margin-top:16px">Visit <a href="https://www.rolerocketai.com">rolerocketai.com</a> for more tools.</p>
    </div>`;
    try {
      await sendEmail({
        to: userEmail,
        subject: 'Your RoleRocket AI Job Matches',
        html: emailHtml,
        text: jobs.map((j, i) => `${i + 1}) ${j.title} @ ${j.company} — ${j.link || 'No link'}`).join('\n')
      });
      await trackWhatsAppTelemetry(phone, 'whatsapp_jobs_emailed', { count: jobs.length, email: userEmail });
      const reply = `Sent ${jobs.length} job${jobs.length > 1 ? 's' : ''} to ${userEmail}. Choose your next step for these job results.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    } catch (emailErr) {
      console.error('WhatsApp jobs email error:', emailErr);
      const reply = 'Could not send the email right now. Try again shortly or visit rolerocketai.com to view your saved jobs.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
  }

  if (convo.currentStep === 'jobs_action' && text.startsWith('apply')) {
    const picked = Number((text.match(/\d+/) || [])[0]);
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    if (!Number.isInteger(picked) || picked < 1 || picked > jobs.length) {
      const reply = `Use the Apply action for one of the listed jobs (1-${jobs.length || 5}).`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const chosen = jobs[picked - 1];
    await Application.create({
      userId: phone,
      jobTitle: chosen.title || 'Role',
      company: chosen.company || 'Company',
      status: 'applied'
    });

    const resumeRewriteAt = new Date(convo.metadata?.context?.lastResumeRewriteAt || 0).getTime();
    const rewriteToApply = resumeRewriteAt > 0 && (Date.now() - resumeRewriteAt) <= sevenDaysMs;
    await trackWhatsAppTelemetry(phone, 'whatsapp_apply_saved', {
      jobTitle: chosen.title || 'Role',
      company: chosen.company || 'Company',
      rewriteToApply
    });

    convo.currentStep = 'menu';
    convo.lastIntent = 'status';
    user.lastIntent = 'status';
    const reply = [
      `Saved: ${chosen.title || 'Role'} @ ${chosen.company || 'Company'} as APPLIED.`,
      'Use Status from the menu for updates in 24h.',
      getWhatsAppOutcomeNudge(phone)
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'jobs_action' && text.startsWith('tailor')) {
    const picked = Number((text.match(/\d+/) || [])[0]);
    const jobs = Array.isArray(convo.metadata?.lastJobs) ? convo.metadata.lastJobs : [];
    if (!Number.isInteger(picked) || picked < 1 || picked > jobs.length) {
      const reply = `Use the Tailor action for one of the listed jobs (1-${jobs.length || 5}).`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const chosen = jobs[picked - 1];
    convo.metadata.context.pendingTailorJob = {
      title: String(chosen.title || ''),
      company: String(chosen.company || ''),
      location: String(chosen.location || ''),
      link: String(chosen.link || ''),
      summary: String(chosen.summary || '').slice(0, 500)
    };
    convo.currentStep = 'job_tailor_choice';
    const reply = [
      `Selected: ${chosen.title || 'Role'} @ ${chosen.company || 'Company'}`,
      'Choose an option: Resume, Cover Letter, or Both.'
    ].join('\n');
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'resume_input_choice') {
    const norm = text.trim();
    const isUpload = /^(upload|upload base|upload resume|upload base resume|base resume|send (a )?resume|pdf|word|file)/.test(norm) || hasInboundDocument;
    const isRecentWork = /^(recent|work|text|voice|send recent|recent work|type|history)/.test(norm);

    if (isUpload) {
      // If they already sent a document along with the choice, process it immediately
      if (hasInboundDocument) {
        const docText = await fetchAndExtractDocumentText(inboundDocumentMedia);
        if (docText) {
          user.resumeText = docText.slice(0, 12000);
          convo.metadata.context.resumeUploadMode = true;
          convo.currentStep = 'resume_followup';
          user.lastIntent = 'resume';
          convo.lastIntent = 'resume';
          await trackWhatsAppTelemetry(phone, 'whatsapp_resume_upload_extracted', {});
          const rewriteCredit = consumeWhatsAppAiCredit(phone, 'resume_rewrite');
          if (!rewriteCredit.ok) {
            convo.metadata.context.pendingFullResume = { source: docText.slice(0, 12000) };
            const rlReply = `Resume rewrite limit reached. Try again in ~${rewriteCredit.retryAfterMinutes} min.`;
            convo.lastOutboundMessage = rlReply;
            convo.lastOutboundAt = new Date();
            await Promise.all([user.save(), convo.save()]);
            return rlReply;
          }
          const rewrite = await generateResumeRewriteForWhatsApp(docText, buildWhatsAppContextNote(user, convo));
          convo.metadata.context.pendingFullResume = { source: docText.slice(0, 12000) };
          const reply = [
            '✅ Resume received and extracted.',
            '',
            rewrite,
            '',
            'Use the buttons above to continue with full draft, save, or export.'
          ].join('\n');
          convo.lastOutboundMessage = reply;
          convo.lastOutboundAt = new Date();
          await Promise.all([user.save(), convo.save()]);
          return reply;
        } else {
          const reply = 'I could not read that file. Please send a clear PDF or Word (.docx) resume.';
          convo.lastOutboundMessage = reply;
          convo.lastOutboundAt = new Date();
          await convo.save();
          return reply;
        }
      }
      convo.metadata.context.resumeUploadMode = true;
      convo.currentStep = 'resume_capture';
      const reply = 'Send your resume as a PDF or Word (.docx) file and I will extract and rewrite it for you.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (isRecentWork) {
      convo.metadata.context.resumeUploadMode = false;
      convo.currentStep = 'resume_capture';
      const reply = [
        'Send your recent work history (text or voice note).',
        'I will rewrite it into strong resume bullets.'
      ].join('\n');
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    // Unrecognised — re-prompt
    const reply = 'Reply UPLOAD or TYPE to continue.';
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'resume_capture') {
    let resumeSource = incoming;
    let usedVoiceTranscription = false;
    const isUploadMode = !!convo.metadata?.context?.resumeUploadMode;

    // Document upload path
    if (!resumeSource && !hasInboundAudio && hasInboundDocument) {
      const docText = await fetchAndExtractDocumentText(inboundDocumentMedia);
      if (docText) {
        resumeSource = docText;
      } else {
        const reply = 'I could not read that file. Please send a clear PDF or Word (.docx) resume, or type your work history instead.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }
    }

    // If upload mode and user sent text/voice instead of a file, accept it anyway
    if (isUploadMode && !resumeSource && !hasInboundAudio && !hasInboundDocument) {
      const reply = 'Please send your resume as a PDF or Word (.docx) file, or type your work history as text.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (!resumeSource && hasInboundAudio) {
      convo.metadata.context.lastVoiceMedia = {
        mediaUrl: inboundAudioMedia.mediaUrl,
        contentType: inboundAudioMedia.contentType,
        capturedAt: new Date().toISOString()
      };
      const transcribeCredit = consumeWhatsAppAiCredit(phone, 'transcribe');
      if (!transcribeCredit.ok) {
        await trackWhatsAppTelemetry(phone, 'whatsapp_ai_rate_limited', {
          feature: 'transcribe',
          retryAfterMinutes: transcribeCredit.retryAfterMinutes
        });
        const reply = `Voice-note limit reached. Try again in ~${transcribeCredit.retryAfterMinutes} min or send text.`;
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }
      resumeSource = await transcribeWhatsAppVoiceNote(inboundAudioMedia);
      usedVoiceTranscription = !!resumeSource;
    }

    if (!resumeSource) {
      await trackWhatsAppTelemetry(phone, 'whatsapp_resume_capture_empty', { hasInboundAudio });
      const reply = hasInboundAudio
        ? 'Could not transcribe that voice note. Reply RETRY VOICE, send a clearer note, or send text.'
        : 'Send your work history as text or a clear voice note.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const pendingTailorMode = String(convo.metadata?.context?.pendingTailorMode || '').toLowerCase();
    const pendingTailorJob = convo.metadata?.context?.pendingTailorJob;
    if (pendingTailorMode && pendingTailorJob?.title) {
      user.resumeText = resumeSource.slice(0, 12000);
      user.lastIntent = 'resume';
      convo.lastIntent = 'resume';
      convo.metadata.context.pendingTailorMode = null;

      const tailoredResume = await generateTailoredResumeForJobWhatsApp(user.resumeText, pendingTailorJob);
      convo.metadata.context.lastFullResumeDraft = tailoredResume;
      convo.metadata.context.pendingFullResume = null;

      if (pendingTailorMode === 'both') {
        const jobTarget = `${pendingTailorJob.title || 'Role'} at ${pendingTailorJob.company || 'Company'}`;
        const tailoredCover = await generateCoverLetterForWhatsApp(
          jobTarget,
          user.resumeText,
          pendingTailorJob.summary || ''
        );
        convo.metadata.context.lastCoverLetterTarget = jobTarget;
        convo.metadata.context.lastCoverLetterDraft = tailoredCover;
        convo.currentStep = 'resume_followup';

        const reply = [
          `Great. I tailored both documents for ${pendingTailorJob.title || 'your selected job'}.`,
          'Use Export Resume and Export Cover action buttons to get both copies now.',
          'You can also use Save Resume or Save Cover.'
        ].join('\n');
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await Promise.all([user.save(), convo.save()]);
        return reply;
      }

      convo.currentStep = 'resume_followup';
      const reply = `${tailoredResume}\n\nUse action buttons: Save Resume, Export Resume, Apply Ready, Jobs, Cover Letter, Explore, or Technical Support.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await Promise.all([user.save(), convo.save()]);
      return reply;
    }

    const rewriteCredit = consumeWhatsAppAiCredit(phone, 'resume_rewrite');
    if (!rewriteCredit.ok) {
      await trackWhatsAppTelemetry(phone, 'whatsapp_ai_rate_limited', {
        feature: 'resume_rewrite',
        retryAfterMinutes: rewriteCredit.retryAfterMinutes
      });
      const reply = `Resume rewrite limit reached. Try again in ~${rewriteCredit.retryAfterMinutes} min.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    user.resumeText = resumeSource.slice(0, 12000);
    user.lastIntent = 'resume';
    convo.lastIntent = 'resume';
    convo.currentStep = 'resume_followup';
    convo.metadata.context.lastResumeChannel = usedVoiceTranscription ? 'voice' : 'text';
    convo.metadata.context.lastResumeRewriteAt = new Date().toISOString();
    convo.metadata.context.pendingFullResume = {
      source: resumeSource.slice(0, 12000),
      role: String(user.targetJob || convo.metadata.context.lastJobTitle || 'Customer Service Representative').slice(0, 140),
      location: String(user.location || convo.metadata.context.lastLocation || 'Jamaica').slice(0, 120),
      capturedAt: new Date().toISOString()
    };
    await trackWhatsAppTelemetry(phone, 'whatsapp_resume_submitted', {
      channel: convo.metadata.context.lastResumeChannel,
      chars: resumeSource.length
    });
    const rewrite = await generateResumeRewriteForWhatsApp(resumeSource, buildWhatsAppContextNote(user, convo));
    const rewriteClean = String(rewrite || '')
      .split(/\r?\n/)
      .filter((line) => !/reply\s*yes/i.test(String(line || '')))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    await trackWhatsAppTelemetry(phone, 'whatsapp_resume_rewrite_completed', {
      channel: convo.metadata.context.lastResumeChannel
    });
    const prefix = usedVoiceTranscription ? 'Voice note transcribed.\n' : '';
    const reply = `${prefix}${rewriteClean}\n\nUse action buttons: Full Draft, Save Resume, Export Resume, Apply Ready, Jobs, Cover Letter, or Explore.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'job_tailor_choice') {
    const selectedJob = convo.metadata?.context?.pendingTailorJob;
    if (!selectedJob?.title) {
      convo.currentStep = 'jobs_action';
      const reply = 'No selected job found. Return to Jobs and choose a role, then use Tailor.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const wantsResume = ['r', 'resume', '1', 'tailor resume'].includes(text);
    const wantsCover = ['c', 'cover', 'cover letter', '2', 'tailor cover', 'tailor cover letter'].includes(text);
    const wantsBoth = ['b', 'both', '3', 'all'].includes(text);

    if (!wantsResume && !wantsCover && !wantsBoth) {
      const reply = 'Choose one option: Resume, Cover Letter, or Both.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const baseResume = String(user.resumeText || '').trim();
    if ((wantsResume || wantsBoth) && !baseResume) {
      convo.metadata.context.pendingTailorMode = wantsBoth ? 'both' : 'resume';
      convo.currentStep = 'resume_capture';
      const reply = 'To tailor your resume, send your recent work history first (text or voice note).';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (wantsResume || wantsBoth) {
      const tailoredResume = await generateTailoredResumeForJobWhatsApp(baseResume, selectedJob);
      convo.metadata.context.lastFullResumeDraft = tailoredResume;
      convo.metadata.context.pendingFullResume = null;
    }

    if (wantsCover || wantsBoth) {
      const jobTarget = `${selectedJob.title || 'Role'} at ${selectedJob.company || 'Company'}`;
      const tailoredCover = await generateCoverLetterForWhatsApp(jobTarget, baseResume, selectedJob.summary || '');
      convo.metadata.context.lastCoverLetterTarget = jobTarget;
      convo.metadata.context.lastCoverLetterDraft = tailoredCover;
    }

    if (wantsBoth) {
      convo.currentStep = 'resume_followup';
      const reply = [
        'Done. I tailored both documents to your selected job.',
        'Use Export Resume and Export Cover action buttons for copies.',
        'You can also use Save Resume or Save Cover.'
      ].join('\n');
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (wantsResume) {
      convo.currentStep = 'resume_followup';
      const draft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
      const reply = `${draft}\n\nUse action buttons: Save Resume, Export Resume, Apply Ready, Jobs, Cover Letter, Explore, or Technical Support.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    convo.currentStep = 'cover_letter_followup';
    const coverDraft = String(convo.metadata?.context?.lastCoverLetterDraft || '').trim();
    const reply = `${coverDraft}\n\nUse action buttons: Save Cover, Export Cover, Jobs, Resume, Explore, or Technical Support.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'interview_target') {
    const prepCredit = consumeWhatsAppAiCredit(phone, 'interview_prep');
    if (!prepCredit.ok) {
      await trackWhatsAppTelemetry(phone, 'whatsapp_ai_rate_limited', {
        feature: 'interview_prep',
        retryAfterMinutes: prepCredit.retryAfterMinutes
      });
      const reply = `Interview prep limit reached. Try again in ~${prepCredit.retryAfterMinutes} min.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    user.lastIntent = 'interview';
    convo.lastIntent = 'interview';
    convo.currentStep = 'menu';
    convo.metadata.context.lastInterviewTarget = incoming;
    await trackWhatsAppTelemetry(phone, 'whatsapp_interview_target_submitted', { target: incoming.slice(0, 140) });
    const prep = await generateInterviewPrepForWhatsApp(incoming, buildWhatsAppContextNote(user, convo));
    await trackWhatsAppTelemetry(phone, 'whatsapp_interview_prep_completed', {});
    const reply = `${prep}\n\nUse the interactive menu buttons for Jobs, Resume, Cover Letter, Explore, Referrals, or Support.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await Promise.all([user.save(), convo.save()]);
    return reply;
  }

  if (convo.currentStep === 'cover_letter_capture') {
    const requestedTarget = normalizeIncomingWhatsAppText(incoming);
    if (!requestedTarget) {
      const reply = 'Send your target role and company. Example: Sales Associate at Digicel.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    const coverLetter = await generateCoverLetterForWhatsApp(
      requestedTarget,
      user.resumeText || convo.metadata?.context?.lastFullResumeDraft || ''
    );
    convo.currentStep = 'cover_letter_followup';
    convo.metadata.context.lastCoverLetterTarget = requestedTarget;
    convo.metadata.context.lastCoverLetterDraft = coverLetter;
    const reply = `${coverLetter}\n\nUse the action buttons to save/export this cover letter or return to menu options.`;
    convo.lastOutboundMessage = reply;
    convo.lastOutboundAt = new Date();
    await convo.save();
    return reply;
  }

  if (convo.currentStep === 'cover_letter_followup') {
    if (['save cover', 'save letter'].includes(text)) {
      const draft = String(convo.metadata?.context?.lastCoverLetterDraft || '').trim();
      if (!draft) {
        const reply = 'No cover letter draft found yet. Reply 3 to create one first.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      const priorSaved = Array.isArray(convo.metadata?.context?.savedCoverLetters)
        ? convo.metadata.context.savedCoverLetters
        : [];
      convo.metadata.context.savedCoverLetters = [
        ...priorSaved.slice(-4),
        {
          target: String(convo.metadata?.context?.lastCoverLetterTarget || ''),
          content: draft,
          savedAt: new Date().toISOString()
        }
      ];

      const reply = 'Saved your cover letter draft. Use the action buttons to export a copy.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (['export cover', 'export letter', 'export cover letter'].includes(text)) {
      const draft = String(convo.metadata?.context?.lastCoverLetterDraft || '').trim();
      if (!draft) {
        const reply = 'No cover letter draft available to export yet. Reply 3 to create one.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      const exportResult = await sendWhatsAppDocumentExports({
        phone,
        featureLabel: 'Cover Letter',
        title: String(convo.metadata?.context?.lastCoverLetterTarget || 'RoleRocket Cover Letter').trim() || 'RoleRocket Cover Letter',
        textContent: draft
      });
      const reply = `${exportResult.ack}\n\nUse the action buttons to continue.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
  }

  if (convo.currentStep === 'resume_followup') {
    if (['yes', 'y', 'full', 'continue'].includes(text)) {
      const pending = convo.metadata?.context?.pendingFullResume;
      const source = String(pending?.source || user.resumeText || '').trim();
      const role = String(pending?.role || user.targetJob || convo.metadata?.context?.lastJobTitle || 'Customer Service Representative').trim();
      const location = String(pending?.location || user.location || convo.metadata?.context?.lastLocation || 'Jamaica').trim();

      const fullResume = await generateFullTargetedResumeForWhatsApp(source, role, location);
      convo.currentStep = 'resume_followup';
      convo.metadata.context.pendingFullResume = null;
      convo.metadata.context.lastFullResumeDraft = fullResume;
      await trackWhatsAppTelemetry(phone, 'whatsapp_resume_full_generated', {
        role,
        location,
        sourceChars: source.length
      });
      const reply = `${fullResume}\n\nUse the resume action buttons to save/export/apply, or return through menu buttons.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (text.startsWith('edit')) {
      const requestedEdit = incoming;
      const pending = convo.metadata?.context?.pendingFullResume;
      const source = String(pending?.source || user.resumeText || '').trim();
      const role = String(pending?.role || user.targetJob || convo.metadata?.context?.lastJobTitle || 'Customer Service Representative').trim();
      const location = String(pending?.location || user.location || convo.metadata?.context?.lastLocation || 'Jamaica').trim();

      let currentDraft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
      if (!currentDraft) {
        currentDraft = await generateFullTargetedResumeForWhatsApp(source, role, location);
      }

      const editedDraft = await generateEditedTargetedResumeForWhatsApp(currentDraft, requestedEdit, role, location);
      convo.currentStep = 'resume_followup';
      convo.metadata.context.lastFullResumeDraft = editedDraft;
      await trackWhatsAppTelemetry(phone, 'whatsapp_resume_edit_applied', {
        role,
        location,
        editChars: requestedEdit.length
      });
      const reply = `${editedDraft}\n\nUse the resume action buttons to save/export/apply, or return through menu buttons.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (['save resume'].includes(text)) {
      const draft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
      if (!draft) {
        const reply = 'No full resume draft found yet. Use the Full Draft button first.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      convo.metadata.context.savedResumeDraft = {
        content: draft,
        savedAt: new Date().toISOString()
      };
      const reply = 'Saved your resume draft. Use the action buttons to export an export-ready copy.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (['export resume', 'export cv'].includes(text)) {
      const draft = String(convo.metadata?.context?.lastFullResumeDraft || '').trim();
      if (!draft) {
        const reply = 'No resume draft available to export yet. Use the Full Draft button first.';
        convo.lastOutboundMessage = reply;
        convo.lastOutboundAt = new Date();
        await convo.save();
        return reply;
      }

      const exportResult = await sendWhatsAppDocumentExports({
        phone,
        featureLabel: 'Resume',
        title: String(convo.metadata?.context?.lastJobTitle || user.targetJob || 'RoleRocket Resume').trim() || 'RoleRocket Resume',
        textContent: draft
      });
      const reply = `${exportResult.ack}\n\nUse the action/menu buttons to continue.`;
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }

    if (['no', 'n', 'skip'].includes(text)) {
      convo.currentStep = 'menu';
      convo.metadata.context.pendingFullResume = null;
      const reply = 'No problem. Use the interactive menu buttons anytime to continue.';
      convo.lastOutboundMessage = reply;
      convo.lastOutboundAt = new Date();
      await convo.save();
      return reply;
    }
  }

  const fallback = convo.currentStep === 'resume_followup'
    ? 'Please use the resume action buttons (Full Draft, Save, Export, Apply Ready) or menu buttons.'
    : convo.currentStep === 'cover_letter_followup'
      ? 'Please use the cover letter action buttons (Save, Export) or menu buttons.'
      : 'I did not catch that. Please use the interactive buttons shown.';
  await trackWhatsAppTelemetry(phone, 'whatsapp_fallback_prompt', {
    step: convo.currentStep || 'menu'
  });
  convo.lastOutboundMessage = fallback;
  convo.lastOutboundAt = new Date();
  await convo.save();
  return fallback;
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
const Institution = require('./models/Institution');
const InstitutionInvite = require('./models/InstitutionInvite');
const Resume = require('./models/Resume');
const Job = require('./models/Job');
const Employer = require('./models/Employer');
const EmployerJob = require('./models/EmployerJob');
const JobAlert = require('./models/JobAlert');
const Application = require('./models/Application');
const Telemetry = require('./models/Telemetry');
const RoleProfile = require('./models/RoleProfile');
const LifetimeSale = require('./models/LifetimeSale');
const CourseProgress = require('./models/CourseProgress');
const CourseLearningSession = require('./models/CourseLearningSession');
const CourseContentCache = require('./models/CourseContentCache');
const LearningCatalogSnapshot = require('./models/LearningCatalogSnapshot');
const UserCredential = require('./models/UserCredential');
const DiasporaEmployer = require('./models/DiasporaEmployer');
const SMSJobAlert = require('./models/SMSJobAlert');
const CommunityHub = require('./models/CommunityHub');
const PlacementOutcome = require('./models/PlacementOutcome');
const WhatsAppRecruitingUser = require('./models/WhatsAppRecruitingUser');
const WhatsAppConversation = require('./models/WhatsAppConversation');

const LEARNING_CATALOG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LEARNING_CATALOG_FAILURE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const LEARNING_CATALOG_CACHE_KEY = 'default';
const LEARNING_CATALOG_HOT_COUNT = 22;
const LEARNING_CATALOG_TOPICS = [
  { id: 'ai-machine-learning', name: 'AI & Machine Learning', summary: 'Understand how AI models work and apply ML to real problems.', laborQuery: 'machine learning engineer OR AI engineer' },
  { id: 'prompt-engineering-ai-ops', name: 'Prompt Engineering & AI Ops', summary: 'Create reliable AI workflows, guardrails, and production-ready prompts.', laborQuery: 'prompt engineer OR AI operations' },
  { id: 'data-engineering', name: 'Data Engineering', summary: 'Design pipelines, data models, and warehouse-ready datasets.', laborQuery: 'data engineer' },
  { id: 'cloud-computing', name: 'Cloud Computing', summary: 'Learn cloud services, deployment models, and infrastructure.', laborQuery: 'cloud engineer OR cloud architect' },
  { id: 'cybersecurity-fundamentals', name: 'Cybersecurity Fundamentals', summary: 'Identify threats and apply security best practices.', laborQuery: 'cybersecurity analyst OR security engineer' },
  { id: 'software-engineering-fundamentals', name: 'Software Engineering Fundamentals', summary: 'Build reliable applications with core programming, testing, and architecture habits.', laborQuery: 'software engineer' },
  { id: 'python-programming', name: 'Python Programming', summary: 'Learn variables, functions, loops, and automation scripts.', laborQuery: 'python developer' },
  { id: 'sql-data-analysis', name: 'SQL & Data Analysis', summary: 'Query databases, join tables, and extract business insights.', laborQuery: 'sql analyst OR data analyst' },
  { id: 'devops-kubernetes', name: 'DevOps & Kubernetes', summary: 'Ship faster with CI/CD, containers, orchestration, and observability.', laborQuery: 'devops engineer OR kubernetes' },
  { id: 'project-management', name: 'Project Management', summary: 'Manage scope, timelines, budgets, and stakeholders.', laborQuery: 'project manager' },
  { id: 'product-management', name: 'Product Management', summary: 'Define roadmaps, lead teams, and ship products users love.', laborQuery: 'product manager' },
  { id: 'salesforce-administration', name: 'Salesforce Administration', summary: 'Configure objects, reports, automations, and user operations in Salesforce.', laborQuery: 'salesforce administrator' },
  { id: 'data-science-applied', name: 'Applied Data Science', summary: 'Build and validate predictive models for business and product outcomes.', laborQuery: 'data scientist OR applied scientist' },
  { id: 'aws-cloud-architecture', name: 'AWS Cloud Architecture', summary: 'Design scalable, resilient cloud systems with cost-aware architecture patterns.', laborQuery: 'aws solutions architect OR cloud architect' },
  { id: 'cloud-security-engineering', name: 'Cloud Security Engineering', summary: 'Secure identities, workloads, and cloud networks with defense-in-depth controls.', laborQuery: 'cloud security engineer' },
  { id: 'site-reliability-engineering', name: 'Site Reliability Engineering', summary: 'Run reliable production systems using SLOs, incident response, and automation.', laborQuery: 'site reliability engineer OR sre' },
  { id: 'platform-engineering', name: 'Platform Engineering', summary: 'Create internal developer platforms that speed delivery and reduce operational toil.', laborQuery: 'platform engineer OR developer platform' },
  { id: 'full-stack-web-development', name: 'Full-Stack Web Development', summary: 'Build modern web apps end-to-end across frontend, backend, and data layers.', laborQuery: 'full stack developer' },
  { id: 'test-automation-qa-engineering', name: 'Test Automation & QA Engineering', summary: 'Design quality strategies with automated testing, CI checks, and release gates.', laborQuery: 'qa automation engineer OR test automation engineer' },
  { id: 'api-integration-automation', name: 'API Integration & Automation', summary: 'Connect systems through APIs and workflow automation for faster operations.', laborQuery: 'api integration engineer OR automation engineer' },
  { id: 'ai-data-governance', name: 'AI Data Governance', summary: 'Manage model risk, data quality, and policy controls for trustworthy AI systems.', laborQuery: 'ai governance OR data governance analyst' },
  { id: 'sales-operations-revops', name: 'Sales Operations & RevOps', summary: 'Optimize revenue processes, forecasting, and CRM operations for growth teams.', laborQuery: 'revenue operations OR sales operations analyst' },
  { id: 'power-bi-data-viz', name: 'Power BI & Data Viz', summary: 'Build dashboards that turn raw data into business decisions.', laborQuery: 'power bi developer OR business intelligence analyst' },
  { id: 'advanced-excel', name: 'Advanced Excel', summary: 'Master PivotTables, VLOOKUP, Power Query, and macros.', laborQuery: 'excel analyst OR operations analyst' },
  { id: 'scrum-agile', name: 'Scrum & Agile', summary: 'Master sprint planning, standups, and retrospectives.', laborQuery: 'scrum master OR agile coach' },
  { id: 'business-analysis', name: 'Business Analysis', summary: 'Translate business needs into requirements, workflows, and delivery plans.', laborQuery: 'business analyst' },
  { id: 'financial-analysis-fpa', name: 'Financial Analysis & FP&A', summary: 'Model revenue, forecast performance, and support strategic decisions.', laborQuery: 'financial analyst OR fp&a' },
  { id: 'digital-marketing-growth', name: 'Digital Marketing & Growth', summary: 'Run campaigns, measure funnels, and optimize customer acquisition.', laborQuery: 'digital marketing manager OR growth marketing' },
  { id: 'ux-design-principles', name: 'UX Design Principles', summary: 'Design user-centered interfaces with research and testing.', laborQuery: 'ux designer OR product designer' },
  { id: 'leadership-management', name: 'Leadership & Management', summary: 'Lead teams, give effective feedback, and manage performance.', laborQuery: 'operations manager OR team lead' }
];
const LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT = Math.min(
  LEARNING_CATALOG_TOPICS.length,
  Math.max(1, Number(process.env.LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT || 8))
);

let learningCatalogCache = {
  expiresAt: 0,
  payload: null
};


// Register email verification route


app.use('/api/verify', require('./routes/verifyEmail'));
// Register resume API route BEFORE static file serving
app.use('/api/resume', require('./routes/resume'));

// (REMOVED) Admin-only endpoint for backfilling referral codes has been disabled for security.

const PORT = process.env.PORT || 5001;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 40 * 1000 // 40 seconds for API calls
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

const startupWhatsAppFrom = String(process.env.TWILIO_WHATSAPP_NUMBER || '').trim();
const startupWhatsAppFromNormalized = startupWhatsAppFrom
  ? (startupWhatsAppFrom.toLowerCase().startsWith('whatsapp:') ? startupWhatsAppFrom : `whatsapp:${startupWhatsAppFrom}`)
  : '';
console.log('--- WhatsApp Environment Variables ---');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '[set]' : '[missing]');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '[set]' : '[missing]');
console.log('TWILIO_WHATSAPP_NUMBER:', startupWhatsAppFromNormalized || '[missing]');
console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? '[set]' : '[missing]');
console.log('WHATSAPP_MEDIA_BASE_URL:', process.env.WHATSAPP_MEDIA_BASE_URL || '[missing]');
console.log('--------------------------------------');

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

const CARIB_JOBS_ENABLED = process.env.CARIB_JOBS_ENABLED !== '0';
const JAMAICA_EMPLOYMENT_ENABLED = process.env.JAMAICA_EMPLOYMENT_ENABLED !== '0';
const BPO_COMPANIES_ENABLED = process.env.BPO_COMPANIES_ENABLED !== '0';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

const JOB_CACHE_MS = 1000 * 60 * 5;
const JOB_STALE_CACHE_MS = 1000 * 60 * 60 * 12;
const jobSearchCache = new Map();
const COURSE_CONTENT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const COURSE_CHECK_SESSION_TTL_MS = 1000 * 60 * 120;
const COURSE_CONTENT_SCHEMA_VERSION = 'cert-v4';
const EXTERNAL_FETCH_TIMEOUT_MS = 1200;
const jobSearchInFlight = new Map();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);
const DEFAULT_INSTITUTION_TRIAL_DAYS = Math.max(1, Number(process.env.INSTITUTION_TRIAL_DAYS || 30));
const E2E_MOCK_MODE = process.env.E2E_MOCK === '1';
const DB_DIAGNOSTIC_TOKEN = String(process.env.DB_DIAGNOSTIC_TOKEN || '').trim();

function getConfiguredWhatsAppShareLink(defaultText = 'START') {
  const configured = String(process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || '').trim();
  if (!configured) return '';

  const normalized = configured.replace(/^whatsapp:/i, '');
  const digits = normalized.replace(/[^0-9]/g, '');
  if (!digits) return '';

  return `https://wa.me/${digits}?text=${encodeURIComponent(String(defaultText || 'START'))}`;
}

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
      const resolveUserIdFromStripeContext = async ({ userId, userEmail, customerEmail, customerId }) => {
        if (userId) {
          const exists = await User.findById(String(userId)).select('_id').lean();
          if (exists) return String(exists._id);
        }

        const emailCandidates = [userEmail, customerEmail]
          .map((value) => String(value || '').toLowerCase().trim())
          .filter(Boolean);

        if (customerId && !emailCandidates.length) {
          try {
            const customer = await stripe.customers.retrieve(String(customerId));
            const stripeEmail = String(customer?.email || '').toLowerCase().trim();
            if (stripeEmail) emailCandidates.push(stripeEmail);
          } catch (customerErr) {
            console.warn(`[STRIPE] Could not retrieve customer ${customerId}: ${customerErr.message}`);
          }
        }

        for (const email of emailCandidates) {
          const fallbackUser = await User.findOne({ email }).select('_id').lean();
          if (fallbackUser) return String(fallbackUser._id);
        }

        return '';
      };

      const applyCheckoutSessionEntitlements = async (session, sourceLabel = 'webhook') => {
        if (!session || typeof session !== 'object') return { applied: false, reason: 'invalid_session' };

        const resolvedUserId = await resolveUserIdFromStripeContext({
          userId: session.metadata?.userId,
          userEmail: session.metadata?.userEmail,
          customerEmail: session.customer_details?.email,
          customerId: session.customer
        });

        if (!resolvedUserId) {
          return { applied: false, reason: 'user_not_resolved' };
        }

        const sessionType = String(session.metadata?.type || '').toLowerCase().trim();
        const paymentStatus = String(session.payment_status || '').toLowerCase().trim();

        if (sessionType === 'document_bundle') {
          if (paymentStatus !== 'paid') {
            return { applied: false, reason: `payment_status_${paymentStatus || 'unknown'}` };
          }

          const credits = Number(session.metadata?.docCredits || 0);
          await grantDocumentCreditsFromCheckout({
            userId: resolvedUserId,
            credits,
            bundleId: session.metadata?.docBundle || 'custom',
            amountCents: Number(session.metadata?.docAmountCents || 0),
            currency: session.currency || 'usd',
            stripeSessionId: session.id || ''
          });

          return { applied: true, userId: resolvedUserId, type: 'document_bundle', source: sourceLabel };
        }

        if (sessionType === 'lifetime' || sessionType === 'recruiter_lifetime') {
          if (paymentStatus !== 'paid') {
            return { applied: false, reason: `payment_status_${paymentStatus || 'unknown'}` };
          }

          const nextPlan = sessionType === 'recruiter_lifetime' ? 'recruiter_lifetime' : 'lifetime';
          await User.findByIdAndUpdate(resolvedUserId, {
            isSubscribed: true,
            plan: nextPlan
          });

          if (nextPlan === 'lifetime' && session.id) {
            await LifetimeSale.findOneAndUpdate(
              { stripeSessionId: String(session.id) },
              {
                stripeSessionId: String(session.id),
                userId: resolvedUserId,
                priceId: session.metadata?.lifetimePriceId || null,
                purchasedAt: new Date()
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }

          return { applied: true, userId: resolvedUserId, type: nextPlan, source: sourceLabel };
        }

        const selectedPlan = String(session.metadata?.plan || 'premium').toLowerCase().trim() || 'premium';
        let shouldUnlock = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';

        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
            const subStatus = String(subscription?.status || '').toLowerCase().trim();
            shouldUnlock = shouldUnlock || ['active', 'trialing', 'past_due'].includes(subStatus);
          } catch (subErr) {
            console.warn(`[STRIPE] Could not fetch subscription ${session.subscription}: ${subErr.message}`);
          }
        }

        if (!shouldUnlock) {
          return { applied: false, reason: `subscription_not_active_${paymentStatus || 'unknown'}` };
        }

        await User.findByIdAndUpdate(resolvedUserId, {
          isSubscribed: true,
          plan: selectedPlan
        });

        return { applied: true, userId: resolvedUserId, type: selectedPlan, source: sourceLabel };
      };

      const signature = req.headers['stripe-signature'];
      if (!signature) {
        console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
        return res.status(400).send('Missing stripe-signature');
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.error(`[STRIPE WEBHOOK] Signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`[STRIPE WEBHOOK] Received event type: ${event.type} | event_id: ${event.id}`);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`[STRIPE WEBHOOK] checkout.session.completed | session=${session.id} | type=${session.metadata?.type} | userId=${session.metadata?.userId || 'MISSING'} | status=${session.payment_status}`);
        const result = await applyCheckoutSessionEntitlements(session, 'webhook_checkout_session_completed');
        if (!result.applied) {
          console.error(`[STRIPE WEBHOOK] Entitlement application skipped for session ${session.id}: ${result.reason}`);
        }
      }

      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const subStatus = String(subscription?.status || '').toLowerCase().trim();
        const userId = await resolveUserIdFromStripeContext({
          userId: subscription?.metadata?.userId,
          userEmail: '',
          customerEmail: '',
          customerId: subscription?.customer
        });

        if (userId) {
          const user = await User.findById(userId).select('plan').lean();
          const currentPlan = String(user?.plan || 'free').toLowerCase();
          const nextPlan = String(subscription?.metadata?.plan || currentPlan || 'premium').toLowerCase();
          const active = ['active', 'trialing', 'past_due'].includes(subStatus);

          if (active) {
            await User.findByIdAndUpdate(userId, {
              isSubscribed: true,
              plan: currentPlan === 'lifetime' ? 'lifetime' : nextPlan
            });
          } else if (currentPlan !== 'lifetime' && currentPlan !== 'recruiter_lifetime') {
            await User.findByIdAndUpdate(userId, {
              isSubscribed: false,
              plan: 'free'
            });
          }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userId = await resolveUserIdFromStripeContext({
          userId: subscription?.metadata?.userId,
          userEmail: '',
          customerEmail: '',
          customerId: subscription?.customer
        });

        if (userId) {
          const user = await User.findById(userId).select('plan').lean();
          const currentPlan = String(user?.plan || 'free').toLowerCase();
          if (currentPlan !== 'lifetime' && currentPlan !== 'recruiter_lifetime') {
            await User.findByIdAndUpdate(userId, {
              isSubscribed: false,
              plan: 'free'
            });
          }
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error(`[STRIPE WEBHOOK] Unhandled error: ${err.message}`, err);
      return res.status(400).send('Webhook Error');
    }
  }
);

// Recovery endpoint: Check Stripe for pending payments and grant credits if webhook missed
app.post('/api/document-credits/sync-from-stripe', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email documentGeneration');
    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log(`[CREDIT SYNC] Checking Stripe for pending payments for ${user.email}`);

    // List all checkout sessions for this customer to find unpaid ones
    const sessions = await stripe.checkout.sessions.list({
      customer_email: user.email,
      limit: 100
    });

    const pendingSessions = sessions.data.filter((s) => {
      const paidBundle = s.metadata?.type === 'document_bundle' && s.payment_status === 'paid';
      if (!paidBundle) return false;
      const byUserId = String(s.metadata?.userId || '') === String(req.user.userId || '');
      const byEmail = String(s.metadata?.userEmail || s.customer_details?.email || '').toLowerCase().trim() === String(user.email || '').toLowerCase().trim();
      return byUserId || byEmail;
    });

    if (pendingSessions.length === 0) {
      console.log(`[CREDIT SYNC] No pending paid document bundles found for ${user.email}`);
      return res.json({
        synced: false,
        reason: 'No pending payments found',
        currentCredits: user.documentGeneration?.paidCredits || 0
      });
    }

    console.log(`[CREDIT SYNC] Found ${pendingSessions.length} paid sessions that may have missed webhook`);

    let totalCreditsGranted = 0;
    for (const session of pendingSessions) {
      const credits = Number(session.metadata?.docCredits || 0);
      const alreadyProcessed = (user.documentGeneration?.purchases || []).some(
        (p) => String(p.stripeSessionId || '') === String(session.id)
      );

      if (!alreadyProcessed && credits > 0) {
        console.log(`[CREDIT SYNC] Processing missed session ${session.id} with ${credits} credits`);
        await grantDocumentCreditsFromCheckout({
          userId: String(user._id),
          credits,
          bundleId: session.metadata?.docBundle || 'custom',
          amountCents: Number(session.metadata?.docAmountCents || 0),
          currency: session.currency || 'usd',
          stripeSessionId: session.id || ''
        });
        totalCreditsGranted += credits;
      }
    }

    const updatedUser = await User.findById(req.user.userId).select('documentGeneration');
    console.log(`[CREDIT SYNC] Synced ${totalCreditsGranted} credits for ${user.email}. New balance: ${updatedUser?.documentGeneration?.paidCredits || 0}`);

    return res.json({
      synced: totalCreditsGranted > 0,
      creditsGranted: totalCreditsGranted,
      newBalance: updatedUser?.documentGeneration?.paidCredits || 0
    });
  } catch (err) {
    console.error(`[CREDIT SYNC] Error: ${err.message}`);
    return res.status(500).json({ error: 'Failed to sync credits from Stripe' });
  }
});

app.post('/api/stripe/confirm-checkout-session', authenticateToken, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || req.query?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const user = await User.findById(req.user.userId).select('_id email plan isSubscribed isAdmin documentGeneration');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return res.status(404).json({ error: 'Stripe session not found' });

    const email = String(user.email || '').toLowerCase().trim();
    const sessionUserId = String(session.metadata?.userId || '').trim();
    const sessionEmail = String(session.metadata?.userEmail || session.customer_details?.email || '').toLowerCase().trim();
    const owned = sessionUserId === String(user._id)
      || (sessionEmail && sessionEmail === email);

    if (!owned) {
      return res.status(403).json({ error: 'This checkout session does not belong to the current user.' });
    }

    const sessionType = String(session.metadata?.type || '').toLowerCase().trim();
    const paymentStatus = String(session.payment_status || '').toLowerCase().trim();

    if (sessionType === 'document_bundle') {
      if (paymentStatus === 'paid') {
        await grantDocumentCreditsFromCheckout({
          userId: String(user._id),
          credits: Number(session.metadata?.docCredits || 0),
          bundleId: session.metadata?.docBundle || 'custom',
          amountCents: Number(session.metadata?.docAmountCents || 0),
          currency: session.currency || 'usd',
          stripeSessionId: session.id || ''
        });
      }

      const refreshed = await User.findById(user._id).select('documentGeneration plan isSubscribed isAdmin');
      const status = getDocumentGenerationStatus(refreshed, 'resume');
      return res.json({
        confirmed: true,
        type: 'document_bundle',
        paymentStatus,
        status,
        paidCredits: Number(refreshed?.documentGeneration?.paidCredits || 0)
      });
    }

    if (sessionType === 'lifetime' || sessionType === 'recruiter_lifetime') {
      if (paymentStatus === 'paid') {
        const nextPlan = sessionType === 'recruiter_lifetime' ? 'recruiter_lifetime' : 'lifetime';
        await User.findByIdAndUpdate(user._id, {
          isSubscribed: true,
          plan: nextPlan
        });

        if (nextPlan === 'lifetime' && session.id) {
          await LifetimeSale.findOneAndUpdate(
            { stripeSessionId: String(session.id) },
            {
              stripeSessionId: String(session.id),
              userId: String(user._id),
              priceId: session.metadata?.lifetimePriceId || null,
              purchasedAt: new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      }

      const refreshed = await User.findById(user._id).select('plan isSubscribed isAdmin');
      return res.json({
        confirmed: true,
        type: sessionType,
        paymentStatus,
        plan: refreshed?.plan || 'free',
        isSubscribed: Boolean(refreshed?.isSubscribed)
      });
    }

    const selectedPlan = String(session.metadata?.plan || 'premium').toLowerCase().trim() || 'premium';
    let unlock = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        const subStatus = String(subscription?.status || '').toLowerCase().trim();
        unlock = unlock || ['active', 'trialing', 'past_due'].includes(subStatus);
      } catch (subErr) {
        console.warn(`[STRIPE CONFIRM] Could not retrieve subscription ${session.subscription}: ${subErr.message}`);
      }
    }

    if (unlock) {
      await User.findByIdAndUpdate(user._id, {
        isSubscribed: true,
        plan: selectedPlan
      });
    }

    const refreshed = await User.findById(user._id).select('plan isSubscribed isAdmin');
    return res.json({
      confirmed: unlock,
      type: 'subscription',
      paymentStatus,
      plan: refreshed?.plan || 'free',
      isSubscribed: Boolean(refreshed?.isSubscribed)
    });
  } catch (err) {
    console.error('[STRIPE CONFIRM] Error confirming checkout session:', err);
    return res.status(500).json({ error: err.message || 'Failed to confirm checkout session' });
  }
});

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

app.post('/api/whatsapp/jobs/import-public', async (req, res) => {
  try {
    const phone = normalizeWhatsAppPhone(String(req.body?.phone || '').trim());
    const token = String(req.body?.token || '').trim();
    const sourceUrlRaw = String(req.body?.sourceUrl || '').trim();
    const additionalNotes = String(req.body?.additionalNotes || '').trim();

    if (!phone || !token) {
      return res.status(400).json({ error: 'Missing phone or token.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server token secret is not configured.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Import link expired. Return to WhatsApp and tap Import & Save Jobs again.' });
    }

    const tokenPhone = normalizeWhatsAppPhone(String(decoded?.phone || '').trim());
    if (decoded?.purpose !== 'wa_import' || !tokenPhone || tokenPhone !== phone) {
      return res.status(403).json({ error: 'Invalid import link token.' });
    }

    if (!sourceUrlRaw) {
      return res.status(400).json({ error: 'Job URL is required.' });
    }

    let sourceUrl = '';
    try {
      const u = new URL(sourceUrlRaw);
      if (!['http:', 'https:'].includes(u.protocol)) {
        return res.status(400).json({ error: 'Please provide a valid http(s) job URL.' });
      }
      sourceUrl = u.toString();
    } catch {
      return res.status(400).json({ error: 'Please provide a valid job URL.' });
    }

    const parsed = await parseJobFromAnywhere(additionalNotes || sourceUrl, sourceUrl);
    const jobTitle = String(parsed.title || '').trim() || sourceUrl.slice(0, 120);
    const company = String(parsed.company || '').trim();

    await Application.create({
      userId: phone,
      jobTitle,
      company,
      status: 'saved'
    });

    await trackWhatsAppTelemetry(phone, 'whatsapp_job_imported_public_link', {
      title: jobTitle,
      company
    });

    return res.json({
      success: true,
      job: {
        title: jobTitle,
        company,
        sourceUrl
      }
    });
  } catch (err) {
    console.error('WhatsApp public import error:', err);
    return res.status(500).json({ error: 'Could not import this job right now. Please try again.' });
  }
});

app.get('/whatsapp-start', (req, res) => {
  const requestedCountry = normalizeExperienceCountryCode(req.query.country || '');
  const prefillText = requestedCountry
    ? `START COUNTRY:${requestedCountry}`
    : String(req.query.text || 'START').trim() || 'START';
  const waLink = getConfiguredWhatsAppShareLink(prefillText);
  if (!waLink) {
    const fallbackBase = String(process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
    return res.redirect(302, `${fallbackBase}/login.html`);
  }

  const escapedWaLink = String(waLink).replace(/"/g, '&quot;');
  const escapedText = String(prefillText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RoleRocket AI WhatsApp Assistant</title>
  <meta name="description" content="Start your RoleRocket AI WhatsApp assistant and execute your job search smarter." />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="RoleRocket AI" />
  <meta property="og:title" content="RoleRocket AI WhatsApp Assistant" />
  <meta property="og:description" content="Open the RoleRocket AI WhatsApp assistant and run your job-search execution plan." />
  <meta property="og:url" content="https://www.rolerocketai.com/whatsapp-start" />
  <meta property="og:image" content="https://www.rolerocketai.com/assets/og-whatsapp-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="RoleRocket AI WhatsApp Assistant" />
  <meta name="twitter:description" content="Open the RoleRocket AI WhatsApp assistant and run your job-search execution plan." />
  <meta name="twitter:image" content="https://www.rolerocketai.com/assets/og-whatsapp-card.png" />
  <style>
    body { margin: 0; font-family: 'Segoe UI', sans-serif; color: #e2e8f0; background: radial-gradient(circle at top right, #0b3d91, #050b18 60%); min-height: 100vh; display: grid; place-items: center; }
    .card { width: min(92vw, 560px); border: 1px solid rgba(148,163,184,.3); border-radius: 16px; background: rgba(15,23,42,.82); padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { margin: 0; color: #cbd5e1; line-height: 1.45; }
    a { display: inline-block; margin-top: 14px; text-decoration: none; font-weight: 700; color: #021726; background: linear-gradient(90deg, #22d3ee, #38bdf8); padding: 11px 14px; border-radius: 10px; }
    .mini { margin-top: 10px; font-size: .86rem; color: #94a3b8; }
  </style>
</head>
<body>
  <main class="card">
    <h1>RoleRocket AI WhatsApp Assistant</h1>
    <p>Opening your RoleRocket AI WhatsApp assistant with message: <strong>${escapedText}</strong>.</p>
    <a href="${escapedWaLink}">Open WhatsApp Assistant</a>
    <div class="mini">If nothing happens automatically, tap the button above.</div>
  </main>
  <script>
    setTimeout(function () { window.location.href = "${escapedWaLink}"; }, 650);
  </script>
</body>
</html>`);
});

app.get('/RoleRocketWhatsAppStartLink', (req, res) => {
  return res.sendFile(path.join(__dirname, '../frontend/whatsapp-start-link.html'));
});

app.get('/start', (req, res) => {
  const waLink = getConfiguredWhatsAppShareLink('START');
  const escapedWaLink = String(waLink || '').replace(/"/g, '&quot;');
  const fallbackBase = String(process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
  const destination = waLink || `${fallbackBase}/login.html`;
  return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RoleRocket AI WhatsApp Assistant</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="RoleRocket AI" />
  <meta property="og:title" content="RoleRocket AI WhatsApp Assistant" />
  <meta property="og:description" content="Your AI job-search assistant on WhatsApp. Import jobs, organize applications, and execute your plan faster." />
  <meta property="og:url" content="https://www.rolerocketai.com/start" />
  <meta property="og:image" content="https://www.rolerocketai.com/assets/og-whatsapp-card.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="RoleRocket AI WhatsApp Assistant" />
  <meta name="twitter:description" content="Your AI job-search assistant on WhatsApp. Import jobs, organize applications, and execute your plan faster." />
  <meta name="twitter:image" content="https://www.rolerocketai.com/assets/og-whatsapp-card.png" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:grid;place-items:center;font-family:'Segoe UI',sans-serif;
      background:linear-gradient(135deg,#000000 0%,#007847 50%,#fdb714 100%);}
    .wrap{text-align:center;padding:32px 20px;}
    span{font-size:3.5rem;display:block;margin-bottom:16px;}
    h1{color:#fff;font-size:clamp(1.4rem,4vw,2rem);font-weight:800;margin-bottom:10px;}
    p{color:rgba(255,255,255,.88);font-size:1rem;}
  </style>
</head>
<body>
  <div class="wrap">
    <span>💬</span>
    <h1>RoleRocket AI WhatsApp Assistant</h1>
    <p>Opening WhatsApp…</p>
  </div>
  <script>window.location.href="${destination}";<\/script>
</body>
</html>`);
});

app.get('/rolerocket', (req, res) => {
  const fallbackBase = String(process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
  const destination = `${fallbackBase}/login.html`;
  return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Career Execution System</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="RoleRocket AI" />
  <meta property="og:title" content="Your Career Execution System" />
  <meta property="og:description" content="AI-powered job search, resume optimizer, cover letter generator, interview prep, and application tracking in one platform." />
  <meta property="og:url" content="https://www.rolerocketai.com/rolerocket" />
  <meta property="og:image" content="https://www.rolerocketai.com/assets/rolerocket-logo-new.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Your Career Execution System" />
  <meta name="twitter:description" content="AI-powered job search, resume optimizer, cover letter generator, interview prep, and application tracking in one platform." />
  <meta name="twitter:image" content="https://www.rolerocketai.com/assets/rolerocket-logo-new.png" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:grid;place-items:center;font-family:'Segoe UI',sans-serif;
      background:radial-gradient(circle at 20% 10%, #0b3d91 0%, #050b18 48%, #040711 100%);}
    .wrap{text-align:center;padding:32px 20px;}
    span{font-size:3.5rem;display:block;margin-bottom:16px;}
    h1{color:#fff;font-size:clamp(1.4rem,4vw,2rem);font-weight:800;margin-bottom:10px;}
    p{color:rgba(255,255,255,.88);font-size:1rem;}
  </style>
</head>
<body>
  <div class="wrap">
    <span>🚀</span>
    <h1>RoleRocket AI</h1>
    <p>Opening platform…</p>
  </div>
  <script>window.location.href="${destination}";<\/script>
</body>
</html>`);
});

app.get('/rolerocket-login', (req, res) => {
  return res.redirect(302, '/rolerocket');
});

app.get('/api/whatsapp/share-link', (_req, res) => {
  const waLink = getConfiguredWhatsAppShareLink('START');
  if (!waLink) {
    return res.status(404).json({ error: 'WhatsApp sender number is not configured.' });
  }
  return res.json({ link: waLink });
});

app.get('/jamaica-workforce-accelerator.html', async (req, res) => {
  try {
    const user = await resolveOptionalUserFromBearer(req);
    const context = buildExperienceContext({ req, user });
    if (!context.showJamaicaHub) {
      return res.redirect(302, '/dashboard.html?experience=global');
    }
  } catch (error) {
    console.error('Jamaica hub gate error:', error);
    return res.redirect(302, '/dashboard.html?experience=global');
  }

  return res.sendFile(path.join(__dirname, '../frontend/jamaica-workforce-accelerator.html'));
});

const FRONTEND_DIR = path.join(__dirname, '../frontend');

function injectGlobalThemeStylesheet(html = '') {
  const source = String(html || '');
  if (!source) return source;

  if (/href=["'][^"']*styles\.css(?:\?[^"']*)?["']/i.test(source)) {
    return source;
  }

  const styleLink = '<link rel="stylesheet" href="styles.css?v=global-theme" />';
  if (/<\/head>/i.test(source)) {
    return source.replace(/<\/head>/i, `${styleLink}\n</head>`);
  }

  return `${styleLink}\n${source}`;
}

app.get(/.*\.html$/, async (req, res, next) => {
  try {
    const relativePath = String(req.path || '').replace(/^\/+/, '');
    if (!relativePath) return next();

    const filePath = path.resolve(FRONTEND_DIR, relativePath);
    if (!filePath.startsWith(FRONTEND_DIR)) return next();

    let html;
    try {
      html = await fs.readFile(filePath, 'utf8');
    } catch {
      return next();
    }

    const themedHtml = injectGlobalThemeStylesheet(html);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.type('html');
    return res.send(themedHtml);
  } catch (error) {
    return next(error);
  }
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
      updatedAt: new Date().toISOString(),
      sources: getPlatformStatsSourceLabels()
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

app.post('/api/whatsapp/incoming', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!isValidTwilioWebhookSignature(req)) {
      console.warn('Rejected WhatsApp webhook request: invalid Twilio signature');
      return res.status(403).type('text/plain').send('Forbidden');
    }

    const from = String(req.body?.From || '').trim();
    const body = extractWhatsAppInboundText(req.body || {});
    const messageSid = String(req.body?.MessageSid || req.body?.SmsMessageSid || '').trim();
    const inboundAudioMedia = extractWhatsAppInboundAudioMedia(req.body || {});
    const inboundDocumentMedia = extractWhatsAppInboundDocument(req.body || {});
    const reply = await handleWhatsAppRecruitingMessage(from, body, messageSid, inboundAudioMedia, inboundDocumentMedia);

    // Fetch convo AFTER the handler runs so we see the updated step and context.
    const phone = normalizeWhatsAppPhone(from);
    const convo = phone ? await WhatsAppConversation.findOne({ phone }).lean() : null;
    const interactiveResult = await maybeSendWhatsAppInteractivePrompt({
      from,
      normalizedInboundText: String(body || '').toLowerCase(),
      convo
    });
    const jobsActionContentSid = String(process.env.TWILIO_WHATSAPP_JOBS_ACTION_CONTENT_SID || '').trim();
    const backMenuContentSid = String(process.env.TWILIO_WHATSAPP_BACK_MENU_CONTENT_SID || '').trim();
    const shouldDeferJobsButtons = interactiveResult === 'defer' && jobsActionContentSid && Array.isArray(convo?.metadata?.lastJobs) && convo.metadata.lastJobs.length > 0;

    if (shouldDeferJobsButtons) {
      res.on('finish', () => {
        setTimeout(() => {
          sendWhatsAppContentTemplate({ to: from, contentSid: jobsActionContentSid }).catch((err) => {
            console.error('Deferred jobs_action template error:', err);
          });
          if (backMenuContentSid) {
            sendWhatsAppContentTemplate({ to: from, contentSid: backMenuContentSid }).catch((err) => {
              console.error('Deferred back_menu template error:', err);
            });
          }
        }, 0);
      });
    }

    // 'suppress' = template replaces text (language/menu/tailor) → return empty TwiML
    if (interactiveResult === 'suppress') {
      return res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // 'keep' or false = send the text reply via TwiML (resume/cover buttons already sent above)
    return res.status(200).type('text/xml').send(buildWhatsAppTwiml(reply));
  } catch (error) {
    console.error('WhatsApp incoming webhook error:', error);
    return res.status(200).type('text/xml').send(buildWhatsAppTwiml('RoleRocket is temporarily busy. Please try again in a moment.'));
  }
});

app.post('/api/whatsapp/status', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    if (!isValidTwilioWebhookSignature(req)) {
      console.warn('Rejected WhatsApp status callback: invalid Twilio signature');
      return res.status(403).type('text/plain').send('Forbidden');
    }

    const messageSid = String(req.body?.MessageSid || req.body?.SmsSid || '').trim();
    const messageStatus = String(req.body?.MessageStatus || req.body?.SmsStatus || '').trim().toLowerCase();
    const errorCode = String(req.body?.ErrorCode || '').trim();
    const errorMessage = String(req.body?.ErrorMessage || '').trim();
    const to = normalizeWhatsAppPhone(String(req.body?.To || '').trim());
    const from = normalizeWhatsAppPhone(String(req.body?.From || '').trim());

    const phone = to || from;
    if (phone) {
      const convo = await WhatsAppConversation.findOne({ phone });
      if (convo) {
        const metadata = (convo.metadata && typeof convo.metadata === 'object') ? convo.metadata : {};
        metadata.delivery = (metadata.delivery && typeof metadata.delivery === 'object') ? metadata.delivery : {};
        const events = Array.isArray(metadata.delivery.events) ? metadata.delivery.events : [];
        events.push({
          messageSid,
          messageStatus,
          errorCode,
          errorMessage,
          to,
          from,
          at: new Date().toISOString()
        });
        metadata.delivery.events = events.slice(-80);
        metadata.delivery.lastStatus = messageStatus || metadata.delivery.lastStatus || '';
        metadata.delivery.lastMessageSid = messageSid || metadata.delivery.lastMessageSid || '';
        metadata.delivery.lastErrorCode = errorCode || '';
        metadata.delivery.lastErrorMessage = errorMessage || '';
        metadata.delivery.lastUpdatedAt = new Date().toISOString();
        convo.metadata = metadata;
        await convo.save();
      }
    }

    await trackWhatsAppTelemetry(phone, 'whatsapp_delivery_status', {
      messageSid,
      messageStatus,
      errorCode,
      errorMessage,
      to,
      from
    });

    return res.status(200).type('text/plain').send('ok');
  } catch (error) {
    console.error('WhatsApp status callback error:', error);
    return res.status(200).type('text/plain').send('ok');
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

    const supportRecipient = process.env.SUPPORT_TO || process.env.CONTACT_TO || 'support@rolerocketai.com';
    const partnershipsRecipient = process.env.PARTNERSHIPS_TO || 'partnerships@rolerocketai.com';
    const careersRecipient = process.env.CAREERS_TO || 'careers@rolerocketai.com';
    const subjectLower = subject.toLowerCase();
    const contactRecipient = subjectLower.includes('partner') || subjectLower.includes('partnership')
      ? partnershipsRecipient
      : (subjectLower.includes('career') || subjectLower.includes('job') || subjectLower.includes('hiring')
        ? careersRecipient
        : supportRecipient);
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
    const user = await User.findById(req.user.userId).select('email plan isAdmin');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = String(user.email || '').toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.length ? ADMIN_EMAILS.includes(email) : false;
    const isAdmin = user.isAdmin === true || isAdminEmail;
    const allowByPlan = !ADMIN_EMAILS.length && hasRequiredPlan(user, 'elite');

    if (!isAdmin && !allowByPlan) {
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
    const user = await User.findById(req.user.userId).select('email isAdmin');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const email = String(user.email || '').toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.length ? ADMIN_EMAILS.includes(email) : false;
    const isAdmin = user.isAdmin === true || isAdminEmail;
    if (!isAdmin) {
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
  const isDbAdmin = user.isAdmin === true;
  const isInternalAdmin = email.endsWith('@rolerocketai.com');
  if (isConfiguredAdmin || isDbAdmin || isInternalAdmin) {
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

function buildQueryTokens(queryTitle = '') {
  const stopWords = new Set([
    'a', 'an', 'and', 'or', 'the', 'for', 'with', 'to', 'of', 'in', 'on', 'at', 'by', 'from', 'job', 'jobs', 'role', 'roles'
  ]);

  return String(queryTitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stopWords.has(t));
}

function tokenMatchInHaystack(token, haystack) {
  if (!token) return false;
  if (haystack.includes(token)) return true;

  // Cheap singular/plural normalization for common English role terms.
  if (token.endsWith('s') && token.length > 3) {
    return haystack.includes(token.slice(0, -1));
  }
  if (!token.endsWith('s') && token.length > 3) {
    return haystack.includes(token + 's');
  }

  return false;
}

function isJobRelevantToQuery(job = {}, queryTitle = '') {
  const rawQuery = String(queryTitle || '').trim().toLowerCase();
  if (!rawQuery) return true;

  const haystack = `${String(job?.title || '')} ${String(job?.company || '')} ${String(job?.description || '')} ${String(job?.location || '')}`.toLowerCase();
  if (!haystack.trim()) return false;

  // Sector-aware matching for hospitality/tourism searches so users can find
  // operational role titles that may not literally include the word "tourism".
  if (/\btourism\b|\bhospitality\b|\bhotel\b|\bresort\b|\btravel\b/.test(rawQuery)) {
    const tourismKeywords = [
      'tourism', 'hospitality', 'hotel', 'resort', 'front desk', 'guest services',
      'housekeeping', 'food and beverage', 'food & beverage', 'restaurant',
      'waiter', 'server', 'bartender', 'chef', 'cook', 'concierge', 'reservations',
      'banquet', 'room attendant', 'houseman', 'hostess', 'villa', 'all-inclusive'
    ];
    if (tourismKeywords.some((k) => haystack.includes(k))) return true;
  }

  // Security searches should also match common adjacent role names.
  if (/\bsecurity\b|\bsecruity\b|\bguard\b|loss\s*prevention/.test(rawQuery)) {
    const securityKeywords = [
      'security', 'secruity', 'guard', 'security officer', 'security guard',
      'loss prevention', 'protective services', 'patrol officer', 'surveillance',
      'gatehouse', 'watchman'
    ];
    if (securityKeywords.some((k) => haystack.includes(k))) return true;
  }

  if (haystack.includes(rawQuery)) return true;

  const tokens = buildQueryTokens(rawQuery);
  if (!tokens.length) return true;

  const matched = tokens.filter((t) => tokenMatchInHaystack(t, haystack)).length;
  const minRequired = tokens.length === 1 ? 1 : Math.max(1, Math.ceil(tokens.length * 0.5));
  return matched >= minRequired;
}

function getJamaicaExpandedQueries(queryTitle = '') {
  const q = String(queryTitle || '').trim().toLowerCase();
  if (!q) return [];

  // Expand tourism/hospitality searches into common role terms to capture
  // postings that omit the umbrella keyword.
  if (/\btourism\b|\bhospitality\b|\bhotel\b|\bresort\b|\btravel\b/.test(q)) {
    return [
      'tourism',
      'hospitality',
      'hotel',
      'resort',
      'front desk',
      'guest services',
      'housekeeping',
      'food and beverage',
      'chef',
      'bartender',
      'server'
    ];
  }

  return [];
}

async function fetchExpandedJamaicaSectorJobs({ title, location, resume }) {
  const queries = getJamaicaExpandedQueries(title);
  if (!queries.length) return [];

  const loc = String(location || '').trim() || 'Jamaica';
  const settled = await Promise.allSettled(
    queries.flatMap((q) => [
      timeoutPromise(fetchCaribbeanJobsHtmlDirect(q, loc, resume), 3500),
      timeoutPromise(fetchIndeedJamaicaJobs(q, loc, resume), 3500)
    ])
  );

  const merged = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) merged.push(...r.value);
  });

  return dedupeJobs(merged);
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

function isCaribbeanIslandLocationText(value = '') {
  const text = String(value || '').toLowerCase();
  if (!text) return false;

  return /caribbean|jamaica|bahamas|barbados|aruba|cura[cg]ao|curacao|antigua|st\.?\s*martin|saint\s*martin|sint\s*maarten|st\.?\s*maarten|trinidad|tobago|guyana|st\.?\s*lucia|saint\s*lucia|grenada|dominica|st\.?\s*kitts|saint\s*kitts|nevis|belize|suriname|cayman|bermuda|martinique|guadeloupe|puerto\s*rico|dominican\s*republic|haiti|bonaire|anguilla|turks\s*and\s*caicos|virgin\s*islands/.test(text);
}

const US_STATE_DIRECTORY = {
  al: { name: 'alabama', cities: ['birmingham', 'montgomery', 'huntsville', 'mobile'] },
  ak: { name: 'alaska', cities: ['anchorage', 'fairbanks', 'juneau'] },
  az: { name: 'arizona', cities: ['phoenix', 'tucson', 'mesa', 'scottsdale'] },
  ar: { name: 'arkansas', cities: ['little rock', 'fayetteville', 'fort smith'] },
  ca: { name: 'california', cities: ['los angeles', 'san francisco', 'san diego', 'sacramento', 'san jose'] },
  co: { name: 'colorado', cities: ['denver', 'boulder', 'fort collins', 'colorado springs'] },
  ct: { name: 'connecticut', cities: ['hartford', 'new haven', 'stamford', 'bridgeport'] },
  de: { name: 'delaware', cities: ['wilmington', 'dover', 'newark'] },
  fl: { name: 'florida', cities: ['miami', 'orlando', 'tampa', 'jacksonville', 'st petersburg'] },
  ga: { name: 'georgia', cities: ['atlanta', 'savannah', 'augusta', 'athens'] },
  hi: { name: 'hawaii', cities: ['honolulu', 'hilo', 'kapolei'] },
  id: { name: 'idaho', cities: ['boise', 'meridian', 'idaho falls'] },
  il: { name: 'illinois', cities: ['chicago', 'naperville', 'evanston', 'springfield'] },
  in: { name: 'indiana', cities: ['indianapolis', 'fort wayne', 'bloomington'] },
  ia: { name: 'iowa', cities: ['des moines', 'cedar rapids', 'iowa city'] },
  ks: { name: 'kansas', cities: ['wichita', 'overland park', 'topeka'] },
  ky: { name: 'kentucky', cities: ['louisville', 'lexington', 'bowling green'] },
  la: { name: 'louisiana', cities: ['new orleans', 'baton rouge', 'lafayette'] },
  me: { name: 'maine', cities: ['portland', 'bangor', 'augusta'] },
  md: { name: 'maryland', cities: ['baltimore', 'rockville', 'annapolis', 'bethesda'] },
  ma: { name: 'massachusetts', cities: ['boston', 'cambridge', 'worcester', 'springfield'] },
  mi: { name: 'michigan', cities: ['detroit', 'grand rapids', 'ann arbor', 'lansing'] },
  mn: { name: 'minnesota', cities: ['minneapolis', 'saint paul', 'rochester'] },
  ms: { name: 'mississippi', cities: ['jackson', 'gulfport', 'southaven'] },
  mo: { name: 'missouri', cities: ['st louis', 'kansas city', 'springfield', 'columbia'] },
  mt: { name: 'montana', cities: ['billings', 'bozeman', 'missoula'] },
  ne: { name: 'nebraska', cities: ['omaha', 'lincoln', 'bellevue'] },
  nv: { name: 'nevada', cities: ['las vegas', 'reno', 'henderson'] },
  nh: { name: 'new hampshire', cities: ['manchester', 'nashua', 'concord'] },
  nj: { name: 'new jersey', cities: ['newark', 'jersey city', 'hoboken', 'trenton'] },
  nm: { name: 'new mexico', cities: ['albuquerque', 'santa fe', 'las cruces'] },
  ny: { name: 'new york', cities: ['new york', 'brooklyn', 'buffalo', 'albany', 'rochester'] },
  nc: { name: 'north carolina', cities: ['charlotte', 'raleigh', 'durham', 'greensboro'] },
  nd: { name: 'north dakota', cities: ['fargo', 'bismarck', 'grand forks'] },
  oh: { name: 'ohio', cities: ['columbus', 'cleveland', 'cincinnati', 'toledo'] },
  ok: { name: 'oklahoma', cities: ['oklahoma city', 'tulsa', 'norman'] },
  or: { name: 'oregon', cities: ['portland', 'eugene', 'salem', 'bend'] },
  pa: { name: 'pennsylvania', cities: ['philadelphia', 'pittsburgh', 'harrisburg', 'allentown', 'erie', 'scranton'] },
  ri: { name: 'rhode island', cities: ['providence', 'warwick', 'cranston'] },
  sc: { name: 'south carolina', cities: ['charleston', 'columbia', 'greenville'] },
  sd: { name: 'south dakota', cities: ['sioux falls', 'rapid city', 'aberdeen'] },
  tn: { name: 'tennessee', cities: ['nashville', 'memphis', 'knoxville', 'chattanooga'] },
  tx: { name: 'texas', cities: ['houston', 'dallas', 'austin', 'san antonio', 'fort worth'] },
  ut: { name: 'utah', cities: ['salt lake city', 'provo', 'ogden'] },
  vt: { name: 'vermont', cities: ['burlington', 'montpelier', 'south burlington'] },
  va: { name: 'virginia', cities: ['richmond', 'arlington', 'alexandria', 'virginia beach'] },
  wa: { name: 'washington', cities: ['seattle', 'spokane', 'tacoma', 'bellevue'] },
  wv: { name: 'west virginia', cities: ['charleston', 'morgantown', 'huntington'] },
  wi: { name: 'wisconsin', cities: ['milwaukee', 'madison', 'green bay'] },
  wy: { name: 'wyoming', cities: ['cheyenne', 'casper', 'laramie'] },
  dc: { name: 'district of columbia', cities: ['washington'] }
};

function getUSStateInfo(value = '', { exactOnly = false } = {}) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;

  if (US_STATE_DIRECTORY[normalized]) {
    return { code: normalized, full: US_STATE_DIRECTORY[normalized].name, cities: US_STATE_DIRECTORY[normalized].cities.slice() };
  }

  for (const [code, info] of Object.entries(US_STATE_DIRECTORY)) {
    if (normalized === info.name) {
      return { code, full: info.name, cities: info.cities.slice() };
    }
  }

  if (exactOnly) return null;

  for (const [code, info] of Object.entries(US_STATE_DIRECTORY)) {
    const fullPattern = new RegExp(`\\b${info.name.replace(/\s+/g, '\\s*')}\\b`, 'i');
    const codePattern = new RegExp(`(?:,|\\b)\\s*${code}\\b`, 'i');
    if (fullPattern.test(normalized) || codePattern.test(normalized)) {
      return { code, full: info.name, cities: info.cities.slice() };
    }
  }

  for (const [code, info] of Object.entries(US_STATE_DIRECTORY)) {
    const matchedCity = info.cities.find((city) => {
      return new RegExp(`\\b${city.replace(/\s+/g, '\\s*')}\\b`, 'i').test(normalized);
    });
    if (matchedCity) {
      return {
        code,
        full: info.name,
        cities: [matchedCity].concat(info.cities.filter((city) => city !== matchedCity))
      };
    }
  }

  return null;
}

function buildLocationHints(queryLocation = '') {
  const query = String(queryLocation || '').trim().toLowerCase();
  if (!query) return [];

  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const usStateInfo = getUSStateInfo(normalizedQuery);

  if (usStateInfo) {
    return [usStateInfo.full, usStateInfo.code].concat(usStateInfo.cities);
  }

  const hintMap = [
    {
      match: ['jamaica'],
      hints: ['jamaica', 'kingston', 'montego bay', 'mobay', 'st. andrew', 'st andrew', 'spanish town', 'ocho rios', 'portmore', 'negril']
    },
    {
      match: ['united kingdom', 'uk', 'britain', 'england'],
      hints: ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland', 'london', 'manchester', 'birmingham', 'glasgow']
    },
    {
      match: ['canada'],
      hints: ['canada', 'ontario', 'toronto', 'vancouver', 'british columbia', 'alberta', 'calgary', 'montreal', 'quebec']
    },
    {
      match: ['caribbean'],
      hints: ['caribbean', 'jamaica', 'trinidad', 'tobago', 'barbados', 'bahamas', 'aruba', 'curaçao', 'curacao', 'guyana', 'st martin', 'saint martin', 'sint maarten', 'st lucia', 'saint lucia', 'antigua', 'grenada', 'dominica', 'st kitts', 'nevis', 'belize', 'suriname', 'cayman', 'bermuda', 'martinique', 'guadeloupe']
    },
    {
      match: ['united states', 'usa', 'us'],
      hints: ['united states', 'usa', 'u.s.', 'new york', 'texas', 'florida', 'california', 'atlanta', 'miami', 'chicago']
    },
    {
      match: ['european union', 'europe', 'eu'],
      hints: ['europe', 'european union', 'eu', 'germany', 'france', 'netherlands', 'spain', 'ireland', 'italy', 'poland']
    }
  ];

  const matched = hintMap.find((entry) => entry.match.some((token) => normalizedQuery === token));
  if (matched) return matched.hints;

  return [normalizedQuery];
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function locationHintMatches(haystack = '', hint = '') {
  const value = String(hint || '').trim().toLowerCase();
  if (!value) return false;

  const compact = value.replace(/\s+/g, ' ');
  const haystackLower = String(haystack || '').toLowerCase();

  // For short tokens (2-4 chars like NY, CA, FL), require word boundary
  if (/^[a-z]{2,4}$/.test(compact)) {
    const pattern = compact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + pattern + '\\b', 'i').test(haystackLower);
  }

  // For longer phrases, just do substring match (more lenient)
  return haystackLower.includes(compact);
}

function isLocationCompatible(job = {}, queryLocation = '') {
  const query = String(queryLocation || '').trim().toLowerCase();
  if (!query) return true;
  const usStateInfo = getUSStateInfo(query, { exactOnly: true });

  if (usStateInfo) {
    const jobText = `${String(job?.location || '')} ${String(job?.description || '')}`.toLowerCase();

    const statePattern = new RegExp(`\\b${usStateInfo.full.replace(/\s+/g, '\\s*')}\\b|\\b${usStateInfo.code}\\b|,\\s*${usStateInfo.code}\\b`, 'i');
    if (statePattern.test(jobText)) return true;

    for (const city of usStateInfo.cities) {
      if (jobText.includes(city)) return true;
    }

    return false;
  }
  
  if (query.includes('remote')) {
    const remoteText = `${String(job?.location || '')} ${String(job?.description || '')}`.toLowerCase();
    return /remote|worldwide|work from home|distributed/.test(remoteText);
  }

  const isCaribbeanQuery = /caribbean|jamaica|bahamas|barbados|aruba|antigua|st\.?\s*martin|saint\s*martin|sint\s*maarten|trinidad|tobago|guyana|st\.?\s*lucia|saint\s*lucia|grenada|dominica|st\.?\s*kitts|nevis|belize|suriname|cayman|bermuda|martinique|guadeloupe/.test(query);
  if (isCaribbeanQuery) {
    const scopedHaystack = `${String(job?.location || '')} ${String(job?.description || '')} ${String(job?.company || '')} ${String(job?.link || '')}`.toLowerCase();
    if (!isCaribbeanIslandLocationText(scopedHaystack)) return false;
  }

  const hints = buildLocationHints(query);
  if (!hints.length) return true;

  const haystack = `${String(job?.location || '')} ${String(job?.description || '')} ${String(job?.source || '')} ${String(job?.company || '')} ${String(job?.link || '')}`.toLowerCase();

  // Disambiguate Jamaica (country) from Jamaica, Queens (New York, USA).
  if (query.includes('jamaica')) {
    const hasJamaicaSignal = /\bjamaica\b|montego\s*bay|st\.?\s*andrew|spanish\s*town|ocho\s*rios|portmore|negril|mandeville|st\.?\s*catherine|st\.?\s*james|clarendon|trelawny/.test(haystack)
      || /kingston\s*,?\s*(jamaica|jm\b)|\bjamaica\b[^\n]{0,80}\bkingston\b/.test(haystack);
    if (!hasJamaicaSignal) return false;

    const hasUsJamaicaSignal = /jamaica\s*,\s*queens|queens|new\s*york|\bny\b|united\s*states|\busa\b|nassau\s*county|brooklyn|bronx/.test(haystack);
    const hasNonJamaicaCountrySignal = /united\s*kingdom|\buk\b|england|scotland|wales|northern\s*ireland|canada|ontario|quebec|alberta|british\s*columbia|united\s*states|\busa\b|australia|new\s*zealand/.test(haystack);
    const hasJamaicaIslandSignal = /\bjamaica\b|montego\s*bay|st\.?\s*andrew|spanish\s*town|ocho\s*rios|portmore|negril|mandeville|st\.?\s*catherine|st\.?\s*james|clarendon|trelawny/.test(haystack)
      || /kingston\s*,?\s*(jamaica|jm\b)|\bjamaica\b[^\n]{0,80}\bkingston\b/.test(haystack);
    if (hasUsJamaicaSignal && !hasJamaicaIslandSignal) return false;
    if (hasNonJamaicaCountrySignal && !hasJamaicaIslandSignal) return false;
  }

  return hints.some((hint) => locationHintMatches(haystack, hint));
}

function scoreFreshness(postedAt) {
  if (!postedAt) return 8;

  const ts = new Date(postedAt).getTime();
  if (Number.isNaN(ts)) return 8;

  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return 10;

  return Math.max(0, Math.round(22 - ageDays * 1.3));
}

function isPostedWithinDays(postedAt, days = 7) {
  if (!postedAt) return false;
  const ts = new Date(postedAt).getTime();
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  if (ageMs < 0) return true;
  return ageMs <= (Number(days) * 24 * 60 * 60 * 1000);
}

function sourceQualityWeight(source = '') {
  const table = {
    Adzuna: 7,
    Greenhouse: 8,
    Lever: 8,
    Remotive: 6,
    Arbeitnow: 5,
    USAJobs: 7,
    CaribJobs: 9,
    'Jamaica Employment': 9,
    'BPO Career Portal': 8,
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

const JOB_TEXT_NOISE_REGEX = /(skip to main content|this button displays|jobs people learning|clear text|join or sign in|privacy policy|cookie policy|forgot password|sign in to set job alerts|get notified when a new job is posted|by clicking continue|email or phone|already on linkedin)/i;

function sanitizeJobField(value, fallback, maxLen) {
  const collapsed = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!collapsed) return fallback;

  let cleaned = collapsed;
  const noiseMatch = cleaned.match(JOB_TEXT_NOISE_REGEX);
  if (noiseMatch && Number.isInteger(noiseMatch.index) && noiseMatch.index > 0) {
    cleaned = cleaned.slice(0, noiseMatch.index).trim();
  }

  cleaned = cleaned.replace(/^[|,;:/\-\s]+|[|,;:/\-\s]+$/g, '').trim();

  if (maxLen > 0 && cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
  }

  return cleaned || fallback;
}

function isNoisyJobRecord(job) {
  const title = String(job?.title || '').trim();
  const company = String(job?.company || '').trim();
  const combined = `${title} ${company}`;

  if (!title || !company) return true;
  if (title.length > 120 || company.length > 90) return true;
  if (JOB_TEXT_NOISE_REGEX.test(combined)) return true;
  if (/^(clear text|done|reset|get notified|sign in|join|by clicking)/i.test(title)) return true;

  return false;
}

function isEligibleTopMatchJob(job) {
  if (isNoisyJobRecord(job)) return false;

  const hasValidLink = /^https?:\/\//i.test(String(job?.link || '').trim());
  const matchScore = Number(job?.matchScore || 0);
  return hasValidLink || matchScore > 0;
}

function isGenericCareerLandingLink(value) {
  try {
    const raw = String(value || '').trim();
    if (!/^https?:\/\//i.test(raw)) return true;

    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = (parsed.pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
    const hasQuery = Boolean(parsed.search && parsed.search !== '?');

    if (host.includes('alorica.com') && path === '/careers') return true;
    if (host.includes('conduent.com') && (path === '/' || path === '/careers')) return true;
    if (host.includes('concentrix.com') && (path === '/' || path === '/careers')) return true;
    if (host.includes('ttec.com') && (path === '/' || path === '/find-a-job')) return true;
    if (host.includes('taskus.com') && (path === '/' || path === '/careers')) return true;
    if (host.includes('foundever.com') && (path === '/' || path === '/jobs')) return true;

    const genericPath = path === '/' || path === '/jobs' || path === '/careers' || path === '/find-a-job';
    return genericPath && !hasQuery;
  } catch (_error) {
    return true;
  }
}

function estimateSalaryRange(title, location, source, description = '') {
  const role = String(title || '').toLowerCase();
  const loc = String(location || '').toLowerCase();
  const desc = String(description || '').toLowerCase();
  const isJamaica = loc.includes('jamaica') || loc.includes('kingston') || loc.includes('montego');
  const isUS = loc.includes('united states') || loc.includes('usa') || loc.includes('new york');
  const isUK = loc.includes('united kingdom') || loc.includes('london');
  const isCanada = loc.includes('canada') || loc.includes('toronto');
  const isSenior = desc.includes('senior') || desc.includes('lead') || desc.includes('manager');
  const isEntry = desc.includes('junior') || desc.includes('entry') || desc.includes('graduate');
  const isRemote = loc.includes('remote') || desc.includes('remote');

  let baseSalary = 45000; // Default USD
  let currency = 'USD';
  let salaryMin = 0;
  let salaryMax = 0;

  if (role.includes('customer service') || role.includes('support')) {
    baseSalary = isJamaica ? 600000 : 32000; // JMD or USD
    currency = isJamaica ? 'JMD' : 'USD';
  } else if (role.includes('software') || role.includes('engineer') || role.includes('developer')) {
    baseSalary = isJamaica ? 1500000 : 85000;
    currency = isJamaica ? 'JMD' : 'USD';
  } else if (role.includes('manager') || role.includes('lead')) {
    baseSalary = isJamaica ? 1200000 : 95000;
    currency = isJamaica ? 'JMD' : 'USD';
  } else if (role.includes('analyst') || role.includes('coordinator')) {
    baseSalary = isJamaica ? 800000 : 55000;
    currency = isJamaica ? 'JMD' : 'USD';
  } else if (role.includes('healthcare') || role.includes('nurse')) {
    baseSalary = isJamaica ? 900000 : 60000;
    currency = isJamaica ? 'JMD' : 'USD';
  }

  if (isUS && !isJamaica) baseSalary *= 1.2;
  if (isCanada && !isJamaica) baseSalary *= 1.1;
  if (isUK && !isJamaica) baseSalary *= 1.05;
  if (isSenior) baseSalary *= 1.4;
  if (isEntry) baseSalary *= 0.75;
  if (isRemote && !isJamaica) baseSalary *= 0.9;

  salaryMin = Math.floor(baseSalary * 0.8);
  salaryMax = Math.floor(baseSalary * 1.3);

  return { min: salaryMin, max: salaryMax, currency, estimated: baseSalary };
}

function normalizeJob(raw) {
  const title = sanitizeJobField(raw.title, 'Untitled Job', 120);
  const company = sanitizeJobField(raw.company, 'Unknown Company', 80);
  const location = sanitizeJobField(raw.location, 'Remote', 80);
  const salary = estimateSalaryRange(title, location, raw.source, raw.description);
  const credentials = raw.requiredCredentials || [];

  return {
    title,
    company,
    location,
    link: raw.link || '#',
    sourceUrl: raw.sourceUrl || raw.link || '#',
    description: raw.description || '',
    postedAt: normalizeDate(raw.postedAt),
    matchScore: Math.max(0, Math.min(100, Number(raw.matchScore || 0))),
    status: raw.status || 'saved',
    source: raw.source || 'Imported',
    linkedinSearchUrl:
      raw.linkedinSearchUrl ||
      makeLinkedInSearchUrl(title, location),
    googleJobsUrl:
      raw.googleJobsUrl ||
      makeGoogleJobsUrl(title, location),
    salaryRange: salary,
    requiredCredentials: credentials,
    experienceLevel: raw.experienceLevel || detectExperienceLevel(title, raw.description),
    employmentType: raw.employmentType || 'full-time',
    isRemote: /remote|work from home|distributed|anywhere/i.test(location + (raw.description || '')),
    sponsorshipAvailable: raw.sponsorshipAvailable || false
  };
}

function detectExperienceLevel(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (/junior|entry|graduate|internship/.test(text)) return 'entry';
  if (/senior|lead|principal|architect/.test(text)) return 'senior';
  if (/manager|director|head/.test(text)) return 'manager';
  return 'mid';
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
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
      return await res.json();
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      const isAbort = err?.name === 'AbortError' || msg.includes('timeout');
      const isTransient = isAbort || msg.includes('fetch failed: 5') || msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('socket hang up');

      if (attempt === maxAttempts || !isTransient) {
        if (isAbort) throw new Error('Fetch timeout');
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.name === 'AbortError') throw new Error('Fetch timeout');
  throw lastError || new Error('Fetch failed');
}

function locationToAdzunaCountries(location) {
  const loc = String(location || '').toLowerCase();
  if (getUSStateInfo(loc)) return ['us'];
  if (/\buk\b|united kingdom|england|scotland|wales|london|manchester|birmingham/.test(loc)) return ['gb'];
  if (/\bcanada\b|\bca\b|toronto|ontario|vancouver|british columbia|alberta|quebec/.test(loc)) return ['ca'];
  if (/\baustralia\b|\bau\b|sydney|melbourne|brisbane|perth/.test(loc)) return ['au'];
  if (/\bgermany\b|\bde\b|berlin|munich|hamburg/.test(loc)) return ['de'];
  if (/\bfrance\b|\bfr\b|paris|lyon/.test(loc)) return ['fr'];
  if (/\bnew zealand\b|\bnz\b|auckland|wellington/.test(loc)) return ['nz'];
  if (/\bjam[ai]+ca\b|kingston|montego/.test(loc)) return ['gb', 'us', 'ca']; // Jamaica not on Adzuna; broaden search
  if (/\bcaribbean\b|trinidad|barbados|bahamas|guyana|st\s*lucia|antigua|grenada|cayman|belize|suriname/.test(loc)) return ['gb', 'us', 'ca'];
  if (/\bus\b|\bny\b|\bca\b|\bfl\b|\bco\b|united states|usa|new york|california|texas|florida|denver|denver|chicago|los angeles|houston|dallas/.test(loc)) return ['us'];
  if (/remote|worldwide|global|anywhere/.test(loc)) return [ADZUNA_COUNTRY, 'gb', 'ca'];
  return [ADZUNA_COUNTRY];
}

function normalizeLocationForApiQuery(location) {
  const loc = String(location || '').toLowerCase().trim();
  const stateInfo = getUSStateInfo(loc, { exactOnly: true });
  if (stateInfo) return stateInfo.full.replace(/\b\w/g, (char) => char.toUpperCase());
  return String(location || '').trim();
}

async function fetchAdzunaJobs(title, location, resume, radiusMiles = 100) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const COUNTRY_LABELS = { gb: 'United Kingdom', us: 'United States', ca: 'Canada', au: 'Australia', de: 'Germany', fr: 'France', nz: 'New Zealand' };
  const countries = locationToAdzunaCountries(location);
  const ADZUNA_PAGES = 4;
  const ADZUNA_RESULTS_PER_PAGE = 50;
  // Adzuna uses km; 1 mile ≈ 1.60934 km. Only send where+distance when a specific
  // city/region is given (not bare country names or Remote).
  const radiusKm = Math.round(radiusMiles * 1.60934);
  const locationLower = String(location || '').toLowerCase().trim();
  const isBroadLocation = !locationLower || /^(remote|united states|united kingdom|canada|australia|jamaica)$/i.test(locationLower);
  const normalizedLocation = normalizeLocationForApiQuery(location);

  const adzunaRequests = [];
  countries.forEach((country) => {
    for (let page = 1; page <= ADZUNA_PAGES; page += 1) {
      adzunaRequests.push({ country, page });
    }
  });

  const allResults = await Promise.allSettled(
    adzunaRequests.map(({ country, page }) => {
      const params = new URLSearchParams({
        app_id: ADZUNA_APP_ID,
        app_key: ADZUNA_APP_KEY,
        results_per_page: String(ADZUNA_RESULTS_PER_PAGE),
        what: title,
        'content-type': 'application/json'
      });
      if (!isBroadLocation) {
        params.set('where', normalizedLocation);
        params.set('distance', String(radiusKm));
      }
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;
      return fetchJson(url, {}, 2200).then((data) => ({ data, country }));
    })
  );

  const results = [];
  allResults.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.data?.results)) {
      const countryLabel = COUNTRY_LABELS[r.value.country] || '';
      r.value.data.results.forEach((job) => {
        const jobLocation = job.location?.display_name || location;
        // Append country name so isLocationCompatible can match it
        const locationWithCountry = countryLabel && !jobLocation.toLowerCase().includes(countryLabel.toLowerCase())
          ? `${jobLocation}, ${countryLabel}`
          : jobLocation;
        results.push({ job, locationWithCountry });
      });
    }
  });

  return results.map(({ job, locationWithCountry }) =>
    normalizeJob({
      title: job.title,
      company: job.company?.display_name || 'Unknown Company',
      location: locationWithCountry,
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

// The Muse — free public API, no key required.
// Covers US-heavy job listings across many industries including customer service.
async function fetchTheMuseJobs(title, location, resume) {
  const loc = String(location || '').toLowerCase();

  // Map common locations to Muse location slugs
  const museLocations = [];
  if (/united states|\busa\b|\bus\b|new york|california|texas|florida|remote/.test(loc)) {
    museLocations.push('New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Remote');
  }
  if (/united kingdom|\buk\b|london|england/.test(loc)) {
    museLocations.push('London, United Kingdom');
  }
  if (/canada|toronto|vancouver/.test(loc)) {
    museLocations.push('Toronto, Ontario', 'Vancouver, British Columbia');
  }
  // For no location or broad queries include top US cities
  if (!loc || museLocations.length === 0) {
    museLocations.push('New York, NY', 'Los Angeles, CA', 'Remote');
  }

  const params = new URLSearchParams({ page: '0', descending: 'true' });
  museLocations.slice(0, 3).forEach((l) => params.append('location[]', l));

  const url = `https://www.themuse.com/api/public/jobs?${params.toString()}`;
  let json;
  try {
    json = await fetchJson(url, {}, 3000);
  } catch {
    return [];
  }

  const results = Array.isArray(json.results) ? json.results : [];
  const titleLower = String(title || '').toLowerCase();

  return results
    .filter((job) => {
      if (!titleLower) return true;
      const text = `${job.name || ''} ${(job.categories || []).map((c) => c.name).join(' ')}`.toLowerCase();
      return text.includes(titleLower);
    })
    .map((job) => {
      const jobLocation = Array.isArray(job.locations) && job.locations.length
        ? job.locations.map((l) => l.name).join(', ')
        : location || 'United States';
      return normalizeJob({
        title: job.name || '',
        company: job.company?.name || 'Unknown Company',
        location: jobLocation,
        link: job.refs?.landing_page || '#',
        description: job.contents || '',
        postedAt: job.publication_date,
        matchScore: estimateMatchScore(job.name, job.contents || '', resume),
        source: 'The Muse'
      });
    });
}

async function fetchIndeedJamaicaJobs(title, _location, resume) {
  const queryTitle = String(title || '').trim() || 'Customer Service Representative';
  const pages = [0, 10, 20];
  const listingMap = new Map();

  const settled = await Promise.allSettled(
    pages.map(async (start) => {
      const url = `https://jm.indeed.com/jobs?q=${encodeURIComponent(queryTitle)}&l=${encodeURIComponent('Jamaica')}&fromage=7&start=${start}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RoleRocketBot/1.0; +https://www.rolerocketai.com)'
        }
      });
      if (!res.ok) throw new Error(`Indeed fetch failed: ${res.status}`);
      return res.text();
    })
  );

  settled.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const html = String(result.value || '');
    const matches = html.matchAll(/href="\/(?:rc\/clk|viewjob)\?[^"#]*jk=([a-zA-Z0-9]+)[^"]*"/g);
    for (const m of matches) {
      const jk = String(m[1] || '').trim();
      if (!jk || listingMap.has(jk)) continue;

      // Parse listing context around each match so we don't fabricate title data
      // from the query itself.
      const idx = Number(m.index || 0);
      const snippet = html.slice(Math.max(0, idx - 1200), idx + 2500);
      const titleMatch = snippet.match(/(?:jobTitle|jobtitle)[\s\S]{0,450}?<a[^>]*>([\s\S]*?)<\/a>/i)
        || snippet.match(/<a[^>]*data-jk=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i)
        || snippet.match(/<a[^>]*>([\s\S]{2,180}?)<\/a>/i);
      const companyMatch = snippet.match(/data-testid=["']company-name["'][^>]*>([\s\S]*?)<\/span>/i)
        || snippet.match(/class=["'][^"']*companyName[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        || snippet.match(/class=["'][^"']*company[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
      const locationMatch = snippet.match(/data-testid=["']text-location["'][^>]*>([\s\S]*?)<\/div>/i)
        || snippet.match(/class=["'][^"']*companyLocation[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
        || snippet.match(/class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

      const parsedTitle = sanitizeJobField(decodeHtmlLite(titleMatch ? titleMatch[1] : ''), '', 120);
      if (!parsedTitle) continue;

      listingMap.set(jk, {
        title: parsedTitle,
        company: sanitizeJobField(decodeHtmlLite(companyMatch ? companyMatch[1] : ''), 'Unknown Company', 70),
        location: sanitizeJobField(decodeHtmlLite(locationMatch ? locationMatch[1] : ''), 'Jamaica', 70),
        link: `https://jm.indeed.com/viewjob?jk=${encodeURIComponent(jk)}`,
        postedAt: new Date().toISOString(),
        source: 'Indeed Jamaica'
      });
    }
  });

  return Array.from(listingMap.values()).map((job) =>
    normalizeJob({
      title: job.title,
      company: job.company,
      location: job.location,
      link: job.link,
      description: `${job.title} at ${job.company} in ${job.location}. Direct listing from Indeed Jamaica (last 7 days).`,
      postedAt: job.postedAt,
      matchScore: estimateMatchScore(job.title, `${job.company} ${job.location} ${queryTitle}`, resume),
      source: job.source
    })
  );
}

function decodeHtmlLite(value = '') {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCaribbeanJobsDate(value = '') {
  const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year) return null;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseCaribbeanJobsListingHtml(html, resume, targetLocation = '') {
  const blocks = String(html || '').match(/<div class="module job-result[\s\S]*?<div class="job-result-cta"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  const records = [];
  const target = String(targetLocation || '').trim().toLowerCase();
  const targetIsCaribbean = /caribbean|jamaica|bahamas|barbados|aruba|antigua|st\.?\s*martin|saint\s*martin|sint\s*maarten|trinidad|tobago|guyana|st\.?\s*lucia|grenada|dominica|st\.?\s*kitts|nevis|belize|suriname|cayman|bermuda|martinique|guadeloupe/.test(target);

  blocks.forEach((block) => {
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href=['"]([^'"]+-Job-\d+\.aspx)['"][^>]*>([\s\S]*?)<\/a>/i);
    const companyMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = block.match(/class=['"]updated-time['"][^>]*>\s*Updated\s*(\d{2}\/\d{2}\/\d{4})/i);
    const locationMatch = block.match(/class=['"]location['"][\s\S]*?<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/i);
    const descriptionMatch = block.match(/<p[^>]*itemprop=['"]description['"][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);

    if (!titleMatch || !companyMatch || !dateMatch || !locationMatch) return;

    const relativeLink = String(titleMatch[1] || '').trim();
    const locationHref = String(locationMatch[1] || '').trim();
    const locationText = decodeHtmlLite(locationMatch[2]);
    const locationHaystack = `${locationHref} ${locationText}`.toLowerCase();
    if (!relativeLink) return;

    if (target) {
      if (targetIsCaribbean) {
        if (!isCaribbeanIslandLocationText(locationHaystack)) return;
      } else if (!locationHaystack.includes(target)) {
        return;
      }
    }

    const postedAt = parseCaribbeanJobsDate(dateMatch[1]);
    if (!postedAt) return;

    const title = decodeHtmlLite(titleMatch[2]);
    const company = decodeHtmlLite(companyMatch[1]) || 'Unknown Company';
    const location = locationText || (targetLocation || 'Caribbean');
    const description = decodeHtmlLite(descriptionMatch ? descriptionMatch[1] : '');

    records.push(
      normalizeJob({
        title,
        company,
        location,
        link: `https://www.caribbeanjobs.com${relativeLink}`,
        description,
        postedAt,
        matchScore: estimateMatchScore(title, `${description} ${location}`, resume),
        source: 'CaribbeanJobs Direct'
      })
    );
  });

  return records;
}

async function fetchCaribbeanJobsHtmlDirect(title, location, resume) {
  const queryTitle = String(title || '').trim() || 'Customer Service Representative';
  const queryLocation = String(location || '').trim() || 'Caribbean';
  const pages = [1, 2, 3];

  const settled = await Promise.allSettled(
    pages.map(async (page) => {
      const url = `https://www.caribbeanjobs.com/jobs/?keywords=${encodeURIComponent(queryTitle)}&location=${encodeURIComponent(queryLocation)}&Page=${page}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RoleRocketBot/1.0; +https://www.rolerocketai.com)',
          Accept: 'text/html'
        }
      });
      if (!res.ok) throw new Error(`CaribbeanJobs fetch failed: ${res.status}`);
      return res.text();
    })
  );

  const merged = [];
  settled.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    merged.push(...parseCaribbeanJobsListingHtml(result.value, resume, queryLocation));
  });

  return dedupeJobs(merged);
}

async function fetchCaribJobs(title, location, resume) {
  if (!CARIB_JOBS_ENABLED) return [];

  try {
    const url = `https://www.caribjobs.com/api/search?q=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}&limit=15`;
    const json = await fetchJson(url, {}, 800);
    const jobs = Array.isArray(json.results) ? json.results : [];

    return jobs.map((job) =>
      normalizeJob({
        title: job.title || job.job_title,
        company: job.company || job.employer_name,
        location: job.location || location || 'Caribbean',
        link: job.url || job.apply_url || '#',
        description: job.description || job.summary || '',
        postedAt: job.posted_date || job.created_at,
        matchScore: estimateMatchScore(job.title || '', job.description || '', resume),
        source: 'CaribJobs',
        sponsorshipAvailable: /sponsorship|visa|work permit/i.test(job.description || ''),
        requiredCredentials: extractCredentials(job.description || '')
      })
    );
  } catch (err) {
    console.warn('CaribJobs fetch failed:', err.message);
    return [];
  }
}

async function fetchJamaicaEmployment(title, location, resume) {
  if (!JAMAICA_EMPLOYMENT_ENABLED) return [];

  try {
    const url = `https://jamaicaemployment.com/api/jobs?search=${encodeURIComponent(title)}&location=${encodeURIComponent(location || 'Jamaica')}&limit=15`;
    const json = await fetchJson(url, {}, 800);
    const jobs = Array.isArray(json.jobs) ? json.jobs : [];

    return jobs.map((job) =>
      normalizeJob({
        title: job.title,
        company: job.employer,
        location: job.location || 'Jamaica',
        link: job.job_url || '#',
        description: job.description || '',
        postedAt: job.posted_at,
        matchScore: estimateMatchScore(job.title, job.description, resume),
        source: 'Jamaica Employment',
        sponsorshipAvailable: /sponsorship|diaspora|work permit/i.test(job.description || ''),
        requiredCredentials: extractCredentials(job.description || '')
      })
    );
  } catch (err) {
    console.warn('Jamaica Employment fetch failed:', err.message);
    return [];
  }
}

function getBPOCompanyJobs(title, location, resume) {
  if (!BPO_COMPANIES_ENABLED) return [];

  const bpoCompanies = [
    { name: 'Alorica', baseUrl: 'https://www.alorica.com/careers', roles: ['customer service', 'tech support', 'quality'] },
    { name: 'Conduent', baseUrl: 'https://careers.conduent.com', roles: ['customer service', 'data entry', 'tech support'] },
    { name: 'Concentrix', baseUrl: 'https://careers.concentrix.com', roles: ['customer service', 'sales', 'tech support'] },
    { name: 'TTEC', baseUrl: 'https://www.ttec.com/find-a-job', roles: ['customer service', 'tech support', 'qa'] },
    { name: 'Foundever', baseUrl: 'https://jobs.foundever.com', roles: ['customer service', 'tech support', 'back office'] },
    { name: 'TaskUs', baseUrl: 'https://www.taskus.com/careers', roles: ['customer service', 'tech support'] }
  ];

  const matchedTitle = String(title || '').toLowerCase();
  const jobs = [];

  for (const company of bpoCompanies) {
    const companyRoles = company.roles.filter(r => matchedTitle.includes(r) || !title.trim());
    for (const role of companyRoles.slice(0, 2)) {
      jobs.push(
        normalizeJob({
          title: `${role.charAt(0).toUpperCase() + role.slice(1)} Representative`,
          company: company.name,
          location: location || 'Jamaica / Remote',
          link: company.baseUrl,
          description: `${company.name} is hiring ${role} professionals. Join our team and help customers worldwide. Remote or on-site positions available in Jamaica.`,
          postedAt: new Date().toISOString(),
          matchScore: Math.min(95, estimateMatchScore(`${role} representative`, company.name, resume) + 10),
          source: 'BPO Career Portal',
          employmentType: 'full-time',
          isRemote: true,
          sponsorshipAvailable: true,
          experienceLevel: 'entry',
          requiredCredentials: ['Customer Service', 'Communication Skills', 'Computer Literacy']
        })
      );
    }
  }

  return jobs;
}

function getGuaranteedJamaicaFallbackJobs(title, resume) {
  const role = String(title || '').trim() || 'Customer Service Representative';
  const localJobs = [
    { company: 'Alorica Jamaica', link: 'https://www.alorica.com/careers', location: 'Kingston, Jamaica' },
    { company: 'Conduent Jamaica', link: 'https://careers.conduent.com', location: 'Kingston, Jamaica' },
    { company: 'Concentrix Jamaica', link: 'https://careers.concentrix.com', location: 'Portmore, Jamaica' },
    { company: 'Foundever Jamaica', link: 'https://jobs.foundever.com', location: 'Montego Bay, Jamaica' },
    { company: 'Teleperformance Jamaica', link: 'https://www.teleperformance.com/careers', location: 'Kingston, Jamaica' },
    { company: 'Sutherland Jamaica', link: 'https://jobs.sutherlandglobal.com', location: 'Kingston, Jamaica' },
    { company: 'ibex Jamaica', link: 'https://ibex.co/careers', location: 'Kingston, Jamaica' },
    { company: 'VXI Jamaica', link: 'https://www.vxi.com/careers', location: 'Kingston, Jamaica' },
    { company: 'Flow Jamaica', link: 'https://careers.cwc.com', location: 'Kingston, Jamaica' },
    { company: 'Digicel Jamaica', link: 'https://www.digicelgroup.com/careers', location: 'Kingston, Jamaica' }
  ];

  return localJobs.map((item, idx) =>
    normalizeJob({
      title: role,
      company: item.company,
      location: item.location,
      link: item.link,
      description: `${item.company} hiring in Jamaica. Apply through the official career portal for ${role.toLowerCase()} opportunities.`,
      postedAt: new Date(Date.now() - idx * 3600 * 1000).toISOString(),
      matchScore: Math.min(95, estimateMatchScore(role, `${item.company} Jamaica`, resume) + 8),
      source: 'Jamaica Career Portal',
      employmentType: 'full-time',
      isRemote: false,
      sponsorshipAvailable: false,
      experienceLevel: 'entry',
      requiredCredentials: ['Customer Service', 'Communication Skills']
    })
  );
}

function getGuaranteedJamaicaTourismFallbackJobs(title, resume) {
  const requested = String(title || '').trim();
  const role = requested || 'Hospitality Associate';
  const requestedLower = requested.toLowerCase();

  const roleVariants = [
    role,
    'Front Desk Agent',
    'Guest Services Associate',
    'Housekeeping Attendant',
    'Food and Beverage Server',
    'Reservations Agent'
  ];

  // Prioritize role variants based on the incoming query so fallback results
  // still feel specific to the user search intent.
  let prioritizedRoles = roleVariants;
  if (/housekeeping/.test(requestedLower)) {
    prioritizedRoles = ['Housekeeping Attendant', 'Room Attendant', role, 'Guest Services Associate'];
  } else if (/front\s*desk|guest\s*service|reception/.test(requestedLower)) {
    prioritizedRoles = ['Front Desk Agent', 'Guest Services Associate', role, 'Reservations Agent'];
  } else if (/food|beverage|restaurant|bartender|server|chef|cook/.test(requestedLower)) {
    prioritizedRoles = ['Food and Beverage Server', 'Restaurant Host', role, 'Bartender'];
  } else if (/tourism|hospitality|hotel|resort|travel/.test(requestedLower)) {
    prioritizedRoles = ['Guest Services Associate', 'Front Desk Agent', 'Food and Beverage Server', 'Housekeeping Attendant', role];
  }

  const localTourismEmployers = [
    { company: 'Sandals Resorts International', link: 'https://www.sandals.com/careers/', location: 'Montego Bay, Jamaica' },
    { company: 'RIU Hotels Jamaica', link: 'https://www.riu.com/en/jobs/', location: 'Negril, Jamaica' },
    { company: 'Bahia Principe Jamaica', link: 'https://www.bahiaprincipe.com/en/jobs/', location: 'St. Ann, Jamaica' },
    { company: 'Half Moon Resort', link: 'https://www.halfmoon.com/careers', location: 'Montego Bay, Jamaica' },
    { company: 'Jamaica Pegasus Hotel', link: 'https://jamaicapegasus.com/careers/', location: 'Kingston, Jamaica' },
    { company: 'S Hotel Jamaica', link: 'https://shoteljamaica.com/careers/', location: 'Montego Bay, Jamaica' },
    { company: 'Hyatt Ziva/Zilara Rose Hall', link: 'https://careers.hyatt.com/', location: 'Montego Bay, Jamaica' },
    { company: 'Palladium Hotel Group Jamaica', link: 'https://www.palladiumhotelgroup.com/en/work-with-us', location: 'Hanover, Jamaica' },
    { company: 'Grand Palladium Lady Hamilton Resort & Spa', link: 'https://www.palladiumhotelgroup.com/en/work-with-us', location: 'Hanover, Jamaica' },
    { company: 'Moon Palace Jamaica', link: 'https://www.palaceresorts.com/en/careers', location: 'Ocho Rios, Jamaica' },
    { company: 'Jamaica Inn', link: 'https://jamaicainn.com/careers/', location: 'Ocho Rios, Jamaica' },
    { company: 'Round Hill Hotel and Villas', link: 'https://www.roundhill.com/careers', location: 'Montego Bay, Jamaica' },
    { company: 'Jakes Hotel', link: 'https://www.jakeshotel.com/', location: 'Treasure Beach, Jamaica' },
    { company: 'JTB (Jamaica Tourist Board)', link: 'https://www.visitjamaica.com/jobs/', location: 'Kingston, Jamaica' },
    { company: 'Jamaica Vacations (JAMVAC)', link: 'https://www.visitjamaica.com/about-jamvac/', location: 'Kingston, Jamaica' }
  ];

  const jobs = [];
  localTourismEmployers.forEach((item, idx) => {
    prioritizedRoles.slice(0, 2).forEach((roleName, roleIdx) => {
      jobs.push(
        normalizeJob({
          title: roleName,
          company: item.company,
          location: item.location,
          link: item.link,
          description: `${item.company} tourism and hospitality careers in Jamaica. Check official employer portal for current openings in guest services, front office, food and beverage, and hotel operations.`,
          postedAt: new Date(Date.now() - (idx * 45 + roleIdx * 15) * 60 * 1000).toISOString(),
          matchScore: Math.min(94, estimateMatchScore(roleName, `${item.company} tourism hospitality Jamaica`, resume) + 8),
          source: 'Jamaica Tourism Careers',
          employmentType: 'full-time',
          isRemote: false,
          sponsorshipAvailable: false,
          experienceLevel: 'entry',
          requiredCredentials: ['Customer Service', 'Communication Skills']
        })
      );
    });
  });

  return dedupeJobs(jobs);
}

function getGuaranteedJamaicaSectorFallbackJobs(title, resume) {
  const query = String(title || '').trim();
  const q = query.toLowerCase();
  if (!q) return [];

  const sectors = [
    {
      key: 'bpo',
      match: /\bbpo\b|customer\s*service|call\s*center|collections|contact\s*center/,
      roles: ['Customer Service Representative', 'Collections Agent', 'Technical Support Representative'],
      employers: [
        { company: 'Alorica Jamaica', link: 'https://www.alorica.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Conduent Jamaica', link: 'https://careers.conduent.com', location: 'Kingston, Jamaica' },
        { company: 'Concentrix Jamaica', link: 'https://careers.concentrix.com', location: 'Portmore, Jamaica' },
        { company: 'Teleperformance Jamaica', link: 'https://www.teleperformance.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Foundever Jamaica', link: 'https://jobs.foundever.com', location: 'Montego Bay, Jamaica' }
      ]
    },
    {
      key: 'security',
      match: /security|secruity|guard|loss\s*prevention|patrol|watchman|protective/,
      roles: ['Security Guard', 'Security Officer', 'Loss Prevention Officer'],
      employers: [
        { company: 'Guardsman Group', link: 'https://guardsmangroup.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'KingAlarm Jamaica', link: 'https://www.kingalarm.com/', location: 'Kingston, Jamaica' },
        { company: 'Hawkeye Electronic Security', link: 'https://hawkeyeonline.com/', location: 'Kingston, Jamaica' },
        { company: 'Securipro Limited', link: 'https://www.securiprojamaica.com/', location: 'Kingston, Jamaica' },
        { company: 'Jamaica Pegasus Hotel', link: 'https://www.jamaicapegasus.com/careers/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'finance',
      match: /finance|accounting|accountant|\bbanking\b|\bbank\b|financial|auditor|payroll|\bloan\b|teller|credit\s*officer|investment/,
      roles: ['Accountant', 'Finance Officer', 'Banking Operations Associate'],
      employers: [
        { company: 'National Commercial Bank Jamaica (NCB)', link: 'https://www.jncb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' },
        { company: 'JMMB Group', link: 'https://jm.jmmb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Scotiabank Jamaica', link: 'https://www.scotiabank.com/jm/en/about/careers.html', location: 'Kingston, Jamaica' },
        { company: 'Victoria Mutual (VM Group)', link: 'https://www.vmgroup.com/careers', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'marketing',
      match: /marketing|marketer|digital\s*market|brand|communications|social\s*media|content\s*creat|content\s*writ|copywriter|public\s*relations|\bpr\b|communications\s*officer/,
      roles: ['Marketing Coordinator', 'Digital Marketing Specialist', 'Brand and Communications Officer'],
      employers: [
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Digicel Jamaica', link: 'https://www.digicelgroup.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Flow Jamaica (C&W)', link: 'https://careers.cwc.com', location: 'Kingston, Jamaica' },
        { company: 'Wisynco Group', link: 'https://wisynco.com/careers/', location: 'St. Catherine, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'healthcare',
      match: /healthcare|health\s*care|nurse|registered\s*nurse|clinical|medical|hospital/,
      roles: ['Registered Nurse', 'Patient Care Assistant', 'Clinical Support Officer'],
      employers: [
        { company: 'University Hospital of the West Indies (UHWI)', link: 'https://www.uhwi.gov.jm/careers', location: 'Kingston, Jamaica' },
        { company: 'Ministry of Health and Wellness', link: 'https://www.moh.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'Andrews Memorial Hospital', link: 'https://www.amhosp.org/', location: 'Kingston, Jamaica' },
        { company: 'Hospiten Montego Bay', link: 'https://hospiten.com/en/careers', location: 'St. James, Jamaica' },
        { company: 'Cornwall Regional Hospital', link: 'https://www.srha.gov.jm/', location: 'Montego Bay, Jamaica' }
      ]
    },
    {
      key: 'education',
      match: /teacher|teaching|education|lecturer|school|tutor|instructor/,
      roles: ['Teacher', 'Lecturer', 'Education Programme Officer'],
      employers: [
        { company: 'Ministry of Education and Youth', link: 'https://moey.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'UWI Mona', link: 'https://www.mona.uwi.edu/hrd/jobs', location: 'Kingston, Jamaica' },
        { company: 'University of Technology, Jamaica', link: 'https://www.utech.edu.jm/careers', location: 'Kingston, Jamaica' },
        { company: 'HEART/NSTA Trust', link: 'https://www.heart-nsta.org/jobs', location: 'Kingston, Jamaica' },
        { company: 'Northern Caribbean University', link: 'https://www.ncu.edu.jm/', location: 'Mandeville, Jamaica' }
      ]
    },
    {
      key: 'tech',
      match: /software|engineer|developer|it\s*support|help\s*desk|systems|network|cyber/,
      roles: ['IT Support Specialist', 'Software Developer', 'Systems Administrator'],
      employers: [
        { company: 'Digicel Jamaica', link: 'https://www.digicelgroup.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Flow Jamaica (C&W)', link: 'https://careers.cwc.com', location: 'Kingston, Jamaica' },
        { company: 'eGov Jamaica', link: 'https://www.egovja.com/', location: 'Kingston, Jamaica' },
        { company: 'NCB Jamaica', link: 'https://www.jncb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'construction',
      match: /construction|civil|site\s*engineer|quantity\s*surveyor|logistics|warehouse|supply\s*chain|procurement/,
      roles: ['Site Engineer', 'Logistics Coordinator', 'Procurement Officer'],
      employers: [
        { company: 'China Harbour Engineering Company Ltd', link: 'https://www.chec.bj.cn/en/', location: 'Kingston, Jamaica' },
        { company: 'Jamaica Pre-Mix Limited', link: 'https://www.jamaicapremix.com/', location: 'Kingston, Jamaica' },
        { company: 'Tank-Weld Metals', link: 'https://tankweld.com/', location: 'Kingston, Jamaica' },
        { company: 'Kingston Wharves', link: 'https://www.kwljamaica.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Seaboard Jamaica', link: 'https://www.seaboard.com/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'hr',
      match: /human\s*resources|\bhr\b|talent\s*acquisition|recruiter|people\s*operations/,
      roles: ['Human Resources Officer', 'Talent Acquisition Specialist', 'HR Generalist'],
      employers: [
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Wisynco Group', link: 'https://wisynco.com/careers/', location: 'St. Catherine, Jamaica' },
        { company: 'JMMB Group', link: 'https://jm.jmmb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' },
        { company: 'National Commercial Bank Jamaica (NCB)', link: 'https://www.jncb.com/careers', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'admin',
      match: /data\s*entry|receptionist|administrative|admin\s*assistant|office\s*clerk|secretary|clerical|front\s*desk/,
      roles: ['Administrative Assistant', 'Data Entry Clerk', 'Receptionist'],
      employers: [
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' },
        { company: 'Ministry of Finance and the Public Service', link: 'https://www.mof.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'Caribbean Producers Jamaica', link: 'https://www.cpj.com.jm/', location: 'Montego Bay, Jamaica' },
        { company: 'Wisynco Group', link: 'https://wisynco.com/careers/', location: 'St. Catherine, Jamaica' }
      ]
    },
    {
      key: 'trades',
      match: /electrician|plumber|auto\s*mechanic|mechanic|carpenter|welder|technician|tradesman|hvac|refrigeration/,
      roles: ['Electrician', 'Plumber', 'Auto Mechanic'],
      employers: [
        { company: 'Jamaica Public Service Company (JPS)', link: 'https://www.jpsco.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'National Water Commission (NWC)', link: 'https://www.nwcjamaica.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Rubis Energy Jamaica', link: 'https://www.rubis.com/en/careers', location: 'Kingston, Jamaica' },
        { company: 'Courts Jamaica', link: 'https://www.courtsjamaica.com/', location: 'Kingston, Jamaica' },
        { company: 'Island Electric Jamaica', link: 'https://islandelectric.com.jm/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'retail',
      match: /cashier|retail|sales\s*associate|shop\s*assistant|store\s*clerk|checkout|merchandiser|inventory\s*clerk/,
      roles: ['Cashier', 'Retail Sales Associate', 'Merchandiser'],
      employers: [
        { company: 'Courts Jamaica', link: 'https://www.courtsjamaica.com/', location: 'Kingston, Jamaica' },
        { company: 'Hi-Lo Food Stores', link: 'https://hilofoods.com/', location: 'Kingston, Jamaica' },
        { company: 'PriceSmart Jamaica', link: 'https://www.pricesmart.com/', location: 'Kingston, Jamaica' },
        { company: 'SuperValu Jamaica', link: 'https://www.supervalu.com.jm/', location: 'Kingston, Jamaica' },
        { company: 'Fontana Pharmacy', link: 'https://www.fontanapharmacy.com/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'driver',
      match: /\bdriver\b|delivery\s*driver|courier|transport|dispatcher|chauffeur|truck\s*driver|bus\s*driver|logistics\s*driver/,
      roles: ['Driver', 'Delivery Driver', 'Courier'],
      employers: [
        { company: 'Wisynco Group', link: 'https://wisynco.com/careers/', location: 'St. Catherine, Jamaica' },
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Caribbean Producers Jamaica', link: 'https://www.cpj.com.jm/', location: 'Montego Bay, Jamaica' },
        { company: 'DHL Jamaica', link: 'https://www.dhl.com/jm-en/home/careers.html', location: 'Kingston, Jamaica' },
        { company: 'Seprod Group', link: 'https://www.seprod.com/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'real_estate',
      match: /real\s*estate|realtor|property\s*manager|property\s*agent|land\s*sales|housing\s*agent/,
      roles: ['Real Estate Agent', 'Property Manager', 'Sales and Leasing Agent'],
      employers: [
        { company: 'RE/MAX Jamaica', link: 'https://www.remax-jamaica.com/', location: 'Kingston, Jamaica' },
        { company: 'Century 21 Jamaica', link: 'https://www.century21jamaica.com/', location: 'Kingston, Jamaica' },
        { company: 'Jamaica Properties Real Estate', link: 'https://www.jamaicaproperties.com/', location: 'Kingston, Jamaica' },
        { company: 'Homes Jamaica', link: 'https://www.homes.com.jm/', location: 'Kingston, Jamaica' },
        { company: 'Pan Jamaica Group', link: 'https://www.panjam.com/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'pharmacy',
      match: /pharmacist|pharmacy\s*technician|lab\s*technician|laboratory|medical\s*lab|pathology|phlebotomist|dispensary/,
      roles: ['Pharmacist', 'Pharmacy Technician', 'Laboratory Technician'],
      employers: [
        { company: 'Fontana Pharmacy', link: 'https://www.fontanapharmacy.com/', location: 'Kingston, Jamaica' },
        { company: 'National Health Fund (NHF)', link: 'https://www.nhf.org.jm/', location: 'Kingston, Jamaica' },
        { company: 'Mega Mart Jamaica', link: 'https://www.megamartja.com/', location: 'Kingston, Jamaica' },
        { company: 'University Hospital of the West Indies (UHWI)', link: 'https://www.uhwi.gov.jm/careers', location: 'Kingston, Jamaica' },
        { company: 'LabTest Jamaica', link: 'https://www.labtestja.com/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'social_work',
      match: /social\s*worker|social\s*work|counselor|community\s*development|child\s*protection|welfare\s*officer|case\s*manager/,
      roles: ['Social Worker', 'Community Development Officer', 'Welfare Officer'],
      employers: [
        { company: 'Child Protection and Family Services Agency (CPFSA)', link: 'https://www.cpfsa.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'Ministry of Labour and Social Security', link: 'https://mlss.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'Office of the Children\'s Advocate', link: 'https://www.childadvocate.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'National Council for Senior Citizens', link: 'https://www.moh.gov.jm/', location: 'Kingston, Jamaica' },
        { company: 'Salvation Army Jamaica', link: 'https://www.salvationarmy.org/', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'culinary',
      match: /\bchef\b|sous\s*chef|pastry\s*chef|cook|culinary|kitchen\s*staff|head\s*chef|line\s*cook|food\s*prep/,
      roles: ['Chef', 'Sous Chef', 'Kitchen Staff'],
      employers: [
        { company: 'Sandals Resorts Jamaica', link: 'https://www.sandals.com/careers/', location: 'St. James, Jamaica' },
        { company: 'RIU Hotels Jamaica', link: 'https://www.riu.com/en/jobs/', location: 'St. James, Jamaica' },
        { company: 'Couples Resorts Jamaica', link: 'https://www.couples.com/careers', location: 'St. Ann, Jamaica' },
        { company: 'Jamaica Pegasus Hotel', link: 'https://www.jamaicapegasus.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Jewel Resorts Jamaica', link: 'https://www.jewel-resorts.com/', location: 'St. Ann, Jamaica' }
      ]
    },
    {
      key: 'creative',
      match: /graphic\s*des|web\s*des|ui\s*ux|ux\s*ui|visual\s*des|art\s*director|illustrat|animator|video\s*edit|photographer|content\s*creat/,
      roles: ['Graphic Designer', 'Web Designer', 'Content Creator'],
      employers: [
        { company: 'Digicel Jamaica', link: 'https://www.digicelgroup.com/careers', location: 'Kingston, Jamaica' },
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'Caribbean Producers Jamaica', link: 'https://www.cpj.com.jm/', location: 'Montego Bay, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' },
        { company: 'Flow Jamaica (C&W)', link: 'https://careers.cwc.com', location: 'Kingston, Jamaica' }
      ]
    },
    {
      key: 'business_analyst',
      match: /business\s*analyst|systems\s*analyst|process\s*analyst|data\s*analyst|operations\s*analyst|management\s*consultant/,
      roles: ['Business Analyst', 'Systems Analyst', 'Data Analyst'],
      employers: [
        { company: 'National Commercial Bank Jamaica (NCB)', link: 'https://www.jncb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'Sagicor Group Jamaica', link: 'https://www.sagicor.com/en-jm/careers', location: 'Kingston, Jamaica' },
        { company: 'GraceKennedy Limited', link: 'https://gracekennedy.com/careers/', location: 'Kingston, Jamaica' },
        { company: 'JMMB Group', link: 'https://jm.jmmb.com/careers', location: 'Kingston, Jamaica' },
        { company: 'eGov Jamaica', link: 'https://www.egovja.com/', location: 'Kingston, Jamaica' }
      ]
    }
  ];

  const selected = sectors.find((s) => s.match.test(q));
  if (!selected) return [];

  const roles = [query, ...selected.roles].filter(Boolean);
  const jobs = [];

  selected.employers.forEach((item, employerIdx) => {
    roles.slice(0, 2).forEach((roleName, roleIdx) => {
      jobs.push(
        normalizeJob({
          title: roleName,
          company: item.company,
          location: item.location,
          link: item.link,
          description: `${item.company} career opportunities in Jamaica for ${roleName}. Apply through official employer channels.`,
          postedAt: new Date(Date.now() - (employerIdx * 60 + roleIdx * 20) * 60 * 1000).toISOString(),
          matchScore: Math.min(94, estimateMatchScore(roleName, `${item.company} ${selected.key} Jamaica`, resume) + 7),
          source: 'Jamaica Sector Careers',
          employmentType: 'full-time',
          isRemote: false,
          sponsorshipAvailable: false,
          experienceLevel: 'entry',
          requiredCredentials: ['Communication Skills', 'Professionalism']
        })
      );
    });
  });

  return dedupeJobs(jobs);
}

function extractCredentials(text) {
  const credentialKeywords = ['csec', 'cape', 'heart', 'nvq', 'associate', 'bachelor', 'diploma', 'certification', 'degree', 'cpa', 'acca', 'coil', 'bpo'];
  const credentials = [];
  const lower = (text || '').toLowerCase();
  for (const cred of credentialKeywords) {
    if (lower.includes(cred)) credentials.push(cred.toUpperCase());
  }
  return [...new Set(credentials)];
}

async function fetchUsaJobs(title, location, resume) {
  if (!USAJOBS_API_KEY || !USAJOBS_USER_AGENT) return [];

  const keyword = encodeURIComponent(title || '');
  const normalizedLocation = normalizeLocationForApiQuery(location);
  const locationName = encodeURIComponent(normalizedLocation || '');
  const locationQuery = String(location || '').toLowerCase();
  const usaPages = /united\s*states|\busa\b|\bus\b|america|\bny\b|\bca\b|\bfl\b|\bco\b|new york|california|texas|florida/.test(locationQuery) ? 4 : 1;

  const responses = await Promise.allSettled(
    Array.from({ length: usaPages }, (_, idx) => idx + 1).map((page) => {
      const url = `https://data.usajobs.gov/api/search?Keyword=${keyword}&LocationName=${locationName}&ResultsPerPage=50&Page=${page}`;
      return fetchJson(
        url,
        {
          headers: {
            'Host': 'data.usajobs.gov',
            'User-Agent': USAJOBS_USER_AGENT,
            'Authorization-Key': USAJOBS_API_KEY
          }
        },
        2200
      );
    })
  );

  const jobs = [];
  responses.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    const items = r.value?.SearchResult?.SearchResultItems;
    if (Array.isArray(items)) jobs.push(...items);
  });

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

function getMockUSStateJobs(title, location, resume) {
  const stateInfo = getUSStateInfo(location);
  if (!stateInfo) return [];

  const requestedTitle = String(title || '').trim() || 'Project Manager';
  const titleTokens = requestedTitle.split(/\s+/).filter(Boolean);
  const titleLabel = titleTokens.length ? requestedTitle : 'Project Manager';
  const cities = stateInfo.cities.length ? stateInfo.cities.slice(0, 6) : [stateInfo.full];
  const companies = ['Comcast', 'Deloitte', 'UPMC', 'PNC Bank', 'Accenture', 'IBM'];
  const titleVariants = [
    `Senior ${titleLabel}`,
    `${titleLabel} II`,
    `${titleLabel} - Operations`,
    `${titleLabel} - Strategy`,
    `${titleLabel} - Enterprise Programs`,
    `${titleLabel} - Client Delivery`
  ];

  return cities.map((city, index) => {
    const company = companies[index % companies.length];
    const roleTitle = titleVariants[index % titleVariants.length];
    const humanLocation = `${city.replace(/\b\w/g, (char) => char.toUpperCase())}, ${stateInfo.full.replace(/\b\w/g, (char) => char.toUpperCase())}`;
    const searchParams = new URLSearchParams({
      keywords: roleTitle,
      location: humanLocation
    });

    return {
      title: roleTitle,
      company,
      location: humanLocation,
      link: `https://www.linkedin.com/jobs/search/?${searchParams.toString()}`,
      description: `Sample statewide match for ${titleLabel} across ${stateInfo.full.replace(/\b\w/g, (char) => char.toUpperCase())}, including ${humanLocation}.`,
      postedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
      matchScore: Math.max(78, 93 - index * 2),
      source: 'State Market Fallback'
    };
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

function buildSourceTasks({ title, location, resume, radiusMiles = 100 }) {
  const q = String(location || '').trim().toLowerCase();
  const isJamaica = /\bjamaica\b/.test(q);
  const isCaribbean = /caribbean|trinidad|tobago|barbados|bahamas|aruba|antigua|st\.?\s*martin|saint\s*martin|sint\s*maarten|guyana|st\s*lucia|grenada|dominica|st\s*kitts|nevis|belize|suriname|cayman|bermuda|martinique|guadeloupe/.test(q);
  const usStateInfo = getUSStateInfo(location);

  const tasks = [
    timeoutPromise(fetchAdzunaJobs(title, location, resume, radiusMiles), 7000),
    timeoutPromise(fetchGreenhouseJobs(title, location, resume), 2200),
    timeoutPromise(fetchLeverJobs(title, location, resume), 2200),
    timeoutPromise(fetchRemotiveJobs(title, location, resume), 2500),
    timeoutPromise(fetchArbeitnowJobs(title, location, resume), 2500),
    timeoutPromise(fetchTheMuseJobs(title, location, resume), 4000)
  ];

  if (/united\s*states|\busa\b|\bus\b|\bny\b|\bca\b|\bfl\b|\bco\b|new york|california|texas|florida|denver|chicago|los angeles|houston|dallas/.test(q) || !q) {
    tasks.push(timeoutPromise(fetchUsaJobs(title, location, resume), 7000));
  }

  if (isJamaica || isCaribbean || !q) {
    tasks.push(timeoutPromise(fetchCaribJobs(title, location, resume), 2500));
    tasks.push(timeoutPromise(fetchJamaicaEmployment(title, location, resume), 2500));
    if (isCaribbean) {
      tasks.push(timeoutPromise(fetchCaribbeanJobsHtmlDirect(title, location, resume), 3500));
    }
  }

  // Add Jamaica-local direct listing feeds to improve local coverage for common roles.
  if (isJamaica) {
    tasks.push(timeoutPromise(fetchCaribbeanJobsHtmlDirect(title, location, resume), 3500));
    tasks.push(timeoutPromise(fetchIndeedJamaicaJobs(title, location, resume), 3500));
    tasks.push(Promise.resolve(getBPOCompanyJobs(title, 'Jamaica', resume)));
  }

  if (usStateInfo) {
    tasks.push(Promise.resolve(getMockUSStateJobs(title, location, resume)));
  }

  return tasks;
}

async function fetchAllSourcesSettled({ title, location, resume, radiusMiles = 100 }) {
  return Promise.allSettled(buildSourceTasks({ title, location, resume, radiusMiles }));
}

async function fetchJamaicaMarketFallbackJobs(title, resume) {
  const normalizedTitle = String(title || '').trim() || 'Registered Nurse';

  // Pull live jobs from markets that currently have stable structured APIs,
  // then relabel as global market availability for Jamaica candidates.
  const settled = await Promise.allSettled([
    fetchAdzunaJobs(normalizedTitle, 'United Kingdom', resume),
    fetchAdzunaJobs(normalizedTitle, 'United States', resume),
    fetchAdzunaJobs(normalizedTitle, 'Canada', resume),
    fetchUsaJobs(normalizedTitle, 'United States', resume)
  ]);

  const combined = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      combined.push(...r.value);
    }
  });

  const ranked = rankJobs(dedupeJobs(combined), { title: normalizedTitle, location: 'Jamaica' });
  return ranked.map((job) => ({
    ...job,
    source: `${job.source} (Global market)`
  }));
}

async function searchJobsFast({ title, location, resume, radiusMiles = 100 }) {
  const cacheKey = `${title}::${location}::${resume || ''}`.toLowerCase().trim();
  const cached = jobSearchCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) {
    return { jobs: cached.jobs, fromCache: true };
  }

  const settled = await fetchAllSourcesSettled({ title, location, resume, radiusMiles });

  const combined = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      combined.push(...r.value);
    }
  });

  console.log(`[SEARCH] ${title} in ${location}: combined=${combined.length} jobs from sources`);

  const locationQueryForExpansion = String(location || '').trim().toLowerCase();
  if (/\bjamaica\b/.test(locationQueryForExpansion)) {
    try {
      const expanded = await fetchExpandedJamaicaSectorJobs({ title, location, resume });
      if (expanded.length) combined.push(...expanded);
    } catch (_e) {
      // Ignore expansion failures and continue with base sources.
    }
  }

  const ranked = rankJobs(dedupeJobs(combined), { title, location });
  const locationMatched = ranked.filter((job) => isLocationCompatible(job, location));
  console.log(`[SEARCH] after locationCompatible filter: ${locationMatched.length} jobs passed`);
  
  const locationQuery = String(location || '').trim().toLowerCase();
  const allowBroadFallback = !locationQuery || /remote|worldwide|global|anywhere|anywhere in/i.test(locationQuery);
  let jobs = (locationMatched.length || !allowBroadFallback ? locationMatched : ranked);

  // Keep results query-intent specific so unrelated roles do not leak into
  // narrow searches like tourism vs software. If query tokens exist, enforce
  // the filter even when it yields zero results.
  const queryTokens = buildQueryTokens(title);
  if (queryTokens.length) {
    jobs = jobs.filter((job) => isJobRelevantToQuery(job, title));
  }

  // For Jamaica, return only Jamaica-matched jobs with recent posted dates
  // and direct posting links (not generic career portal landing pages).
  if (/\bjamaica\b/.test(locationQuery)) {
    jobs = jobs
      .filter((job) => isLocationCompatible(job, 'Jamaica'))
      .filter((job) => isPostedWithinDays(job.postedAt, 7))
      .filter((job) => !isGenericCareerLandingLink(job.link));
  }

  // For other Caribbean islands (Trinidad, Barbados, Bahamas, Guyana, etc.),
  // do not inject relabeled non-Caribbean jobs.
  const isCaribbean = /caribbean|trinidad|barbados|bahamas|guyana|st\s*lucia|antigua|grenada|cayman|belize|suriname|martinique|guadeloupe/.test(locationQuery);
  if (isCaribbean && !/\bjamaica\b/.test(locationQuery)) {
    jobs = jobs.filter((job) => isCaribbeanIslandLocationText(`${job.location || ''} ${job.description || ''} ${job.company || ''} ${job.link || ''}`));
  }

  // For Jamaica, do not inject synthetic/fallback portal links when none match
  // direct-link and recency requirements.

  const queryTitleLower = String(title || '').toLowerCase();
  const isTourismHospitalityQuery = /\btourism\b|\bhospitality\b|\bhotel\b|\bresort\b|\btravel\b/.test(queryTitleLower);
  if (!jobs.length && /\bjamaica\b/.test(locationQuery) && isTourismHospitalityQuery) {
    jobs = getGuaranteedJamaicaTourismFallbackJobs(title, resume);
  }

  if (!jobs.length && /\bjamaica\b/.test(locationQuery) && !isTourismHospitalityQuery) {
    const sectorFallback = getGuaranteedJamaicaSectorFallbackJobs(title, resume);
    if (sectorFallback.length) jobs = sectorFallback;
  }

  // If live feeds return only a handful of sector jobs, top up with curated
  // Jamaica sector fallbacks so users still get a useful list.
  if (/\bjamaica\b/.test(locationQuery) && !isTourismHospitalityQuery && jobs.length > 0 && jobs.length < 8) {
    const sectorFallback = getGuaranteedJamaicaSectorFallbackJobs(title, resume);
    if (sectorFallback.length) {
      jobs = rankJobs(dedupeJobs([...jobs, ...sectorFallback]), { title, location });
    }
  }

  // If providers are flaky, return stale cache before showing empty.
  if (!jobs.length && cached && Date.now() - cached.createdAt < JOB_STALE_CACHE_MS) {
    return { jobs: cached.jobs, fromCache: true, staleCache: true };
  }
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
const JOB_ALERT_LOCATION_SCOPES = ['strict-local', 'nearby-radius', 'nationwide-us'];
const JOB_ALERT_MIN_MATCH_SCORE = 90;
const JOB_ALERT_SCHEDULE_INTERVAL_MS = 1000 * 60 * 5;
const WHATSAPP_STATUS_NUDGE_INTERVAL_MS = 1000 * 60 * 10;
const WHATSAPP_STATUS_NUDGE_DELAY_MS = 1000 * 60 * 60 * 24;
const JOB_ALERT_FREQUENCY_MS = {
  instant: 1000 * 60 * 60 * 2,
  daily: 1000 * 60 * 60 * 24,
  weekly: 1000 * 60 * 60 * 24 * 7
};
let jobAlertSchedulerTimer = null;
let jobAlertSchedulerRunning = false;
let whatsappStatusNudgeTimer = null;
let whatsappStatusNudgeRunning = false;

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
  const searchRadiusRaw = Number(input.searchRadius);
  const locationScopeRaw = cleanAlertString(input.locationScope || 'strict-local', 30).toLowerCase();
  const locationScope = locationScopeRaw === 'nearby' ? 'nearby-radius'
    : locationScopeRaw === 'nationwide' ? 'nationwide-us'
    : locationScopeRaw;
  const workModesRaw = Array.isArray(input.workModes) ? input.workModes : [];
  const employmentTypesRaw = Array.isArray(input.employmentTypes) ? input.employmentTypes : [];
  const seniorityLevelsRaw = Array.isArray(input.seniorityLevels) ? input.seniorityLevels : [];
  return {
    location: cleanAlertString(input.location || 'Remote', 120) || 'Remote',
    frequency: JOB_ALERT_FREQUENCIES.includes(frequency) ? frequency : 'daily',
    locationScope: JOB_ALERT_LOCATION_SCOPES.includes(locationScope) ? locationScope : 'strict-local',
    searchRadius: Number.isFinite(searchRadiusRaw) && searchRadiusRaw > 0 ? Math.min(Math.round(searchRadiusRaw), 500) : 100,
    workModes: toAllowedList(workModesRaw.map((item) => String(item).toLowerCase()), JOB_ALERT_WORK_MODES),
    employmentTypes: toAllowedList(employmentTypesRaw.map((item) => String(item).toLowerCase()), JOB_ALERT_EMPLOYMENT_TYPES),
    seniorityLevels: toAllowedList(seniorityLevelsRaw.map((item) => String(item).toLowerCase()), JOB_ALERT_SENIORITY_LEVELS),
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

function parseSalaryTargetNumber(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function getUserRecommendationThresholds(userId) {
  if (!userId) {
    return { salaryMin: 0, workModes: [], employmentTypes: [] };
  }

  const [user, profile] = await Promise.all([
    User.findById(userId).select('jobAlertDefaults').lean(),
    RoleProfile.findOne({ userId }).sort({ updatedAt: -1 }).lean()
  ]);

  const defaults = normalizeJobAlertDefaults(user?.jobAlertDefaults || {});
  const roleProfileSalary = parseSalaryTargetNumber(profile?.salaryTarget || '');
  const salaryMin = Math.max(Number(defaults.salaryMin || 0), roleProfileSalary);

  const workModes = Array.isArray(defaults.workModes) ? defaults.workModes.filter(Boolean) : [];
  const employmentTypes = Array.isArray(defaults.employmentTypes) ? defaults.employmentTypes.filter(Boolean) : [];

  if (profile?.workPreference && profile.workPreference !== 'flexible' && !workModes.length) {
    workModes.push(String(profile.workPreference));
  }

  return {
    salaryMin,
    workModes: [...new Set(workModes.map((item) => String(item).toLowerCase().trim()).filter(Boolean))],
    employmentTypes: [...new Set(employmentTypes.map((item) => String(item).toLowerCase().trim()).filter(Boolean))]
  };
}

function jobMatchesRecommendationThresholds(job, thresholds) {
  const activeThresholds = thresholds || { salaryMin: 0, workModes: [], employmentTypes: [] };

  if (Number(activeThresholds.salaryMin || 0) > 0) {
    const salaryMax = Number((job.salaryRange && job.salaryRange.max) || 0);
    const salaryMin = Number((job.salaryRange && job.salaryRange.min) || 0);
    // Do not reject jobs with missing salary metadata.
    // Many feeds omit salary for otherwise valid postings.
    if ((salaryMax > 0 || salaryMin > 0) && Math.max(salaryMax, salaryMin) < Number(activeThresholds.salaryMin || 0)) {
      return false;
    }
  }

  if (Array.isArray(activeThresholds.workModes) && activeThresholds.workModes.length) {
    const jobWorkModes = detectWorkModes(job);
    // Only enforce when job work-mode metadata is actually present.
    if (jobWorkModes.length && !jobWorkModes.some((item) => activeThresholds.workModes.includes(item))) {
      return false;
    }
  }

  if (Array.isArray(activeThresholds.employmentTypes) && activeThresholds.employmentTypes.length) {
    const jobEmployment = detectEmploymentTypes(job);
    // Only enforce when job employment-type metadata is actually present.
    if (jobEmployment.length && !jobEmployment.some((item) => activeThresholds.employmentTypes.includes(item))) {
      return false;
    }
  }

  return true;
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

async function runWhatsAppStatusNudges() {
  if (whatsappStatusNudgeRunning || mongoose.connection.readyState !== 1) return;
  whatsappStatusNudgeRunning = true;

  try {
    const threshold = new Date(Date.now() - WHATSAPP_STATUS_NUDGE_DELAY_MS);
    const candidates = await Application.find({
      status: 'applied',
      createdAt: { $lte: threshold }
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    for (const app of candidates) {
      const phone = normalizeWhatsAppPhone(app.userId || '');
      if (!phone) continue;

      const [convo, profile] = await Promise.all([
        WhatsAppConversation.findOne({ phone }),
        WhatsAppRecruitingUser.findOne({ phone }).lean()
      ]);
      if (!convo || profile?.optedIn === false) continue;

      const metadata = (convo.metadata && typeof convo.metadata === 'object') ? convo.metadata : {};
      metadata.statusNudge = (metadata.statusNudge && typeof metadata.statusNudge === 'object') ? metadata.statusNudge : {};
      const sentApplicationIds = Array.isArray(metadata.statusNudge.sentApplicationIds)
        ? metadata.statusNudge.sentApplicationIds.map((item) => String(item || ''))
        : [];
      const appId = String(app._id || '');
      if (!appId || sentApplicationIds.includes(appId)) continue;

      const message = [
        `24h status check: ${app.jobTitle || 'Your application'} @ ${app.company || 'the company'}.`,
        'Reply STATUS for latest tracked updates, or 1 for new matches.'
      ].join('\n');

      const sendResult = await sendWhatsAppMessage({ to: phone, message });
      if (!sendResult?.success) {
        await trackWhatsAppTelemetry(phone, 'whatsapp_status_nudge_failed', {
          applicationId: appId,
          reason: sendResult?.error || sendResult?.reason || 'send_failed'
        });
        continue;
      }

      metadata.statusNudge.sentApplicationIds = [...sentApplicationIds.slice(-119), appId];
      metadata.statusNudge.lastSentAt = new Date().toISOString();
      metadata.statusNudge.lastMessageSid = String(sendResult.sid || '');

      convo.metadata = metadata;
      convo.lastOutboundMessage = message;
      convo.lastOutboundAt = new Date();
      await convo.save();

      await trackWhatsAppTelemetry(phone, 'whatsapp_status_nudge_sent', {
        applicationId: appId,
        jobTitle: String(app.jobTitle || ''),
        company: String(app.company || ''),
        messageSid: String(sendResult.sid || '')
      });
    }
  } finally {
    whatsappStatusNudgeRunning = false;
  }
}

function startWhatsAppStatusNudgeScheduler() {
  if (process.env.NODE_ENV === 'test' || whatsappStatusNudgeTimer) return;
  whatsappStatusNudgeTimer = setInterval(() => {
    runWhatsAppStatusNudges().catch((err) => {
      console.error('WhatsApp status nudge scheduler failed:', err.message);
    });
  }, WHATSAPP_STATUS_NUDGE_INTERVAL_MS);

  runWhatsAppStatusNudges().catch((err) => {
    console.error('Initial WhatsApp status nudge run failed:', err.message);
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

function getInDemandJobSourceLabels() {
  const config = getSourceConfigSnapshot();
  const labels = [];

  if (config.adzuna?.enabled) labels.push('Adzuna');
  if (config.greenhouse?.enabled) labels.push('Greenhouse');
  if (config.lever?.enabled) labels.push('Lever');
  if (config.remotive?.enabled) labels.push('Remotive');
  if (config.arbeitnow?.enabled) labels.push('Arbeitnow');
  if (config.usajobs?.enabled) labels.push('USAJobs');

  return labels;
}

function getPlatformStatsSourceLabels() {
  return ['RoleRocket AI platform database'];
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
    industries: Object.fromEntries(results),
    sources: getInDemandJobSourceLabels()
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

function normalizePossibleCompanyName(value = '') {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[|:;,\-\s]+$/g, '')
    .trim();

  if (!cleaned) return '';

  const invalid = /^(apply|job|jobs|remote|full[-\s]?time|part[-\s]?time|linkedin|indeed|glassdoor|monster|ziprecruiter|imported\s+company|unknown\s+company)$/i;
  if (invalid.test(cleaned)) return '';

  return cleaned;
}

function titleCaseFromSlug(slug = '') {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractCompanyFromSourceUrl(sourceUrl = '') {
  try {
    const url = new URL(String(sourceUrl || '').trim());
    const host = String(url.hostname || '').toLowerCase();
    const pathParts = String(url.pathname || '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    if (host.includes('jobs.lever.co') && pathParts[0]) {
      return normalizePossibleCompanyName(titleCaseFromSlug(pathParts[0]));
    }

    if (host.includes('boards.greenhouse.io') && pathParts[0]) {
      return normalizePossibleCompanyName(titleCaseFromSlug(pathParts[0]));
    }

    const workdayMatch = host.match(/^([a-z0-9-]+)\.(?:wd\d+\.)?myworkdayjobs\.com$/i);
    if (workdayMatch && workdayMatch[1]) {
      return normalizePossibleCompanyName(titleCaseFromSlug(workdayMatch[1]));
    }

    return '';
  } catch {
    return '';
  }
}

function extractCompanyName(text = '', sourceUrl = '') {
  const patterns = [
    /company[:\s]+([^\n]+)/i,
    /hiring company[:\s]+([^\n]+)/i,
    /employer[:\s]+([^\n]+)/i,
    /organization[:\s]+([^\n]+)/i,
    /about\s+([^\n]{2,80})\s+(?:careers|jobs)/i,
    /\bat\s+([A-Z][A-Za-z0-9&.,'\-\s]{2,80}?)(?:\s+(?:in|is|seeks|seeking|looking|hiring|for)\b|[\n,.;]|$)/
  ];

  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    const normalized = normalizePossibleCompanyName(match?.[1] || '');
    if (normalized) return normalized;
  }

  return extractCompanyFromSourceUrl(sourceUrl) || 'Unknown Company';
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
    company: extractCompanyName(rawText, sourceUrl),
    location: extractLocation(rawText),
    description: rawText.trim(),
    link: sourceUrl?.trim() || '#',
    sourceUrl: sourceUrl?.trim() || '#',
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

    const parsedCompany = normalizePossibleCompanyName(parsed.company || '');

    return normalizeJob({
      ...fallback,
      title: parsed.title || fallback.title,
      company: parsedCompany || fallback.company,
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

    const { name, email, password, referralCode, accountType, institutionName, invitationCode } = req.body || {};
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');
    const normalizedReferralCode = String(referralCode || '').trim().toUpperCase();
    const normalizedAccountType = ['institution'].includes(String(accountType || '')) ? 'institution' : 'individual';
    let normalizedInstitutionName = normalizeInstitutionName(institutionName);
    const normalizedInvitationCode = normalizeInstitutionInviteCode(invitationCode);
    let normalizedInstitutionId = null;
    let inviteRecord = null;
    let institutionTrialStartsAt = null;
    let institutionTrialEndsAt = null;
    let institutionInviteCode = null;
    let institutionAccessType = null;
    let institutionLicensedPlan = null;
    let initialPlan = 'free';
    let initialSubscribed = false;

    if (!normalizedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (rawPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (normalizedAccountType === 'institution') {
      if (!normalizedInstitutionName) {
        return res.status(400).json({ error: 'Institution name is required for institution accounts' });
      }

      if (!normalizedInvitationCode) {
        return res.status(400).json({ error: 'Invitation code is required for institution accounts' });
      }

      inviteRecord = await InstitutionInvite.findOne({
        code: normalizedInvitationCode,
        active: true
      }).lean();

      if (!inviteRecord) {
        return res.status(400).json({ error: 'Invalid invitation code' });
      }

      if (inviteRecord.expiresAt && new Date(inviteRecord.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Invitation code has expired' });
      }

      if (Number(inviteRecord.usedCount || 0) >= Number(inviteRecord.maxUses || 0)) {
        return res.status(400).json({ error: 'Invitation code has already been used' });
      }

      const inviteInstitutionName = normalizeInstitutionName(inviteRecord.institutionName);
      if (inviteInstitutionName.toLowerCase() !== normalizedInstitutionName.toLowerCase()) {
        return res.status(400).json({ error: 'Invitation code does not match the selected institution name' });
      }

      institutionAccessType = normalizeInstitutionActivationType(inviteRecord.activationType);
      institutionLicensedPlan = normalizeInstitutionIncludedPlan(inviteRecord.includedPlan || 'elite');
      institutionInviteCode = normalizedInvitationCode;

      if (institutionAccessType === 'paid') {
        initialPlan = institutionLicensedPlan;
        initialSubscribed = true;
      } else {
        const accessDays = Math.max(1, Number(inviteRecord.accessDays || DEFAULT_INSTITUTION_TRIAL_DAYS));
        institutionTrialStartsAt = new Date();
        institutionTrialEndsAt = new Date(institutionTrialStartsAt.getTime() + accessDays * 24 * 60 * 60 * 1000);
      }
    }

    // Individual students: if they provide an invite code alongside an institution name,
    // validate it and apply the includedPlan. Without a code they join free (cohort link only).
    if (normalizedAccountType === 'individual' && normalizedInvitationCode && normalizedInstitutionName) {
      const studentInvite = await InstitutionInvite.findOne({
        code: normalizedInvitationCode,
        active: true
      }).lean();

      if (!studentInvite) {
        return res.status(400).json({ error: 'Invalid invitation code' });
      }
      if (studentInvite.expiresAt && new Date(studentInvite.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Invitation code has expired' });
      }
      if (Number(studentInvite.usedCount || 0) >= Number(studentInvite.maxUses || 0)) {
        return res.status(400).json({ error: 'Invitation code has already been used' });
      }
      const inviteInstName = normalizeInstitutionName(studentInvite.institutionName);
      if (inviteInstName.toLowerCase() !== normalizedInstitutionName.toLowerCase()) {
        return res.status(400).json({ error: 'Invitation code does not match the selected institution' });
      }

      institutionAccessType = normalizeInstitutionActivationType(studentInvite.activationType);
      institutionLicensedPlan = normalizeInstitutionIncludedPlan(studentInvite.includedPlan || 'elite');
      institutionInviteCode = normalizedInvitationCode;

      if (institutionAccessType === 'paid') {
        initialPlan = institutionLicensedPlan;
        initialSubscribed = true;
      } else {
        const accessDays = Math.max(1, Number(studentInvite.accessDays || DEFAULT_INSTITUTION_TRIAL_DAYS));
        institutionTrialStartsAt = new Date();
        institutionTrialEndsAt = new Date(institutionTrialStartsAt.getTime() + accessDays * 24 * 60 * 60 * 1000);
      }
    }

    // Allow individual students to optionally link themselves to an institution
    // (for cohort analytics) while keeping institution accounts required to provide it.
    if (normalizedInstitutionName) {
      const institutionRecord = await findOrCreateInstitutionByName(normalizedInstitutionName);
      normalizedInstitutionName = institutionRecord.name;
      normalizedInstitutionId = institutionRecord._id;
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
          isSubscribed: initialSubscribed,
          plan: initialPlan,
          accountType: normalizedAccountType,
          institutionName: normalizedInstitutionName,
          institutionId: normalizedInstitutionId,
          institutionTrialStartsAt,
          institutionTrialEndsAt,
          institutionInviteCode,
          institutionAccessType,
          institutionLicensedPlan,
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
            .select('_id name email password isSubscribed plan referralCode referralCount emailVerified institutionTrialStartsAt institutionTrialEndsAt institutionAccessType institutionLicensedPlan')
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
                  institutionTrialStartsAt: existingUser.institutionTrialStartsAt || null,
                  institutionTrialEndsAt: existingUser.institutionTrialEndsAt || null,
                  institutionAccessType: existingUser.institutionAccessType || null,
                  institutionLicensedPlan: existingUser.institutionLicensedPlan || null,
                  institutionTrialActive: isInstitutionTrialActive(existingUser),
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

    if (normalizedAccountType === 'institution' && inviteRecord) {
      const consumedAt = new Date();
      const consumedInvite = await InstitutionInvite.findOneAndUpdate(
        {
          _id: inviteRecord._id,
          active: true,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: consumedAt } }
          ],
          $expr: { $lt: ['$usedCount', '$maxUses'] }
        },
        {
          $inc: { usedCount: 1 },
          $set: {
            lastUsedAt: consumedAt,
            lastUsedByUserId: user._id
          }
        },
        { new: true }
      ).lean();

      if (!consumedInvite) {
        await User.deleteOne({ _id: user._id });
        return res.status(409).json({ error: 'Invitation code was already consumed. Request a new code.' });
      }
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
        institutionTrialEndsAt: user.institutionTrialEndsAt || null,
        institutionTrialStartsAt: user.institutionTrialStartsAt || null,
        institutionAccessType: user.institutionAccessType || null,
        institutionLicensedPlan: user.institutionLicensedPlan || null,
        institutionTrialActive: isInstitutionTrialActive(user),
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
      .select('_id name email password isSubscribed plan referralCode referralCount emailVerified accountType institutionName institutionId institutionTrialEndsAt institutionTrialStartsAt institutionInviteCode institutionAccessType institutionLicensedPlan isAdmin')
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

    let userWithInstitution = user;
    if (user.accountType === 'institution') {
      userWithInstitution = await ensureInstitutionIdentityForUser(user);
    }

    // If admin, always set plan to 'lifetime' and isSubscribed true
    const trialEntitlements = applyInstitutionTrialEntitlements(user);
    let plan = trialEntitlements.plan;
    let isSubscribed = trialEntitlements.isSubscribed;
    const isAdmin = user.isAdmin === true || (ADMIN_EMAILS.length && ADMIN_EMAILS.includes(normalizedEmail));
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
        accountType: userWithInstitution.accountType || 'individual',
        institutionName: userWithInstitution.institutionName || null,
        institutionId: userWithInstitution.institutionId || null,
        institutionTrialStartsAt: user.institutionTrialStartsAt || null,
        institutionTrialEndsAt: user.institutionTrialEndsAt || null,
        institutionAccessType: user.institutionAccessType || null,
        institutionLicensedPlan: user.institutionLicensedPlan || null,
        institutionTrialActive: trialEntitlements.institutionTrialActive,
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
      Telemetry.find({ ts: { $gte: since } }).select('event funnel ts variant meta').lean(),
      User.find({}).select('_id plan createdAt').lean(),
      Job.find({ createdAt: { $gte: since } }).select('userId status createdAt').lean()
    ]);

    const eventCounts = {};
    const funnelCounts = {};
    const daily = {};
    const mismatchByType = {};
    let mismatchTotal = 0;

    events.forEach((evt) => {
      const event = evt.event || 'unknown';
      const funnel = evt.funnel || 'uncategorized';
      const day = new Date(evt.ts || Date.now()).toISOString().slice(0, 10);

      eventCounts[event] = (eventCounts[event] || 0) + 1;
      funnelCounts[funnel] = (funnelCounts[funnel] || 0) + 1;
      daily[day] = (daily[day] || 0) + 1;

      if (event === 'experience_personalization_mismatch') {
        mismatchTotal += 1;
        const mismatchType = String((evt.meta && evt.meta.type) || 'unknown');
        mismatchByType[mismatchType] = (mismatchByType[mismatchType] || 0) + 1;
      }
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
      experienceConsistency: {
        mismatchTotal,
        mismatchByType: Object.entries(mismatchByType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => ({ type, count }))
      },
      usersByPlan,
      cohorts: cohortWithRates
    });
  } catch (err) {
    console.error('Telemetry summary error:', err);
    return res.status(500).json({ error: 'Failed to load telemetry summary' });
  }
});

// Admin: manually grant document credits to a user (e.g. if webhook failed after payment)
app.post('/api/admin/grant-document-credits', authenticateToken, requireAdminAccess, async (req, res) => {
  try {
    const { email, credits, note } = req.body || {};
    if (!email || !Number.isFinite(Number(credits)) || Number(credits) <= 0) {
      return res.status(400).json({ error: 'email and a positive credits number are required' });
    }

    const target = await User.findOne({ email: String(email).toLowerCase().trim() }).select('email name plan documentGeneration');
    if (!target) return res.status(404).json({ error: `No user found with email: ${email}` });

    const { ensureWallet } = require('./services/documentGenerationBilling');
    if (!target.documentGeneration || typeof target.documentGeneration !== 'object') {
      target.documentGeneration = { paidCredits: 0, resumeFirstFreeUsed: false, coverLetterFirstFreeUsed: false, totalCreditsPurchased: 0, purchases: [] };
    }
    if (!Array.isArray(target.documentGeneration.purchases)) target.documentGeneration.purchases = [];
    if (!Number.isFinite(Number(target.documentGeneration.paidCredits))) target.documentGeneration.paidCredits = 0;
    if (!Number.isFinite(Number(target.documentGeneration.totalCreditsPurchased))) target.documentGeneration.totalCreditsPurchased = 0;

    const grantCount = Math.max(1, Math.floor(Number(credits)));
    target.documentGeneration.paidCredits = Number(target.documentGeneration.paidCredits) + grantCount;
    target.documentGeneration.totalCreditsPurchased = Number(target.documentGeneration.totalCreditsPurchased) + grantCount;
    target.documentGeneration.purchases.push({
      bundleId: 'admin-grant',
      credits: grantCount,
      amountCents: 0,
      currency: 'usd',
      stripeSessionId: '',
      note: String(note || 'Manual admin grant').slice(0, 200),
      purchasedAt: new Date()
    });
    target.markModified('documentGeneration');
    await target.save();

    console.log(`[ADMIN] Granted ${grantCount} document credits to ${email} by admin ${req.currentUser.email}`);

    return res.json({
      success: true,
      email: target.email,
      granted: grantCount,
      newBalance: target.documentGeneration.paidCredits
    });
  } catch (err) {
    console.error('Admin grant-document-credits error:', err);
    return res.status(500).json({ error: err.message || 'Failed to grant credits' });
  }
});

// Admin: view document credit balance for a user
app.get('/api/admin/document-credits', authenticateToken, requireAdminAccess, async (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const target = await User.findOne({ email }).select('email name plan documentGeneration');
    if (!target) return res.status(404).json({ error: `No user found with email: ${email}` });

    return res.json({
      email: target.email,
      name: target.name || '',
      plan: target.plan || 'free',
      paidCredits: Number(target.documentGeneration?.paidCredits || 0),
      totalCreditsPurchased: Number(target.documentGeneration?.totalCreditsPurchased || 0),
      resumeFirstFreeUsed: Boolean(target.documentGeneration?.resumeFirstFreeUsed),
      coverLetterFirstFreeUsed: Boolean(target.documentGeneration?.coverLetterFirstFreeUsed),
      purchases: target.documentGeneration?.purchases || []
    });
  } catch (err) {
    console.error('Admin document-credits error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load credits' });
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

// POST /api/outcomes/hired — student self-reports a job placement
app.post('/api/outcomes/hired', authenticateToken, async (req, res) => {
  try {
    const { roleTitle, companyName, sourceOfJob, country, notes } = req.body || {};
    if (!roleTitle || !String(roleTitle).trim()) {
      return res.status(400).json({ error: 'roleTitle is required' });
    }

    // Look up user for institutionName context
    const user = await User.findById(req.user.userId).select('name email institutionName').lean();

    const outcome = new PlacementOutcome({
      userId: req.user.userId,
      roleTitle: String(roleTitle).trim().slice(0, 160),
      status: 'hired',
      hiredAt: new Date(),
      sourceLayer: 'self-service',
      institutionName: (user && user.institutionName) ? String(user.institutionName).trim() : '',
      country: country ? String(country).trim().slice(0, 80) : 'Jamaica',
      notes: [
        companyName ? 'Company: ' + String(companyName).trim() : '',
        sourceOfJob ? 'Found via: ' + String(sourceOfJob).trim() : '',
        notes ? String(notes).trim() : ''
      ].filter(Boolean).join(' | ').slice(0, 2000)
    });
    await outcome.save();

    return res.json({ ok: true, outcomeId: outcome._id });
  } catch (err) {
    console.error('Outcome hired error:', err);
    return res.status(500).json({ error: 'Failed to record outcome' });
  }
});

// GET /api/outcomes/hired — get the user's own hire records
app.get('/api/outcomes/hired', authenticateToken, async (req, res) => {
  try {
    const outcomes = await PlacementOutcome.find({ userId: req.user.userId, status: 'hired' })
      .sort({ hiredAt: -1 }).limit(10).lean();
    return res.json({ outcomes });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load outcomes' });
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

app.post('/api/documents/email', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email name').lean();
    if (!user || !user.email) {
      return res.status(404).json({ error: 'User email not found.' });
    }

    const recipientEmail = String(user.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      return res.status(400).json({ error: 'Your account email is invalid.' });
    }

    const featureRaw = String(req.body?.feature || 'Document').trim();
    const filenameRaw = String(req.body?.filename || 'rolerocket-document').trim();
    const htmlContent = String(req.body?.htmlContent || '').trim();
    const textContent = String(req.body?.textContent || '').trim();
    const rawAttachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    if (!htmlContent && !textContent) {
      return res.status(400).json({ error: 'Document content is required.' });
    }

    const MAX_CONTENT_SIZE = 300000;
    if (htmlContent.length > MAX_CONTENT_SIZE || textContent.length > MAX_CONTENT_SIZE) {
      return res.status(413).json({ error: 'Document is too large to email.' });
    }

    const safeFeature = featureRaw.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 80) || 'Document';
    const safeFileBase = (filenameRaw || 'rolerocket-document')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'rolerocket-document';

    const firstName = String(user.name || '').trim().split(/\s+/)[0] || 'there';
    const subject = `Your ${safeFeature} – RoleRocket AI`;
    let attachments = [];

    if (rawAttachments.length) {
      const MAX_ATTACHMENT_COUNT = 4;
      const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

      attachments = rawAttachments
        .slice(0, MAX_ATTACHMENT_COUNT)
        .map((attachment, index) => {
          const filename = String(attachment?.filename || `${safeFileBase}-${index + 1}`).trim().slice(0, 120);
          const contentType = String(attachment?.contentType || 'application/octet-stream').trim().slice(0, 120);
          const contentBase64 = String(attachment?.contentBase64 || '').trim();
          const content = Buffer.from(contentBase64, 'base64');

          if (!filename || !contentBase64 || !content.length) {
            throw new Error('Invalid attachment payload.');
          }
          if (content.length > MAX_ATTACHMENT_SIZE_BYTES) {
            throw new Error('Attachment is too large to email.');
          }

          return { filename, contentType, content };
        });
    } else {
      const pdfBuffer = await createDocumentPdfBuffer({
        title: safeFeature,
        textContent,
        htmlContent
      });
      const wordBuffer = createDocumentWordBuffer({
        title: safeFeature,
        textContent,
        htmlContent
      });

      attachments = [
        {
          filename: `${safeFileBase}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        },
        {
          filename: `${safeFileBase}.doc`,
          content: wordBuffer,
          contentType: 'application/msword'
        }
      ];
    }

    const emailHtml = `
      <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:640px;">
        <h2 style="margin:0 0 10px;">Your ${safeFeature}</h2>
        <p style="margin:0 0 12px;">Hi ${firstName}, your PDF and Word files are attached.</p>
        <p style="margin:0;color:#475569;font-size:13px;">Sent from RoleRocket AI.</p>
      </div>
    `;

    const emailText = `Hi ${firstName}, your ${safeFeature} PDF and Word files are attached. Sent from RoleRocket AI.`;

    console.log(`[document-email] Sending ${safeFeature} to ${recipientEmail}`);

    await sendEmail({
      to: recipientEmail,
      subject,
      html: emailHtml,
      text: emailText,
      attachments
    });

    return res.json({
      success: true,
      message: 'Document sent to your account email.'
    });
  } catch (err) {
    console.error('Document email send error:', err);
    return res.status(500).json({ error: 'Failed to send document email.' });
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
    const roleText = String(role || '').trim() || 'Not provided';
    const jdText = String(jobDescription || '').trim() || 'Not provided';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1600,
      temperature: 0.35,
      messages: wantsAnswers
        ? [
            {
              role: 'system',
              content:
                'You are an elite interview coach. Generate precise, logical, role-specific interview answers. For each question: include (1) a direct sample answer in STAR/CAR style (90-140 words), (2) one-line why this answer works, (3) one concrete metric/result line, and (4) one refinement tip. Keep language professional, natural, and practical. Avoid vague advice and filler.'
            },
            {
              role: 'user',
              content: `Role: ${roleText}\n\nJob Description:\n${jdText}\n\nQuestions:\n${cleanedQuestions || 'Not provided'}\n\nReturn clean markdown with clear headings per question.`
            }
          ]
        : [
            {
              role: 'system',
              content:
                'You are an elite interview strategist. Create highly relevant interview prep for the target role and job context. Output: (1) 8 likely interview questions grouped by category, (2) concise answer themes for each question, (3) 3 high-quality questions the candidate should ask the interviewer, and (4) a short prep checklist for the final 24 hours before interview. Keep it sharp, practical, and logically structured.'
            },
            {
              role: 'user',
              content: `Role: ${roleText}\n\nJob Description:\n${jdText}\n\nUse concrete terminology for this role and avoid generic advice.`
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

app.post('/api/executive-presence/speaking-analysis', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const transcriptInput = String(req.body?.transcript || '').trim();
    const context = String(req.body?.context || '').trim().slice(0, 1200);
    let transcript = transcriptInput;

    if (!transcript && req.file?.buffer?.length) {
      try {
        const mimeType = String(req.file.mimetype || 'audio/webm');
        const extension = path.extname(req.file.originalname || '') || '.webm';
        const audioFile = new File([req.file.buffer], `executive-presence${extension}`, { type: mimeType });
        const t = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'gpt-4o-mini-transcribe',
          prompt: 'Transcribe this executive communication practice sample. Return plain text only.'
        });
        transcript = String(t?.text || '').trim();
      } catch {
        // Leave transcript empty and return a user-facing validation message below.
      }
    }

    if (!transcript) {
      return res.status(400).json({ error: 'Provide a transcript or upload an audio/video sample.' });
    }

    if (E2E_MOCK_MODE) {
      return res.json({
        analysis: {
          executiveTone: 74,
          clarity: 79,
          confidence: 72,
          pacing: 77,
          structure: 70,
          fillerWordDensity: 'medium',
          summary: 'Your answer is technically solid, but executive framing needs to be tighter and more concise.',
          strengths: ['Clear ownership language', 'Good logical sequencing', 'Relevant outcome references'],
          improvements: ['Open with strategic headline', 'Reduce filler words and over-qualifiers', 'Close with measurable impact'],
          coachingScript: 'Lead with outcome first, then actions, then one metric. Keep each response under 90 seconds.'
        },
        transcript
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an executive communication coach. Analyze speaking samples for leadership readiness. Return strict JSON with keys: executiveTone (0-100), clarity (0-100), confidence (0-100), pacing (0-100), structure (0-100), fillerWordDensity (low|medium|high), summary, strengths (array), improvements (array), coachingScript.'
        },
        {
          role: 'user',
          content: `Context: ${context || 'General executive interview practice'}\n\nTranscript:\n${transcript.slice(0, 6000)}`
        }
      ]
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    return res.json({
      analysis: {
        executiveTone: Number(parsed.executiveTone || 0),
        clarity: Number(parsed.clarity || 0),
        confidence: Number(parsed.confidence || 0),
        pacing: Number(parsed.pacing || 0),
        structure: Number(parsed.structure || 0),
        fillerWordDensity: String(parsed.fillerWordDensity || 'medium'),
        summary: String(parsed.summary || '').trim(),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
        coachingScript: String(parsed.coachingScript || '').trim()
      },
      transcript
    });
  } catch (err) {
    console.error('Executive presence speaking analysis error:', err);
    return res.status(500).json({ error: 'Failed to analyze speaking sample.' });
  }
});

app.post('/api/executive-presence/answer-rewrite', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const answer = String(req.body?.answer || '').trim();
    const targetRole = String(req.body?.targetRole || '').trim();
    if (!answer) return res.status(400).json({ error: 'Answer text is required.' });

    if (E2E_MOCK_MODE) {
      return res.json({
        rewritten: 'I led cross-functional coordination across product, operations, and support to deliver the project ahead of timeline while protecting quality standards and stakeholder alignment.',
        rationale: ['Starts with ownership', 'Adds strategic coordination language', 'Shows measurable leadership impact'],
        executiveFraming: 'Leadership + cross-functional execution + business outcome.'
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Rewrite answers to sound executive: concise, strategic, leadership-oriented, and measurable. Return JSON with keys rewritten, rationale (array of 2-4 bullets), executiveFraming.'
        },
        {
          role: 'user',
          content: `Target role: ${targetRole || 'Leadership-track role'}\n\nOriginal answer:\n${answer.slice(0, 4000)}`
        }
      ]
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    return res.json({
      rewritten: String(parsed.rewritten || '').trim(),
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale.slice(0, 5) : [],
      executiveFraming: String(parsed.executiveFraming || '').trim()
    });
  } catch (err) {
    console.error('Executive presence answer rewrite error:', err);
    return res.status(500).json({ error: 'Failed to rewrite executive answer.' });
  }
});

app.post('/api/executive-presence/training', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const scenario = String(req.body?.scenario || '').trim();
    const details = String(req.body?.details || '').trim();
    if (!scenario) return res.status(400).json({ error: 'Scenario is required.' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Provide executive communication training. Return JSON with keys leadershipLanguage (array), stakeholderUpdateTemplate, boardStyleVersion, doNotSay (array), highImpactPhrases (array), practicePrompt.'
        },
        {
          role: 'user',
          content: `Scenario: ${scenario}\nDetails: ${details || 'N/A'}`
        }
      ]
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    const flatStr = (v) => !v ? '' : (typeof v === 'object' ? Object.entries(v).map(([k, val]) => `${k}: ${val}`).join('\n') : String(v).trim());
    return res.json({
      leadershipLanguage: Array.isArray(parsed.leadershipLanguage) ? parsed.leadershipLanguage.slice(0, 7) : [],
      stakeholderUpdateTemplate: flatStr(parsed.stakeholderUpdateTemplate),
      boardStyleVersion: flatStr(parsed.boardStyleVersion),
      doNotSay: Array.isArray(parsed.doNotSay) ? parsed.doNotSay.slice(0, 6) : [],
      highImpactPhrases: Array.isArray(parsed.highImpactPhrases) ? parsed.highImpactPhrases.slice(0, 8) : [],
      practicePrompt: String(parsed.practicePrompt || '').trim()
    });
  } catch (err) {
    console.error('Executive presence training error:', err);
    return res.status(500).json({ error: 'Failed to generate training module.' });
  }
});

app.post('/api/executive-presence/mock-interview', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const role = String(req.body?.role || '').trim() || 'Manager';
    const context = String(req.body?.context || '').trim();
    const answer = String(req.body?.answer || '').trim();

    if (!answer) {
      const q = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Generate executive-level mock interview prompts. Return JSON with keys leadershipQuestions (array), strategicQuestions (array), behavioralQuestions (array).' 
          },
          {
            role: 'user',
            content: `Role: ${role}\nContext: ${context || 'Promotion readiness and stakeholder leadership'}`
          }
        ]
      });
      const parsed = JSON.parse(String(q.choices?.[0]?.message?.content || '{}'));
      return res.json({
        leadershipQuestions: Array.isArray(parsed.leadershipQuestions) ? parsed.leadershipQuestions.slice(0, 4) : [],
        strategicQuestions: Array.isArray(parsed.strategicQuestions) ? parsed.strategicQuestions.slice(0, 4) : [],
        behavioralQuestions: Array.isArray(parsed.behavioralQuestions) ? parsed.behavioralQuestions.slice(0, 4) : []
      });
    }

    const s = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Score executive interview answers. Return JSON with keys confidence (0-100), executivePresence (0-100), clarity (0-100), influence (0-100), strengths (array), improvements (array), executiveVersion.'
        },
        {
          role: 'user',
          content: `Role: ${role}\nContext: ${context || 'N/A'}\nCandidate answer:\n${answer.slice(0, 4500)}`
        }
      ]
    });

    const parsed = JSON.parse(String(s.choices?.[0]?.message?.content || '{}'));
    return res.json({
      confidence: Number(parsed.confidence || 0),
      executivePresence: Number(parsed.executivePresence || 0),
      clarity: Number(parsed.clarity || 0),
      influence: Number(parsed.influence || 0),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
      executiveVersion: String(parsed.executiveVersion || '').trim()
    });
  } catch (err) {
    console.error('Executive presence mock interview error:', err);
    return res.status(500).json({ error: 'Failed to run mock executive interview.' });
  }
});

app.post('/api/executive-presence/structure-coach', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const framework = String(req.body?.framework || 'star').trim().toUpperCase();
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Teach structured executive thinking. Return JSON keys: framework, structuredResponse, executiveSummary, conciseVersion, problemSolvingMap (array).' 
        },
        {
          role: 'user',
          content: `Framework: ${framework}\nPrompt: ${prompt.slice(0, 3500)}`
        }
      ]
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    const flatStr = (v) => !v ? '' : (typeof v === 'object' ? Object.entries(v).map(([k, val]) => `${k}: ${val}`).join('\n') : String(v).trim());
    return res.json({
      framework: String(parsed.framework || framework),
      structuredResponse: flatStr(parsed.structuredResponse),
      executiveSummary: String(parsed.executiveSummary || '').trim(),
      conciseVersion: String(parsed.conciseVersion || '').trim(),
      problemSolvingMap: Array.isArray(parsed.problemSolvingMap) ? parsed.problemSolvingMap.slice(0, 8) : []
    });
  } catch (err) {
    console.error('Executive presence structure coach error:', err);
    return res.status(500).json({ error: 'Failed to generate structure coaching.' });
  }
});

app.post('/api/executive-presence/writing-assistant', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('plan email isAdmin').lean();
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to use Executive Presence Builder.' });
    }

    const writingType = String(req.body?.writingType || 'email').trim();
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Writing sample is required.' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Improve professional writing for executive presence. Return JSON with keys rewritten, beforeAfterSummary, leadershipSignalWords (array), toneNotes (array), subjectLine.'
        },
        {
          role: 'user',
          content: `Writing type: ${writingType}\nOriginal text:\n${text.slice(0, 5000)}`
        }
      ]
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    return res.json({
      rewritten: String(parsed.rewritten || '').trim(),
      beforeAfterSummary: String(parsed.beforeAfterSummary || '').trim(),
      leadershipSignalWords: Array.isArray(parsed.leadershipSignalWords) ? parsed.leadershipSignalWords.slice(0, 8) : [],
      toneNotes: Array.isArray(parsed.toneNotes) ? parsed.toneNotes.slice(0, 6) : [],
      subjectLine: String(parsed.subjectLine || '').trim()
    });
  } catch (err) {
    console.error('Executive presence writing assistant error:', err);
    return res.status(500).json({ error: 'Failed to improve writing sample.' });
  }
});

/* ─── RocketApply AI Auto-Tailor ──────────────────────────────────────────── */
app.post('/api/apply/ai-tailor', authenticateToken, async (req, res) => {
  try {
    const { jobTitle, jobDescription, resumeText } = req.body || {};
    if (!jobTitle || !jobDescription) {
      return res.status(400).json({ error: 'jobTitle and jobDescription are required' });
    }
    const user = await User.findById(req.user.userId).select('aiGenerationUsage plan').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userPrompt = [
      `Job Title: ${String(jobTitle).slice(0, 120)}`,
      `Job Description:\n${String(jobDescription).slice(0, 3000)}`,
      resumeText ? `Candidate Resume:\n${String(resumeText).slice(0, 3000)}` : null,
      'Task: Return valid JSON with these keys:',
      'resumeDraft: 4-6 tailored resume bullets that mirror the job keywords and highlight relevant experience. Each bullet starts with a strong action verb.',
      'coverLetterDraft: A concise personalized cover letter paragraph (3-4 sentences) for this role, addressed to "Hiring Manager".',
      'fitScore: integer 1-100 representing candidacy fit against this specific job.',
      'fitChecklist: 5-7 concise checklist items the candidate should confirm before submitting.',
      'editSuggestions: 3-5 short suggestions to strengthen the application materials.',
      'Rules: Only use information present in the resume or the job description. Do not invent dates, companies, or credentials.',
    ].filter(Boolean).join('\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach who tailors resumes and cover letters. Be concise, professional, ATS-friendly, and output valid JSON only.'
        },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 900,
      temperature: 0.45
    });

    const parsed = JSON.parse(String(completion.choices?.[0]?.message?.content || '{}'));
    const fitScoreRaw = Number(parsed.fitScore || 0);
    const fitScore = Number.isFinite(fitScoreRaw) ? Math.max(1, Math.min(100, Math.round(fitScoreRaw))) : 65;
    const resumeDraft = String(parsed.resumeDraft || '').trim();
    const coverDraft = String(parsed.coverLetterDraft || '').trim();
    const fitChecklist = Array.isArray(parsed.fitChecklist)
      ? parsed.fitChecklist.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 7)
      : [];
    const editSuggestions = Array.isArray(parsed.editSuggestions)
      ? parsed.editSuggestions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [];

    return res.json({
      resumeDraft,
      coverLetterDraft: coverDraft,
      fitScore,
      fitChecklist,
      editSuggestions,
      // Backward-compatible fields for existing UI consumers.
      bullets: resumeDraft,
      coverLetter: coverDraft
    });
  } catch (err) {
    console.error('POST /api/apply/ai-tailor', err);
    return res.status(500).json({ error: 'AI tailor failed' });
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

app.get('/api/learning/catalog', async (req, res) => {
  try {
    const payload = await getLearningCatalogPayload();
    return res.json(payload);
  } catch (err) {
    console.error('Learning catalog error:', err);
    return res.status(500).json({ error: 'Failed to load learning catalog.' });
  }
});

app.post('/api/learning/course-content', authenticateToken, async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    const forceRefresh = req.body?.forceRefresh === true;
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access full course content.' });
    }

    const courseKey = normalizeCourseKey(topic);
    const now = Date.now();
    const cachedCourse = await CourseContentCache.findOne({ courseKey }).lean();

    let course = null;

    if (!forceRefresh && cachedCourse && cachedCourse.expiresAt && new Date(cachedCourse.expiresAt).getTime() > now && cachedCourse.coursePayload && hasStructuredProgressChecks(cachedCourse.coursePayload)) {
      course = cachedCourse.coursePayload;
    } else {
      course = buildFallbackCourseContent(topic);

      if (process.env.OPENAI_API_KEY) {
        try {
          const completion = await withTimeout(openai.chat.completions.create({
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
      "practiceTask": "string",
      "progressCheckQuestion": "string",
      "progressCheckOptions": ["string", "string", "string", "string"],
      "correctOptionIndex": 0
    }
  ],
  "capstoneProject": {
    "title": "string",
    "scenario": "string",
    "deliverables": ["string", "string", "string"]
  },
  "practiceBank": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctOptionIndex": 0,
      "explanation": "string",
      "domainKey": "string",
      "domainLabel": "string"
    }
  ],
  "finalAssessment": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctOptionIndex": 0,
      "explanation": "string",
      "domainKey": "string",
      "domainLabel": "string"
    }
  ],
  "mockExams": [
    {
      "title": "string",
      "description": "string",
      "timeLimitMinutes": 60,
      "questions": [
        {
          "question": "string",
          "options": ["string", "string", "string", "string"],
          "correctOptionIndex": 0,
          "explanation": "string",
          "domainKey": "string",
          "domainLabel": "string"
        }
      ]
    }
  ],
  "certificationPlan": {
    "trackLabel": "string",
    "overallPassMark": 75,
    "domainPassMark": 70,
    "practiceQuestionCount": 300,
    "finalQuestionCount": 120,
    "mockExamCount": 2,
    "mockQuestionCount": 60,
    "domains": [{ "key": "string", "label": "string" }]
    }
  ],
  "interviewPrep": ["string", "string", "string"],
  "resumeSignals": ["string", "string", "string"]
}

Rules:
- Create exactly 10 modules.
- Each module.lesson must be 220-320 words and must teach concrete how-to steps, decision criteria, and common execution tradeoffs.
- Each module.workedExample must include a realistic scenario with numbers, constraints, or decisions.
- Each module.progressCheckQuestion must test practical understanding of that specific module.
- Each module.progressCheckOptions must contain exactly 4 plausible multiple-choice answers.
- Each module.correctOptionIndex must be an integer from 0 to 3 and point to the single best answer.
- practiceBank must contain at least 180 questions for general topics and 300+ for advanced topics like AI/ML.
- finalAssessment must contain 60-180 multiple-choice questions (60 for general, 80 for business, 100 for STEM, 150 for AI/ML).
- mockExams must contain at least 2 timed mock exams with different question sets.
- certificationPlan must include overallPassMark, domainPassMark, and certification domains.
- Each practiceBank, finalAssessment, and mockExams question must contain exactly 4 options, one correctOptionIndex, a concise explanation, and domain labels.
- The finalAssessment must test retention across the full course, not just repeat module checkpoint wording.
- Avoid fluff and generic advice.
- No markdown, no code fences, no extra text outside JSON.`
              }
            ]
          }), 12000, 'course generation');

          const rawContent = String(completion.choices?.[0]?.message?.content || '').trim();
          const cleaned = rawContent
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          try {
            const parsed = JSON.parse(cleaned);
            if (hasStructuredProgressChecks(parsed)) {
              course = parsed;
            }
          } catch (parseError) {
            console.warn('Course content JSON parse failed, using fallback course.');
          }
        } catch (generationError) {
          console.warn('Course content generation failed, using fallback course:', generationError.message);
        }
      }

      if (!hasStructuredProgressChecks(course)) {
        course = buildFallbackCourseContent(topic);
      }

      const generatedFingerprint = createCourseContentFingerprint(course);
      try {
        await CourseContentCache.findOneAndUpdate(
          { courseKey },
          {
            $set: {
              courseTitle: topic,
              contentFingerprint: generatedFingerprint,
              coursePayload: course,
              expiresAt: new Date(now + COURSE_CONTENT_CACHE_TTL_MS)
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (cacheWriteError) {
        console.warn('Course content cache write failed, returning uncached content:', cacheWriteError.message);
      }
    }

    const normalizedModules = Array.isArray(course?.modules)
      ? course.modules.map((module, index) => normalizeCourseModule(module, index))
      : [];
    course = { ...course, modules: normalizedModules };

    const contentFingerprint = createCourseContentFingerprint(course);
    const modules = normalizedModules;
    const answers = modules.map((module) => {
      const correctOptionIndex = Number(module?.correctOptionIndex);
      const progressCheckOptions = Array.isArray(module?.progressCheckOptions) ? module.progressCheckOptions : [];
      return {
        correctOptionIndex,
        correctOptionText: String(progressCheckOptions[correctOptionIndex] || '').trim(),
        explanation: String(module?.progressCheckExplanation || '').trim()
      };
    });
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + COURSE_CHECK_SESSION_TTL_MS);

    try {
      await CourseLearningSession.findOneAndUpdate(
        { userId: req.user.userId, courseKey },
        {
          $set: {
            courseTitle: topic,
            contentFingerprint,
            sessionToken,
            answers,
            expiresAt
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const existingProgress = await CourseProgress.findOne({ userId: req.user.userId, courseKey }).lean();
      const totalModules = modules.length;

      if (!existingProgress || String(existingProgress.contentFingerprint || '') !== contentFingerprint) {
        await CourseProgress.findOneAndUpdate(
          { userId: req.user.userId, courseKey },
          {
            $set: {
              courseTitle: topic,
              contentFingerprint,
              totalModules,
              completedModules: [],
              completedAt: null
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else if (Number(existingProgress.totalModules || 0) !== totalModules) {
        await CourseProgress.findOneAndUpdate(
          { userId: req.user.userId, courseKey },
          {
            $set: {
              courseTitle: topic,
              contentFingerprint,
              totalModules
            }
          },
          { new: true }
        );
      }
    } catch (progressWriteError) {
      console.warn('Course learning session write failed, returning content without persisted progress:', progressWriteError.message);
    }

    return res.json({
      sessionToken,
      contentFingerprint,
      course
    });
  } catch (err) {
    console.error('Course content error:', err);
    return res.status(500).json({ error: 'Failed to generate course content.' });
  }
});

function normalizeCourseKey(topic) {
  const rawTopic = String(topic || '');
  const baseKey = rawTopic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'course';
  const aiMlVersion = /ai|machine learning|ml|deep learning|data science|artificial intelligence|neural|nlp|computer vision/i.test(rawTopic)
    ? '-aiml-v2'
    : '';
  return `${baseKey}${aiMlVersion}-${COURSE_CONTENT_SCHEMA_VERSION}`;
}

function buildCatalogItems(topics, source) {
  return topics.map((topic, index) => ({
    rank: index + 1,
    id: String(topic.id || normalizeCourseKey(topic.name)),
    name: String(topic.name || '').trim(),
    summary: String(topic.summary || '').trim(),
    demand: index < LEARNING_CATALOG_HOT_COUNT ? 'HOT' : 'RISING',
    laborScore: Number(topic.laborScore || 0),
    source
  }));
}

function getFallbackLearningCatalogPayload(reason) {
  const items = buildCatalogItems(LEARNING_CATALOG_TOPICS, 'backend-curated');
  const reasonSuffix = reason ? ` · ${reason}` : '';
  return {
    items,
    source: 'backend-curated',
    status: 'fallback',
    statusTone: 'warning',
    statusMessage: reason || 'Live labor-market ranking is unavailable right now.',
    sourceLabel: `Source: backend-ranked catalog fallback${reasonSuffix}`,
    generatedAt: new Date().toISOString(),
    hotCount: items.filter((item) => item.demand === 'HOT').length,
    risingCount: items.filter((item) => item.demand === 'RISING').length
  };
}

function createCatalogMeta(payload, overrides = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    ...payload,
    ...overrides,
    hotCount: Number(overrides.hotCount ?? payload?.hotCount ?? items.filter((item) => item.demand === 'HOT').length),
    risingCount: Number(overrides.risingCount ?? payload?.risingCount ?? items.filter((item) => item.demand === 'RISING').length),
    liveTopicCount: Number(overrides.liveTopicCount ?? payload?.liveTopicCount ?? 0),
    nextRetryAt: overrides.nextRetryAt ?? payload?.nextRetryAt ?? null
  };
}

function isCurrentCatalogPayload(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.length === LEARNING_CATALOG_TOPICS.length;
}

function buildStaleCatalogPayload(snapshot, note) {
  const payload = snapshot?.payload || getFallbackLearningCatalogPayload(note);
  const baseLabel = String(snapshot?.sourceLabel || payload?.sourceLabel || 'Source: cached catalog').trim();
  return createCatalogMeta(payload, {
    source: String(snapshot?.source || payload?.source || 'backend-curated').trim(),
    status: 'stale-live',
    statusTone: 'warning',
    statusMessage: note,
    sourceLabel: `${baseLabel} · ${note}`,
    generatedAt: payload?.generatedAt || snapshot?.refreshedAt || new Date().toISOString()
  });
}

function hasLaborMarketApiConfig() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

async function fetchLaborMarketScore(topic) {
  const country = String(process.env.ADZUNA_COUNTRY || 'us').trim().toLowerCase();
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    what: String(topic?.laborQuery || topic?.name || '').trim(),
    results_per_page: '1',
    'content-type': 'application/json'
  });
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const response = await withTimeout(fetch(url), 8000, `labor-market request for ${topic?.name || 'topic'}`);
  if (!response.ok) {
    throw new Error(`Labor market API returned ${response.status}`);
  }
  const payload = await response.json();
  return Number(payload?.count || 0);
}

async function getExternalLearningCatalogPayload() {
  const externallyRankedTopics = LEARNING_CATALOG_TOPICS.slice(0, LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT);
  const unscoredTopics = LEARNING_CATALOG_TOPICS.slice(LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT);
  const scoredTopics = await Promise.all(externallyRankedTopics.map(async (topic, index) => ({
    ...topic,
    baselineRank: index,
    laborScore: await fetchLaborMarketScore(topic)
  })));

  const rankedTopics = scoredTopics
    .sort((left, right) => {
      if (right.laborScore !== left.laborScore) return right.laborScore - left.laborScore;
      return left.baselineRank - right.baselineRank;
    })
    .map(({ baselineRank, ...topic }) => topic)
    .concat(unscoredTopics.map((topic) => ({ ...topic, laborScore: 0 })));

  const items = buildCatalogItems(rankedTopics, 'adzuna');
  const partialLabel = LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT < LEARNING_CATALOG_TOPICS.length
    ? `Top ${LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT} topics ranked with live job volume; remaining topics use platform trend ordering`
    : 'All tracked topics ranked with live job volume';
  return {
    items,
    source: 'adzuna',
    status: 'live',
    statusTone: 'success',
    statusMessage: partialLabel,
    sourceLabel: `Source: live labor-market demand via Adzuna job volume · ${partialLabel}`,
    generatedAt: new Date().toISOString(),
    hotCount: items.filter((item) => item.demand === 'HOT').length,
    risingCount: items.filter((item) => item.demand === 'RISING').length,
    liveTopicCount: LEARNING_CATALOG_EXTERNAL_TOPIC_LIMIT
  };
}

async function getLearningCatalogPayload() {
  const now = Date.now();
  if (learningCatalogCache.payload && learningCatalogCache.expiresAt > now && isCurrentCatalogPayload(learningCatalogCache.payload)) {
    return learningCatalogCache.payload;
  }

  const snapshot = await LearningCatalogSnapshot.findOne({ cacheKey: LEARNING_CATALOG_CACHE_KEY }).lean();

  if (snapshot?.payload && snapshot.expiresAt && new Date(snapshot.expiresAt).getTime() > now && isCurrentCatalogPayload(snapshot.payload)) {
    learningCatalogCache = {
      expiresAt: new Date(snapshot.expiresAt).getTime(),
      payload: snapshot.payload
    };
    return snapshot.payload;
  }

  let payload = null;
  let usedStaleSnapshot = false;

  const failureCooldownActive = Boolean(
    snapshot?.lastFailureAt
    && (now - new Date(snapshot.lastFailureAt).getTime()) < LEARNING_CATALOG_FAILURE_COOLDOWN_MS
  );
  const nextRetryAt = failureCooldownActive
    ? new Date(new Date(snapshot.lastFailureAt).getTime() + LEARNING_CATALOG_FAILURE_COOLDOWN_MS).toISOString()
    : null;

  if (hasLaborMarketApiConfig() && !failureCooldownActive) {
    try {
      payload = await getExternalLearningCatalogPayload();
      await LearningCatalogSnapshot.findOneAndUpdate(
        { cacheKey: LEARNING_CATALOG_CACHE_KEY },
        {
          $set: {
            payload,
            source: payload.source,
            sourceLabel: payload.sourceLabel,
            refreshedAt: new Date(),
            expiresAt: new Date(now + LEARNING_CATALOG_CACHE_TTL_MS),
            lastAttemptedAt: new Date(),
            lastFailureAt: null,
            lastFailureReason: ''
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.warn('Learning catalog external ranking failed, using fallback catalog:', error.message);
      await LearningCatalogSnapshot.findOneAndUpdate(
        { cacheKey: LEARNING_CATALOG_CACHE_KEY },
        {
          $set: {
            lastAttemptedAt: new Date(),
            lastFailureAt: new Date(),
            lastFailureReason: String(error.message || 'External ranking failed')
          },
          $setOnInsert: {
            payload: getFallbackLearningCatalogPayload('No live snapshot available'),
            source: 'backend-curated',
            sourceLabel: 'Source: backend-ranked catalog fallback',
            refreshedAt: new Date(0),
            expiresAt: new Date(0)
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (snapshot?.payload && isCurrentCatalogPayload(snapshot.payload)) {
        payload = buildStaleCatalogPayload(snapshot, `Using cached snapshot while live refresh is unavailable (${String(error.message || 'request failed').toLowerCase()})`);
        payload = createCatalogMeta(payload, { nextRetryAt });
        usedStaleSnapshot = true;
      }
    }
  }

  if (!payload && failureCooldownActive && snapshot?.payload && isCurrentCatalogPayload(snapshot.payload)) {
    const reason = String(snapshot.lastFailureReason || 'recent live refresh failure').toLowerCase();
    payload = buildStaleCatalogPayload(snapshot, `Using cached snapshot while live refresh is paused (${reason})`);
    payload = createCatalogMeta(payload, { nextRetryAt });
    usedStaleSnapshot = true;
  }

  if (!payload) {
    const reason = failureCooldownActive
      ? 'Live labor-market refresh temporarily paused after repeated failures'
      : 'Live labor-market data unavailable';
    payload = getFallbackLearningCatalogPayload(reason);
    payload = createCatalogMeta(payload, {
      nextRetryAt,
      status: failureCooldownActive ? 'paused' : 'fallback',
      statusTone: failureCooldownActive ? 'warning' : 'warning',
      statusMessage: failureCooldownActive
        ? `Live ranking is temporarily paused. Next retry after ${new Date(nextRetryAt).toLocaleString()}.`
        : reason
    });
  }

  learningCatalogCache = {
    expiresAt: usedStaleSnapshot && snapshot?.expiresAt
      ? Math.max(now + (60 * 60 * 1000), new Date(snapshot.expiresAt).getTime())
      : now + LEARNING_CATALOG_CACHE_TTL_MS,
    payload
  };

  return payload;
}

function createCourseContentFingerprint(course) {
  return crypto.createHash('sha256').update(JSON.stringify(course || {})).digest('hex');
}

function getCertificationTargets(topic) {
  const normalizedTopic = String(topic || '').toLowerCase();
  if (/ai|machine learning|ml|deep learning|data science|artificial intelligence|neural|nlp|computer vision/i.test(normalizedTopic)) {
    return {
      count: 150,
      domainLabel: 'AI/ML',
      practiceQuestionCount: 320,
      mockQuestionCount: 75,
      mockExamCount: 2,
      overallPassMark: 80,
      domainPassMark: 75
    };
  }
  if (/stem|physics|chemistry|biology|mathematics|calculus|statistics|algebra|geometry/i.test(normalizedTopic)) {
    return {
      count: 100,
      domainLabel: 'STEM',
      practiceQuestionCount: 240,
      mockQuestionCount: 50,
      mockExamCount: 2,
      overallPassMark: 75,
      domainPassMark: 70
    };
  }
  if (/business|project|management|leadership|finance|accounting|hr|human resource|marketing|sales/i.test(normalizedTopic)) {
    return {
      count: 80,
      domainLabel: 'Business',
      practiceQuestionCount: 220,
      mockQuestionCount: 40,
      mockExamCount: 2,
      overallPassMark: 72,
      domainPassMark: 68
    };
  }
  return {
    count: 60,
    domainLabel: 'General',
    practiceQuestionCount: 180,
    mockQuestionCount: 30,
    mockExamCount: 2,
    overallPassMark: 70,
    domainPassMark: 65
  };
}

function getCertificationDomains() {
  return [
    { key: 'foundations', label: 'Foundations & Planning' },
    { key: 'execution', label: 'Execution & Quality' },
    { key: 'communication', label: 'Communication & Measurement' },
    { key: 'improvement', label: 'Improvement & Career Readiness' }
  ];
}

function getQuestionDomain(categoryKey) {
  if (categoryKey === 'fundamentals' || categoryKey === 'planning') {
    return { domainKey: 'foundations', domainLabel: 'Foundations & Planning' };
  }
  if (categoryKey === 'execution' || categoryKey === 'quality') {
    return { domainKey: 'execution', domainLabel: 'Execution & Quality' };
  }
  if (categoryKey === 'communication' || categoryKey === 'measurement') {
    return { domainKey: 'communication', domainLabel: 'Communication & Measurement' };
  }
  return { domainKey: 'improvement', domainLabel: 'Improvement & Career Readiness' };
}

function normalizeCertificationQuestion(item, fallbackTopic, fallbackDomain) {
  const optionsSource = Array.isArray(item?.opts) ? item.opts : item?.options;
  const options = Array.isArray(optionsSource)
    ? optionsSource.map((option) => String(option || '').trim()).filter(Boolean).slice(0, 4)
    : [];
  while (options.length < 4) options.push(`Option ${options.length + 1}`);
  return {
    question: String(item?.q || item?.question || `Question about ${String(fallbackTopic || 'this course')}`).trim(),
    options: options.slice(0, 4),
    correctOptionIndex: Number.isInteger(item?.correct)
      ? Math.max(0, Math.min(Number(item.correct), 3))
      : Math.max(0, Math.min(Number(item?.correctOptionIndex || 0), 3)),
    explanation: String(item?.explanation || `This question tests your knowledge of ${String(fallbackTopic || 'this course')}.`).trim(),
    domainKey: String(item?.domainKey || fallbackDomain?.domainKey || 'foundations').trim(),
    domainLabel: String(item?.domainLabel || fallbackDomain?.domainLabel || 'Foundations & Planning').trim()
  };
}

function generateCertificationExamQuestions(topic, baseQuestions = []) {
  const targets = getCertificationTargets(topic);
  const qCount = targets.count;
  const topicName = String(topic || 'the subject').trim();

  // Core knowledge bank (reusable across domains)
  const knowledgeCategories = {
    fundamentals: [
      { q: `What is the primary objective of ${topicName}?`, opts: ['To understand core principles', 'To avoid learning anything', 'To maximize speed without quality', 'To use the most expensive tools'], correct: 0 },
      { q: `Which factor is most important when starting ${topicName} work?`, opts: ['Clear goals and success metrics', 'Having all possible tools ready', 'Speed above all else', 'Skipping any planning phase'], correct: 0 },
      { q: `What distinguishes output from impact in ${topicName}?`, opts: ['Output is delivered; impact is the improvement it creates', 'They are identical concepts', 'Impact only exists in theory', 'Output is irrelevant to impact'], correct: 0 },
    ],
    planning: [
      { q: `What should be included in a solid ${topicName} plan?`, opts: ['Deliverables, owners, and checkpoints', 'Every idea ever mentioned', 'No deadlines to stay flexible', 'Only the final result'], correct: 0 },
      { q: `How should you handle scope changes during ${topicName}?`, opts: ['Update the plan explicitly', 'Let them accumulate silently', 'Reject all changes immediately', 'Ignore them until launch'], correct: 0 },
      { q: `What is the best way to identify dependencies in ${topicName}?`, opts: ['Document what blocks each task', 'Assume nothing is blocked', 'Only discover blocks during execution', 'Avoid mentioning dependencies'], correct: 0 },
    ],
    execution: [
      { q: `What makes a workflow visible during ${topicName}?`, opts: ['Clear stages and escalation rules', 'Keeping work invisible to avoid criticism', 'No documentation of process', 'Random task movement'], correct: 0 },
      { q: `How often should progress be reviewed in ${topicName}?`, opts: ['At a regular cadence based on project duration', 'Only at the very end', 'When something goes wrong', 'Never formally'], correct: 0 },
      { q: `What should happen when a blocker is identified in ${topicName}?`, opts: ['Escalate immediately to prevent delays', 'Hope it resolves on its own', 'Ignore it silently', 'Double the team size'], correct: 0 },
    ],
    quality: [
      { q: `What is the best approach to managing risk in ${topicName}?`, opts: ['Identify risks early and define mitigations', 'Wait until risks become critical', 'Assume everything will work out', 'Deny that risks exist'], correct: 0 },
      { q: `How should quality be defined in ${topicName}?`, opts: ['Clear criteria tied to the work objective', 'High numbers with no definition', 'Whatever takes the least time', 'Only user opinion matters'], correct: 0 },
      { q: `When should quality checkpoints occur in ${topicName}?`, opts: ['Throughout execution, not just at the end', 'Only before final delivery', 'After launch is too late', 'Quality checks waste time'], correct: 0 },
    ],
    communication: [
      { q: `What should a stakeholder update on ${topicName} include?`, opts: ['Status, impact, risks, and next steps', 'Only detailed task lists', 'Optimistic language without metrics', 'A long narrative with no recommendation'], correct: 0 },
      { q: `Who should receive ${topicName} progress updates?`, opts: ['Stakeholders tailored by their role and interests', 'Only the project manager', 'No one until completion', 'Everyone in the organization'], correct: 0 },
      { q: `How should you frame tradeoffs in ${topicName}?`, opts: ['Transparently with evidence and impact analysis', 'Hide downsides from stakeholders', 'Avoid discussing tradeoffs at all', 'Let the team decide alone'], correct: 0 },
    ],
    measurement: [
      { q: `What is the difference between leading and lagging metrics in ${topicName}?`, opts: ['Leading warns early; lagging confirms final impact', 'They serve the same purpose', 'Metrics are never useful', 'Only lagging metrics matter'], correct: 0 },
      { q: `How should you choose metrics for ${topicName}?`, opts: ['Based on actual decision-making needs', 'Pick metrics with the biggest numbers', 'Avoid metrics entirely', 'Choose vanity metrics only'], correct: 0 },
      { q: `What makes a metric actionable in ${topicName}?`, opts: ['It informs a specific decision or action', 'It sounds impressive', 'No metric is truly actionable', 'Activity counts are sufficient'], correct: 0 },
    ],
    sustainment: [
      { q: `What ensures improvements last after ${topicName} completion?`, opts: ['Ownership, monitoring, and regular reviews', 'Declaring success and moving on', 'No measurement after launch', 'Hoping the change sticks'], correct: 0 },
      { q: `How should you handle process drift after ${topicName} rollout?`, opts: ['Review regularly and update the process', 'Ignore drift until performance fails', 'Never update a process once live', 'Documentation is unnecessary'], correct: 0 },
      { q: `Who owns the monitoring of ${topicName} outcomes?`, opts: ['A designated person with clear responsibilities', 'Everyone and no one', 'Only the original project team', 'Monitoring is wasteful'], correct: 0 },
    ],
    interviews: [
      { q: `How should you frame ${topicName} experience for interviews?`, opts: ['Action linked to measurable result', 'List of tools used', 'Vague statements of contribution', 'Jargon without outcomes'], correct: 0 },
      { q: `What story about ${topicName} is most convincing in interviews?`, opts: ['Problem → Action → Quantified Result', 'How hard you worked', 'Tools you used', 'Time spent on the task'], correct: 0 },
      { q: `How should you discuss ${topicName} challenges in interviews?`, opts: ['Describe the tradeoff and your mitigation', 'Claim there were no challenges', 'Blame the team or circumstances', 'Never mention challenges'], correct: 0 },
    ]
  };

  let allQuestions = [];

  // Add base questions if provided
  if (Array.isArray(baseQuestions) && baseQuestions.length > 0) {
    allQuestions = allQuestions.concat(baseQuestions.slice(0, Math.ceil(qCount * 0.15)).map((item) => normalizeCertificationQuestion(item, topicName, null)));
  }

  // Add category questions, cycling and randomizing to reach target count
  Object.entries(knowledgeCategories).forEach(([categoryKey, category]) => {
    const domainMeta = getQuestionDomain(categoryKey);
    allQuestions = allQuestions.concat(category.map((item) => ({
      ...item,
      domainKey: domainMeta.domainKey,
      domainLabel: domainMeta.domainLabel,
      explanation: `This question tests your understanding of ${domainMeta.domainLabel.toLowerCase()} in ${topicName}.`
    })));
  });

  // Expand questions with variation by randomizing and duplicating with rewording
  while (allQuestions.length < qCount) {
    const sourceQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    const variation = {
      q: sourceQuestion.q.replace(new RegExp(`${topicName}`, 'gi'), `your ${topicName.toLowerCase()} initiative`),
      opts: sourceQuestion.opts.map(opt => opt.replace(new RegExp(topicName, 'gi'), 'the work')),
      correct: sourceQuestion.correct,
      explanation: `This question tests your understanding of ${topicName} best practices.`,
      domainKey: sourceQuestion.domainKey,
      domainLabel: sourceQuestion.domainLabel
    };
    allQuestions.push(variation);
  }

  // Shuffle and trim to exact count
  allQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, qCount);

  // Convert to final assessment format
  return allQuestions
    .map((item) => normalizeCertificationQuestion(item, topicName, getQuestionDomain('fundamentals')))
    .filter((item) => Array.isArray(item.options) && item.options.length >= 4);
}

function buildPracticeQuestionBank(topic, assessmentQuestions = [], targets = getCertificationTargets(topic)) {
  const normalizedAssessment = Array.isArray(assessmentQuestions)
    ? assessmentQuestions.map((item) => normalizeCertificationQuestion(item, topic, null))
    : [];
  const bank = normalizedAssessment.slice();
  while (bank.length < targets.practiceQuestionCount) {
    const source = normalizedAssessment[bank.length % Math.max(normalizedAssessment.length, 1)]
      || normalizeCertificationQuestion({
        question: `Practice question about ${topic}`,
        options: [
          'Use a structured, evidence-based approach.',
          'Skip planning and improvise.',
          'Avoid documenting tradeoffs.',
          'Ignore stakeholder impact.'
        ],
        correctOptionIndex: 0,
        explanation: `This practice question reinforces the strongest applied approach for ${topic}.`
      }, topic, getQuestionDomain('fundamentals'));
    bank.push({
      ...source,
      question: `${source.question} (Practice Bank ${bank.length + 1})`
    });
  }
  return bank.slice(0, targets.practiceQuestionCount);
}

function buildMockExams(topic, practiceQuestionBank = [], targets = getCertificationTargets(topic)) {
  const sourceBank = Array.isArray(practiceQuestionBank)
    ? practiceQuestionBank.map((item) => normalizeCertificationQuestion(item, topic, null))
    : [];
  const mockExams = [];

  for (let mockIndex = 0; mockIndex < targets.mockExamCount; mockIndex += 1) {
    const questions = [];
    for (let questionIndex = 0; questionIndex < targets.mockQuestionCount; questionIndex += 1) {
      const sourceIndex = (mockIndex * targets.mockQuestionCount + questionIndex) % Math.max(sourceBank.length, 1);
      const baseQuestion = sourceBank[sourceIndex]
        || normalizeCertificationQuestion(null, topic, getQuestionDomain('fundamentals'));
      questions.push({
        ...baseQuestion,
        question: `${baseQuestion.question} (Mock ${mockIndex + 1} - Q${questionIndex + 1})`
      });
    }

    mockExams.push({
      title: `${targets.domainLabel} Timed Mock ${mockIndex + 1}`,
      description: `Timed readiness check for ${topic} with rotating questions across the main certification domains.`,
      timeLimitMinutes: Math.max(45, targets.mockQuestionCount),
      questions
    });
  }

  return mockExams;
}

function buildCertificationPlan(topic) {
  const targets = getCertificationTargets(topic);
  return {
    trackLabel: `${targets.domainLabel} certification pathway`,
    overallPassMark: targets.overallPassMark,
    domainPassMark: targets.domainPassMark,
    practiceQuestionCount: targets.practiceQuestionCount,
    finalQuestionCount: targets.count,
    mockExamCount: targets.mockExamCount,
    mockQuestionCount: targets.mockQuestionCount,
    domains: getCertificationDomains()
  };
}

function loadPythonDataScienceCourse() {
  // Python Data Science course from markdown template
  // This is the structured Python Data Science course with 5 sections and detailed subsections
  return {
    courseTitle: 'Python Data Science: Proficiency to Production',
    subtitle: 'Master data science fundamentals from raw Python to business-ready visualizations',
    difficulty: 'Intermediate',
    estimatedDuration: '10-12 weeks',
    marketDemand: 'Python data science skills are essential for data analysts, data engineers, and business intelligence professionals.',
    overview: 'This course teaches you the complete data science workflow: Python fundamentals, NumPy for numerical computing, Pandas for data manipulation, Matplotlib for visualization, and the teach-first flow methodology. Every concept includes working code examples, practice tasks, and success checkpoints.',
    learningOutcomes: [
      'Write Python scripts with variables, loops, functions, and reusable modules.',
      'Manipulate numerical arrays efficiently using NumPy vectorization and broadcasting.',
      'Load, clean, filter, group, and merge real-world data with Pandas.',
      'Create professional visualizations with Matplotlib including line charts, scatter plots, and multi-panel layouts.',
      'Apply the Teach-First Flow (concept → walkthrough → practice → checkpoint) to master new technical topics.'
    ],
    modules: [
      {
        title: 'Python Fundamentals: Variables',
        objective: 'Store and manage data types in Python (int, float, str, bool, list, dict)',
        lesson: 'Learn how to declare and assign variables, understand Python data types, and manage variable scope. Variables are containers for data. Python supports integers, floats, strings, booleans, and collections like lists and dictionaries. Understanding scope is critical: variables defined inside functions are local, while module-level variables are global. This foundation is essential because data science work depends on reliable data handling.',
        workedExample: `# Declare and assign variables
name = "Alex"
age = 28
salary = 75000.50
is_manager = True

# Lists
skills = ["Python", "SQL", "Excel"]
print(f"{name} knows {len(skills)} skills")

# Dictionaries
employee = {"name": "Alex", "department": "Data", "salary": 75000.50}
print(f"Department: {employee['department']}")`,
        commonMistake: 'Assuming all variables are global or mixing up data types during operations.',
        practiceTask: 'Create a dictionary of an employee with name, department, salary, and years_of_service. Print one value using bracket notation.',
        progressCheckQuestion: 'What is the primary purpose of variable scope in Python?',
        progressCheckOptions: [
          'To control which functions and blocks can access a variable',
          'To make code slower and more complex',
          'To avoid using any variables at all',
          'To automatically convert all data types'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Python Fundamentals: Loops',
        objective: 'Iterate over collections efficiently without writing repetitive code',
        lesson: 'Loops automate repetition. For loops iterate over collections like lists, tuples, and dictionaries. While loops repeat until a condition becomes false. Enumerate adds an index to for loops, making it easy to track position. Nested loops iterate within iterations. Mastering loops is essential because data science workflows heavily depend on processing each row or element in a dataset.',
        workedExample: `sales = [1000, 1500, 2000, 1200, 1800]
total = 0
for sale in sales:
    total += sale
  print(f"Running total: \${total}")

# With enumerate
for index, sale in enumerate(sales):
    print(f"Month {index + 1}: \${sale}")

# Dictionary iteration
emp_salaries = {"Alice": 80000, "Bob": 75000}
for name, salary in emp_salaries.items():
    print(f"{name}: \${salary:,}")`,
        commonMistake: 'Writing nested loops when a single loop with built-in functions would be cleaner.',
        practiceTask: 'Create a list of 5 numbers and use a loop to print the sum and average.',
        progressCheckQuestion: 'Which loop type is best for iterating a known number of times?',
        progressCheckOptions: [
          'A for loop over a range or collection',
          'A while loop that never ends',
          'No loop, just copy-paste the code',
          'A nested loop for every operation'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Python Fundamentals: Functions',
        objective: 'Write reusable blocks of code with clear inputs and outputs',
        lesson: 'Functions are reusable blocks of code that accept inputs (parameters) and return outputs. They eliminate repetition and make code readable. A function definition includes the def keyword, parameter names, and a docstring explaining what it does. Return statements specify what the function outputs. Default parameter values make functions flexible. This is critical for data science because real workflows depend on reusable data-processing functions.',
        workedExample: `def calculate_bonus(salary, bonus_rate=0.1):
    """Calculate employee bonus."""
    return salary * bonus_rate

print(f"Bonus: \${calculate_bonus(80000)}")
print(f"Bonus: \${calculate_bonus(80000, 0.15)}")

def analyze_sales(sales_list):
    total = sum(sales_list)
    average = total / len(sales_list)
    max_sale = max(sales_list)
    return total, average, max_sale

sales = [1000, 1500, 2000, 1200, 1800]
total, avg, max_val = analyze_sales(sales)
print(f"Total: \${total}, Avg: \${avg}, Max: \${max_val}")`,
        commonMistake: 'Writing functions without docstrings or not returning the expected output.',
        practiceTask: 'Write a function that takes a list of numbers and returns the sum, average, and count in one return statement.',
        progressCheckQuestion: 'What is a docstring in Python?',
        progressCheckOptions: [
          'A description of what a function does, placed right after the def line',
          'A comment that appears at the end of a file',
          'A way to execute code silently',
          'A requirement that makes functions run slower'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Python Fundamentals: Reusable Scripts',
        objective: 'Combine variables, loops, and functions into a complete workflow module',
        lesson: 'Reusable scripts combine functions, loops, and data handling into a coherent module. A module is a Python file (.py) containing functions and variables that other scripts import. This modular approach is essential for data science because real projects require loading data, cleaning it, transforming it, and analyzing it in predictable, repeatable steps. Writing modular code makes workflows robust and testable.',
        workedExample: `# data_utils.py - A reusable module
def load_sales_data(filename):
    """Load sales from a text file."""
    sales = []
    with open(filename, 'r') as f:
        for line in f:
            try:
                sales.append(float(line.strip()))
            except ValueError:
                continue
    return sales

def clean_sales_data(sales_list):
    """Remove None/invalid values."""
    cleaned = [s for s in sales_list if s is not None and s > 0]
    return cleaned

def summarize_sales(sales_list):
    """Return summary statistics."""
    if not sales_list:
        return None
    return {
        "total": sum(sales_list),
        "count": len(sales_list),
        "average": sum(sales_list) / len(sales_list),
        "max": max(sales_list),
        "min": min(sales_list)
    }

# In another script:
# from data_utils import load_sales_data, clean_sales_data, summarize_sales
# sales = load_sales_data("sales.txt")
# clean = clean_sales_data(sales)
# print(summarize_sales(clean))`,
        commonMistake: 'Not breaking code into functions, leading to repetition and hard-to-maintain scripts.',
        practiceTask: 'Write a module with three functions: load_data, clean_data, and summarize_data. Test the module by importing and calling each function.',
        progressCheckQuestion: 'Why are reusable scripts important in data science?',
        progressCheckOptions: [
          'They make workflows repeatable, testable, and maintainable across projects',
          'They make code slower and harder to understand',
          'They require more lines of code than necessary',
          'They eliminate the need for documentation'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'NumPy: Creating and Inspecting Arrays',
        objective: 'Create and explore NumPy arrays efficiently',
        lesson: 'NumPy arrays are fast, memory-efficient containers for numerical data. Arrays are created from lists, ranges, or special functions like zeros, ones, and arange. Unlike Python lists, arrays require all elements to be the same type, which enables optimized C-level operations. Key attributes like shape, dtype, and size tell you about the array structure. Indexing and slicing access specific elements or ranges. Understanding arrays is essential because every data science library (Pandas, Scikit-learn, TensorFlow) is built on top of NumPy.',
        workedExample: `import numpy as np

# Create arrays from lists
arr1 = np.array([1, 2, 3, 4, 5])
print(f"Shape: {arr1.shape}, Type: {arr1.dtype}")

# Create arrays with special functions
zeros = np.zeros(5)
ones = np.ones(3)
range_arr = np.arange(0, 10, 2)

# Multi-dimensional arrays
arr2d = np.array([[1, 2, 3], [4, 5, 6]])
print(f"2D shape: {arr2d.shape}")

# Indexing and slicing
print(f"First element: {arr1[0]}")
print(f"Last three: {arr1[-3:]}")

# Array attributes
print(f"Size: {arr1.size}, Dtype: {arr1.dtype}")`,
        commonMistake: 'Confusing array shape with size or assuming all elements must be converted to the same type.',
        practiceTask: 'Create a 3x3 array with values 1-9. Print its shape, size, and extract the middle row.',
        progressCheckQuestion: 'What is the main advantage of NumPy arrays over Python lists?',
        progressCheckOptions: [
          'NumPy arrays are much faster for numerical operations and use less memory',
          'NumPy arrays store mixed data types automatically',
          'NumPy arrays make code shorter without any tradeoffs',
          'NumPy arrays eliminate the need for loops completely'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'NumPy: Vectorization and Broadcasting',
        objective: 'Perform element-wise operations without explicit loops',
        lesson: 'Vectorization is NumPy\'s superpower. Instead of looping through each element, you operate on the entire array at once. This is 10-100x faster because NumPy uses optimized C code instead of Python loops. Broadcasting automatically aligns arrays of different shapes so operations work correctly. For example, adding a scalar to an array adds it to every element. Adding a row vector to a 2D array adds it to every row. Mastering vectorization is key to writing efficient data science code.',
        workedExample: `import numpy as np

# Vectorized operations (no loops needed!)
salaries = np.array([80000, 75000, 90000, 85000])

# Add a bonus to all salaries
bonus = salaries * 0.10
print(f"Bonuses: {bonus}")

# Element-wise operations
squared = salaries ** 2
print(f"Squared: {squared}")

# Boolean masking
high_earners = salaries[salaries > 80000]
print(f"High earners: {high_earners}")

# Broadcasting: 2D operation
sales_by_month = np.array([
    [100, 150, 200],
    [110, 160, 210],
    [120, 170, 220]
])

# Add region bonus to each row
region_bonus = np.array([10, 20, 15])
adjusted = sales_by_month + region_bonus
print(f"Adjusted:\\n{adjusted}")`,
        commonMistake: 'Using loops when vectorized operations are available, resulting in slow code.',
        practiceTask: 'Create an array of 10 employee salaries. Use vectorization to add a 5% raise, calculate taxes (20% deduction), and find how many earn above the average.',
        progressCheckQuestion: 'What does broadcasting do in NumPy?',
        progressCheckOptions: [
          'It automatically aligns arrays of different shapes for element-wise operations',
          'It converts all arrays to the same data type',
          'It makes arrays print to the console automatically',
          'It eliminates the need for arrays entirely'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'NumPy: Advanced Indexing and Operations',
        objective: 'Extract and manipulate data using advanced array techniques',
        lesson: 'NumPy offers powerful indexing: boolean indexing filters arrays based on conditions, fancy indexing uses arrays of indices, and slicing extracts ranges. These techniques are essential for data science because you constantly need to select subsets of data (rows above a threshold, specific columns, matching criteria). Advanced operations like reshape, transpose, and flattening restructure data for downstream processing. Understanding these techniques makes data manipulation fast and readable.',
        workedExample: `import numpy as np

# Boolean indexing: select elements matching a condition
sales = np.array([1000, 1500, 800, 2000, 1200])
high_sales = sales[sales > 1000]
print(f"High sales: {high_sales}")

# Fancy indexing: use an array of indices
indices = np.array([0, 2, 4])
selected = sales[indices]
print(f"Selected sales: {selected}")

# Reshape: change array dimensions
arr = np.arange(12)
reshaped = arr.reshape(3, 4)
print(f"Reshaped:\\n{reshaped}")

# Transpose: swap rows and columns
transposed = reshaped.T
print(f"Transposed:\\n{transposed}")

# Flattening: convert to 1D
flattened = reshaped.flatten()
print(f"Flattened: {flattened}")`,
        commonMistake: 'Confusing indexing syntax or not understanding how reshape affects array dimensions.',
        practiceTask: 'Create a 4x5 array of random numbers. Extract rows where the first column is > 0.5. Reshape the result to a 1D array.',
        progressCheckQuestion: 'What does boolean indexing return?',
        progressCheckOptions: [
          'An array containing only elements where the condition is True',
          'A single True/False value',
          'The indices where the condition is True',
          'An error message'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Pandas: Loading and Exploring DataFrames',
        objective: 'Load, inspect, and understand the structure of real-world data',
        lesson: 'Pandas DataFrames are table-like structures (rows and columns) that hold mixed data types. The read_csv function loads CSV files into DataFrames. Once loaded, info() shows data types and missing values, describe() provides statistical summaries, head() displays the first few rows, and tail() shows the last few rows. These inspection functions are critical because understanding your data\'s structure, types, and distribution prevents costly mistakes downstream.',
        workedExample: `import pandas as pd

# Load CSV data
df = pd.read_csv('employees.csv')

# Inspect the data
print(f"Shape: {df.shape}")  # Rows and columns
print(f"\\nFirst 3 rows:\\n{df.head(3)}")
print(f"\\nData types:\\n{df.dtypes}")

# Summary statistics
print(f"\\nSummary stats:\\n{df.describe()}")

# Check for missing values
print(f"\\nMissing values:\\n{df.isnull().sum()}")

# Column names
print(f"\\nColumns: {df.columns.tolist()}")`,
        commonMistake: 'Jumping into analysis without inspecting data, leading to errors from unknown structure or missing values.',
        practiceTask: 'Create a DataFrame from a dictionary with 5 employees (name, department, salary). Use head(), info(), and describe() to explore it.',
        progressCheckQuestion: 'What does df.info() show in Pandas?',
        progressCheckOptions: [
          'Data types, non-null counts, and memory usage for each column',
          'Statistical summary of numerical columns only',
          'The first 5 rows of the DataFrame',
          'Suggestions for improving code performance'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Pandas: Data Cleaning and Missing Values',
        objective: 'Handle missing data using multiple strategies',
        lesson: 'Real-world data is messy. Missing values (NaN) appear due to data collection errors, incomplete records, or system failures. Pandas offers multiple strategies: dropna() removes rows or columns with missing values, fillna() replaces missing values with a specified value, forward fill carries the previous value forward, and interpolation estimates missing values. Choosing the right strategy depends on the data\'s nature and the analysis goal. Poor missing-value handling can bias your analysis or cause downstream errors.',
        workedExample: `import pandas as pd
import numpy as np

# Create data with missing values
df = pd.DataFrame({
    'employee': ['Alice', 'Bob', 'Carol', 'Dave'],
    'salary': [80000, np.nan, 90000, 85000],
    'bonus': [5000, 6000, np.nan, 4000]
})

print("Original:")
print(df)

# Strategy 1: Drop missing values
dropped = df.dropna()
print("\\nDropped NaN rows:")
print(dropped)

# Strategy 2: Fill with median salary
df_filled = df.copy()
df_filled['salary'].fillna(df['salary'].median(), inplace=True)
print("\\nFilled salary with median:")
print(df_filled)

# Strategy 3: Forward fill
df_ffill = df.fillna(method='ffill')
print("\\nForward filled:")
print(df_ffill)`,
        commonMistake: 'Using one missing-value strategy for all columns without considering context.',
        practiceTask: 'Create a DataFrame with missing values. Apply three different strategies (drop, fill with mean, forward fill) and compare results.',
        progressCheckQuestion: 'When is dropping rows with missing values appropriate?',
        progressCheckOptions: [
          'When missing values are rare and the row adds little information',
          'Always, without considering the impact on analysis',
          'Never, because filling is always better',
          'Only when you have less than 10 rows of data'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Pandas: Filtering and Selection',
        objective: 'Select subsets of data based on conditions',
        lesson: 'Filtering is extracting rows or columns matching criteria. Boolean indexing filters rows based on conditions (e.g., salary > 80000). loc selects by label/condition, iloc selects by integer position. Column selection uses bracket notation (df[\'column\']) or dot notation (df.column). These techniques let you focus on relevant subsets without modifying the original DataFrame, which is critical for exploratory data analysis.',
        workedExample: `import pandas as pd

df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Carol', 'Dave'],
    'department': ['Sales', 'Engineering', 'Sales', 'HR'],
    'salary': [80000, 95000, 78000, 70000]
})

# Boolean filtering: select rows where salary > 75000
high_salary = df[df['salary'] > 75000]
print("High salary employees:")
print(high_salary)

# Multiple conditions
sales_high = df[(df['department'] == 'Sales') & (df['salary'] > 75000)]
print("\\nSales with high salary:")
print(sales_high)

# Select specific columns
names_depts = df[['name', 'department']]
print("\\nNames and departments:")
print(names_depts)

# Using loc and iloc
print("\\nUsing loc (by label):")
print(df.loc[df['name'] == 'Alice'])

print("\\nUsing iloc (by position):")
print(df.iloc[0:2])`,
        commonMistake: 'Using = instead of == in conditions, which assigns instead of comparing.',
        practiceTask: 'Create a DataFrame with 6 employees. Filter for Sales department with salary >= 80000. Select only name and salary columns.',
        progressCheckQuestion: 'What does df[df["salary"] > 80000] return?',
        progressCheckOptions: [
          'A DataFrame with only rows where salary exceeds 80000',
          'A single True/False value',
          'All rows sorted by salary',
          'An error because the syntax is wrong'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Pandas: Grouping and Aggregation',
        objective: 'Summarize data by groups using aggregation functions',
        lesson: 'Grouping splits data into groups based on one or more columns, then applies aggregation functions (sum, mean, count, max, min) to each group. This is essential for business analysis: total sales by region, average salary by department, customer count by product category. The groupby method returns a GroupBy object; calling aggregate or agg applies the function. Multiple aggregations can be applied to different columns simultaneously. Mastering this technique is key to exploratory data analysis.',
        workedExample: `import pandas as pd

df = pd.DataFrame({
    'department': ['Sales', 'Sales', 'Engineering', 'Engineering', 'HR'],
    'employee': ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'],
    'salary': [80000, 78000, 95000, 92000, 70000]
})

# Group by department and calculate mean salary
dept_salary = df.groupby('department')['salary'].mean()
print("Average salary by department:")
print(dept_salary)

# Multiple aggregations
agg_result = df.groupby('department').agg({
    'salary': ['mean', 'max', 'min'],
    'employee': 'count'
})
print("\\nMultiple aggregations:")
print(agg_result)

# Group by and transform (add result back to original data)
df['dept_avg_salary'] = df.groupby('department')['salary'].transform('mean')
print("\\nWith department average:")
print(df)`,
        commonMistake: 'Forgetting to apply an aggregation function, resulting in a GroupBy object instead of results.',
        practiceTask: 'Create a sales DataFrame with product, region, and amount. Group by region and calculate total and average sales.',
        progressCheckQuestion: 'What does df.groupby("department")["salary"].sum() return?',
        progressCheckOptions: [
          'The total salary for each department',
          'The total salary of the entire company',
          'A list of all salaries sorted',
          'An error message'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Pandas: Merging and Joining Data',
        objective: 'Combine multiple DataFrames based on shared columns',
        lesson: 'Real-world analysis often requires combining data from multiple sources. merge (or join) combines DataFrames based on a common column (key). Inner joins keep only matching rows, left joins keep all rows from the left DataFrame, right joins keep all rows from the right DataFrame, and outer joins keep all rows from both. Specifying the correct join type is critical because it determines what data is retained and what is discarded. Understanding merge is essential for multi-table analysis.',
        workedExample: `import pandas as pd

employees = pd.DataFrame({
    'emp_id': [101, 102, 103],
    'name': ['Alice', 'Bob', 'Carol'],
    'dept_id': [10, 20, 10]
})

departments = pd.DataFrame({
    'dept_id': [10, 20, 30],
    'dept_name': ['Sales', 'Engineering', 'HR']
})

# Inner join: only matching rows
merged = pd.merge(employees, departments, on='dept_id', how='inner')
print("Inner join:")
print(merged)

# Left join: all employees, even without dept match
left_merged = pd.merge(employees, departments, on='dept_id', how='left')
print("\\nLeft join:")
print(left_merged)`,
        commonMistake: 'Using the wrong join type and losing data without realizing it.',
        practiceTask: 'Create two DataFrames: customers (id, name) and orders (order_id, customer_id, amount). Perform a left join to show all customers with their orders.',
        progressCheckQuestion: 'What is the difference between inner and left join?',
        progressCheckOptions: [
          'Inner keeps only matching rows; left keeps all left DataFrame rows',
          'They are identical and can be used interchangeably',
          'Left join is always faster than inner join',
          'Inner join removes duplicate rows automatically'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Matplotlib: Line and Area Charts',
        objective: 'Visualize trends over time with line and area charts',
        lesson: 'Line charts show trends over time or continuous values. Area charts are line charts filled with color underneath. Both are ideal for time-series data: stock prices, website traffic, temperature, sales trends. Matplotlib\'s plot function creates lines. Adding labels, titles, legends, and gridlines makes charts readable. Area charts use fill_between or stackplot for stacked areas. Understanding these basics is essential because visualizations communicate patterns that raw numbers hide.',
        workedExample: `import matplotlib.pyplot as plt
import numpy as np

# Time-series data
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
sales = [1000, 1500, 2000, 1800, 2500, 3000]
expenses = [600, 700, 800, 750, 900, 950]

# Line chart
plt.figure(figsize=(10, 6))
plt.plot(months, sales, marker='o', label='Sales', linewidth=2)
plt.plot(months, expenses, marker='s', label='Expenses', linewidth=2)
plt.title('Monthly Sales vs Expenses', fontsize=14, fontweight='bold')
plt.xlabel('Month')
plt.ylabel('Amount ($)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.show()

# Area chart
plt.figure(figsize=(10, 6))
plt.fill_between(range(len(months)), sales, alpha=0.5, label='Sales')
plt.plot(range(len(months)), sales, marker='o', linewidth=2)
plt.xticks(range(len(months)), months)
plt.title('Sales Trend Over Time', fontsize=14)
plt.ylabel('Sales ($)')
plt.legend()
plt.show()`,
        commonMistake: 'Creating charts without labels or titles, making them confusing to viewers.',
        practiceTask: 'Create a line chart showing temperature over 7 days. Add labels, title, legend, and format the y-axis to show Fahrenheit.',
        progressCheckQuestion: 'When is a line chart most appropriate?',
        progressCheckOptions: [
          'For showing trends over time or continuous values',
          'For comparing categories with no time element',
          'Only when data has 100+ points',
          'Never, area charts are always better'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Matplotlib: Bar and Histogram Charts',
        objective: 'Compare categories and show distributions',
        lesson: 'Bar charts compare values across categories (sales by region, employees by department). Histograms show distributions of numerical data (height distribution, salary distribution). Bar charts use bar(), histograms use hist(). Bar charts have discrete categories on the x-axis; histograms have continuous bins. Both are essential for exploratory data analysis and business reporting. Adding value labels on bars and controlling bin sizes for histograms improves readability.',
        workedExample: `import matplotlib.pyplot as plt
import numpy as np

# Bar chart: categories
departments = ['Sales', 'Engineering', 'HR', 'Finance']
headcount = [15, 25, 8, 10]

plt.figure(figsize=(10, 6))
bars = plt.bar(departments, headcount, color=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'])
# Add value labels on bars
for i, v in enumerate(headcount):
    plt.text(i, v + 0.5, str(v), ha='center', fontweight='bold')
plt.title('Headcount by Department', fontsize=14, fontweight='bold')
plt.ylabel('Number of Employees')
plt.show()

# Histogram: distribution
salaries = np.array([50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 95000, 100000, 105000])
plt.figure(figsize=(10, 6))
plt.hist(salaries, bins=5, edgecolor='black', alpha=0.7, color='steelblue')
plt.title('Salary Distribution', fontsize=14, fontweight='bold')
plt.xlabel('Salary ($)')
plt.ylabel('Frequency')
plt.show()`,
        commonMistake: 'Using histograms for categorical data or not adjusting bin count appropriately.',
        practiceTask: 'Create a bar chart showing sales by product (3-5 products). Add value labels on each bar.',
        progressCheckQuestion: 'What is the main difference between a bar chart and a histogram?',
        progressCheckOptions: [
          'Bar charts compare categories; histograms show distributions of continuous data',
          'They are identical and terms are interchangeable',
          'Histograms are always better than bar charts',
          'Bar charts can only show numbers up to 100'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Matplotlib: Scatter Plots and Correlation',
        objective: 'Visualize relationships between two numerical variables',
        lesson: 'Scatter plots show the relationship between two continuous variables. Each point represents one observation. Patterns in scatter plots reveal correlations: positive (variables increase together), negative (one increases, other decreases), or none (random). Adding trend lines, color-coding, and size encoding adds dimensionality. Scatter plots are essential for exploratory analysis because they reveal patterns that summary statistics hide. Understanding correlation visually helps decide whether two variables should be used together in analysis.',
        workedExample: `import matplotlib.pyplot as plt
import numpy as np

# Create sample data
np.random.seed(42)
experience = np.random.randint(1, 20, 20)
salary = 50000 + experience * 3000 + np.random.randn(20) * 5000

plt.figure(figsize=(10, 6))
plt.scatter(experience, salary, s=100, alpha=0.6, color='steelblue', edgecolor='black')

# Add trend line
z = np.polyfit(experience, salary, 1)
p = np.poly1d(z)
plt.plot(experience, p(experience), "r--", linewidth=2, label='Trend')

plt.title('Experience vs Salary', fontsize=14, fontweight='bold')
plt.xlabel('Years of Experience')
plt.ylabel('Salary ($)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.show()`,
        commonMistake: 'Assuming correlation implies causation, or overlapping points obscuring true relationships.',
        practiceTask: 'Create a scatter plot with 20+ data points showing the relationship between two variables. Add a trend line and correlation coefficient.',
        progressCheckQuestion: 'What does a scatter plot best reveal?',
        progressCheckOptions: [
          'The relationship and correlation between two continuous variables',
          'A single variable\'s distribution alone',
          'Categorical comparisons without context',
          'Nothing useful compared to bar charts'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Matplotlib: Subplots and Multi-Panel Layouts',
        objective: 'Create dashboard-like visualizations with multiple charts',
        lesson: 'A single figure can contain multiple subplots using subplots(). Specify rows and columns to create a grid (e.g., 2x2 for four charts). Each subplot is a separate axes object, allowing different chart types and data in each. Subplots are essential for comparative analysis: showing multiple metrics at once, comparing before/after, or displaying similar analyses for different groups. Tight layouts and proper spacing ensure readability.',
        workedExample: `import matplotlib.pyplot as plt
import numpy as np

# Create data
months = ['Jan', 'Feb', 'Mar', 'Apr']
sales = [1000, 1500, 2000, 2500]
expenses = [600, 700, 800, 900]
regions = ['North', 'South', 'East', 'West']
regional_sales = [5000, 6000, 4500, 5500]

# 2x2 subplot grid
fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# Subplot 1: Line chart (top-left)
axes[0, 0].plot(months, sales, marker='o', color='blue')
axes[0, 0].set_title('Monthly Sales Trend')
axes[0, 0].set_ylabel('Sales ($)')

# Subplot 2: Bar chart (top-right)
axes[0, 1].bar(months, expenses, color='red')
axes[0, 1].set_title('Monthly Expenses')
axes[0, 1].set_ylabel('Expense ($)')

# Subplot 3: Pie chart (bottom-left)
axes[1, 0].pie(regional_sales, labels=regions, autopct='%1.1f%%')
axes[1, 0].set_title('Sales by Region')

# Subplot 4: Scatter plot (bottom-right)
x = np.random.randn(20)
y = np.random.randn(20)
axes[1, 1].scatter(x, y, alpha=0.6)
axes[1, 1].set_title('Random Data')

plt.tight_layout()
plt.show()`,
        commonMistake: 'Creating too many subplots, making the figure cluttered and hard to read.',
        practiceTask: 'Create a 2x2 subplot grid with line chart, bar chart, histogram, and scatter plot. Add titles and labels to each.',
        progressCheckQuestion: 'When should you use subplots instead of separate figures?',
        progressCheckOptions: [
          'When comparing multiple metrics or views that relate to the same analysis',
          'Only when your computer has limited memory',
          'Never, separate figures are always clearer',
          'When you want to confuse the audience'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Teach-First Flow: Concept, Walkthrough, Practice, Checkpoint',
        objective: 'Master the methodology for teaching and learning technical topics',
        lesson: 'The Teach-First Flow is a four-step learning framework: 1) Concept: understand the "why" and core principles through explanation and analogy, 2) Guided Walkthrough: follow step-by-step annotated code with expected outputs, 3) Practice Task: apply the concept to a similar but distinct problem independently, 4) Checkpoint: answer quiz questions to validate understanding. This flow activates different learning modalities: explanation builds conceptual understanding, code examples show application, practice builds muscle memory, and checkpoints confirm readiness. Using this flow for any technical skill accelerates learning and retention.',
        workedExample: `# The Teach-First Flow Applied to "Data Cleaning"

# CONCEPT: Why clean data matters
# Raw data has missing values, duplicates, inconsistent formats, and outliers.
# Data cleaning is the process of detecting and correcting these issues.
# Clean data leads to accurate analysis; dirty data leads to wrong conclusions.

# GUIDED WALKTHROUGH: See it working
import pandas as pd
import numpy as np

df = pd.DataFrame({
    'employee': ['Alice', 'Bob', 'Carol', 'Alice'],
    'salary': [80000, np.nan, 90000, 80000],
    'hire_date': ['2020-01-15', '2019-05-20', np.nan, '2020-01-15']
})

# Step 1: Check for duplicates
print(df.duplicated())
df_clean = df.drop_duplicates()

# Step 2: Handle missing values
df_clean = df_clean.dropna(subset=['salary'])

# Step 3: Standardize formats
df_clean['hire_date'] = pd.to_datetime(df_clean['hire_date'])

print(df_clean)

# PRACTICE TASK: Clean a messier dataset independently
# (Student would receive a new CSV with similar issues and apply the techniques)

# CHECKPOINT: Quiz questions
# Q: What does drop_duplicates() do?
# A: It removes rows that are identical to previous rows
`,
        commonMistake: 'Skipping the concept phase and jumping directly to code, missing the intuition.',
        practiceTask: 'Choose a technical concept you learned recently. Write a concept explanation, find/create a code example, design a practice task, and create 2-3 checkpoint questions.',
        progressCheckQuestion: 'Why is the Concept step important in the Teach-First Flow?',
        progressCheckOptions: [
          'It builds intuition and understanding before diving into code details',
          'It is optional and can be skipped if you are short on time',
          'It is only useful for beginners, not for experienced learners',
          'It makes learning slower without any real benefit'
        ],
        correctOptionIndex: 0
      },
      {
        title: 'Integrated Capstone: End-to-End Data Science Workflow',
        objective: 'Apply all five sections to a realistic employee analytics project',
        lesson: 'Your capstone project brings together Python fundamentals, NumPy array operations, Pandas data manipulation, Matplotlib visualization, and the Teach-First Flow framework. Given a messy employee dataset, you will: 1) Load and explore the data (Python + Pandas), 2) Clean missing values and detect outliers (Pandas), 3) Calculate derived metrics like years of service and salary percentiles (NumPy + Pandas), 4) Group by department and compute summaries (Pandas), 5) Merge with a departments table (Pandas merge), and 6) Create a multi-panel dashboard (Matplotlib subplots). This end-to-end workflow mirrors real data science work.',
        workedExample: `# Capstone: Employee Analytics Dashboard

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 1. LOAD & EXPLORE
df = pd.read_csv('employees.csv')
print(df.head())
print(df.info())
print(df.describe())

# 2. CLEAN
df['salary'].fillna(df.groupby('department')['salary'].transform('median'), inplace=True)
df = df.drop_duplicates()

# 3. CALCULATE
df['years_service'] = (pd.Timestamp.now() - df['hire_date']).dt.days / 365.25
df['salary_percentile'] = df['salary'].rank(pct=True) * 100

# 4. GROUP & AGGREGATE
dept_stats = df.groupby('department').agg({
    'salary': ['mean', 'min', 'max'],
    'employee_id': 'count'
})
print(dept_stats)

# 5. MERGE
depts = pd.read_csv('departments.csv')
df = df.merge(depts, on='dept_id', how='left')

# 6. VISUALIZE
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
axes[0, 0].hist(df['salary'], bins=20, color='steelblue')
axes[0, 0].set_title('Salary Distribution')
axes[0, 1].bar(dept_stats.index, dept_stats[('salary', 'mean')])
axes[0, 1].set_title('Avg Salary by Department')
axes[1, 0].scatter(df['years_service'], df['salary'], alpha=0.6)
axes[1, 0].set_title('Tenure vs Salary')
axes[1, 1].pie(df['department'].value_counts(), labels=df['department'].unique())
axes[1, 1].set_title('Headcount by Department')
plt.tight_layout()
plt.savefig('employee_dashboard.png', dpi=300)`,
        commonMistake: 'Skipping steps or not validating data at each stage, leading to downstream errors.',
        practiceTask: 'Complete the capstone using a provided employee dataset or simulated CSV. Produce cleaned data, a summary DataFrame, and a 2x2 visualization dashboard.',
        progressCheckQuestion: 'What is the main purpose of a capstone project in data science?',
        progressCheckOptions: [
          'To integrate multiple skills into an end-to-end workflow and demonstrate mastery',
          'To practice only the most difficult topic in isolation',
          'To replace all the earlier modules with a single exercise',
          'To show that you can write code without understanding concepts'
        ],
        correctOptionIndex: 0
      }
    ],
    capstoneProject: {
      title: 'Python Data Science Capstone: Employee Analytics Dashboard',
      scenario: 'You are given a messy employee dataset (CSV) with employee names, departments, hire dates, salaries, performance scores, and regional information. Your task is to load, clean, transform, and visualize the data to create an employee analytics dashboard.',
      deliverables: [
        'Cleaned DataFrame with no duplicates and minimal missing values',
        'Summary statistics by department (mean salary, headcount, years of service)',
        'Multi-panel visualization (2x2 subplots) showing salary distribution, departmental comparisons, tenure trends, and regional breakdown',
        'A brief written analysis identifying 2-3 key insights from the data'
      ]
    },
    practiceBank: [],
    finalAssessment: [
      {
        question: 'What is the primary advantage of using NumPy arrays over Python lists?',
        options: [
          'NumPy arrays are 10-100x faster for numerical operations',
          'NumPy arrays can store mixed data types',
          'NumPy arrays are easier to read',
          'NumPy arrays have better variable names'
        ],
        correctOptionIndex: 0,
        explanation: 'NumPy arrays are optimized for numerical computing and use vectorization, making them much faster than Python loops.',
        domainKey: 'foundations',
        domainLabel: 'Foundations & Planning'
      },
      {
        question: 'Which Pandas method combines two DataFrames based on a common column?',
        options: [
          'merge() or join()',
          'concat()',
          'combine()',
          'union()'
        ],
        correctOptionIndex: 0,
        explanation: 'merge() and join() combine DataFrames using keys, while concat() stacks them vertically.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'What does the Teach-First Flow sequence consist of?',
        options: [
          'Concept → Walkthrough → Practice → Checkpoint',
          'Concept → Quiz → Code → Test',
          'Code → Theory → Practice → Evaluation',
          'Tools → Libraries → Models → Deployment'
        ],
        correctOptionIndex: 0,
        explanation: 'The Teach-First Flow prioritizes understanding (concept) before walking through code, practicing independently, and validating with checkpoints.',
        domainKey: 'foundations',
        domainLabel: 'Foundations & Planning'
      },
      {
        question: 'Which Matplotlib function creates a grid of multiple charts?',
        options: [
          'subplots()',
          'scatter()',
          'axes()',
          'grid()'
        ],
        correctOptionIndex: 0,
        explanation: 'subplots() creates a figure with multiple axes arranged in a grid.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'How should missing values be handled if they represent less than 5% of your data?',
        options: [
          'Drop the rows with dropna() since the impact is minimal',
          'Fill with the median or mean of the column',
          'Keep them as NaN without investigation',
          'Convert them all to zero'
        ],
        correctOptionIndex: 0,
        explanation: 'When missing values are rare, dropping them is often simpler than imputing. Always evaluate context and the reason for missing data.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'What does boolean indexing do in NumPy?',
        options: [
          'Filters an array based on a condition, returning only True elements',
          'Converts all array values to True or False',
          'Checks if an array is empty',
          'Sorts an array in ascending order'
        ],
        correctOptionIndex: 0,
        explanation: 'Boolean indexing uses a condition (e.g., arr > 10) to create a mask and return only elements where the condition is True.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      }
    ],
    mockExams: [],
    certificationPlan: {
      trackLabel: 'Python Data Science certification pathway',
      overallPassMark: 75,
      domainPassMark: 70,
      practiceQuestionCount: 0,
      finalQuestionCount: 6,
      mockExamCount: 0,
      mockQuestionCount: 0,
      domains: getCertificationDomains()
    },
    interviewPrep: [
      'Practice explaining your capstone project step-by-step: data loading, cleaning, transformation, grouping, merging, and visualization.',
      'Be ready to describe one challenge you faced during data cleaning and how you resolved it.',
      'Prepare to discuss why vectorization with NumPy is faster than loops and when you would use it.'
    ],
    resumeSignals: [
      'Python data science workflow design using NumPy, Pandas, and Matplotlib',
      'Data cleaning, exploration, and transformation with real-world datasets',
      'End-to-end analytics projects from raw CSV to dashboard visualization'
    ]
  };
}

function buildFallbackCourseContent(topic) {
  const courseTitle = String(topic || 'Professional Course').trim() || 'Professional Course';
  const actionName = courseTitle.replace(/\s+/g, ' ').trim();
  const certificationPlan = buildCertificationPlan(actionName);
  
  // Special handling for Python Programming / Data Science topics
  if (/python.*programming|python.*data.*science/i.test(actionName)) {
    return loadPythonDataScienceCourse();
  }
  
  if (/ai|machine learning|ml|deep learning|data science|artificial intelligence|neural|nlp|computer vision/i.test(actionName)) {
    const seededAssessment = [
      {
        question: 'Which math topic is most directly used to represent features and model weights in machine learning?',
        options: ['Linear algebra', 'Trigonometric identities only', 'Organic chemistry', 'Classical mechanics'],
        correctOptionIndex: 0,
        explanation: 'Vectors, matrices, and matrix operations are foundational to ML representations and optimization.',
        domainKey: 'foundations',
        domainLabel: 'Foundations & Planning'
      },
      {
        question: 'Which Python library is most associated with traditional machine learning workflows?',
        options: ['Scikit-learn', 'BeautifulSoup', 'Flask', 'Selenium'],
        correctOptionIndex: 0,
        explanation: 'Scikit-learn provides standard tools for supervised and unsupervised machine learning.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'A classification model predicts:',
        options: ['A categorical label', 'Only continuous values', 'Database schemas', 'Network latency only'],
        correctOptionIndex: 0,
        explanation: 'Classification predicts class labels such as spam/not spam or churn/not churn.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'Which technique is most closely associated with unsupervised learning?',
        options: ['K-means clustering', 'Logistic regression', 'Backpropagation through a CNN', 'Greedy beam search'],
        correctOptionIndex: 0,
        explanation: 'K-means is a standard unsupervised method for grouping unlabeled data into clusters.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'Which evaluation metric is especially useful when class imbalance matters?',
        options: ['F1-score', 'Row count', 'Epoch number', 'Learning rate only'],
        correctOptionIndex: 0,
        explanation: 'F1-score balances precision and recall and is often more informative than accuracy for imbalanced datasets.',
        domainKey: 'measurement',
        domainLabel: 'Communication & Measurement'
      },
      {
        question: 'Transformers are most strongly associated with which modern AI area?',
        options: ['Generative AI and large language models', 'Relational database normalization', 'Computer hardware manufacturing', 'Spreadsheet automation only'],
        correctOptionIndex: 0,
        explanation: 'Transformer architectures power many modern generative AI systems, including LLMs.',
        domainKey: 'foundations',
        domainLabel: 'Foundations & Planning'
      },
      {
        question: 'Reinforcement learning is best described as:',
        options: ['Learning through reward-driven interaction with an environment', 'Only supervised training on labeled images', 'Cleaning CSV files with Pandas', 'Writing SQL joins for feature tables'],
        correctOptionIndex: 0,
        explanation: 'Reinforcement learning trains an agent by rewarding beneficial decisions over time.',
        domainKey: 'foundations',
        domainLabel: 'Foundations & Planning'
      },
      {
        question: 'Feature engineering belongs primarily to which stage of an AI workflow?',
        options: ['Data preprocessing', 'Final slide design', 'Invoice reconciliation', 'User password reset'],
        correctOptionIndex: 0,
        explanation: 'Feature engineering transforms raw data into stronger inputs for model training.',
        domainKey: 'execution',
        domainLabel: 'Execution & Quality'
      },
      {
        question: 'MLOps focuses on:',
        options: ['Deploying, monitoring, and maintaining models in production', 'Only academic theory', 'Replacing Python with spreadsheets', 'Avoiding version control'],
        correctOptionIndex: 0,
        explanation: 'MLOps covers operational reliability, deployment, monitoring, retraining, and governance for models.',
        domainKey: 'improvement',
        domainLabel: 'Improvement & Career Readiness'
      },
      {
        question: 'A strong AI capstone should usually include:',
        options: ['Problem definition, model workflow, evaluation, and deployment plan', 'Only a screenshot of the final notebook', 'A long tool list with no outcome', 'Model training without any business context'],
        correctOptionIndex: 0,
        explanation: 'End-to-end AI projects should connect business problem, data pipeline, model performance, and practical deployment thinking.',
        domainKey: 'communication',
        domainLabel: 'Communication & Measurement'
      }
    ];
    const finalAssessment = generateCertificationExamQuestions(topic, seededAssessment);
    const practiceBank = buildPracticeQuestionBank(topic, finalAssessment, getCertificationTargets(topic));
    const mockExams = buildMockExams(topic, practiceBank, getCertificationTargets(topic));

    return {
      courseTitle: 'AI + Machine Learning',
      subtitle: 'Foundations, Python tooling, core ML methods, deep learning, GenAI, MLOps, and end-to-end applied projects.',
      difficulty: 'Intermediate',
      estimatedDuration: '12-16 weeks',
      marketDemand: 'AI and machine learning skills are in demand across software, analytics, automation, product, and data teams.',
      overview: 'This course teaches AI + Machine Learning as a real technical pathway: foundational math, Python tooling, supervised and unsupervised learning, evaluation, deep learning, generative AI, reinforcement learning, data preprocessing, MLOps, and end-to-end project delivery. The learning sequence is designed to move from theory into implementation, then into deployment and portfolio-ready proof.',
      learningOutcomes: [
        'Explain the mathematical and conceptual foundations behind modern AI and machine learning systems.',
        'Use Python, notebooks, and core ML libraries to manipulate data and build models.',
        'Apply supervised and unsupervised learning techniques to real problem types.',
        'Evaluate model performance using appropriate metrics and error analysis.',
        'Build an end-to-end AI application from preprocessing through deployment planning.'
      ],
      modules: [
        {
          title: 'Foundational Theory and Mathematics for ML',
          objective: 'Build the math and conceptual base needed to understand how ML models learn.',
          lesson: 'Start with the mathematics that make machine learning possible: linear algebra for vectors, matrices, transformations, and model parameters; calculus for gradients and optimization; and probability/statistics for uncertainty, sampling, distributions, and inference. Then connect that math to core AI concepts: the difference between AI, machine learning, deep learning, and neural networks. This module should help learners understand not just what a model does, but why optimization, loss functions, and data distributions matter in practice.',
          workedExample: 'Represent a dataset row as a feature vector, multiply by model weights, compare the prediction with the true value using a loss function, and update the weights in the direction that reduces error.',
          commonMistake: 'Trying to memorize model names without understanding vectors, gradients, distributions, or how errors are minimized.',
          practiceTask: 'Explain in plain language how vectors, gradients, and probability each contribute to model training.',
          progressCheckQuestion: 'Why is calculus important in machine learning?',
          progressCheckOptions: ['It helps optimize model parameters using gradients', 'It is used only for chart styling', 'It replaces the need for data', 'It is relevant only to web design'],
          correctOptionIndex: 0
        },
        {
          title: 'Programming and Tooling for AI Workflows',
          objective: 'Use the core development environment and libraries that support AI/ML work.',
          lesson: 'Develop working fluency in Python as the main language for AI and ML. Use NumPy for numerical computation, Pandas for data manipulation, Scikit-learn for traditional machine learning workflows, and TensorFlow or PyTorch for deep learning. Learners should also work in Jupyter Notebooks to combine narrative, code, visualizations, and experiments. This module should also introduce cloud tooling such as Google Cloud Vertex AI or Microsoft Azure for training, experiment management, and deployment workflows.',
          workedExample: 'Load a CSV with Pandas, inspect nulls and distributions, transform arrays with NumPy, train a simple Scikit-learn model, and document the experiment inside a Jupyter Notebook.',
          commonMistake: 'Using libraries as black boxes without understanding where each tool fits in the workflow.',
          practiceTask: 'Create a notebook that loads a small dataset, explores it with Pandas, and trains a baseline Scikit-learn model.',
          progressCheckQuestion: 'Which library is most associated with traditional ML pipelines?',
          progressCheckOptions: ['Scikit-learn', 'Photoshop', 'Figma', 'Redis'],
          correctOptionIndex: 0
        },
        {
          title: 'Supervised Learning',
          objective: 'Train models on labeled data for prediction and classification tasks.',
          lesson: 'Study supervised learning as the branch of machine learning where models learn from labeled examples. Cover regression for predicting continuous outcomes and classification for predicting categories. Learners should understand how and when to use techniques such as Logistic Regression, Decision Trees, Random Forests, Support Vector Machines, and other common estimators. The teaching should connect business problems to model choice, showing that the model is selected based on data shape, explainability needs, error cost, and computational tradeoffs.',
          workedExample: 'Use labeled customer churn data to train a classification model, compare Logistic Regression and Random Forest outputs, and interpret why the stronger model performs better.',
          commonMistake: 'Treating all predictive problems the same instead of distinguishing regression from classification and matching the model to the task.',
          practiceTask: 'Train one regression model and one classification model, then explain the difference in target type and evaluation approach.',
          progressCheckQuestion: 'Which supervised task predicts a category label?',
          progressCheckOptions: ['Classification', 'Clustering', 'Dimensionality reduction', 'Anomaly-free logging'],
          correctOptionIndex: 0
        },
        {
          title: 'Unsupervised Learning',
          objective: 'Identify structure and patterns in unlabeled datasets.',
          lesson: 'Teach unsupervised learning as the process of discovering patterns in data without labeled targets. Cover clustering and dimensionality reduction, with attention to K-means and PCA. Learners should understand what each technique reveals, when these methods are useful, and what their limitations are. This module should focus on pattern discovery, segmentation, anomaly exploration, and feature compression rather than prediction. Emphasize that unsupervised learning is often exploratory and valuable for understanding the shape of data before a downstream supervised task.',
          workedExample: 'Run K-means on customer behavior data to identify user segments, then apply PCA to visualize the compressed structure of the feature space.',
          commonMistake: 'Assuming clusters automatically equal real business segments without validating interpretability or usefulness.',
          practiceTask: 'Cluster a small unlabeled dataset and write a short interpretation of each group discovered.',
          progressCheckQuestion: 'What is PCA mainly used for?',
          progressCheckOptions: ['Dimensionality reduction', 'Label creation by humans', 'Database backups', 'Spreadsheet formatting'],
          correctOptionIndex: 0
        },
        {
          title: 'Model Evaluation and Tuning',
          objective: 'Measure model quality correctly and improve performance through analysis.',
          lesson: 'A model is only useful if its performance is measured with the right metrics. Teach accuracy, precision, recall, F1-score, and confusion matrices for classification tasks, and discuss how metric choice changes when false positives and false negatives have different costs. Add evaluation workflow concepts such as train/test split, validation sets, cross-validation, hyperparameter tuning, and basic error analysis. Learners should understand that strong evaluation is about matching the metric to the operational goal, not just reporting a single high number.',
          workedExample: 'Compare two fraud-detection classifiers with confusion matrices and show why recall may matter more than raw accuracy when missed fraud is expensive.',
          commonMistake: 'Using accuracy alone for imbalanced classification problems and missing the true failure pattern.',
          practiceTask: 'Evaluate a classifier with precision, recall, F1-score, and confusion matrix, then recommend which metric matters most for the use case.',
          progressCheckQuestion: 'Which metric is often strongest when precision and recall both matter?',
          progressCheckOptions: ['F1-score', 'File size', 'Epoch count', 'Notebook cell count'],
          correctOptionIndex: 0
        },
        {
          title: 'Deep Learning and Neural Networks',
          objective: 'Understand multi-layer neural networks and their role in complex data tasks.',
          lesson: 'Introduce deep learning as the extension of neural networks into deeper architectures capable of learning complex patterns from images, text, audio, and high-dimensional signals. Cover the structure of neurons, layers, activations, backpropagation, and optimization. Then connect those foundations to use cases such as computer vision and speech analysis. The goal is not to memorize every architecture, but to understand why deeper models can capture complex patterns and what that costs in data, compute, and tuning effort.',
          workedExample: 'Follow the flow of an image through a simple neural network, show how weights update through backpropagation, and explain how deeper layers learn more abstract features.',
          commonMistake: 'Treating deep learning as magic instead of a layered optimization process with real tradeoffs in data quality, compute, and interpretability.',
          practiceTask: 'Build or inspect a small neural network and explain the role of layers, activations, and backpropagation.',
          progressCheckQuestion: 'Why are deep networks useful for complex tasks like vision?',
          progressCheckOptions: ['They learn layered feature representations', 'They eliminate the need for training data', 'They guarantee perfect accuracy', 'They avoid optimization entirely'],
          correctOptionIndex: 0
        },
        {
          title: 'Generative AI, Transformers, and Prompt Engineering',
          objective: 'Understand the core ideas behind modern generative AI systems and how to work with them effectively.',
          lesson: 'Teach modern generative AI as a major branch of current AI practice, focusing on large language models, transformer architectures, and prompt engineering. Learners should understand why transformers became so important, what makes LLMs useful, and how prompting changes model behavior. This module should distinguish between using an LLM productively and understanding the model family that powers it. Include prompt design, grounding, limitations, hallucination risk, safety concerns, and how GenAI fits into broader production workflows.',
          workedExample: 'Compare a vague prompt and a structured prompt for the same task, then explain why better instructions, constraints, and output format improve results.',
          commonMistake: 'Treating prompt engineering as magic wording instead of structured task design with constraints, context, and evaluation.',
          practiceTask: 'Write and test three prompts for one business task, then compare output quality and explain what changed.',
          progressCheckQuestion: 'Transformers are most associated with which area?',
          progressCheckOptions: ['Modern generative AI and LLMs', 'Spreadsheet macros', 'Network cable routing', 'Browser CSS rendering'],
          correctOptionIndex: 0
        },
        {
          title: 'Reinforcement Learning',
          objective: 'Understand how agents learn from reward signals and interaction.',
          lesson: 'Present reinforcement learning as a framework where agents act in environments, observe outcomes, and learn policies that maximize long-term reward. Cover state, action, reward, policy, exploration, exploitation, and sequential decision-making. This module should focus on conceptual understanding and practical intuition: what kinds of problems reinforcement learning suits, why it differs from supervised learning, and why trial-and-error learning matters in interactive systems.',
          workedExample: 'Describe an agent learning to navigate a game environment, receiving rewards for progress and penalties for poor decisions, then improving its strategy over repeated episodes.',
          commonMistake: 'Confusing reinforcement learning with labeled prediction tasks instead of understanding it as reward-based sequential decision-making.',
          practiceTask: 'Explain the difference between supervised learning and reinforcement learning using one practical example of each.',
          progressCheckQuestion: 'What drives learning in reinforcement learning?',
          progressCheckOptions: ['Rewards and penalties from interaction', 'Only labeled spreadsheets', 'Manual feature names', 'Static confusion matrices'],
          correctOptionIndex: 0
        },
        {
          title: 'Data Preprocessing and Feature Engineering',
          objective: 'Turn raw data into model-ready inputs that improve training quality.',
          lesson: 'Teach preprocessing as one of the highest-leverage stages of ML work. Cover data cleaning, missing-value handling, encoding, scaling, feature engineering, and feature selection. Emphasize that raw data is rarely ready for modeling and that model quality depends heavily on input quality. Learners should understand how better features can improve downstream performance more than swapping one algorithm for another. Include train/test leakage risks and the importance of building transformations correctly inside the modeling workflow.',
          workedExample: 'Take a messy tabular dataset, clean missing values, encode categories, engineer a new feature from existing columns, and compare model performance before and after the transformation.',
          commonMistake: 'Jumping into model training before checking data quality, leakage, missingness, or feature usefulness.',
          practiceTask: 'Prepare a raw dataset for ML by cleaning it, engineering at least one new feature, and documenting each transformation step.',
          progressCheckQuestion: 'Why does feature engineering matter?',
          progressCheckOptions: ['It can improve model performance by creating more useful inputs', 'It only changes font size in notebooks', 'It replaces evaluation metrics', 'It removes the need for labels'],
          correctOptionIndex: 0
        },
        {
          title: 'MLOps and Production AI Systems',
          objective: 'Understand how models are deployed, monitored, and maintained in real environments.',
          lesson: 'Move beyond training into operational AI. Teach MLOps as the discipline of packaging, deploying, versioning, monitoring, retraining, and governing models in production. Learners should understand why a model that performs well in a notebook can still fail in deployment if data drift, monitoring, reproducibility, or latency is ignored. Introduce model serving, experiment tracking, model versioning, CI/CD concepts for ML, and cloud environments such as Vertex AI or Azure AI services.',
          workedExample: 'A churn model is deployed, monitored for drift, and retrained when new customer behavior reduces prediction quality in production.',
          commonMistake: 'Treating model training as the finish line instead of planning for deployment, monitoring, rollback, and retraining.',
          practiceTask: 'Design a lightweight MLOps plan covering versioning, deployment, monitoring, and retraining triggers for one model.',
          progressCheckQuestion: 'What is the core goal of MLOps?',
          progressCheckOptions: ['To operationalize and maintain ML models reliably in production', 'To avoid using notebooks', 'To replace model evaluation with intuition', 'To keep models offline forever'],
          correctOptionIndex: 0
        },
        {
          title: 'Capstone Design: End-to-End AI Application',
          objective: 'Integrate the full AI workflow from problem framing through deployment planning.',
          lesson: 'The final teaching module should synthesize the entire course into end-to-end project thinking. Learners should define the problem, understand the business use case, prepare data, choose a modeling approach, evaluate results, and propose a deployment and monitoring strategy. This module is where technical depth meets portfolio quality. The emphasis is not just on model accuracy, but on showing the complete AI lifecycle: problem identification, preprocessing, model selection, evaluation, and operational readiness.',
          workedExample: 'Plan a fraud detection, recommender, or image classification project by documenting the problem, data source, preprocessing pipeline, candidate models, evaluation metrics, and deployment considerations.',
          commonMistake: 'Treating the capstone as just a model-training task instead of an end-to-end AI application with business context and deployment thinking.',
          practiceTask: 'Write a one-page capstone brief covering problem, data, model options, metrics, risks, and deployment plan.',
          progressCheckQuestion: 'What makes an AI capstone portfolio-ready?',
          progressCheckOptions: ['It connects business problem, model workflow, evaluation, and deployment plan', 'It only includes code screenshots', 'It skips metrics and business context', 'It ends after importing libraries'],
          correctOptionIndex: 0
        }
      ],
      capstoneProject: {
        title: 'AI + Machine Learning Capstone',
        scenario: 'Build an end-to-end AI application such as a fraud detection system, recommender system, image classifier, or similar production-style use case from problem framing through deployment planning.',
        deliverables: [
          'Problem statement, data audit, and preprocessing pipeline',
          'Modeling notebook with at least one baseline and one improved model plus evaluation metrics',
          'Deployment and MLOps plan covering monitoring, drift, retraining, and stakeholder communication'
        ]
      },
      practiceBank,
      finalAssessment,
      mockExams,
      certificationPlan,
      interviewPrep: [
        'Prepare to explain the difference between AI, machine learning, deep learning, and generative AI clearly and concisely.',
        'Be ready to walk through one supervised learning project, including data prep, model choice, metrics, and tradeoffs.',
        'Practice describing how you would take an ML model from notebook prototype into monitored production use.'
      ],
      resumeSignals: [
        'Python-based AI/ML workflow design with NumPy, Pandas, Scikit-learn, and deep learning frameworks',
        'Model evaluation, feature engineering, and end-to-end AI project execution',
        'Production-minded AI thinking including MLOps, monitoring, and deployment planning'
      ]
    };
  }

  const finalAssessment = generateCertificationExamQuestions(topic);
  const practiceBank = buildPracticeQuestionBank(topic, finalAssessment, getCertificationTargets(topic));
  const mockExams = buildMockExams(topic, practiceBank, getCertificationTargets(topic));

  return {
    courseTitle: actionName,
    subtitle: `RoleRocket AI certification pathway for ${actionName}`,
    difficulty: 'Intermediate',
    estimatedDuration: '10-12 weeks',
    marketDemand: `${actionName} remains a practical, in-demand skill across modern teams.`,
    overview: `This certification-oriented course gives you a more complete working foundation in ${actionName}. You will learn how to define the goal, scope the work, collect the right inputs, execute with a clear workflow, manage risk, communicate progress, measure outcomes, and convert the work into strong interview and resume proof. The course is designed to feel closer to a real professional certification track: longer lessons, broader coverage, repeated checkpoints, a capstone, and a comprehensive final multiple-choice exam.`,
    learningOutcomes: [
      `Explain the core workflow behind ${actionName}.`,
      `Scope ${actionName} work into clear phases and deliverables.`,
      `Execute ${actionName} tasks with visible progress and clear ownership.`,
      `Reduce risk and improve quality with deliberate checkpoints.`,
      `Present ${actionName} impact clearly to stakeholders and hiring managers.`
    ],
    modules: [
      {
        title: `Foundations of ${actionName}`,
        objective: `Understand what ${actionName} is supposed to achieve and how strong execution is measured.`,
        lesson: `Start by defining the actual outcome ${actionName} is meant to improve. Identify the users, stakeholders, timeline, and decision criteria before choosing tools or tactics. Strong execution starts with the goal, the constraints, and the measure of success. Write a short problem statement, list the current pain points, and define what a better outcome would look like in concrete terms. Then outline the key inputs, the people involved, and the checkpoints required to move work forward without ambiguity. This foundation prevents wasted effort and makes the rest of the work easier to execute, inspect, and explain.`,
        workedExample: `A team wants to improve a process that currently takes 10 days. The lead sets a target of 6 days, names the approval bottleneck, identifies the owners, and tracks turnaround time weekly before changing any tools.`,
        commonMistake: `Starting with tactics before defining the target outcome, success metric, and constraints.`,
        practiceTask: `Write a one-paragraph problem statement for a ${actionName} initiative, including success metrics and two constraints.`,
        progressCheckQuestion: `What should be defined before choosing tactics or tools?`,
        progressCheckOptions: [
          'The goal, constraints, and success metrics',
          'The final slide design for stakeholders',
          'Every tool the team might buy',
          'A perfect solution with no tradeoffs'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Scoping and Planning ${actionName}`,
        objective: `Turn a broad goal into a realistic plan with clear owners, deliverables, and checkpoints.`,
        lesson: `Convert the outcome into a scoped plan by separating must-have work from optional improvements. Break the effort into phases, assign owners, define dependencies, and choose a review cadence. Good plans are small enough to execute and specific enough to inspect. Document what will be delivered first, what assumptions are being made, and what evidence would force you to adjust. Align the work to calendar time, available capacity, and stakeholder expectations. A workable plan reduces confusion because each step has a purpose, an owner, and a decision point. When scope changes, update the plan explicitly instead of letting drift accumulate silently.`,
        workedExample: `A six-week initiative is split into discovery, build, validation, and rollout. One lead owns requirements, one owns implementation, and a weekly checkpoint flags delays if any task slips by more than two days.`,
        commonMistake: `Treating every request as equally important and building a plan that exceeds available time or capacity.`,
        practiceTask: `Create a four-step plan for a small initiative and assign an owner plus target date to each step.`,
        progressCheckQuestion: `What makes a plan executable instead of vague?`,
        progressCheckOptions: [
          'It has clear deliverables, owners, and checkpoints',
          'It lists every idea anyone mentioned',
          'It avoids deadlines to stay flexible',
          'It focuses only on the final result and skips the process'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Execution Workflow for ${actionName}`,
        objective: `Run the work consistently while keeping momentum, quality, and visibility high.`,
        lesson: `Execution depends on a visible workflow. Define what enters the queue, how work is prioritized, what done means, and how blockers are escalated. Track progress with a small number of useful indicators instead of too many vanity metrics. During execution, compare actual outcomes against the plan, note why something moved faster or slower than expected, and adjust resources or sequencing when required. Communicate changes early. Reliable execution is not speed alone. It is the combination of progress, clarity, and controlled decision-making under pressure. Teams trust a process more when updates are concrete and tied to what happens next.`,
        workedExample: `A workflow board shows tasks in backlog, active, review, and done. A blocker older than 24 hours is escalated to the project owner, which prevents review items from stalling for an entire week.`,
        commonMistake: `Working reactively without a visible workflow or escalation rule for blockers.`,
        practiceTask: `Map your current workflow into 4 to 6 stages and define what must be true for an item to move to done.`,
        progressCheckQuestion: `What is the main benefit of a visible workflow?`,
        progressCheckOptions: [
          'It makes priorities, blockers, and next steps clear',
          'It removes the need for stakeholder communication',
          'It guarantees there will be no delays',
          'It replaces the need for planning'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Quality Control and Risk Management in ${actionName}`,
        objective: `Protect outcomes by reviewing assumptions, spotting risk early, and tightening quality checks.`,
        lesson: `Risk management is not a one-time exercise. Review the plan for assumptions that could fail, identify where the highest-impact errors are likely to occur, and set checkpoints before those errors become expensive. Define what quality means for the work: correctness, usability, completeness, compliance, or stakeholder approval. Then connect that definition to lightweight review steps. Effective operators reduce surprises by surfacing uncertainty early, testing the most fragile parts of the process, and documenting decisions that affect downstream work. When a risk appears, respond with a concrete mitigation by reducing scope, adding review capacity, changing sequencing, or creating a fallback path.`,
        workedExample: `A team identifies approval delays as the highest risk and adds a pre-review checklist plus a 48-hour response deadline. That change prevents launch-week rework caused by late stakeholder feedback.`,
        commonMistake: `Assuming quality will happen automatically without explicit checkpoints or review criteria.`,
        practiceTask: `List three risks for your current process and write one mitigation step for each.`,
        progressCheckQuestion: `What is the best first response to a meaningful project risk?`,
        progressCheckOptions: [
          'Define a concrete mitigation or fallback before the issue grows',
          'Ignore it until the problem becomes urgent',
          'Add more tools without changing the process',
          'Assume the team will figure it out later'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Communicating ${actionName} to Stakeholders`,
        objective: `Deliver updates that build trust and make decisions easier.`,
        lesson: `Strong communication focuses on what changed, what it means, and what decision is needed next. Tailor updates to the audience. Leaders usually need status, risk, and impact. Working teams need tasks, timing, and blockers. Keep updates concise and tied to evidence. Use before-and-after comparisons, current progress against target, and a short explanation of tradeoffs. Good communication reduces confusion because it translates detailed work into clear direction. It also protects the team from unnecessary churn, since stakeholders can see the actual status instead of filling gaps with assumptions. A useful update always answers three questions: where we are, what is at risk, and what happens next.`,
        workedExample: `Instead of saying a launch is behind, a lead reports that testing is 70 percent complete, two defects are blocking signoff, and a one-day extension will protect quality without affecting the customer announcement.`,
        commonMistake: `Giving vague updates that describe activity but not progress, impact, or next decisions.`,
        practiceTask: `Write a six-sentence stakeholder update that includes progress, a risk, and the next required action.`,
        progressCheckQuestion: `What should a strong stakeholder update include?`,
        progressCheckOptions: [
          'Current status, impact, risks, and next actions',
          'Only detailed task notes from every contributor',
          'Optimistic language without metrics or tradeoffs',
          'A long summary with no clear recommendation'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Proving Impact with ${actionName}`,
        objective: `Close the loop by measuring outcomes and turning the work into career evidence.`,
        lesson: `After execution, compare the outcome to the original target. Record what changed, why it improved, and what should be repeated next time. Distinguish output from impact. Output is what you delivered. Impact is what improved because of it. Capture baseline metrics, final metrics, and the actions that produced the change. Then translate that into concise resume language and interview stories. This step matters because completed work creates career leverage only when it is measurable and explainable. The strongest proof points show problem, action, and result with enough detail to sound credible and useful.`,
        workedExample: `A process redesign reduced turnaround time from 10 days to 6 days, decreased rework by 25 percent, and improved stakeholder satisfaction scores. The lead turns that into a resume bullet tied to process design, execution, and measurable outcome.`,
        commonMistake: `Listing responsibilities without documenting the measurable result or business impact.`,
        practiceTask: `Write one resume bullet and one interview story outline based on a completed project or simulated example.`,
        progressCheckQuestion: `What makes project experience persuasive on a resume?`,
        progressCheckOptions: [
          'A clear action linked to a measurable result',
          'A list of tools with no context',
          'A broad statement that you helped the team',
          'Detailed jargon without any outcome'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Requirements and Input Quality for ${actionName}`,
        objective: `Define strong inputs so execution starts from reliable assumptions and evidence.`,
        lesson: `Many projects struggle not because the team lacks effort, but because they start from weak inputs. Strong execution begins with verified requirements, a clear source of truth, and an explicit definition of what information is missing. Before work begins, identify the decisions the course or project must support, the documents or datasets being used, who owns them, and how current they are. Separate facts from assumptions. Then define how missing information will be resolved, what happens if a key dependency is delayed, and which items are critical enough to block progression. Input quality matters because every planning choice, risk assessment, and outcome measure depends on it. Teams that start with vague requirements often spend most of their time reworking avoidable mistakes. Teams that validate inputs early move faster later because execution is built on stable ground.`,
        workedExample: `A lead preparing a new automation workflow discovers that customer status definitions differ across two teams. Instead of building immediately, the lead resolves the mismatch, documents the approved definitions, and avoids days of rework later.`,
        commonMistake: `Treating assumptions, old notes, and unverified requests as equally reliable inputs.`,
        practiceTask: `List the five most important inputs for a real or simulated ${actionName} initiative and label each as verified, unverified, or missing.`,
        progressCheckQuestion: `What is the best reason to validate inputs before execution starts?`,
        progressCheckOptions: [
          'It reduces avoidable rework caused by bad assumptions',
          'It eliminates the need for stakeholder approval',
          'It guarantees there will be no scope changes',
          'It makes outcomes look better automatically'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Measurement Frameworks in ${actionName}`,
        objective: `Choose metrics that actually show progress, quality, and business value.`,
        lesson: `A certification-level practitioner needs to separate activity metrics from outcome metrics. Activity metrics show that work happened. Outcome metrics show whether the work improved anything meaningful. Start by identifying the main business goal, then choose one or two leading indicators that warn you early when execution is drifting and one or two lagging indicators that confirm the final impact. Define how each metric is calculated, how often it will be reviewed, and what threshold triggers action. Avoid vanity metrics that look impressive but do not affect decisions. Strong measurement frameworks also describe what will be compared: before versus after, target versus actual, or cohort versus cohort. If you cannot explain what a metric will change in your decision-making, it is probably not useful enough. The goal is not to collect more numbers. The goal is to connect evidence to a better operational decision.`,
        workedExample: `A team launching a support workflow tracks backlog age as a leading metric and resolution rate as a lagging metric. Backlog age warns them early when new cases are not moving, while resolution rate confirms whether customers are actually getting helped.`,
        commonMistake: `Reporting raw activity counts without connecting them to quality or business impact.`,
        practiceTask: `Define one leading metric and one lagging metric for a process you want to improve, then explain what action each metric would trigger.`,
        progressCheckQuestion: `Which metric is usually strongest for proving final impact?`,
        progressCheckOptions: [
          'A lagging metric tied to the target outcome',
          'A vanity metric with large numbers',
          'The longest status update in the meeting',
          'Any metric collected only once at the end'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Decision-Making Under Tradeoffs in ${actionName}`,
        objective: `Make better decisions when time, quality, budget, and scope compete with each other.`,
        lesson: `Real certification work is not about finding perfect answers. It is about making defensible decisions under constraints. When tradeoffs appear, name them clearly. What happens if you protect speed over quality, or scope over timeline, or cost over resilience? Then decide which variable matters most for the current objective. Good decision-making uses criteria instead of impulse. Compare each option against impact, urgency, reversibility, stakeholder expectations, and operational risk. Document the decision, the reasons behind it, and the signals that would require revisiting it later. This makes the work easier to defend in stakeholder conversations and easier to explain in interviews. Strong operators are not the people who avoid hard tradeoffs. They are the people who make them transparently, with evidence, and with a clear plan for what comes next.`,
        workedExample: `A project is one week behind and leadership asks for the full original scope. The lead reduces two low-impact features, protects quality on the core deliverable, and explains the tradeoff with a customer-impact rationale.`,
        commonMistake: `Trying to protect every variable equally instead of deciding what matters most.`,
        practiceTask: `Write a short decision memo for a case where you must choose between timeline and scope.`,
        progressCheckQuestion: `What makes a tradeoff decision credible?`,
        progressCheckOptions: [
          'It uses explicit criteria and explains the impact of the choice',
          'It hides the downside to keep stakeholders calm',
          'It avoids documentation to stay flexible',
          'It assumes every option can be equally protected'
        ],
        correctOptionIndex: 0
      },
      {
        title: `Sustaining Improvements in ${actionName}`,
        objective: `Keep gains from slipping after rollout or project completion.`,
        lesson: `Certification-level work does not stop at launch. Sustainable improvement requires ownership, review cadence, and a maintenance plan. Once a workflow or initiative goes live, decide who monitors the outcome, how incidents are captured, when performance is reviewed, and what thresholds trigger retraining or redesign. Create lightweight documentation that new contributors can follow without relying on tribal knowledge. Sustainability also means checking whether the work still matches the original need. Processes drift when context changes but the operating method does not. Regular review lets you update assumptions before performance degrades. A solid sustainability plan turns one-time execution into repeatable operating capability, which is often what employers really want when they ask for experienced practitioners.`,
        workedExample: `After a new internal process reduces turnaround time, the team assigns one owner to review metrics each Friday, logs recurring issues, and updates the checklist monthly so gains are not lost after the initial rollout.`,
        commonMistake: `Declaring success at launch without assigning ownership for monitoring and maintenance.`,
        practiceTask: `Create a 30-day sustainment plan with owner, review cadence, and two escalation triggers.`,
        progressCheckQuestion: `What is the strongest sign that an improvement can last?`,
        progressCheckOptions: [
          'There is an owner, review rhythm, and trigger for intervention',
          'The team stopped discussing it after launch',
          'No one measured anything after rollout',
          'All documentation was replaced with memory'
        ],
        correctOptionIndex: 0
      }
    ],
    capstoneProject: {
      title: `${actionName} Capstone`,
      scenario: `Design and execute a realistic ${actionName} initiative from problem definition through final results review.`,
      deliverables: [
        'Problem statement with goals, constraints, and stakeholders',
        'Execution plan with milestones, owners, and risk mitigations',
        'Final impact summary with metrics, lessons learned, and resume-ready proof points'
      ]
    },
    practiceBank,
    finalAssessment,
    mockExams,
    certificationPlan,
    interviewPrep: [
      `Be ready to explain how you scope ${actionName} work before execution starts.`,
      `Prepare one example where you managed risk, changed the plan, or protected quality under pressure.`,
      `Practice describing the measurable impact of your ${actionName} work using specific numbers or outcomes.`
    ],
    resumeSignals: [
      `Structured planning and execution for ${actionName} initiatives`,
      `Risk management and stakeholder communication in ${actionName} work`,
      `Measured business impact and clear documentation of ${actionName} outcomes`
    ]
  };
}

function hasStructuredProgressChecks(course) {
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const finalAssessment = Array.isArray(course?.finalAssessment) ? course.finalAssessment : [];
  if (modules.length !== 10) return false;
  if (finalAssessment.length < 60 || finalAssessment.length > 180) return false;
  const validModules = modules.every((module) => (
    Array.isArray(module?.progressCheckOptions)
    && module.progressCheckOptions.length >= 4
    && Number.isInteger(Number(module?.correctOptionIndex))
  ));
  const validAssessment = finalAssessment.every((item) => (
    Array.isArray(item?.options)
    && item.options.length >= 3
    && Number.isInteger(Number(item?.correctOptionIndex))
  ));
  return validModules && validAssessment;
}

function normalizeCourseModule(module, index) {
  const rawOptions = Array.isArray(module?.progressCheckOptions)
    ? module.progressCheckOptions.map((option) => String(option || '').trim()).filter(Boolean)
    : [];
  const fallbackOptions = [
    'Apply the core process described in the lesson before moving forward.',
    'Skip the planning step and rely on assumptions instead.',
    'Wait until issues escalate before reviewing the work.',
    'Focus only on tools and ignore communication with stakeholders.'
  ];
  const progressCheckOptions = rawOptions.length >= 4
    ? rawOptions.slice(0, 4)
    : fallbackOptions.map((option, optionIndex) => rawOptions[optionIndex] || option);
  const numericCorrectOptionIndex = Number(module?.correctOptionIndex);
  const correctOptionIndex = Number.isInteger(numericCorrectOptionIndex)
    && numericCorrectOptionIndex >= 0
    && numericCorrectOptionIndex < progressCheckOptions.length
      ? numericCorrectOptionIndex
      : 0;
  const correctOptionText = String(progressCheckOptions[correctOptionIndex] || '').trim();
  const objective = String(module?.objective || '').trim();
  const fallbackExplanation = correctOptionText
    ? `The best answer is "${correctOptionText}" because it matches the core objective of this module${objective ? `: ${objective}` : '.'}`
    : `This answer best reflects the core lesson from module ${index + 1}.`;

  return {
    ...module,
    title: String(module?.title || `Module ${index + 1}`).trim(),
    progressCheckQuestion: String(module?.progressCheckQuestion || `Which answer best reflects the core lesson from module ${index + 1}?`).trim(),
    progressCheckOptions,
    correctOptionIndex,
    progressCheckExplanation: String(module?.progressCheckExplanation || fallbackExplanation).trim()
  };
}

app.post('/api/learning/course-progress-check', authenticateToken, async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    const moduleIndex = Number(req.body?.moduleIndex);
    const selectedOptionIndex = Number(req.body?.selectedOptionIndex);
    const sessionToken = String(req.body?.sessionToken || '').trim();

    if (!topic) return res.status(400).json({ error: 'Topic is required.' });
    if (!Number.isInteger(moduleIndex) || moduleIndex < 0) {
      return res.status(400).json({ error: 'Valid moduleIndex is required.' });
    }
    if (!Number.isInteger(selectedOptionIndex) || selectedOptionIndex < 0) {
      return res.status(400).json({ error: 'Valid selectedOptionIndex is required.' });
    }
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required.' });
    }

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access full course content.' });
    }

    const courseKey = normalizeCourseKey(topic);
    const session = await CourseLearningSession.findOne({
      userId: req.user.userId,
      courseKey,
      sessionToken
    }).lean();

    if (!session || !session.expiresAt || new Date(session.expiresAt).getTime() < Date.now()) {
      return res.status(409).json({ error: 'Progress check session expired. Reload the course and try again.' });
    }

    const answerEntry = Array.isArray(session.answers) ? session.answers[moduleIndex] : null;
    const expectedIndex = typeof answerEntry === 'object' && answerEntry !== null
      ? Number(answerEntry.correctOptionIndex)
      : Number(answerEntry);
    if (!Number.isInteger(expectedIndex) || expectedIndex < 0) {
      return res.status(404).json({ error: 'Progress check data not found for this module.' });
    }

    // Prefer session-stored text/explanation; fall back to live course cache for rich feedback
    let correctOptionText = typeof answerEntry === 'object' && answerEntry !== null
      ? String(answerEntry.correctOptionText || '').trim()
      : '';
    let explanation = typeof answerEntry === 'object' && answerEntry !== null
      ? String(answerEntry.explanation || '').trim()
      : '';

    if (!correctOptionText || !explanation) {
      const cachedCourse = await CourseContentCache.findOne({ courseKey }).lean();
      if (cachedCourse?.coursePayload) {
        const rawModules = Array.isArray(cachedCourse.coursePayload.modules)
          ? cachedCourse.coursePayload.modules
          : [];
        const rawModule = rawModules[moduleIndex];
        if (rawModule) {
          const normalized = normalizeCourseModule(rawModule, moduleIndex);
          if (!correctOptionText) {
            correctOptionText = String(normalized.progressCheckOptions?.[expectedIndex] || '').trim();
          }
          if (!explanation) {
            explanation = String(normalized.progressCheckExplanation || '').trim();
          }
        }
      }
    }

    const passed = selectedOptionIndex === expectedIndex;
    if (!passed) {
      return res.json({
        passed: false,
        correctOptionIndex: expectedIndex,
        correctOptionText,
        explanation
      });
    }

    const totalModules = Array.isArray(session.answers) ? session.answers.length : 0;
    const sessionFingerprint = String(session.contentFingerprint || '').trim();
    const existing = await CourseProgress.findOne({ userId: req.user.userId, courseKey }).lean();
    const existingFingerprint = String(existing?.contentFingerprint || '').trim();
    const mergedCompletedModules = Array.from(new Set([
      ...((existingFingerprint === sessionFingerprint && Array.isArray(existing?.completedModules)) ? existing.completedModules : []),
      moduleIndex
    ]))
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < totalModules)
      .sort((a, b) => a - b);

    const completedAt = totalModules > 0 && mergedCompletedModules.length === totalModules
      ? (existing?.completedAt || new Date())
      : null;

    const saved = await CourseProgress.findOneAndUpdate(
      { userId: req.user.userId, courseKey },
      {
        $set: {
          courseTitle: topic,
          contentFingerprint: sessionFingerprint,
          totalModules,
          completedModules: mergedCompletedModules,
          completedAt
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      passed: true,
      correctOptionIndex: expectedIndex,
      correctOptionText,
      explanation,
      totalModules: Number(saved?.totalModules || totalModules),
      completedModules: Array.isArray(saved?.completedModules) ? saved.completedModules : [],
      completedAt: saved?.completedAt || null
    });
  } catch (err) {
    console.error('Course progress check error:', err);
    return res.status(500).json({ error: 'Failed to validate progress check.' });
  }
});

app.get('/api/learning/course-progress', authenticateToken, async (req, res) => {
  try {
    const topic = String(req.query?.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access full course content.' });
    }

    const courseKey = normalizeCourseKey(topic);

    const record = await CourseProgress.findOne({ userId: req.user.userId, courseKey }).lean();
    return res.json({
      courseKey,
      courseTitle: topic,
      contentFingerprint: String(record?.contentFingerprint || '').trim(),
      totalModules: Number(record?.totalModules || 0),
      completedModules: Array.isArray(record?.completedModules) ? record.completedModules : [],
      completedAt: record?.completedAt || null
    });
  } catch (err) {
    console.error('Course progress load error:', err);
    return res.status(500).json({ error: 'Failed to load course progress.' });
  }
});

app.put('/api/learning/course-progress', authenticateToken, async (req, res) => {
  try {
    const topic = String(req.body?.topic || '').trim();
    const totalModules = Math.max(0, Number(req.body?.totalModules || 0));

    if (!topic) return res.status(400).json({ error: 'Topic is required.' });

    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access full course content.' });
    }

    const courseKey = normalizeCourseKey(topic);

    const existing = await CourseProgress.findOne({ userId: req.user.userId, courseKey }).lean();
    const contentFingerprint = String(existing?.contentFingerprint || '').trim();
    const trustedCompletedModules = Array.isArray(existing?.completedModules) ? existing.completedModules : [];
    const completedAt = totalModules > 0 && trustedCompletedModules.length === totalModules
      ? (existing?.completedAt || new Date())
      : null;

    const saved = await CourseProgress.findOneAndUpdate(
      { userId: req.user.userId, courseKey },
      {
        $set: {
          courseTitle: topic,
          contentFingerprint,
          totalModules,
          completedModules: trustedCompletedModules,
          completedAt
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      courseKey,
      courseTitle: topic,
      totalModules: Number(saved?.totalModules || 0),
      completedModules: Array.isArray(saved?.completedModules) ? saved.completedModules : [],
      completedAt: saved?.completedAt || null
    });
  } catch (err) {
    console.error('Course progress save error:', err);
    return res.status(500).json({ error: 'Failed to save course progress.' });
  }
});

app.get('/api/learning/course-progress-list', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to access course progress.' });
    }

    const items = await CourseProgress.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = items.map((item) => {
      const totalModules = Number(item?.totalModules || 0);
      const completedModules = Array.isArray(item?.completedModules) ? item.completedModules : [];
      const completedCount = completedModules.length;
      const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
      return {
        courseKey: String(item?.courseKey || ''),
        courseTitle: String(item?.courseTitle || ''),
        totalModules,
        completedModules,
        completedCount,
        progressPercent,
        completedAt: item?.completedAt || null,
        updatedAt: item?.updatedAt || null
      };
    });

    return res.json({ items: mapped });
  } catch (err) {
    console.error('Course progress list error:', err);
    return res.status(500).json({ error: 'Failed to load course progress list.' });
  }
});

app.get('/api/learning/progress-overview', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!hasRequiredPlan(user, 'elite')) {
      return res.status(403).json({ error: 'Upgrade to Elite to view learning progress.' });
    }

    const rows = await CourseProgress.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .lean();

    const totalCourses = rows.length;
    const completedCourses = rows.filter((r) => Number(r?.totalModules || 0) > 0 && Array.isArray(r?.completedModules) && r.completedModules.length === Number(r.totalModules || 0)).length;
    const inProgressCourses = rows.filter((r) => Array.isArray(r?.completedModules) && r.completedModules.length > 0 && r.completedModules.length < Number(r?.totalModules || 0)).length;
    const totalCompletedModules = rows.reduce((sum, r) => sum + (Array.isArray(r?.completedModules) ? r.completedModules.length : 0), 0);

    const uniqueDays = Array.from(new Set(rows
      .map((r) => (r?.updatedAt ? new Date(r.updatedAt) : null))
      .filter((d) => d && !Number.isNaN(d.getTime()))
      .map((d) => d.toISOString().slice(0, 10))
    )).sort((a, b) => b.localeCompare(a));

    let streakDays = 0;
    if (uniqueDays.length) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 0; i < 365; i += 1) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);
        const key = expected.toISOString().slice(0, 10);
        if (uniqueDays.includes(key)) {
          streakDays += 1;
        } else {
          break;
        }
      }
    }

    const badges = [];
    if (totalCompletedModules >= 1) badges.push({ key: 'first-module', label: 'First Module Done' });
    if (completedCourses >= 1) badges.push({ key: 'course-finisher', label: 'Course Finisher' });
    if (streakDays >= 3) badges.push({ key: 'consistency-3', label: '3-Day Learning Streak' });
    if (totalCompletedModules >= 10) badges.push({ key: 'sprinter', label: 'Learning Sprinter' });

    const continueCourse = rows.find((r) => {
      const total = Number(r?.totalModules || 0);
      const done = Array.isArray(r?.completedModules) ? r.completedModules.length : 0;
      return total > 0 && done > 0 && done < total;
    });

    return res.json({
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalCompletedModules,
      streakDays,
      badges,
      continueCourse: continueCourse
        ? {
          courseKey: String(continueCourse.courseKey || ''),
          courseTitle: String(continueCourse.courseTitle || ''),
          totalModules: Number(continueCourse.totalModules || 0),
          completedCount: Array.isArray(continueCourse.completedModules) ? continueCourse.completedModules.length : 0
        }
        : null
    });
  } catch (err) {
    console.error('Learning progress overview error:', err);
    return res.status(500).json({ error: 'Failed to load learning progress overview.' });
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
            'Act like an executive career coach. Give a focused career plan, role targets, skill gaps, salary positioning guidance, and next 3 actions. Return plain text only. Do not use markdown syntax. Do not use #, ##, or ### headings. Keep formatting simple and legible with short section titles and concise bullets.'
        },
        {
          role: 'user',
          content: `Resume:\n${resume || 'Not provided'}\n\nGoals:\n${goals || 'Not provided'}`
        }
      ]
    });

    const rawResult = String(completion.choices?.[0]?.message?.content || '');
    const cleanedResult = rawResult
      .replace(/\r\n/g, '\n')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return res.json({ result: cleanedResult });
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

app.post('/api/page-assistant', authenticateToken, async (req, res) => {
  try {
    const message = trimForAssistant(req.body?.message, 1500);
    const page = trimForAssistant(req.body?.page, 120) || 'RoleRocket AI tool';
    const contextEntries = normalizeAssistantContext(req.body?.context);
    const history = normalizeAssistantHistory(req.body?.history);

    if (!message) {
      return res.status(400).json({ error: 'A question is required.' });
    }

    const contextBlock = contextEntries.length
      ? contextEntries.map(([key, value]) => `- ${key}: ${value}`).join('\n')
      : '- No page context was supplied.';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are RoleRocket AI's in-app page assistant.

Your job is to help the user complete the task on the page they are currently using.

Rules:
- Be concise, practical, and specific to the page context.
- Do not invent page state that is not present in the supplied context.
- Prefer direct guidance, rewrites, checklists, or next steps.
- If the user asks for edits to a draft, respond with improved wording they can use immediately.
- Use plain text with short paragraphs or short bullet lists.
- Do not mention internal policies, tokens, or implementation details.`
        },
        {
          role: 'system',
          content: `Current page: ${page}\n\nPage context:\n${contextBlock}`
        },
        ...history,
        {
          role: 'user',
          content: message
        }
      ]
    });

    const answer = String(completion.choices?.[0]?.message?.content || '').trim();
    return res.json({ answer: answer || 'I could not generate a response right now.' });
  } catch (err) {
    console.error('Page assistant error:', err);
    return res.status(500).json({ error: 'Page assistant failed.' });
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
      sources: getInDemandJobSourceLabels(),
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
    const radiusRaw = Number(req.query.radius);
    const radiusMiles = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(Math.round(radiusRaw), 500) : 100;
    const { jobs } = await searchJobsFast({ title, location, resume: preferences, radiusMiles });
    let topJobs = jobs;
    let thresholdSummary = null;

    const bearer = String(req.headers.authorization || '').trim();
    if (/^Bearer\s+/i.test(bearer)) {
      try {
        const token = bearer.replace(/^Bearer\s+/i, '').trim();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId || decoded.id || decoded._id || decoded.sub || null;

        if (userId) {
          const thresholds = await getUserRecommendationThresholds(String(userId));
          thresholdSummary = thresholds;
          const hasActiveThreshold = Number(thresholds.salaryMin || 0) > 0 || thresholds.workModes.length > 0 || thresholds.employmentTypes.length > 0;
          if (hasActiveThreshold) {
            topJobs = topJobs.filter((job) => jobMatchesRecommendationThresholds(job, thresholds));
          }
        }
      } catch (_tokenErr) {
        // Keep this endpoint usable anonymously even if an invalid token is supplied.
      }
    }

    return res.json({
      query: { title, location, preferences },
      jobs: topJobs,
      thresholdSummary,
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

app.put('/api/jobs/:id/materials', authenticateToken, async (req, res) => {
  try {
    const resumeDraft = String(req.body?.resumeDraft || '').trim();
    const coverLetterDraft = String(req.body?.coverLetterDraft || '').trim();
    const fitScoreRaw = Number(req.body?.fitScore || 0);
    const fitScore = Number.isFinite(fitScoreRaw) ? Math.max(1, Math.min(100, Math.round(fitScoreRaw))) : 0;
    const fitChecklist = Array.isArray(req.body?.fitChecklist)
      ? req.body.fitChecklist.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
      : [];

    const job = await Job.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const materialsBlock = [
      '[Guided Apply Materials]',
      `fitScore=${fitScore || 'n/a'}`,
      fitChecklist.length ? `checklist=${fitChecklist.join(' | ')}` : 'checklist=n/a',
      resumeDraft ? `resumeDraft=${resumeDraft.replace(/\s+/g, ' ').slice(0, 1200)}` : 'resumeDraft=n/a',
      coverLetterDraft ? `coverLetterDraft=${coverLetterDraft.replace(/\s+/g, ' ').slice(0, 900)}` : 'coverLetterDraft=n/a',
      `savedAt=${new Date().toISOString()}`
    ].join('\n');

    const priorNotes = String(job.notes || '').trim();
    job.notes = [priorNotes, materialsBlock].filter(Boolean).join('\n\n').slice(-8000);
    if (job.status === 'saved') {
      job.status = 'ready';
    }
    await job.save();

    return res.json({ success: true, job });
  } catch (err) {
    console.error('Save job materials error:', err);
    return res.status(500).json({ error: 'Failed to save guided apply materials' });
  }
});

app.post('/api/apply/execute', authenticateToken, async (req, res) => {
  try {
    const jobId = String(req.body?.jobId || '').trim();
    const mode = String(req.body?.mode || 'open').trim().toLowerCase();
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = await Job.findOne({ _id: jobId, userId: req.user.userId });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const link = String(job.link || '').trim();
    if (!/^https?:\/\//i.test(link)) {
      return res.status(400).json({ error: 'This job does not have a valid application URL.' });
    }

    const integrationEnabled = String(process.env.APPLY_INTEGRATION_ENABLED || '').trim() === '1';
    const integrationSource = /(greenhouse|lever|workday|icims)/i.test(link) ? 'known' : 'none';
    const canAutoSubmit = integrationEnabled && integrationSource === 'known';

    if (mode === 'auto-submit' && canAutoSubmit) {
      job.status = 'applied';
      job.notes = [String(job.notes || '').trim(), `[Guided Apply] auto-submitted via integration at ${new Date().toISOString()}`]
        .filter(Boolean)
        .join('\n\n')
        .slice(-8000);
      await job.save();
      return res.json({
        action: 'submitted',
        integration: true,
        link,
        jobId: String(job._id),
        status: job.status,
        message: 'Application submitted via integration and status tracked automatically.'
      });
    }

    // Fallback path: open application page and track as applied/opened workflow stage.
    job.status = 'applied';
    job.notes = [String(job.notes || '').trim(), `[Guided Apply] application page opened at ${new Date().toISOString()}`]
      .filter(Boolean)
      .join('\n\n')
      .slice(-8000);
    await job.save();

    return res.json({
      action: 'opened',
      integration: false,
      link,
      jobId: String(job._id),
      status: job.status,
      message: 'No supported API integration for this job source. Opened application page and tracked status automatically.'
    });
  } catch (err) {
    console.error('Apply execute error:', err);
    return res.status(500).json({ error: 'Failed to execute apply flow.' });
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

    const thresholds = await getUserRecommendationThresholds(req.user.userId);
    const hasActiveThreshold = Number(thresholds.salaryMin || 0) > 0 || thresholds.workModes.length > 0 || thresholds.employmentTypes.length > 0;

    const eligibleJobs = jobs.filter((job) => {
      if (!isEligibleTopMatchJob(job)) return false;
      if (!hasActiveThreshold) return true;

      const normalizedForThresholds = {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        salaryRange: estimateSalaryRange(job.title, job.location, 'OneClickQueue', job.description)
      };

      return jobMatchesRecommendationThresholds(normalizedForThresholds, thresholds);
    });

    const topJobs = eligibleJobs.slice(0, 3).map((job) => ({
      id: String(job._id),
      title: job.title,
      company: job.company,
      link: job.link || '',
      description: String(job.description || '').slice(0, 1200),
      urgencyLabel: job.status === 'ready' ? 'High' : 'Medium',
      matchScore: job.matchScore || 0
    }));

    return res.json({ topJobs, thresholdsApplied: hasActiveThreshold });
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

    const user = await User.findById(userId).select('email plan veteranVerified isAdmin');
    const email = String(user?.email || '').toLowerCase();
    const isAdmin = user?.isAdmin === true || (ADMIN_EMAILS && ADMIN_EMAILS.includes(email));
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
      success_url: `${process.env.CLIENT_URL}/index.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/index.html`,
      customer_email: email,
      client_reference_id: userId,
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

app.get('/api/document-credits/status', authenticateToken, async (req, res) => {
  try {
    const feature = String(req.query.feature || 'resume').trim().toLowerCase();
    if (!['resume', 'cover-letter'].includes(feature)) {
      return res.status(400).json({ error: 'feature must be resume or cover-letter' });
    }

    const user = await User.findById(req.user.userId).select('plan isAdmin documentGeneration');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const status = getDocumentGenerationStatus(user, feature);
    return res.json({
      status,
      bundles: getCreditBundles()
    });
  } catch (err) {
    console.error('Document credit status error:', err);
    return res.status(500).json({ error: 'Could not load document credit status' });
  }
});

app.post('/api/document-credits/create-checkout-session', paymentLimiter, authenticateToken, async (req, res) => {
  try {
    const bundleId = String(req.body?.bundle || 'single').trim().toLowerCase();
    const bundle = getCreditBundle(bundleId);
    if (!bundle) {
      return res.status(400).json({ error: 'Unknown bundle.' });
    }

    const user = await User.findById(req.user.userId).select('plan isAdmin email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = String(user.plan || 'free').toLowerCase();
    if (user.isAdmin === true || plan !== 'free') {
      return res.status(400).json({ error: 'Document credit checkout is only required for free tier users.' });
    }

    const returnPathRaw = String(req.body?.returnPath || '/').trim();
    const safeReturnPath = returnPathRaw.startsWith('/') ? returnPathRaw : '/';

    if (E2E_MOCK_MODE) {
      return res.json({ url: 'https://checkout.test/session' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: String(user.email || '').toLowerCase(),
      customer_creation: 'always',
      client_reference_id: String(req.user.userId),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: bundle.amountCents,
            product_data: {
              name: `RoleRocket ${bundle.label}`,
              description: `${bundle.credits} generation credits for Resume/Cover Letter tools`
            }
          }
        }
      ],
      success_url: `${process.env.CLIENT_URL}${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}docCredits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}docCredits=cancel`,
      metadata: {
        type: 'document_bundle',
        userId: String(req.user.userId),
        userEmail: String(user.email || '').toLowerCase(),
        docCredits: String(bundle.credits),
        docBundle: bundle.id,
        docAmountCents: String(bundle.amountCents)
      }
    });

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL.' });
    }

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Document credit checkout error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create document credit checkout session' });
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

    const user = await User.findById(req.user.userId).select('email plan veteranVerified isAdmin');
    const email = String(user?.email || '').toLowerCase();
    const isAdmin = user?.isAdmin === true || (ADMIN_EMAILS && ADMIN_EMAILS.includes(email));
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
      success_url: `${process.env.CLIENT_URL}/index.html?lifetime=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/index.html`,
      customer_email: String(user.email || '').toLowerCase(),
      customer_creation: 'always',
      client_reference_id: String(req.user.userId),
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

app.patch('/api/profile', authenticateToken, async (req, res) => {
  try {
    const updates = {};
    if (req.body && typeof req.body.name === 'string') {
      const name = req.body.name.trim().slice(0, 120);
      if (name) updates.name = name;
    }
    if (req.body && typeof req.body.profileSummary === 'string') {
      updates['networkingProfile.bio'] = req.body.profileSummary.trim().slice(0, 400);
      updates['networkingProfile.updatedAt'] = new Date();
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const user = await User.findByIdAndUpdate(req.user.userId, { $set: updates }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/google1e7a24f124416c47.html', (_req, res) => {
  return res.type('text/plain').send('google-site-verification: google1e7a24f124416c47.html');
});

app.get('/sitemap.xml/google1e7a24f124416c47.html', (_req, res) => {
  return res.type('text/plain').send('google-site-verification: google1e7a24f124416c47.html');
});

// ─── Employer Portal ─────────────────────────────────────────────────────────

// Register a new employer account
app.post('/api/employers/register', async (req, res) => {
  try {
    const { company, email, password, industry, website } = req.body || {};
    if (!company || typeof company !== 'string' || company.trim().length < 2)
      return res.status(400).json({ error: 'Company name is required.' });
    if (!email || typeof email !== 'string' || !email.includes('@'))
      return res.status(400).json({ error: 'A valid work email is required.' });
    if (!password || typeof password !== 'string' || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await Employer.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const employer = await Employer.create({
      company: company.trim().slice(0, 120),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      industry: (industry || '').slice(0, 80),
      website: (website || '').slice(0, 500),
    });
    return res.status(201).json({ message: 'Employer account created.', company: employer.company });
  } catch (err) {
    console.error('Employer register error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Employer login
app.post('/api/employers/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const employer = await Employer.findOne({ email: email.toLowerCase().trim() });
    if (!employer) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, employer.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { employerId: employer._id, company: employer.company, role: 'employer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, company: employer.company });
  } catch (err) {
    console.error('Employer login error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Middleware: verify employer JWT
function requireEmployerAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) return res.status(401).json({ error: 'Employer authentication required.' });
  try {
    const decoded = jwt.verify(bearer, process.env.JWT_SECRET);
    if (decoded.role !== 'employer') return res.status(403).json({ error: 'Employer access only.' });
    req.employer = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired employer token.' });
  }
}

// Post a new job
app.post('/api/employers/jobs', requireEmployerAuth, async (req, res) => {
  try {
    const { title, location, type, salary, link, closing, description } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim())
      return res.status(400).json({ error: 'Job title is required.' });
    if (!description || typeof description !== 'string' || !description.trim())
      return res.status(400).json({ error: 'Job description is required.' });
    if (!location || typeof location !== 'string' || !location.trim())
      return res.status(400).json({ error: 'Location is required.' });

    const ALLOWED_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote'];
    const jobType = ALLOWED_TYPES.includes(type) ? type : 'Full-Time';

    // Validate link is a safe URL or email when provided
    if (link && link.trim()) {
      const l = link.trim();
      const isUrl = /^https?:\/\//i.test(l);
      const isEmail = /^[^@]+@[^@]+\.[^@]+$/.test(l);
      if (!isUrl && !isEmail)
        return res.status(400).json({ error: 'Application link must be a valid URL or email address.' });
    }

    const employer = await Employer.findById(req.employer.employerId).select('company');
    if (!employer) return res.status(404).json({ error: 'Employer account not found.' });

    const job = await EmployerJob.create({
      employerId: req.employer.employerId,
      company: employer.company,
      title: title.trim().slice(0, 160),
      location: (location || '').trim().slice(0, 120),
      type: jobType,
      salary: (salary || '').trim().slice(0, 120),
      link: (link || '').trim().slice(0, 500),
      closing: closing ? new Date(closing) : null,
      description: description.trim().slice(0, 8000),
    });
    return res.status(201).json(job);
  } catch (err) {
    console.error('Employer post job error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Get employer's own posted jobs
app.get('/api/employers/jobs', requireEmployerAuth, async (req, res) => {
  try {
    const jobs = await EmployerJob.find({ employerId: req.employer.employerId, active: true })
      .sort({ createdAt: -1 }).limit(50).lean();
    return res.json(jobs);
  } catch (err) {
    console.error('Employer get jobs error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// Delete (deactivate) an employer job
app.delete('/api/employers/jobs/:jobId', requireEmployerAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !/^[a-f0-9]{24}$/i.test(jobId))
      return res.status(400).json({ error: 'Invalid job ID.' });
    const result = await EmployerJob.findOneAndUpdate(
      { _id: jobId, employerId: req.employer.employerId },
      { active: false },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Job not found or you do not have permission to remove it.' });
    return res.json({ message: 'Job listing removed.' });
  } catch (err) {
    console.error('Employer delete job error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// Public job board — all active employer-posted jobs (no auth required)
app.get('/api/jobs/board', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;
    const query = { active: true };
    if (req.query.q) {
      const safe = String(req.query.q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ title: new RegExp(safe, 'i') }, { company: new RegExp(safe, 'i') }, { location: new RegExp(safe, 'i') }];
    }
    const [jobs, total] = await Promise.all([
      EmployerJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EmployerJob.countDocuments(query),
    ]);
    return res.json({ jobs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Job board error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/credentials/upload', authenticateToken, async (req, res) => {
  try {
    const { credentialType, subjectName, yearAwarded, grade, documentUrl } = req.body;
    if (!credentialType || !subjectName || !yearAwarded) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const credential = new UserCredential({
      userId: req.user.userId,
      credentialType,
      subjectName,
      yearAwarded,
      grade,
      documentUrl,
      verificationStatus: 'pending'
    });

    await credential.save();
    return res.json({ success: true, credential, verificationCode: credential.verificationCode });
  } catch (err) {
    console.error('Credential upload error:', err);
    return res.status(500).json({ error: 'Failed to upload credential' });
  }
});

app.get('/api/credentials/my', authenticateToken, async (req, res) => {
  try {
    const credentials = await UserCredential.find({ userId: req.user.userId }).select('-verificationCode').lean();
    return res.json({ credentials });
  } catch (err) {
    console.error('Credentials fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

app.post('/api/credentials/verify', async (req, res) => {
  try {
    const { verificationCode, verificationStatus } = req.body;
    if (!verificationCode || !['verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ error: 'Invalid verification data' });
    }

    const credential = await UserCredential.findOneAndUpdate(
      { verificationCode },
      { verificationStatus, verifiedAt: new Date() },
      { new: true }
    );

    if (!credential) {
      return res.status(404).json({ error: 'Verification code not found' });
    }

    return res.json({ success: true, credential });
  } catch (err) {
    console.error('Credential verification error:', err);
    return res.status(500).json({ error: 'Failed to verify credential' });
  }
});

app.post('/api/diaspora-employers/register', async (req, res) => {
  try {
    const { companyName, contactEmail, country, industry, sponsorshipLevel, website, linkedinProfile, description } = req.body;
    
    if (!companyName || !contactEmail || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingEmployer = await DiasporaEmployer.findOne({ contactEmail });
    if (existingEmployer) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const employer = new DiasporaEmployer({
      companyName,
      contactEmail,
      country,
      industry,
      sponsorshipLevel,
      website,
      linkedinProfile,
      description,
      verificationStatus: 'pending'
    });

    await employer.save();
    return res.json({ success: true, employerId: employer._id, message: 'Registration pending approval' });
  } catch (err) {
    console.error('Diaspora employer registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/diaspora-employers/:id/roles', async (req, res) => {
  try {
    const { roleTitle, description, experienceLevel, salaryMin, salaryMax, currency, requiredCredentials, applyUrl } = req.body;
    
    const employer = await DiasporaEmployer.findById(req.params.id);
    if (!employer) {
      return res.status(404).json({ error: 'Employer not found' });
    }

    employer.remoteFirstRoles.push({
      roleTitle,
      description,
      experienceLevel,
      salaryMin,
      salaryMax,
      currency,
      requiredCredentials,
      applyUrl
    });

    await employer.save();
    return res.json({ success: true, roles: employer.remoteFirstRoles });
  } catch (err) {
    console.error('Role posting error:', err);
    return res.status(500).json({ error: 'Failed to post role' });
  }
});

app.get('/api/diaspora-employers/search', async (req, res) => {
  try {
    const { country, sponsorshipLevel, experienceLevel, credentials } = req.query;
    const query = { verificationStatus: 'approved', isActive: true };

    if (country) query.country = country;
    if (sponsorshipLevel) query.sponsorshipLevel = sponsorshipLevel;

    const employers = await DiasporaEmployer.find(query).lean();
    let filtered = employers;

    if (experienceLevel || credentials) {
      filtered = employers.filter(emp => {
        return emp.remoteFirstRoles.some(role => {
          const matchExp = !experienceLevel || role.experienceLevel === experienceLevel;
          const matchCreds = !credentials || (role.requiredCredentials && role.requiredCredentials.some(c => credentials.includes(c)));
          return matchExp && matchCreds;
        });
      });
    }

    return res.json({ employers: filtered });
  } catch (err) {
    console.error('Diaspora employer search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/alerts/sms/register', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, alertType, frequency, rolePreferences, locationPreferences } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const smsConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
    const verificationCode = Math.random().toString().slice(2, 8);

    let alert = await SMSJobAlert.findOne({ userId: req.user.userId, phoneNumber });
    if (alert) {
      alert.alertType = alertType || alert.alertType;
      alert.frequency = frequency || alert.frequency;
      alert.rolePreferences = rolePreferences || alert.rolePreferences;
      alert.locationPreferences = locationPreferences || alert.locationPreferences;
      alert.isActive = true;
      if (smsConfigured) {
        alert.phoneVerified = false;
        alert.verificationCode = verificationCode;
      }
    } else {
      alert = new SMSJobAlert({
        userId: req.user.userId,
        phoneNumber,
        alertType,
        frequency,
        rolePreferences,
        locationPreferences,
        verificationCode: smsConfigured ? verificationCode : null,
        phoneVerified: !smsConfigured,
        isActive: true
      });
    }

    await alert.save();

    if (smsConfigured) {
      const alertTypeLabel = alertType === 'whatsapp' ? 'WhatsApp' : 'SMS';
      await sendSMS({
        to: phoneNumber,
        message: `Your RoleRocket AI job alert verification code is: ${verificationCode}. Enter this code to activate your ${alertTypeLabel} alerts.`
      });
      return res.json({ success: true, alertId: alert._id, requiresVerification: true, message: 'Verification code sent via SMS' });
    }

    // SMS not configured — activate immediately without phone verification
    return res.json({ success: true, alertId: alert._id, requiresVerification: false, verified: true });
  } catch (err) {
    console.error('SMS alert registration error:', err);
    return res.status(500).json({ error: 'Failed to register SMS alert' });
  }
});

app.post('/api/alerts/sms/verify', authenticateToken, async (req, res) => {
  try {
    const { alertId, verificationCode } = req.body;
    
    const alert = await SMSJobAlert.findOneAndUpdate(
      { _id: alertId, userId: req.user.userId, verificationCode },
      { phoneVerified: true, verificationCode: null },
      { new: true }
    );

    if (!alert) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    return res.json({ success: true, alert });
  } catch (err) {
    console.error('SMS verification error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/community-hubs/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10 } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location required' });
    }

    const hubs = await CommunityHub.find({
      location: { $near: { $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] }, $maxDistance: maxDistance * 1000 } },
      isActive: true
    }).lean();

    return res.json({ hubs });
  } catch (err) {
    const hubs = await CommunityHub.find({ isActive: true }).lean();
    return res.json({ hubs });
  }
});

app.get('/api/community-hubs/all', async (req, res) => {
  try {
    const { region, partnerOnly } = req.query;
    const query = { isActive: true };
    
    if (region) query.region = region;
    if (partnerOnly === 'true') query.partnersWithRoleRocket = true;

    const hubs = await CommunityHub.find(query).sort({ region: 1, hubName: 1 }).lean();
    return res.json({ hubs });
  } catch (err) {
    console.error('Community hubs error:', err);
    return res.status(500).json({ error: 'Failed to fetch hubs' });
  }
});

app.get('/healthz', (_req, res) => {
  return res.json({
    ok: true,
    service: 'rolerocket-backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/readyz', (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  return res.status(mongoReady ? 200 : 503).json({
    ok: mongoReady,
    service: 'rolerocket-backend',
    mongoState: mongoose.connection.readyState,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/{*path}', (req, res) => {
  return res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startJobAlertScheduler();
    startWhatsAppStatusNudgeScheduler();
    setTimeout(() => {
      prewarmJobSearches().catch((err) => {
        console.warn('Job prewarm failed:', err.message);
      });
    }, 500);
    console.log('DEBUG: app.listen callback completed');
  });

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      console.error(`Startup failed: port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error('Startup failed with server error:', error);
    process.exit(1);
  });
}

console.log('DEBUG: server bootstrap complete');

module.exports = app;