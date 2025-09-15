const mongoose = require('mongoose');

const savedPropertySchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  savedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['saved', 'applied', 'visited', 'rejected'],
    default: 'saved'
  },
  notes: String
});

savedPropertySchema.index({ tenant: 1 });
savedPropertySchema.index({ tenant: 1, property: 1 }, { unique: true });

module.exports = mongoose.model('SavedProperty', savedPropertySchema);