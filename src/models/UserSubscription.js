const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  audience: {
    type: String,
    required: true,
    enum: ['owner', 'tenant']
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'],
    default: 'trialing'
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: Date,
  pausedAt: Date,
  resumeAt: Date,
  prorationBehavior: {
    type: String,
    enum: ['create_prorations', 'none'],
    default: 'create_prorations'
  },
  gateway: {
    type: String,
    default: 'razorpay'
  },
  gatewayCustomerId: String,
  gatewaySubscriptionId: String,
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  metadata: {
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

userSubscriptionSchema.index({ userId: 1, audience: 1 });
userSubscriptionSchema.index({ status: 1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);