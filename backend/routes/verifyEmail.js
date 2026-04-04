const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) {
    return res.status(400).json({ error: 'Invalid verification link.' });
  }
  try {
    const user = await User.findOne({ email, emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link.' });
    }
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email already verified.' });
    }
    if (user.emailVerificationExpires && user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({ error: 'Verification link expired.' });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: 'Server error during email verification.' });
  }
});

module.exports = router;
