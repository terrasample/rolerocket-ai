const mongoose = require('mongoose');

function normalizeInstitutionName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const InstitutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
      index: true
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

InstitutionSchema.pre('validate', function (next) {
  const normalized = normalizeInstitutionName(this.name);
  this.name = normalized;
  this.key = normalized.toLowerCase();
  next();
});

module.exports = mongoose.model('Institution', InstitutionSchema);
