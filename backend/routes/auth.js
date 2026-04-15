const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { loginLimiter } = require('../middleware/rateLimit');

// ----------------------
// Signup Route
// ----------------------
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);


    // Save user (set emailVerified to false, generate verification token)
    const emailVerificationToken = require('crypto').randomBytes(32).toString('hex');
    const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const user = new User({
      name,
      email,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires
    });
    await user.save();

    // Send verification email (queue)
    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
    if (typeof global.queueEmailVerificationEmail === 'function') {
      global.queueEmailVerificationEmail({ to: email, name, verifyUrl });
    }

    console.log(`✅ Signup successful for: ${email} (verification required)`);
    res.json({ success: true, message: 'Signup successful. Please verify your email before logging in.' });

  } catch (err) {
    console.error('❌ Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// ----------------------
// Login Route (with rate limiting)
// ----------------------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }


    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`⚠️ Login failed - user not found: ${email}`);
      // Log failed attempt (could be extended to DB or monitoring)
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      console.log(`⚠️ Login failed - email not verified: ${email}`);
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`⚠️ Login failed - wrong password: ${email}`);
      // Log failed attempt (could be extended to DB or monitoring)
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Return user info including plan/subscription
    console.log(`✅ Login successful: ${email}`);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        isSubscribed: user.isSubscribed,
        referralCode: user.referralCode,
        veteranVerified: user.veteranVerified
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ----------------------
// Get Current User Info (for /api/me)
// ----------------------
const authenticateToken = require('../middleware/auth');
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // If referralCode is missing, generate and save one
    if (!user.referralCode) {
      user.referralCode = (user.name?.split(' ')[0] || 'REF') + Math.floor(100000 + Math.random() * 900000);
      await user.save();
    }
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      isSubscribed: user.isSubscribed,
      referralCode: user.referralCode,
      veteranVerified: user.veteranVerified
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

module.exports = router;