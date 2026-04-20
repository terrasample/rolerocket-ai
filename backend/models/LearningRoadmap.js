const mongoose = require('mongoose');

const LearningRoadmapSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetRole: { type: String, required: true, trim: true },
    currentLevel: { type: String, default: '', trim: true },
    timePerWeek: { type: Number, default: 5 },
    jobDescription: { type: String, required: true },
    resumeText: { type: String, default: '' },
    roadmapText: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningRoadmap', LearningRoadmapSchema);
