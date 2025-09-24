const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const socialAuthSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userType'
  },
  userType: {
    type: String,
    required: true,
    enum: ['Owner', 'Tenant']
  },
  provider: {
    type: String,
    required: true,
    enum: ['google', 'facebook']
  },
  providerId: {
    type: String,
    required: true
  },
  providerEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  providerName: String,
  providerPicture: String,
  accessToken: String, // For API calls if needed
  refreshToken: String, // For token refresh if needed
  tokenExpires: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

// Compound index to ensure one social provider per user
socialAuthSchema.index({ userId: 1, userType: 1, provider: 1 }, { unique: true });
// Index for quick provider lookups
socialAuthSchema.index({ provider: 1, providerId: 1 }, { unique: true });

// Method to check if social auth is expired
socialAuthSchema.methods.isTokenExpired = function() {
  if (!this.tokenExpires) return false;
  return new Date() > this.tokenExpires;
};

// Method to update last used timestamp
socialAuthSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  return this.save();
};

// Static method to find user by social provider
socialAuthSchema.statics.findByProvider = function(provider, providerId) {
  return this.findOne({ provider, providerId, isActive: true });
};

// Static method to find all social auths for a user
socialAuthSchema.statics.findByUser = function(userId, userType) {
  return this.find({ userId, userType, isActive: true });
};

module.exports = mongoose.model('SocialAuth', socialAuthSchema);