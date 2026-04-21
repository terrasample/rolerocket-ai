const mongoose = require('mongoose');

const CourseLearningSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseKey: { type: String, required: true, trim: true, index: true },
    courseTitle: { type: String, required: true, trim: true },
    contentFingerprint: { type: String, required: true, trim: true, index: true },
    sessionToken: { type: String, required: true, trim: true, index: true },
    answers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

CourseLearningSessionSchema.index({ userId: 1, courseKey: 1 }, { unique: true });
CourseLearningSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CourseLearningSession', CourseLearningSessionSchema);