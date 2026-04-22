const mongoose = require('mongoose');

const DiasporaEmployerSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    contactPhone: {
      type: String,
      trim: true,
      default: null
    },
    country: {
      type: String,
      enum: ['USA', 'Canada', 'UK', 'EU', 'Other'],
      required: true
    },
    industry: {
      type: String,
      trim: true,
      default: 'Other'
    },
    remoteRolesAvailable: {
      type: Boolean,
      default: true
    },
    sponsorshipLevel: {
      type: String,
      enum: ['visa-sponsorship', 'work-permit', 'contract-to-hire', 'remote-only'],
      default: 'remote-only'
    },
    remoteFirstRoles: [
      {
        roleTitle: String,
        description: String,
        experienceLevel: String,
        salaryMin: Number,
        salaryMax: Number,
        currency: String,
        requiredCredentials: [String],
        applyUrl: String
      }
    ],
    logo: {
      type: String,
      default: null
    },
    website: {
      type: String,
      default: null
    },
    linkedinProfile: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: ''
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    approvalNotes: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    jobsPosted: {
      type: Number,
      default: 0
    },
    successfulHires: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    }
  },
  { timestamps: true }
);

DiasporaEmployerSchema.index({ country: 1, verificationStatus: 1 });
DiasporaEmployerSchema.index({ industry: 1, sponsorshipLevel: 1 });
DiasporaEmployerSchema.index({ isActive: 1, verificationStatus: 1 });
DiasporaEmployerSchema.index({ contactEmail: 1 }, { unique: true });

module.exports = mongoose.model('DiasporaEmployer', DiasporaEmployerSchema);
