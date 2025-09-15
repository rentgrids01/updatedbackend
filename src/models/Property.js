const mongoose = require('mongoose');

// Function to generate unique property ID
const generatePropertyId = () => {
  const prefix = 'RENT';
  const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6 digit number
  return `${prefix}${randomNum}`;
};

const propertySchema = new mongoose.Schema({
  propertyId: {
    type: String,
    unique: true,
    default: generatePropertyId
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Owner',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['apartment', 'house', 'villa', 'studio', 'pg', 'hostel']
  },
  listingType: {
    type: String,
    required: true,
    enum: ['rent', 'sale']
  },
  monthlyRent: {
    type: Number,
    required: function() { return this.listingType === 'rent'; }
  },
  salePrice: {
    type: Number,
    required: function() { return this.listingType === 'sale'; }
  },
  securityDeposit: Number,
  maintenanceCharge: Number,
  area: {
    type: Number,
    required: true
  },
  areaUnit: {
    type: String,
    enum: ['sqft', 'sqm'],
    default: 'sqft'
  },
  bedroom: {
    type: Number,
    required: true
  },
  bathroom: {
    type: Number,
    required: true
  },
  balcony: Number,
  bhk: {
    type: String,
    required: true,
    enum: ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '5BHK+']
  },
  floorNo: Number,
  totalFloors: Number,
  furnishType: {
    type: String,
    enum: ['furnished', 'semi-furnished', 'unfurnished'],
    required: true
  },
  availableFrom: Date,
  availableFor: {
    type: String,
    enum: ['Family', 'Bachelor Male', 'Bachelor Female', 'Anyone']
  },
  location: {
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    locality: {
      type: String,
      required: true
    },
    landmark: String,
    zipcode: String,
    fullAddress: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  features: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feature'
  }],
  amenities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Amenity'
  }],
  images: [String],
  documents: [String],
  status: {
    type: String,
    enum: ['request', 'draft', 'published', 'rented', 'sold', 'inactive'],
    default: 'request'
  },
  views: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
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

propertySchema.index({ 'location.city': 1, monthlyRent: 1, bhk: 1 });
propertySchema.index({ owner: 1, status: 1 });
propertySchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Property', propertySchema);