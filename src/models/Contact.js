const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required"],
    trim: true,
    maxLength: [50, "First name cannot exceed 50 characters"]
  },
  lastName: {
    type: String,
    required: [true, "Last name is required"],
    trim: true,
    maxLength: [50, "Last name cannot exceed 50 characters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Please provide a valid email address"
    ]
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [
      /^[\+]?[\d\s\-\(\)]+$/,
      "Please provide a valid phone number"
    ]
  },
  message: {
    type: String,
    required: [true, "Message is required"],
    trim: true,
    minLength: [10, "Message must be at least 10 characters long"],
    maxLength: [1000, "Message cannot exceed 1000 characters"]
  },
  status: {
    type: String,
    enum: ["new", "read", "responded", "closed"],
    default: "new"
  },
  source: {
    type: String,
    default: "contact_form"
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient querying
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ status: 1 });

module.exports = mongoose.model("Contact", contactSchema);