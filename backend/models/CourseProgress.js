const mongoose = require('mongoose');

const CourseProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseKey: { type: String, required: true, trim: true, index: true },
    courseTitle: { type: String, required: true, trim: true },
    contentFingerprint: { type: String, default: '', trim: true },
    totalModules: { type: Number, default: 0 },
    completedModules: { type: [Number], default: [] },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

CourseProgressSchema.index({ userId: 1, courseKey: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', CourseProgressSchema);
