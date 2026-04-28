const mongoose = require('mongoose');

const PlacementOutcomeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employer',
      default: null,
      index: true
    },
    diasporaEmployerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiasporaEmployer',
      default: null,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    sourceLayer: {
      type: String,
      enum: ['school', 'university', 'government-program', 'employer', 'self-service'],
      default: 'self-service',
      index: true
    },
    institutionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160
    },
    roleTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    status: {
      type: String,
      enum: ['applied', 'screening', 'interview', 'offered', 'hired', 'retained-90'],
      default: 'applied',
      index: true
    },
    salaryAmount: {
      type: Number,
      default: null,
      min: 0
    },
    salaryCurrency: {
      type: String,
      default: 'JMD',
      trim: true,
      maxlength: 10
    },
    country: {
      type: String,
      default: 'Jamaica',
      trim: true,
      maxlength: 80
    },
    notes: {
      type: String,
      default: '',
      maxlength: 2000
    },
    hiredAt: {
      type: Date,
      default: null
    },
    retainedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

PlacementOutcomeSchema.index({ sourceLayer: 1, status: 1, createdAt: -1 });
PlacementOutcomeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlacementOutcome', PlacementOutcomeSchema);
