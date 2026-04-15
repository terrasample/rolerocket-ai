require('dotenv').config();

const { getWelcomeEmailHtml } = require('./welcome-email-template');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@rolerocketai.com';
const CLIENT_URL = process.env.CLIENT_URL || 'https://www.rolerocketai.com';

const isLive = process.argv.includes('--live');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const delayArg = process.argv.find((arg) => arg.startsWith('--delay='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 1) : 0;
const delayMs = delayArg ? Math.max(0, Number(delayArg.split('=')[1]) || 0) : 250;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment.');
  process.exit(1);
}

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 8000
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWelcomeHtml(name) {
  return getWelcomeEmailHtml(name, CLIENT_URL.replace(/\/$/, ''));
}

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const query = User.find({ email: { $exists: true, $ne: null } })
    .select('name email')
    .lean();

  if (limit > 0) {
    query.limit(limit);
  }

  const users = await query;
  const seen = new Set();
  const targets = users.filter((u) => {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return false;
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  console.log(`Campaign mode: ${isLive ? 'LIVE' : 'DRY-RUN'}`);
  console.log(`Targets: ${targets.length}`);

  let sent = 0;
  let failed = 0;

  for (const user of targets) {
    const to = String(user.email || '').trim().toLowerCase();
    const subject = 'Welcome to RoleRocket AI';
    const html = getWelcomeHtml(user.name);

    if (!isLive) {
      console.log(`[DRY-RUN] Would send to ${to}`);
      continue;
    }

    try {
      await transporter.sendMail({
        from: `"RoleRocket AI" <${SMTP_FROM}>`,
        to,
        subject,
        html
      });
      sent += 1;
      console.log(`[SENT] ${to}`);
    } catch (err) {
      failed += 1;
      console.error(`[FAILED] ${to}: ${err.message}`);
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(`Done. sent=${sent}, failed=${failed}, total=${targets.length}`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Campaign error:', err.message || err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
