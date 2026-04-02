const mongoose = require('mongoose');

const RoleProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    profileName: {
      type: String,
      default: 'Primary Profile',
      trim: true
    },
    targetRole: {
      type: String,
      default: '',
      trim: true
    },
    targetLocation: {
      type: String,
      default: 'Remote',
      trim: true
    },
    salaryTarget: {
      type: String,
      default: '',
      trim: true
    },
    industries: [{ type: String, trim: true }],
    coreSkills: [{ type: String, trim: true }],
    workPreference: {
      type: String,
      enum: ['remote', 'hybrid', 'onsite', 'flexible'],
      default: 'flexible'
    },
    seniority: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
      default: 'mid'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoleProfile', RoleProfileSchema);
