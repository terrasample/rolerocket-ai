// Script to backfill missing referral codes for all users in MongoDB
// Usage: node scripts/backfill-referral-codes.js

const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rolerocket';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const users = await User.find({ $or: [ { referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' } ] });
  console.log(`Found ${users.length} users missing referralCode.`);
  for (const user of users) {
    user.referralCode = generateReferralCode();
    await user.save();
    console.log(`Updated user ${user._id} with referralCode ${user.referralCode}`);
  }
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
