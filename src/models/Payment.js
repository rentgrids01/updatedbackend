const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userType: {
    type: String,
    enum: ['tenant', 'landlord'],
    required: true
  },
  visitRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitRequest'
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  method: {
    type: String,
    enum: ['upi', 'card', 'netbanking', 'wallet']
  },
  status: {
    type: String,
    enum: ['pending', 'requires_action', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  gateway: {
    type: String,
    default: 'razorpay'
  },
  gatewayPaymentId: String,
  gatewayOrderId: String,
  clientSecret: String,
  returnUrl: String,
  paidAt: Date,
  failedAt: Date,
  refundedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);