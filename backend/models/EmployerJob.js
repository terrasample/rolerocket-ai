const mongoose = require('mongoose');

const EmployerJobSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employer',
    required: true,
  },
  company: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  location: {
    type: String,
    default: '',
    trim: true,
    maxlength: 120,
  },
  type: {
    type: String,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote'],
    default: 'Full-Time',
  },
  salary: {
    type: String,
    default: '',
    maxlength: 120,
  },
  link: {
    type: String,
    default: '',
    maxlength: 500,
  },
  closing: {
    type: Date,
    default: null,
  },
  description: {
    type: String,
    default: '',
    maxlength: 8000,
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('EmployerJob', EmployerJobSchema);
