const mongoose = require('mongoose');

const IntegrationAuditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    targetType: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    targetId: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    layer: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    institutionName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 180
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    actorEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true
    },
    actorPlan: {
      type: String,
      default: '',
      trim: true
    },
    ip: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

IntegrationAuditLogSchema.index({ createdAt: -1, action: 1 });

module.exports = mongoose.model('IntegrationAuditLog', IntegrationAuditLogSchema);
