const FREE_DAILY_GENERATION_LIMIT = 1;

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isUnlimitedUser(user) {
  if (!user) return false;

  const email = String(user.email || '').toLowerCase();
  if (email && (email.endsWith('@rolerocketai.com') || getAdminEmails().includes(email))) {
    return true;
  }

  return String(user.plan || 'free') !== 'free';
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getFeatureLabel(feature) {
  return feature === 'cover-letter' ? 'cover letter' : 'resume';
}

function getDailyUsageCount(user, feature, day = getTodayKey()) {
  return (user.aiGenerationUsage || []).find((entry) => entry.day === day && entry.feature === feature)?.count || 0;
}

function getDailyGenerationStatus(user, feature) {
  if (isUnlimitedUser(user)) {
    return {
      allowed: true,
      limit: null,
      used: 0,
      remaining: null,
      message: ''
    };
  }

  const used = getDailyUsageCount(user, feature);
  const remaining = Math.max(0, FREE_DAILY_GENERATION_LIMIT - used);

  return {
    allowed: used < FREE_DAILY_GENERATION_LIMIT,
    limit: FREE_DAILY_GENERATION_LIMIT,
    used,
    remaining,
    message: `Free users can generate only 1 ${getFeatureLabel(feature)} per day. Upgrade to Pro for unlimited access.`
  };
}

async function recordDailyGenerationUsage(user, feature) {
  if (!user || isUnlimitedUser(user)) return;

  const day = getTodayKey();
  const existing = (user.aiGenerationUsage || []).find((entry) => entry.day === day && entry.feature === feature);

  if (existing) {
    existing.count += 1;
  } else {
    user.aiGenerationUsage.push({ day, feature, count: 1 });
  }

  user.markModified('aiGenerationUsage');
  await user.save();
}

module.exports = {
  getDailyGenerationStatus,
  recordDailyGenerationUsage
};