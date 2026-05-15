const User = require('../models/User');

const FEATURE_KEYS = {
  resume: 'resumeFirstFreeUsed',
  'cover-letter': 'coverLetterFirstFreeUsed',
  'email-assistant': 'emailAssistantFirstFreeUsed'
};

const FEATURE_DAILY_KEYS = {
  resume: 'resumeFreeLastUsedDay',
  'cover-letter': 'coverLetterFreeLastUsedDay',
  'email-assistant': 'emailAssistantFreeLastUsedDay'
};

const CREDIT_BUNDLES = {
  single: {
    id: 'single',
    label: '1 Generation Credit',
    credits: 1,
    amountCents: 199
  },
  five: {
    id: 'five',
    label: '5 Generation Credits',
    credits: 5,
    amountCents: 699
  },
  ten: {
    id: 'ten',
    label: '10 Generation Credits',
    credits: 10,
    amountCents: 1199
  }
};

function isPaidOrAdmin(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  return String(user.plan || 'free').toLowerCase() !== 'free';
}

function normalizeFeature(feature) {
  const normalized = String(feature || '').toLowerCase();
  return (normalized === 'resume' || normalized === 'cover-letter' || normalized === 'email-assistant') ? normalized : 'resume';
}

function getUtcDayStamp(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureWallet(user) {
  if (!user.documentGeneration || typeof user.documentGeneration !== 'object') {
    user.documentGeneration = {
      paidCredits: 0,
      resumeFirstFreeUsed: false,
      coverLetterFirstFreeUsed: false,
      emailAssistantFirstFreeUsed: false,
      totalCreditsPurchased: 0,
      purchases: []
    };
  }

  if (!Number.isFinite(Number(user.documentGeneration.paidCredits))) {
    user.documentGeneration.paidCredits = 0;
  }
  if (typeof user.documentGeneration.resumeFirstFreeUsed !== 'boolean') {
    user.documentGeneration.resumeFirstFreeUsed = false;
  }
  if (typeof user.documentGeneration.coverLetterFirstFreeUsed !== 'boolean') {
    user.documentGeneration.coverLetterFirstFreeUsed = false;
  }
  if (typeof user.documentGeneration.emailAssistantFirstFreeUsed !== 'boolean') {
    user.documentGeneration.emailAssistantFirstFreeUsed = false;
  }
  if (typeof user.documentGeneration.resumeFreeLastUsedDay !== 'string') {
    user.documentGeneration.resumeFreeLastUsedDay = '';
  }
  if (typeof user.documentGeneration.coverLetterFreeLastUsedDay !== 'string') {
    user.documentGeneration.coverLetterFreeLastUsedDay = '';
  }
  if (typeof user.documentGeneration.emailAssistantFreeLastUsedDay !== 'string') {
    user.documentGeneration.emailAssistantFreeLastUsedDay = '';
  }
  if (!Number.isFinite(Number(user.documentGeneration.totalCreditsPurchased))) {
    user.documentGeneration.totalCreditsPurchased = 0;
  }
  if (!Array.isArray(user.documentGeneration.purchases)) {
    user.documentGeneration.purchases = [];
  }
}

function getDocumentGenerationStatus(user, feature) {
  const normalizedFeature = normalizeFeature(feature);
  const dailyKey = FEATURE_DAILY_KEYS[normalizedFeature];
  const unlimited = isPaidOrAdmin(user);

  if (unlimited) {
    return {
      feature: normalizedFeature,
      unlimited: true,
      canGenerate: true,
      requiresPayment: false,
      freeRemaining: null,
      paidCredits: null,
      usedCredits: null,
      totalCreditsPurchased: null,
      nextChargeUsd: null
    };
  }

  ensureWallet(user);
  const today = getUtcDayStamp();
  const freeUsedToday = String(user.documentGeneration[dailyKey] || '') === today;
  const paidCredits = Math.max(0, Number(user.documentGeneration.paidCredits || 0));
  const totalCreditsPurchased = Math.max(0, Number(user.documentGeneration.totalCreditsPurchased || 0));
  const usedCredits = Math.max(0, totalCreditsPurchased - paidCredits);
  const freeRemaining = freeUsedToday ? 0 : 1;
  const canGenerate = freeRemaining > 0 || paidCredits > 0;

  return {
    feature: normalizedFeature,
    unlimited: false,
    canGenerate,
    requiresPayment: !canGenerate,
    freeRemaining,
    paidCredits,
    usedCredits,
    totalCreditsPurchased,
    nextChargeUsd: 1.99
  };
}

async function consumeDocumentGeneration(user, feature) {
  const normalizedFeature = normalizeFeature(feature);
  const featureFlag = FEATURE_KEYS[normalizedFeature];
  const dailyKey = FEATURE_DAILY_KEYS[normalizedFeature];

  if (isPaidOrAdmin(user)) {
    return {
      source: 'plan',
      charged: false,
      status: getDocumentGenerationStatus(user, normalizedFeature)
    };
  }

  ensureWallet(user);
  const today = getUtcDayStamp();
  const freeUsedToday = String(user.documentGeneration[dailyKey] || '') === today;
  const paidCredits = Math.max(0, Number(user.documentGeneration.paidCredits || 0));

  if (!freeUsedToday) {
    user.documentGeneration[dailyKey] = today;
    // Keep legacy flags true once feature has ever been used for compatibility.
    user.documentGeneration[featureFlag] = true;
    user.markModified('documentGeneration');
    await user.save();
    return {
      source: 'first-free',
      charged: false,
      status: getDocumentGenerationStatus(user, normalizedFeature)
    };
  }

  if (paidCredits > 0) {
    user.documentGeneration.paidCredits = paidCredits - 1;
    user.markModified('documentGeneration');
    await user.save();
    return {
      source: 'credit',
      charged: true,
      status: getDocumentGenerationStatus(user, normalizedFeature)
    };
  }

  const status = getDocumentGenerationStatus(user, normalizedFeature);
  const error = new Error('No document credits remaining. Buy a bundle to continue.');
  error.code = 'DOC_CREDIT_REQUIRED';
  error.statusCode = 402;
  error.status = status;
  throw error;
}

function getCreditBundles() {
  return Object.values(CREDIT_BUNDLES);
}

function getCreditBundle(bundleId) {
  return CREDIT_BUNDLES[String(bundleId || '').toLowerCase()] || null;
}

async function grantDocumentCreditsFromCheckout({
  userId,
  credits,
  bundleId,
  amountCents,
  currency,
  stripeSessionId
}) {
  if (!userId || !Number.isFinite(Number(credits)) || Number(credits) <= 0) return;

  const user = await User.findById(userId);
  if (!user) return;

  ensureWallet(user);

  if (stripeSessionId) {
    const alreadyProcessed = user.documentGeneration.purchases.some(
      (purchase) => String(purchase.stripeSessionId || '') === String(stripeSessionId)
    );
    if (alreadyProcessed) return;
  }

  const grantCount = Math.max(1, Number(credits));
  user.documentGeneration.paidCredits = Math.max(0, Number(user.documentGeneration.paidCredits || 0)) + grantCount;
  user.documentGeneration.totalCreditsPurchased = Math.max(0, Number(user.documentGeneration.totalCreditsPurchased || 0)) + grantCount;
  user.documentGeneration.purchases.push({
    bundleId: String(bundleId || 'custom').slice(0, 50),
    credits: grantCount,
    amountCents: Number.isFinite(Number(amountCents)) ? Number(amountCents) : null,
    currency: String(currency || 'usd').toLowerCase(),
    stripeSessionId: stripeSessionId ? String(stripeSessionId) : '',
    purchasedAt: new Date()
  });

  user.markModified('documentGeneration');
  await user.save();
}

module.exports = {
  getDocumentGenerationStatus,
  consumeDocumentGeneration,
  getCreditBundles,
  getCreditBundle,
  grantDocumentCreditsFromCheckout
};