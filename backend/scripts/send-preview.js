/**
 * Send a preview welcome email to any address.
 * Usage: node scripts/send-preview.js --to=you@example.com
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const { getWelcomeEmailHtml } = require('./welcome-email-template');

const toArg = process.argv.find((a) => a.startsWith('--to='));
if (!toArg) {
  console.error('Usage: node scripts/send-preview.js --to=email@example.com');
  process.exit(1);
}
const TO = toArg.split('=')[1].trim();

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CLIENT_URL = 'https://www.rolerocketai.com' } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('SMTP not configured.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000
});

const html = getWelcomeEmailHtml('Prince', CLIENT_URL.replace(/\/$/, ''));

transporter.sendMail({
  from: `"RoleRocket AI" <${process.env.SMTP_FROM || 'noreply@rolerocketai.com'}>`,
  to: TO,
  subject: 'Welcome to RoleRocket AI, Prince 🚀',
  html
}).then(() => {
  console.log(`[SENT] Preview delivered to ${TO}`);
  process.exit(0);
}).catch((err) => {
  console.error(`[FAILED] ${err.message}`);
  process.exit(1);
});
