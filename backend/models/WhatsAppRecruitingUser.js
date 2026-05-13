const mongoose = require('mongoose');

const WhatsAppRecruitingUserSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    skills: { type: [String], default: [] },
    resumeText: { type: String, default: '' },
    targetJob: { type: String, default: '', trim: true },
    plan: {
      type: String,
        enum: ['free', 'pro', 'premium', 'elite', 'lifetime', 'business'],
      default: 'free'
    },
    jobAlertFrequency: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'daily'
    },
    optedIn: { type: Boolean, default: true },
    optedInAt: { type: Date, default: Date.now },
    optedOutAt: { type: Date, default: null },
    lastIntent: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppRecruitingUser', WhatsAppRecruitingUserSchema);
