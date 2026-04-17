const mongoose = require('mongoose');

const JobAlertResultSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, default: '' },
    title: { type: String, default: '' },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    link: { type: String, default: '' },
    description: { type: String, default: '' },
    source: { type: String, default: '' },
    postedAt: { type: Date, default: null },
    matchScore: { type: Number, default: 0 },
    whyMatched: { type: [String], default: [] }
  },
  { _id: false }
);

const JobAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    titles: { type: [String], default: [] },
    location: { type: String, default: 'Remote' },
    workModes: { type: [String], default: [] },
    employmentTypes: { type: [String], default: [] },
    seniorityLevels: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    includeKeywords: { type: [String], default: [] },
    excludeKeywords: { type: [String], default: [] },
    excludedCompanies: { type: [String], default: [] },
    salaryMin: { type: Number, default: null },
    frequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly'],
      default: 'daily'
    },
    emailEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    includeSimilarTitles: { type: Boolean, default: true },
    isPaused: { type: Boolean, default: false },
    resumeSource: {
      type: String,
      enum: ['dashboard', 'upload', 'none'],
      default: 'none'
    },
    resumeText: { type: String, default: '' },
    resumeLabel: { type: String, default: '' },
    lastCheckedAt: { type: Date, default: null },
    lastMatchCount: { type: Number, default: 0 },
    newJobsFoundCount: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    latestResults: { type: [JobAlertResultSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobAlert', JobAlertSchema);