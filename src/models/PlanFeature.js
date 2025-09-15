const mongoose = require('mongoose');

const planFeatureSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  featureKey: {
    type: String,
    required: true
  },
  featureValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

planFeatureSchema.index({ planId: 1, featureKey: 1 }, { unique: true });

module.exports = mongoose.model('PlanFeature', planFeatureSchema);