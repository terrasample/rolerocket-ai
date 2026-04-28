const mongoose = require('mongoose');

const IntegrationAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    layer: {
      type: String,
      enum: ['schools', 'universities', 'government', 'employers'],
      required: true,
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
    role: {
      type: String,
      enum: ['viewer', 'analyst', 'manager', 'admin'],
      default: 'viewer'
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

IntegrationAccessSchema.index({ userId: 1, layer: 1, institutionKey: 1 }, { unique: true });

IntegrationAccessSchema.pre('validate', function (next) {
  this.institutionKey = String(this.institutionName || '').trim().toLowerCase();
  next();
});

module.exports = mongoose.model('IntegrationAccess', IntegrationAccessSchema);
