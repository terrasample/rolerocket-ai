const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },

    isSubscribed: { type: Boolean, default: false },
    plan: {
      type: String,
      enum: ['free', 'pro', 'premium', 'elite', 'lifetime'],
      default: 'free'
    },

    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },

    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    emailVerified: { type: Boolean, default: true },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },

    veteranVerified: { type: Boolean, default: false },
    veteranVerifiedAt: { type: Date, default: null },
    veteranDiscountPopupSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);