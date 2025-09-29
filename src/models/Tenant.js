const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const tenantSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  emailId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phonenumber: {
    type: String,
    required: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  profilePhoto: {
    type: String,
    default: "",
  },
  avatar: {
    type: String,
    default: "",
  },
  dob: Date,
  age: Number,
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
  },
  documents: [
    {
      docType: String,
      docUrl: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "universalTenantApplication",
    sparse: true,
  },
  isProfileComplete :{
    type: Boolean,
    default: false,
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  userType: {
    type: String,
    default: "tenant"
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});


tenantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

tenantSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Tenant", tenantSchema);
