// Create an institution invitation code for 30-day trial onboarding.
// Usage:
//   node scripts/create-institution-invite.js --institution "UWI Mona" --type university --trialDays 30 --maxUses 1 --expiresInDays 90

const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: process.env.NODE_ENV !== 'production'
});

const mongoose = require('mongoose');
const crypto = require('crypto');
const Institution = require('../models/Institution');
const InstitutionInvite = require('../models/InstitutionInvite');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rolerocket';

function normalizeInstitutionName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function buildCodePrefix(institutionName) {
  const compact = String(institutionName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${(compact.slice(0, 6) || 'INST')}-TRIAL`;
}

async function generateUniqueCode(institutionName, maxAttempts = 12) {
  const prefix = buildCodePrefix(institutionName);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await InstitutionInvite.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique invite code');
}

async function findOrCreateInstitutionByName(name) {
  const normalizedName = normalizeInstitutionName(name);
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
  );
}

async function main() {
  const args = parseArgs(process.argv);
  const institutionName = normalizeInstitutionName(args.institution || args.name);
  if (!institutionName) {
    throw new Error('Missing --institution "Institution Name"');
  }

  const organizationTypeRaw = String(args.type || 'institution').toLowerCase();
  const organizationType = ['university', 'workplace', 'institution', 'other'].includes(organizationTypeRaw)
    ? organizationTypeRaw
    : 'institution';
  const accessDays = Math.max(1, Math.min(365, Number(args.accessDays || args.trialDays || 30)));
  const maxUses = Math.max(1, Math.min(10000, Number(args.maxUses || 1)));
  const expiresInDays = Number.isFinite(Number(args.expiresInDays))
    ? Math.max(1, Math.min(3650, Number(args.expiresInDays)))
    : null;
  const requestedCode = normalizeInviteCode(args.code || '');

  await mongoose.connect(MONGODB_URI);

  const institution = await findOrCreateInstitutionByName(institutionName);
  const code = requestedCode || await generateUniqueCode(institution.name);

  const existing = await InstitutionInvite.findOne({ code }).select('_id').lean();
  if (existing) {
    throw new Error(`Invite code already exists: ${code}`);
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const invite = await InstitutionInvite.create({
    code,
    institutionName: institution.name,
    institutionKey: institution.key,
    institutionId: institution._id,
    organizationType,
    accessDays,
    maxUses,
    expiresAt,
    notes: String(args.notes || '').trim()
  });

  const baseUrl = String(process.env.CLIENT_URL || 'https://www.rolerocketai.com').replace(/\/$/, '');
  const signupUrl = `${baseUrl}/signup.html?institution=${encodeURIComponent(invite.institutionName)}&inviteCode=${encodeURIComponent(invite.code)}`;

  console.log('Institution invite created successfully');
  console.log('Institution:', invite.institutionName);
  console.log('Code:', invite.code);
  console.log('Organization type:', invite.organizationType);
  console.log('Access days:', invite.accessDays);
  console.log('Max uses:', invite.maxUses);
  console.log('Expires at:', invite.expiresAt ? invite.expiresAt.toISOString() : 'none');
  console.log('Signup URL:', signupUrl);

  await mongoose.disconnect();
}

main()
  .catch(async (err) => {
    console.error('Failed to create institution invite:', err.message);
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect errors in failure path.
    }
    process.exit(1);
  });
