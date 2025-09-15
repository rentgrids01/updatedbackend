const mongoose = require('mongoose');

const propertyTenantCriteriaSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  preferTenantType: {
    type: String,
    enum: ['Family', 'Bachelor Male', 'Bachelor Female', 'Working Professionals', 'Students']
  },
  genderPreference: {
    type: String,
    enum: ['Male', 'Female', 'Any']
  },
  languagePreference: String,
  moveInDate: Date,
  leaseDuration: String,
  noOfOccupants: Number,
  agePreference: String,
  petsAllowed: {
    type: Boolean,
    default: false
  },
  smokingAllowed: {
    type: Boolean,
    default: false
  },
  coupleFriendly: {
    type: Boolean,
    default: false
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

propertyTenantCriteriaSchema.index({ property: 1 });

module.exports = mongoose.model('PropertyTenantCriteria', propertyTenantCriteriaSchema);