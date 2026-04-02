const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, default: '' },
    event: { type: String, required: true, index: true },
    funnel: { type: String, default: '' },
    page: { type: String, default: '' },
    variant: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    ts: { type: Date, default: Date.now, index: true }
  },
  { minimize: true }
);

module.exports = mongoose.model('Telemetry', telemetrySchema);
