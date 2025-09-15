const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSubscription'
  },
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  subtotal: {
    type: Number,
    required: true
  },
  taxPercent: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'paid', 'void', 'refunded'],
    default: 'pending'
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  dueAt: {
    type: Date,
    required: true
  },
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ invoiceNo: 1 });

// Auto-generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNo) {
    const count = await this.constructor.countDocuments();
    this.invoiceNo = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);