const mongoose = require('mongoose');

const WhatsAppConversationSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    lastIntent: { type: String, default: '' },
    currentStep: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastInboundMessage: { type: String, default: '' },
    lastOutboundMessage: { type: String, default: '' },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppConversation', WhatsAppConversationSchema);
