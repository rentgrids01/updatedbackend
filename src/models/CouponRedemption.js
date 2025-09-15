const mongoose = require('mongoose');

const couponRedemptionSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription'
  },
  redeemedAt: {
    type: Date,
    default: Date.now
  }
});

couponRedemptionSchema.index({ couponId: 1, userId: 1 });

module.exports = mongoose.model('CouponRedemption', couponRedemptionSchema);