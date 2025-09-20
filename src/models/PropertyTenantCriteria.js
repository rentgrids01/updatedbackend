const mongoose = require('mongoose');

const propertyTenantCriteriaSchema = new mongoose.Schema({
  owner:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  preferTenantType: {
    type: [String],
    enum: ['Family', 'Bachelor Male', 'Bachelor Female', 'Working Professional', 'Students']
  },
  genderPreference: {
    type: String,
    enum: ['Male', 'Female', 'Any']
  },
  languagePreference: String,
  moveInDate: Date,
  leaseDuration: String,
  numberOfOccupants: Number,
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
  notes:{
    type: String,
    maxlength: 1000,
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