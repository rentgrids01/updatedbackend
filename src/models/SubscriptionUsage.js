const mongoose = require('mongoose');

const subscriptionUsageSchema = new mongoose.Schema({
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription',
    required: true
  },
  metric: {
    type: String,
    required: true
  },
  used: {
    type: Number,
    default: 0
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

subscriptionUsageSchema.index({ subscriptionId: 1, metric: 1, periodStart: 1 });

module.exports = mongoose.model('SubscriptionUsage', subscriptionUsageSchema);