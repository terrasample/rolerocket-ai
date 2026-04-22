const mongoose = require('mongoose');

const CommunityHubSchema = new mongoose.Schema(
  {
    hubName: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    region: {
      type: String,
      enum: ['Kingston', 'St. Andrew', 'St. Catherine', 'Manchester', 'Clarendon', 'Portland', 'St. Mary', 'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland'],
      default: null
    },
    latitude: Number,
    longitude: Number,
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    contactPerson: {
      type: String,
      trim: true,
      default: null
    },
    accessType: {
      type: String,
      enum: ['free', 'donation', 'membership'],
      default: 'free'
    },
    hubType: {
      type: String,
      enum: ['library', 'vocational-center', 'ngo', 'community-center', 'school', 'other'],
      default: 'community-center'
    },
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    },
    facilities: [String],
    trainingPrograms: [String],
    computerAccess: {
      type: Boolean,
      default: true
    },
    internetBandwidth: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    staffCount: {
      type: Number,
      default: 1
    },
    partnersWithRoleRocket: {
      type: Boolean,
      default: false
    },
    qrCode: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: ''
    },
    logo: {
      type: String,
      default: null
    },
    yearsActive: {
      type: Number,
      default: 1
    },
    communityServed: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

CommunityHubSchema.index({ location: 1, region: 1 });
CommunityHubSchema.index({ latitude: 1, longitude: 1 });
CommunityHubSchema.index({ partnersWithRoleRocket: 1, isActive: 1 });

module.exports = mongoose.model('CommunityHub', CommunityHubSchema);
