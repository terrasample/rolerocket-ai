const mongoose = require('mongoose');

const CourseContentCacheSchema = new mongoose.Schema(
  {
    courseKey: { type: String, required: true, trim: true, unique: true, index: true },
    courseTitle: { type: String, required: true, trim: true },
    contentFingerprint: { type: String, required: true, trim: true, index: true },
    coursePayload: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

CourseContentCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CourseContentCache', CourseContentCacheSchema);