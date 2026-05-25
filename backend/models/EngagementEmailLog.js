'use strict';
const mongoose = require('mongoose');

const EngagementEmailLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    emailType: {
      type: String,
      required: true,
      enum: ['day3_nudge', 'day7_reengagement', 'day30_winback'],
      index: true
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  }
);

EngagementEmailLogSchema.index({ userId: 1, emailType: 1, sentAt: -1 });

module.exports = mongoose.model('EngagementEmailLog', EngagementEmailLogSchema);
