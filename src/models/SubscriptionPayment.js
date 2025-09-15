const mongoose = require('mongoose');

const subscriptionPaymentSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  gateway: {
    type: String,
    required: true,
    default: 'razorpay'
  },
  gatewayPaymentId: String,
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    required: true,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'created'
  },
  failureReason: String,
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

subscriptionPaymentSchema.index({ invoiceId: 1 });
subscriptionPaymentSchema.index({ gatewayPaymentId: 1 });

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);