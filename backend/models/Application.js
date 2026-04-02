const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  userId: String,
  jobTitle: String,
  company: String,
  status: {
    type: String,
    default: 'applied'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Application', ApplicationSchema);
