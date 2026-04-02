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
    referralCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);