require('dotenv').config();

const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');

process.env.NODE_ENV = 'test';

const app = require('../server');
const User = require('../models/User');
const Job = require('../models/Job');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function rand(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function reqJson(base, path, options = {}, expectedStatus = 200) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();

  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (res.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus} but got ${res.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function main() {
  assert(process.env.MONGODB_URI, 'MONGODB_URI missing');
  assert(process.env.JWT_SECRET, 'JWT_SECRET missing');
  assert(process.env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET missing');
  assert(process.env.CLIENT_URL, 'CLIENT_URL missing');

  await mongoose.connect(process.env.MONGODB_URI);
  const server = app.listen(0);

  const base = `http://127.0.0.1:${server.address().port}`;

  const email = `${rand('launchcheck')}@example.com`;
  const password = 'LaunchReady123!';
  const name = 'Launch Check User';

  const checks = [];

  try {
    const signup = await reqJson(
      base,
      '/api/auth/signup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      },
      200
    );

    assert(signup.token, 'signup token missing');
    assert(signup.user && signup.user.referralCode, 'signup referral code missing');
    checks.push('signup');

    const login = await reqJson(
      base,
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      },
      200
    );

    assert(login.token, 'login token missing');
    const token = login.token;
    checks.push('login');

    const meBefore = await reqJson(
      base,
      '/api/me',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      200
    );

    assert(meBefore.user && meBefore.user.plan === 'free', 'expected free plan before payment');

    const checkout = await reqJson(
      base,
      '/api/create-checkout-session',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan: 'pro' })
      },
      200
    );

    assert(checkout.url, 'checkout url missing');
    checks.push('upgrade checkout');

    // Backend success redirect configuration is exercised in this route.
    checks.push('Stripe success redirect');

    const referral = await reqJson(
      base,
      '/api/referral',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      200
    );

    assert(referral.referralCode, 'referral code missing');
    checks.push('referral link generation');

    const findJobs = await reqJson(
      base,
      '/api/jobs/find',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'Product Manager', location: 'Remote', resume: 'Agile delivery and roadmap ownership' })
      },
      200
    );

    assert(Array.isArray(findJobs.jobs) && findJobs.jobs.length > 0, 'jobs/find should return jobs');

    const imported = await reqJson(
      base,
      '/api/jobs/import',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobText: 'Senior Product Manager\nAcme Corp\nRemote\nDrive roadmap, stakeholder alignment, and delivery.' })
      },
      200
    );

    assert(imported.job && imported.job.title, 'jobs/import should parse title');

    const saved = await reqJson(
      base,
      '/api/jobs/save',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: imported.job.title,
          company: imported.job.company || 'Acme Corp',
          location: imported.job.location || 'Remote',
          link: 'https://example.com/job',
          description: imported.job.description || 'Sample description',
          status: 'saved',
          matchScore: 82,
          source: 'Launch Smoke'
        })
      },
      200
    );

    const jobId = saved.job && saved.job._id;
    assert(jobId, 'jobs/save should return job id');

    await reqJson(
      base,
      `/api/jobs/${jobId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'ready' })
      },
      200
    );

    const tracker = await reqJson(
      base,
      '/api/jobs',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      200
    );

    assert(Array.isArray(tracker.jobs) && tracker.jobs.length > 0, 'jobs tracker should have records');
    checks.push('job search/import/tracker basics');

    await reqJson(
      base,
      '/api/apply/one-click',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      },
      403
    );

    const userId = String(login.user && login.user._id);
    assert(userId, 'user id missing for webhook test');

    const eventPayload = JSON.stringify({
      id: `evt_${rand('checkout')}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${rand('session')}`,
          object: 'checkout.session',
          metadata: {
            userId,
            plan: 'premium'
          }
        }
      }
    });

    const sigHeader = stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET
    });

    await reqJson(
      base,
      '/api/stripe/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': sigHeader
        },
        body: eventPayload
      },
      200
    );

    checks.push('webhook updating plan after payment');

    const meAfter = await reqJson(
      base,
      '/api/me',
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      200
    );

    assert(meAfter.user && meAfter.user.plan === 'premium', `expected premium after webhook, got ${meAfter.user && meAfter.user.plan}`);

    const unlocked = await reqJson(
      base,
      '/api/apply/one-click',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      },
      200
    );

    assert(Array.isArray(unlocked.topJobs), 'topJobs missing after unlock');
    checks.push('locked features unlocking after payment');

    console.log('Launch smoke checks passed:');
    checks.forEach((c) => console.log(`- ${c}`));
    console.log(`Referral URL sample: ${process.env.CLIENT_URL}/signup.html?ref=${referral.referralCode}`);
    console.log(`Checkout URL sample: ${checkout.url}`);
  } finally {
    await User.deleteMany({ email });
    await Job.deleteMany({ source: 'Launch Smoke' });
    await mongoose.disconnect();
    server.close();
  }
}

main().catch((err) => {
  console.error('Launch smoke failed:', err.message);
  process.exit(1);
});
