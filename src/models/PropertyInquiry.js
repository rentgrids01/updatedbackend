const mongoose = require("mongoose");

const PropertyInquirySchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant", 
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner",
    required: true,
  },
  inquiryType: {
    type: String,
    enum: ["property_interest", "visit_request", "general_inquiry"],
    default: "property_interest",
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "expired"],
    default: "pending",
  },
  // Chat will be created when owner accepts the inquiry
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    default: null,
  },
  // Track if owner has responded
  ownerResponse: {
    message: {
      type: String,
    },
    respondedAt: {
      type: Date,
    },
  },
  // Invitation status for notification tracking
  isNotificationSent: {
    type: Boolean,
    default: false,
  },
  // Expiry date for inquiry (auto-expire after 7 days)
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    },
  },
  // Related visit request if this inquiry leads to a visit
  visitRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VisitRequest",
    default: null,
  },
}, {
  timestamps: true,
});

// Add indexes for better performance
PropertyInquirySchema.index({ property: 1 });
PropertyInquirySchema.index({ tenant: 1 });
PropertyInquirySchema.index({ owner: 1 });
PropertyInquirySchema.index({ status: 1 });
PropertyInquirySchema.index({ expiresAt: 1 });
PropertyInquirySchema.index({ createdAt: -1 });

// Virtual to check if inquiry is expired
PropertyInquirySchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Instance method to accept inquiry and create chat
PropertyInquirySchema.methods.acceptInquiry = async function(ownerResponseMessage = '') {
  const Chat = require('./Chat');
  
  if (this.status !== 'pending') {
    throw new Error('Inquiry has already been processed');
  }
  
  if (this.isExpired) {
    throw new Error('Inquiry has expired');
  }
  
  // Extract ObjectIds from potentially populated fields
  const tenantId = this.tenant._id || this.tenant;
  const ownerId = this.owner._id || this.owner;
  
  // Validate that we have valid ObjectIds
  if (!tenantId || !ownerId) {
    throw new Error('Invalid tenant or owner ID');
  }
  
  // Create chat between tenant and owner
  const chat = await Chat.findOrCreateChat(tenantId, ownerId);
  
  // Update inquiry status
  this.status = 'accepted';
  this.chat = chat._id;
  this.ownerResponse = {
    message: ownerResponseMessage,
    respondedAt: new Date(),
  };
  
  await this.save();
  return chat;
};

// Instance method to decline inquiry
PropertyInquirySchema.methods.declineInquiry = async function(ownerResponseMessage = '') {
  if (this.status !== 'pending') {
    throw new Error('Inquiry has already been processed');
  }
  
  this.status = 'declined';
  this.ownerResponse = {
    message: ownerResponseMessage,
    respondedAt: new Date(),
  };
  
  await this.save();
  return this;
};

// Static method to get pending inquiries for an owner
PropertyInquirySchema.statics.getPendingInquiriesForOwner = function(ownerId) {
  return this.find({
    owner: ownerId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('property', 'title propertyType monthlyRent images')
  .populate('tenant', 'fullName profilePhoto phonenumber')
  .sort({ createdAt: -1 });
};

// Static method to get inquiries for a tenant
PropertyInquirySchema.statics.getInquiriesForTenant = function(tenantId) {
  return this.find({
    tenant: tenantId
  })
  .populate('property', 'title propertyType monthlyRent images')
  .populate('owner', 'fullName profilePhoto phonenumber')
  .sort({ createdAt: -1 });
};

// Static method to expire old inquiries
PropertyInquirySchema.statics.expireOldInquiries = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lte: new Date() }
    },
    {
      status: 'expired'
    }
  );
  return result;
};

module.exports = mongoose.model("PropertyInquiry", PropertyInquirySchema);