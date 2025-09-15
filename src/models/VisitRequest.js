const mongoose = require('mongoose');

const visitRequestSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  status: {
    type: String,
    enum: ['submitted', 'profile_verified', 'landlord_reviewing', 'visit_requested', 'landlord_approved', 'landlord_rejected', 'tenant_confirmed', 'scheduled', 'completed', 'cancelled_by_tenant', 'cancelled_by_landlord', 'expired_auto_reject'],
    default: 'submitted'
  },
  preferredSlots: [{
    start: Date,
    end: Date
  }],
  selectedSlot: {
    slotId: String,
    start: Date,
    end: Date
  },
  coApplicants: [{
    name: String,
    email: String,
    phone: String
  }],
  consents: {
    terms: Boolean,
    pdpa: Boolean
  },
  progress: {
    type: Number,
    default: 0
  },
  paymentRequired: {
    type: Boolean,
    default: true
  },
  paymentAmount: {
    type: Number,
    default: 199
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'requires_action', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: String,
  reasonCode: String,
  reasonText: String,
  scheduledDate: Date,
  scheduledTime: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

visitRequestSchema.index({ landlord: 1, status: 1 });
visitRequestSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('VisitRequest', visitRequestSchema);