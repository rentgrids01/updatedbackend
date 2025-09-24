const mongoose = require("mongoose");

const tenantDocumentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true
  },
  documentType: {
    type: String,
    required: true,
    enum: ["AADHAR", "PAN", "DRIVING_LICENSE", "PASSPORT", "BANK_STATEMENT", "SALARY_SLIP", "OTHER"]
  },
  documentName: {
    type: String,
    required: true,
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected", "expired"],
    default: "pending"
  },
  verificationNotes: {
    type: String,
    default: ""
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },
  verifiedAt: Date,
  expiryDate: Date,
  tags: [String],
  metadata: {
    uploadedVia: {
      type: String,
      enum: ["web", "mobile", "api"],
      default: "api"
    },
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
tenantDocumentSchema.index({ tenant: 1 });
tenantDocumentSchema.index({ documentType: 1 });
tenantDocumentSchema.index({ verificationStatus: 1 });
tenantDocumentSchema.index({ createdAt: -1 });

// Method to check if document is expired
tenantDocumentSchema.methods.isExpired = function() {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
};

// Method to get file extension
tenantDocumentSchema.methods.getFileExtension = function() {
  return this.fileName.split('.').pop().toLowerCase();
};

// Virtual for public URL (without exposing internal paths)
tenantDocumentSchema.virtual('publicUrl').get(function() {
  return this.fileUrl;
});

// Ensure virtuals are included in JSON output
tenantDocumentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model("TenantDocument", tenantDocumentSchema);