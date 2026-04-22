const mongoose = require('mongoose');
const crypto = require('crypto');

const UserCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    credentialType: {
      type: String,
      enum: ['CSEC', 'CAPE', 'HEART', 'NVQ-J', 'ASSOCIATE', 'BACHELOR', 'DIPLOMA', 'CPA', 'ACCA', 'OTHER'],
      required: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    yearAwarded: {
      type: Number,
      required: true
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'I'],
      default: null
    },
    verificationCode: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(16).toString('hex')
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    verifierEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    verifierInstitution: {
      type: String,
      trim: true,
      default: null
    },
    documentUrl: {
      type: String,
      default: null
    },
    notes: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
);

UserCredentialSchema.index({ userId: 1, credentialType: 1, verificationStatus: 1 });
UserCredentialSchema.index({ verificationCode: 1 });
UserCredentialSchema.index({ verifiedAt: 1 });

module.exports = mongoose.model('UserCredential', UserCredentialSchema);
