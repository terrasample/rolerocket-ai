const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  matchScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['saved', 'ready', 'applied', 'interview', 'offer', 'rejected'],
    default: 'saved'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Job', JobSchema);