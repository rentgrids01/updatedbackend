const PropertyInquiry = require("../models/PropertyInquiry");
const Property = require("../models/Property");
const Owner = require("../models/Owner");
const Tenant = require("../models/Tenant");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const PropertyInquiryNotificationService = require("../utils/propertyInquiryNotificationService");

// Send Property Inquiry
const sendPropertyInquiry = async (req, res) => {
  try {
    const { propertyId, message, inquiryType = "property_interest" } = req.body;
    const tenantId = req.user._id;

    // Validate input
    if (!propertyId || !message) {
      return res.status(400).json({
        success: false,
        message: "Property ID and message are required"
      });
    }

    // Validate that the user is a tenant
    if (req.user.userType !== 'tenant') {
      return res.status(403).json({
        success: false,
        message: "Only tenants can send property inquiries"
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId).populate('owner');
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found"
      });
    }

    // Prevent tenants from sending inquiries to their own properties (if they are also owners)
    if (property.owner._id.toString() === tenantId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot send an inquiry for your own property"
      });
    }

    // Check if tenant already has a pending inquiry for this property
    const existingInquiry = await PropertyInquiry.findOne({
      property: propertyId,
      tenant: tenantId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (existingInquiry) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending inquiry for this property"
      });
    }

    // Create new inquiry
    const inquiry = new PropertyInquiry({
      property: propertyId,
      tenant: tenantId,
      owner: property.owner._id,
      inquiryType,
      message: message.trim(),
    });

    await inquiry.save();

    // Populate the inquiry for response
    const populatedInquiry = await PropertyInquiry.findById(inquiry._id)
      .populate('property', 'title propertyType monthlyRent images propertyId')
      .populate('tenant', 'fullName profilePhoto phonenumber')
      .populate('owner', 'fullName profilePhoto phonenumber');

    // Send notification to owner
    const io = req.app.get('io');
    if (io) {
      const notificationService = new PropertyInquiryNotificationService(io);
      await notificationService.notifyOwnerOfNewInquiry(populatedInquiry);
      await notificationService.sendInquiryCountUpdate(property.owner._id.toString());
    }

    res.status(201).json({
      success: true,
      message: "Property inquiry sent successfully",
      data: populatedInquiry
    });

  } catch (error) {
    console.error('Send property inquiry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Pending Inquiries for Owner
const getPendingInquiries = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const inquiries = await PropertyInquiry.getPendingInquiriesForOwner(ownerId);

    res.json({
      success: true,
      message: "Pending inquiries fetched successfully",
      data: inquiries
    });

  } catch (error) {
    console.error('Get pending inquiries error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Inquiries for Owner (pending, accepted, declined)
const getAllInquiriesForOwner = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { owner: ownerId };
    if (status) {
      query.status = status;
    }

    const inquiries = await PropertyInquiry.find(query)
      .populate('property', 'title propertyType monthlyRent images propertyId')
      .populate('tenant', 'fullName profilePhoto phonenumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PropertyInquiry.countDocuments(query);

    res.json({
      success: true,
      message: "Inquiries fetched successfully",
      data: inquiries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get all inquiries for owner error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Inquiries for Tenant
const getInquiriesForTenant = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { tenant: tenantId };
    if (status) {
      query.status = status;
    }

    const inquiries = await PropertyInquiry.find(query)
      .populate('property', 'title propertyType monthlyRent images propertyId')
      .populate('owner', 'fullName profilePhoto phonenumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PropertyInquiry.countDocuments(query);

    res.json({
      success: true,
      message: "Your inquiries fetched successfully",
      data: inquiries,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get inquiries for tenant error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Accept Property Inquiry and Create Chat
const acceptInquiry = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { responseMessage = "" } = req.body;
    const ownerId = req.user._id;

    console.log('Debug - Accept inquiry request:', {
      inquiryId,
      ownerId: ownerId.toString(),
      responseMessage
    });

    // Find inquiry
    const inquiry = await PropertyInquiry.findById(inquiryId)
      .populate('property', 'title propertyType monthlyRent images propertyId')
      .populate('tenant', 'fullName profilePhoto phonenumber')
      .populate('owner', 'fullName profilePhoto phonenumber');

    console.log('Debug - Found inquiry:', {
      inquiryId: inquiryId,
      inquiryExists: !!inquiry,
      inquiry: inquiry ? {
        _id: inquiry._id,
        tenant: inquiry.tenant,
        owner: inquiry.owner,
        property: inquiry.property,
        status: inquiry.status
      } : null
    });

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found"
      });
    }

    // Check if owner field exists and is populated
    if (!inquiry.owner) {
      console.error('Owner field is null for inquiry:', inquiryId);
      return res.status(400).json({
        success: false,
        message: "Invalid inquiry: owner information missing"
      });
    }

    // Check if tenant field exists and is populated
    if (!inquiry.tenant) {
      console.error('Tenant field is null for inquiry:', inquiryId);
      console.error('Raw tenant ID:', inquiry.tenant);
      return res.status(400).json({
        success: false,
        message: "Invalid inquiry: tenant information missing or invalid. The tenant may have been deleted or the inquiry contains invalid data."
      });
    }

    // Verify owner authorization
    const inquiryOwnerId = inquiry.owner._id || inquiry.owner;
    
    console.log('🔐 Authorization check:', {
      authenticatedUserId: ownerId.toString(),
      inquiryOwnerId: inquiryOwnerId.toString(),
      authenticated_user_type: req.user.userType,
      inquiry_owner_name: inquiry.owner.fullName || 'Unknown',
      authorized: inquiryOwnerId.toString() === ownerId.toString()
    });
    
    if (inquiryOwnerId.toString() !== ownerId.toString()) {
      console.warn('❌ Authorization failed - User is not the property owner');
      return res.status(403).json({
        success: false,
        message: "Unauthorized to respond to this inquiry. Only the property owner can accept or decline inquiries.",
        details: {
          expected_owner: inquiryOwnerId.toString(),
          authenticated_user: ownerId.toString()
        }
      });
    }

    console.log('Debug - About to accept inquiry:', {
      inquiryId: inquiry._id,
      tenantId: inquiry.tenant._id || inquiry.tenant,
      ownerId: inquiry.owner._id || inquiry.owner,
      status: inquiry.status
    });

    // Accept inquiry and create chat
    const chat = await inquiry.acceptInquiry(responseMessage);

    // Send initial message from owner if response message provided
    if (responseMessage.trim()) {
      const initialMessage = await Message.create({
        chat: chat._id,
        sender: ownerId,
        senderModel: "Owner",
        messageType: "text",
        content: responseMessage.trim(),
        tenancyInviteContext: 'none', // Regular message
      });

      // Update chat with initial message
      chat.lastMessage = initialMessage._id;
      chat.lastActivity = new Date();
      await chat.save();
    }

    // Send notification to tenant
    const io = req.app.get('io');
    if (io) {
      const notificationService = new PropertyInquiryNotificationService(io);
      await notificationService.notifyTenantOfAcceptedInquiry(inquiry, chat);
      await notificationService.sendInquiryCountUpdate(ownerId);
    }

    res.json({
      success: true,
      message: "Inquiry accepted and chat created successfully",
      data: {
        inquiry: inquiry,
        chat: chat
      }
    });

  } catch (error) {
    console.error('Accept inquiry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Decline Property Inquiry
const declineInquiry = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const { responseMessage = "" } = req.body;
    const ownerId = req.user._id;

    // Find inquiry
    const inquiry = await PropertyInquiry.findById(inquiryId)
      .populate('property', 'title propertyType monthlyRent images propertyId')
      .populate('tenant', 'fullName profilePhoto phonenumber')
      .populate('owner', 'fullName profilePhoto phonenumber');

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found"
      });
    }

    // Verify owner authorization
    if (inquiry.owner._id.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to respond to this inquiry"
      });
    }

    // Decline inquiry
    await inquiry.declineInquiry(responseMessage);

    // Send notification to tenant
    const io = req.app.get('io');
    if (io) {
      const notificationService = new PropertyInquiryNotificationService(io);
      await notificationService.notifyTenantOfDeclinedInquiry(inquiry);
      await notificationService.sendInquiryCountUpdate(ownerId);
    }

    res.json({
      success: true,
      message: "Inquiry declined successfully",
      data: inquiry
    });

  } catch (error) {
    console.error('Decline inquiry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Inquiry Details
const getInquiryDetails = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const userId = req.user._id;

    const inquiry = await PropertyInquiry.findById(inquiryId)
      .populate('property', 'title propertyType monthlyRent images propertyId description address')
      .populate('tenant', 'fullName profilePhoto phonenumber')
      .populate('owner', 'fullName profilePhoto phonenumber')
      .populate('chat');

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found"
      });
    }

    // Verify user authorization (either tenant or owner)
    if (inquiry.tenant._id.toString() !== userId.toString() && 
        inquiry.owner._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this inquiry"
      });
    }

    res.json({
      success: true,
      message: "Inquiry details fetched successfully",
      data: inquiry
    });

  } catch (error) {
    console.error('Get inquiry details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Chat from Inquiry
const getChatFromInquiry = async (req, res) => {
  try {
    const { inquiryId } = req.params;
    const userId = req.user._id;

    const inquiry = await PropertyInquiry.findById(inquiryId)
      .populate('chat');

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: "Inquiry not found"
      });
    }

    // Verify user authorization
    if (inquiry.tenant.toString() !== userId.toString() && 
        inquiry.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this chat"
      });
    }

    if (!inquiry.chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not yet created for this inquiry"
      });
    }

    // Return chat ID for frontend to redirect to chat
    res.json({
      success: true,
      message: "Chat found successfully",
      data: {
        chatId: inquiry.chat._id,
        inquiryStatus: inquiry.status
      }
    });

  } catch (error) {
    console.error('Get chat from inquiry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Clean up expired inquiries (can be run as a cron job)
const cleanupExpiredInquiries = async (req, res) => {
  try {
    const result = await PropertyInquiry.expireOldInquiries();

    res.json({
      success: true,
      message: "Expired inquiries cleaned up successfully",
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Cleanup expired inquiries error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  sendPropertyInquiry,
  getPendingInquiries,
  getAllInquiriesForOwner,
  getInquiriesForTenant,
  acceptInquiry,
  declineInquiry,
  getInquiryDetails,
  getChatFromInquiry,
  cleanupExpiredInquiries
};
