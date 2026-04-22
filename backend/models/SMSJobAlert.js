const mongoose = require('mongoose');

const SMSJobAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      default: 'Jamaica'
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    verificationCode: {
      type: String,
      default: null
    },
    verificationExpires: {
      type: Date,
      default: null
    },
    alertType: {
      type: String,
      enum: ['sms', 'whatsapp', 'both'],
      default: 'sms'
    },
    frequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'daily'
    },
    rolePreferences: [String],
    locationPreferences: [String],
    experienceLevelFilter: {
      type: String,
      enum: ['all', 'entry', 'mid', 'senior'],
      default: 'all'
    },
    credentialFilter: [String],
    minSalary: {
      type: Number,
      default: 0
    },
    remoteJobsOnly: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastAlertSent: {
      type: Date,
      default: null
    },
    alertsSent: {
      type: Number,
      default: 0
    },
    clicksReceived: {
      type: Number,
      default: 0
    },
    whatsappGroupId: {
      type: String,
      default: null
    },
    whatsappGroupName: {
      type: String,
      default: null
    },
    communityHubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityHub',
      default: null
    }
  },
  { timestamps: true }
);

SMSJobAlertSchema.index({ userId: 1, phoneVerified: 1 });
SMSJobAlertSchema.index({ phoneNumber: 1, isActive: 1 });
SMSJobAlertSchema.index({ frequency: 1, lastAlertSent: 1 });
SMSJobAlertSchema.index({ whatsappGroupId: 1 });

module.exports = mongoose.model('SMSJobAlert', SMSJobAlertSchema);
