const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  responseDate: Date,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

applicationSchema.index({ tenant: 1, status: 1 });
applicationSchema.index({ landlord: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);