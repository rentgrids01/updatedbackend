const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  kind: {
    type: String,
    required: true,
    enum: ['percent', 'fixed']
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  maxRedemptions: {
    type: Number,
    default: null
  },
  perUserLimit: {
    type: Number,
    default: 1
  },
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

couponSchema.index({ code: 1 });
couponSchema.index({ startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Coupon', couponSchema);