const mongoose = require('mongoose');

const preferredTenantSchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  tenantTypes: [{
    type: String,
    enum: ['Family', 'Bachelor Male', 'Bachelor Female', 'Working Professionals', 'Students']
  }],
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

preferredTenantSchema.index({ landlord: 1, property: 1 });

module.exports = mongoose.model('PreferredTenant', preferredTenantSchema);