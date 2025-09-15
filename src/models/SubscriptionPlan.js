const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  audience: {
    type: String,
    required: true,
    enum: ['owner', 'tenant', 'both']
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  billingCycle: {
    type: String,
    required: true,
    enum: ['monthly', 'quarterly', 'yearly', 'one-time']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  setupFee: {
    type: Number,
    default: 0
  },
  trialDays: {
    type: Number,
    default: 0
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  planImage: String,
  sortOrder: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner'
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

subscriptionPlanSchema.index({ audience: 1, isPublished: 1 });
subscriptionPlanSchema.index({ code: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);