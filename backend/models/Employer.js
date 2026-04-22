const mongoose = require('mongoose');

const EmployerSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  password: {
    type: String,
    required: true,
  },
  industry: {
    type: String,
    default: '',
    maxlength: 80,
  },
  website: {
    type: String,
    default: '',
    maxlength: 500,
  },
  approved: {
    type: Boolean,
    default: true, // auto-approved for now; set to false to require admin review
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Employer', EmployerSchema);
