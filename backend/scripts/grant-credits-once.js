#!/usr/bin/env node
// One-time script to grant document credits to a user by email
// Usage: node scripts/grant-credits-once.js <email> [credits]
require('dotenv').config();
const mongoose = require('mongoose');

const targetEmail = (process.argv[2] || '').toLowerCase().trim();
const creditsToGrant = Math.max(1, parseInt(process.argv[3] || '1', 10));

if (!targetEmail) {
  console.error('Usage: node scripts/grant-credits-once.js <email> [credits]');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('../models/User');

  const user = await User.findOne({ email: new RegExp('^' + targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
  if (!user) {
    console.error('USER NOT FOUND:', targetEmail);
    process.exit(1);
  }

  if (!user.documentGeneration) user.documentGeneration = {};
  const before = user.documentGeneration.paidCredits || 0;
  user.documentGeneration.paidCredits = before + creditsToGrant;
  user.documentGeneration.totalCreditsPurchased = (user.documentGeneration.totalCreditsPurchased || 0) + creditsToGrant;
  if (!user.documentGeneration.purchases) user.documentGeneration.purchases = [];
  user.documentGeneration.purchases.push({
    bundleId: 'manual-grant',
    credits: creditsToGrant,
    amountCents: null,
    currency: 'usd',
    stripeSessionId: '',
    purchasedAt: new Date(),
    note: 'Manual grant via admin script'
  });
  user.markModified('documentGeneration');
  await user.save();

  console.log('SUCCESS: Granted', creditsToGrant, 'credit(s) to', user.email);
  console.log('paidCredits before:', before, '-> now:', user.documentGeneration.paidCredits);
  process.exit(0);
}).catch(err => {
  console.error('DB error:', err.message);
  process.exit(1);
});
