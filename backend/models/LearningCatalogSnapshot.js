const mongoose = require('mongoose');

const LearningCatalogSnapshotSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, trim: true, unique: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { type: String, required: true, trim: true },
    sourceLabel: { type: String, required: true, trim: true },
    refreshedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    lastAttemptedAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastFailureReason: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningCatalogSnapshot', LearningCatalogSnapshotSchema);