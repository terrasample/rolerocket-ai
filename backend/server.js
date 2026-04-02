require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');
const Stripe = require('stripe');

const { runATSAnalysis } = require('./services/atsScorer');

const User = require('./models/User');
const Resume = require('./models/Resume');
const Job = require('./models/Job');

const app = express();
const PORT = process.env.PORT || 5000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const LIFETIME_PRICE_ID = process.env.STRIPE_LIFETIME_PRICE_ID || '';
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || '';
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID || '';

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

const JOB_CACHE_MS = 1000 * 60 * 5;
const jobSearchCache = new Map();

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
app.use(express.static(path.join(__dirname, '../frontend')));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

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

function normalizeJob(raw) {
  return {
    title: raw.title || 'Untitled Job',
    company: raw.company || 'Unknown Company',
    location: raw.location || 'Remote',
    link: raw.link || '#',
    description: raw.description || '',
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

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return res.json();
}

async function fetchAdzunaJobs(title, location, resume) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const url = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1?app_id=${encodeURIComponent(
    ADZUNA_APP_ID
  )}&app_key=${encodeURIComponent(ADZUNA_APP_KEY)}&results_per_page=10&what=${encodeURIComponent(
    title
  )}&where=${encodeURIComponent(location)}&content-type=application/json`;

  const json = await fetchJson(url);
  const results = Array.isArray(json.results) ? json.results : [];

  return results.map((job) =>
    normalizeJob({
      title: job.title,
      company: job.company?.display_name || 'Unknown Company',
      location: job.location?.display_name || location,
      link: job.redirect_url || '#',
      description: job.description || '',
      matchScore: estimateMatchScore(job.title, job.description, resume),
      source: 'Adzuna'
    })
  );
}

async function fetchGreenhouseJobs(title, location, resume) {
  if (!GREENHOUSE_BOARDS.length) return [];

  const boardCalls = GREENHOUSE_BOARDS.map(async (board) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;
    const json = await fetchJson(url);
    const jobs = Array.isArray(json.jobs) ? json.jobs : [];

    return jobs
      .filter((job) => {
        const text = `${job.title || ''} ${(job.location?.name || '')}`.toLowerCase();
        return text.includes(title.toLowerCase()) || !title.trim();
      })
      .slice(0, 5)
      .map((job) =>
        normalizeJob({
          title: job.title,
          company: board,
          location: job.location?.name || location || 'Remote',
          link: job.absolute_url || '#',
          description: '',
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
    const jobs = await fetchJson(url);

    return (Array.isArray(jobs) ? jobs : [])
      .filter((job) => {
        const text = `${job.text || ''} ${(job.categories?.location || '')}`.toLowerCase();
        return text.includes(title.toLowerCase()) || !title.trim();
      })
      .slice(0, 5)
      .map((job) =>
        normalizeJob({
          title: job.text,
          company: board,
          location: job.categories?.location || location || 'Remote',
          link: job.hostedUrl || '#',
          description: '',
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

async function searchJobsFast({ title, location, resume }) {
  const cacheKey = `${title}::${location}::${resume || ''}`.toLowerCase().trim();
  const cached = jobSearchCache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) {
    return { jobs: cached.jobs, fromCache: true };
  }

  const settled = await Promise.allSettled([
    timeoutPromise(fetchAdzunaJobs(title, location, resume), 3500),
    timeoutPromise(fetchGreenhouseJobs(title, location, resume), 2500),
    timeoutPromise(fetchLeverJobs(title, location, resume), 2500)
  ]);

  const combined = [];
  settled.forEach((r) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      combined.push(...r.value);
    }
  });

  const jobs = dedupeJobs(combined).slice(0, 15);
  const finalJobs = jobs.length ? jobs : buildMockJobs(title, location);

  jobSearchCache.set(cacheKey, {
    createdAt: Date.now(),
    jobs: finalJobs
  });

  return { jobs: finalJobs, fromCache: false };
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
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newReferralCode = generateReferralCode();
    while (await User.findOne({ referralCode: newReferralCode })) {
      newReferralCode = generateReferralCode();
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      isSubscribed: false,
      plan: 'free',
      referralCode: newReferralCode,
      referredBy: referralCode || null
    });

    if (referralCode) {
      const refUser = await User.findOne({ referralCode: referralCode.toUpperCase() });

      if (refUser) {
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
      }
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
        isSubscribed: user.isSubscribed,
        plan: user.plan,
        referralCode: user.referralCode,
        referralCount: user.referralCount
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
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
        isSubscribed: user.isSubscribed,
        plan: user.plan,
        referralCode: user.referralCode,
        referralCount: user.referralCount
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('User load error:', err);
    return res.status(500).json({ error: 'Failed to load user' });
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

app.post('/api/jobs/find', authenticateToken, async (req, res) => {
  try {
    const { title, location, resume } = req.body;

    if (!title || !location) {
      return res.status(400).json({ error: 'title and location are required' });
    }

    const { jobs, fromCache } = await searchJobsFast({ title, location, resume });

    return res.json({
      jobs,
      meta: {
        fromCache,
        linkedinSearchUrl: makeLinkedInSearchUrl(title, location),
        googleJobsUrl: makeGoogleJobsUrl(title, location)
      }
    });
  } catch (err) {
    console.error('Find jobs error:', err);
    return res.status(500).json({ error: 'Failed to find jobs' });
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

app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'plan is required' });
    }

    const normalizedPlan = String(plan).toLowerCase().trim();

    const planToPriceMap = {
      pro: PRO_PRICE_ID,
      premium: PREMIUM_PRICE_ID,
      elite: ELITE_PRICE_ID
    };

    const priceId = planToPriceMap[normalizedPlan];

    if (!priceId) {
      return res.status(400).json({ error: 'Unknown plan. Check your .env Stripe price IDs.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/dashboard.html?success=true`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard.html`,
      metadata: {
        userId: req.user.userId,
        plan: normalizedPlan
      },
      subscription_data: {
        metadata: {
          userId: req.user.userId,
          plan: normalizedPlan
        }
      }
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Subscription checkout error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

app.post('/api/create-lifetime-checkout', authenticateToken, async (req, res) => {
  try {
    if (!LIFETIME_PRICE_ID) {
      return res.status(400).json({ error: 'Missing STRIPE_LIFETIME_PRICE_ID' });
    }

    const price = await stripe.prices.retrieve(LIFETIME_PRICE_ID, {
      expand: ['product']
    });

    if (!price.active) {
      return res.status(400).json({ error: 'Lifetime price is not active in Stripe.' });
    }

    if (price.type !== 'one_time') {
      return res.status(400).json({
        error: `Lifetime price must be a one-time price, but Stripe says it is "${price.type}".`
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: LIFETIME_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/dashboard.html?lifetime=true`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard.html`,
      metadata: {
        userId: req.user.userId,
        type: 'lifetime'
      }
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Lifetime checkout error:', err);
    return res.status(500).json({ error: err.message || 'Lifetime checkout failed' });
  }
});

app.get('/{*path}', (req, res) => {
  return res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});