const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const tenantSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  emailId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phonenumber: {
    type: String,
    required: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  profilePhoto: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  dob: Date,
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  preferredTenantType: {
    type: String,
    enum: ['Bachelor', 'Family', 'Working Professional', 'Student']
  },
  moveInDate: Date,
  leaseDuration: String,
  petsAllowed: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No'
  },
  smokingAllowed: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No'
  },
  languagePreference: String,
  agePreference: String,
  address: String,
  personalDetails: {
    age: Number,
    employer: String,
    occupation: String,
    monthlyIncome: Number
  },
  propertyPreferences: {
    bhkType: {
      type: String,
      enum: ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', '5BHK+']
    },
    furnishingType: {
      type: String,
      enum: ['furnished', 'semi-furnished', 'unfurnished']
    },
    amenities: [String],
    occupants: Number,
    budgetMin: Number,
    budgetMax: Number,
    location: String,
    leaseDuration: String,
    moveInDate: Date
  },
  documents: [{
    docType: String,
    docUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: String,
  videoIntroUrl: String,
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

tenantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

tenantSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Tenant', tenantSchema);