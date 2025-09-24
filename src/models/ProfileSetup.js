const mongoose = require("mongoose");

const profileSetupSchema = new mongoose.Schema({
  setupId: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return 'setup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true
  },
  userType: {
    type: String,
    default: "tenant",
    enum: ["tenant", "owner"]
  },
  currentStep: {
    type: String,
    enum: [
      "INITIALIZATION",
      "PERSONAL_DETAILS", 
      "AVATAR_SELECTION",
      "PROFILE_PHOTO",
      "PROFILE_COMPLETION",
      "ID_UPLOAD",
      "FINALIZATION",
      "COMPLETED"
    ],
    default: "INITIALIZATION"
  },
  stepsCompleted: [{
    type: String,
    enum: [
      "INITIALIZATION",
      "PERSONAL_DETAILS", 
      "AVATAR_SELECTION",
      "PROFILE_PHOTO", 
      "PROFILE_COMPLETION",
      "ID_UPLOAD",
      "FINALIZATION"
    ]
  }],
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  personalDetails: {
    fullName: String,
    email: String,
    contact: String,
    dateOfBirth: String,
    age: String,
    propertyType: String
  },
  avatar: {
    type: {
      type: String,
      enum: ["selected", "uploaded"],
      default: "selected"
    },
    avatarId: Number,
    imageUrl: String,
    uploadedImagePath: String
  },
  profilePhoto: {
    imageUrl: String,
    imagePath: String
  },
  idDocuments: [{
    documentType: {
      type: String,
      enum: ["AADHAR", "PAN", "DRIVING_LICENSE", "PASSPORT"]
    },
    fileName: String,
    filePath: String,
    fileUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Profile setup expires in 7 days
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  completedAt: Date
}, {
  timestamps: true
});

// Index for efficient querying
profileSetupSchema.index({ setupId: 1 });
profileSetupSchema.index({ tenant: 1 });
profileSetupSchema.index({ expiresAt: 1 });

// Method to calculate progress percentage
profileSetupSchema.methods.calculateProgress = function() {
  const totalSteps = 6; // PERSONAL_DETAILS, AVATAR_SELECTION, PROFILE_PHOTO, PROFILE_COMPLETION, ID_UPLOAD, FINALIZATION
  const completedSteps = this.stepsCompleted.length;
  this.progress = Math.round((completedSteps / totalSteps) * 100);
  return this.progress;
};

// Method to advance to next step
profileSetupSchema.methods.advanceStep = function(step) {
  if (!this.stepsCompleted.includes(step)) {
    this.stepsCompleted.push(step);
  }
  
  // Update current step based on progress
  const stepOrder = [
    "INITIALIZATION",
    "PERSONAL_DETAILS", 
    "AVATAR_SELECTION",
    "PROFILE_PHOTO",
    "PROFILE_COMPLETION", 
    "ID_UPLOAD",
    "FINALIZATION",
    "COMPLETED"
  ];
  
  const currentIndex = stepOrder.indexOf(step);
  const nextStep = stepOrder[currentIndex + 1];
  
  if (nextStep) {
    this.currentStep = nextStep;
  }
  
  this.calculateProgress();
  
  // Mark as completed if all steps are done
  if (this.progress === 100) {
    this.currentStep = "COMPLETED";
    this.isProfileComplete = true;
    this.completedAt = new Date();
  }
};

module.exports = mongoose.model("ProfileSetup", profileSetupSchema);