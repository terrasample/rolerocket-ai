const mongoose = require('mongoose');

const LifetimeSaleSchema = new mongoose.Schema(
  {
    stripeSessionId: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    priceId: { type: String, default: null },
    purchasedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LifetimeSale', LifetimeSaleSchema);
