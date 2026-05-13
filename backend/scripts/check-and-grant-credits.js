#!/usr/bin/env node

/**
 * Script to check customer credit balance and manually grant credits if webhook failed.
 * Usage: node scripts/check-and-grant-credits.js <email> [credits-to-grant]
 */

const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  override: process.env.NODE_ENV !== 'production'
});

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.argv[2];
  const creditsToGrant = parseInt(process.argv[3]) || 0;

  if (!email) {
    console.error('Usage: node scripts/check-and-grant-credits.js <email> [credits-to-grant]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      'email name plan documentGeneration createdAt'
    );

    if (!user) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    console.log(`\n📧 Customer Found:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    console.log(`   Plan: ${user.plan || 'free'}`);
    console.log(`   Account Created: ${user.createdAt}`);

    const docGen = user.documentGeneration || {};
    console.log(`\n💳 Document Credits Status:`);
    console.log(`   Paid Credits: ${docGen.paidCredits || 0}`);
    console.log(`   Total Purchased: ${docGen.totalCreditsPurchased || 0}`);
    console.log(`   Resume Free Used: ${docGen.resumeFirstFreeUsed ? 'Yes' : 'No'}`);
    console.log(`   Cover Letter Free Used: ${docGen.coverLetterFirstFreeUsed ? 'Yes' : 'No'}`);

    if (docGen.purchases && docGen.purchases.length) {
      console.log(`\n📋 Purchase History:`);
      docGen.purchases.forEach((p, idx) => {
        console.log(`   [${idx + 1}] Bundle: ${p.bundleId}, Credits: ${p.credits}, Amount: ${p.amountCents / 100}${p.currency?.toUpperCase() || 'USD'}`);
        console.log(`       Stripe Session: ${p.stripeSessionId || 'N/A'}`);
        console.log(`       Date: ${p.purchasedAt}`);
      });
    } else {
      console.log(`\n📋 Purchase History: None`);
    }

    // Grant credits if requested
    if (creditsToGrant > 0) {
      if (!user.documentGeneration) {
        user.documentGeneration = {
          paidCredits: 0,
          resumeFirstFreeUsed: false,
          coverLetterFirstFreeUsed: false,
          totalCreditsPurchased: 0,
          purchases: []
        };
      }

      if (!Array.isArray(user.documentGeneration.purchases)) {
        user.documentGeneration.purchases = [];
      }

      const grantCount = Math.max(1, Math.floor(creditsToGrant));
      user.documentGeneration.paidCredits = (Number(user.documentGeneration.paidCredits) || 0) + grantCount;
      user.documentGeneration.totalCreditsPurchased = (Number(user.documentGeneration.totalCreditsPurchased) || 0) + grantCount;

      user.documentGeneration.purchases.push({
        bundleId: 'admin-manual-grant',
        credits: grantCount,
        amountCents: 0,
        currency: 'usd',
        stripeSessionId: '',
        note: `Manual admin grant to fix webhook failure - ${new Date().toISOString()}`,
        purchasedAt: new Date()
      });

      user.markModified('documentGeneration');
      await user.save();

      console.log(`\n✅ Granted ${grantCount} credits to ${user.email}`);
      console.log(`   New Balance: ${user.documentGeneration.paidCredits}`);
    } else {
      console.log(`\n💡 To grant credits, run: node scripts/check-and-grant-credits.js ${email} <number-of-credits>`);
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main();
