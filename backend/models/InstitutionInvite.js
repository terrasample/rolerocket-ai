const mongoose = require('mongoose');

const ORGANIZATION_TYPES = ['university', 'workplace', 'institution', 'other'];
const ACTIVATION_TYPES = ['trial', 'pilot', 'paid'];
const INCLUDED_PLANS = ['free', 'pro', 'premium', 'elite', 'lifetime'];

const InstitutionInviteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
      index: true
    },
    institutionName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    institutionKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
      index: true
    },
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      default: null,
      index: true
    },
    organizationType: {
      type: String,
      enum: ORGANIZATION_TYPES,
      default: 'institution'
    },
    activationType: {
      type: String,
      enum: ACTIVATION_TYPES,
      default: 'trial'
    },
    includedPlan: {
      type: String,
      enum: INCLUDED_PLANS,
      default: 'elite'
    },
    accessDays: {
      type: Number,
      default: 30,
      min: 0,
      max: 365
    },
    maxUses: {
      type: Number,
      default: 1,
      min: 1,
      max: 10000
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    expiresAt: {
      type: Date,
      default: null
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    lastUsedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

InstitutionInviteSchema.index({ institutionKey: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model('InstitutionInvite', InstitutionInviteSchema);
