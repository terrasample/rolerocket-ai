const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:   { type: String, required: true, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

const NetworkingConnectionSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status:   { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    messages: { type: [MessageSchema], default: [] }
  },
  { timestamps: true }
);

// Ensure one connection per pair (either direction)
NetworkingConnectionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('NetworkingConnection', NetworkingConnectionSchema);
