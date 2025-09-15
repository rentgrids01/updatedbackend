const Tenant = require('../models/Tenant');
const SavedProperty = require('../models/SavedProperty');
const Property = require('../models/Property');
const VisitRequest = require('../models/VisitRequest');
const { saveFile } = require('../utils/fileUpload');
const { getPredefinedResponse, getChatbotResponse } = require("../utils/faqService");
// Get Profile
const getProfile = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user._id).select('-password');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Profile
const createProfile = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      dob,
      gender,
      preferredTenantType,
      moveInDate,
      leaseDuration,
      petsAllowed,
      smokingAllowed,
      languagePreference,
      agePreference
    } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      {
        fullName: fullName || req.user.fullName,
        emailId: email || req.user.emailId,
        phonenumber: phone || req.user.phonenumber,
        dob,
        gender,
        preferredTenantType,
        moveInDate,
        leaseDuration,
        petsAllowed,
        smokingAllowed,
        languagePreference,
        agePreference,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile created successfully',
      data: tenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedAt = new Date();

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: tenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload Avatar
const uploadAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { avatar, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatar: tenant.avatar }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload Profile Photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
    }

    const result = await saveFile(
      req.file.buffer,
      'profile_photos',
      req.file.originalname
    );

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: result.url, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { profilePhoto: tenant.profilePhoto }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload Document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded'
      });
    }

    const { docType } = req.body;

    const result = await saveFile(
      req.file.buffer,
      'tenant_documents',
      req.file.originalname
    );

    const tenant = await Tenant.findById(req.user._id);
    tenant.documents.push({
      docType,
      docUrl: result.url
    });
    await tenant.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        docType,
        docUrl: result.url
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Documents
const getDocuments = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user._id).select('documents');
    
    res.json({
      success: true,
      data: tenant.documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findById(req.user._id);
    tenant.documents = tenant.documents.filter(doc => doc._id.toString() !== id);
    await tenant.save();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify KYC
const verifyKYC = async (req, res) => {
  try {
    const { verificationStatus, verifiedBy } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { verificationStatus, verifiedBy, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'KYC verification updated successfully',
      data: { verificationStatus: tenant.verificationStatus }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Dashboard Summary
const getDashboardSummary = async (req, res) => {
  try {
    const visitRequests = await VisitRequest.find({ tenant: req.user._id });
    const savedProperties = await SavedProperty.find({ tenant: req.user._id });

    const counters = {
      pendingVerification: req.user.verificationStatus === 'pending' ? 1 : 0,
      requestedVisits: {
        pending: visitRequests.filter(v => ['submitted', 'landlord_reviewing'].includes(v.status)).length,
        accepted: visitRequests.filter(v => v.status === 'landlord_approved').length,
        rejected: visitRequests.filter(v => v.status === 'landlord_rejected').length
      },
      scheduledVisits: visitRequests.filter(v => v.status === 'scheduled').length,
      savedProperties: savedProperties.length,
      unreadMessages: 0, // TODO: implement messaging
      payments: {
        pending: visitRequests.filter(v => v.paymentStatus === 'pending').length
      }
    };

    const nextActions = [];
    const pendingPayments = visitRequests.filter(v => v.paymentStatus === 'pending');
    if (pendingPayments.length > 0) {
      nextActions.push({
        type: 'complete_payment',
        visitRequestId: pendingPayments[0]._id,
        cta: {
          label: 'Pay to Confirm Your Visit',
          href: `/tenant/visits/${pendingPayments[0]._id}`
        }
      });
    }

    const recent = {
      requestedVisits: visitRequests.slice(-3).map(visit => ({
        id: visit._id,
        property: {
          id: visit.property,
          // TODO: populate property details
        },
        status: visit.status,
        progress: visit.progress
      })),
      savedProperties: savedProperties.slice(-3)
    };

    res.json({
      success: true,
      data: {
        tenant: {
          id: req.user._id,
          name: req.user.fullName,
          avatarUrl: req.user.profilePhoto,
          kyc: {
            status: req.user.verificationStatus,
            lastVerifiedAt: req.user.updatedAt
          }
        },
        counters,
        nextActions,
        recent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Saved Properties
const getSavedProperties = async (req, res) => {
  try {
    const savedProperties = await SavedProperty.find({ tenant: req.user._id })
      .populate('property')
      .sort({ savedAt: -1 });

    res.json({
      success: true,
      data: savedProperties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Save Property
const saveProperty = async (req, res) => {
  try {
    const { propertyId, notes } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if already saved
    const existingSaved = await SavedProperty.findOne({
      tenant: req.user._id,
      property: propertyId
    });

    if (existingSaved) {
      return res.status(400).json({
        success: false,
        message: 'Property already saved'
      });
    }

    const savedProperty = await SavedProperty.create({
      tenant: req.user._id,
      property: propertyId,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Property saved successfully',
      data: savedProperty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Saved Property
const deleteSavedProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await SavedProperty.findOneAndDelete({
      _id: id,
      tenant: req.user._id
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Saved property not found'
      });
    }

    res.json({
      success: true,
      message: 'Property removed from saved list'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Bulk Delete Saved Properties
const bulkDeleteSavedProperties = async (req, res) => {
  try {
    const { propertyIds } = req.body;

    await SavedProperty.deleteMany({
      tenant: req.user._id,
      property: { $in: propertyIds }
    });

    res.json({
      success: true,
      message: 'Properties removed from saved list'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Replace Saved Properties
const replaceSavedProperties = async (req, res) => {
  try {
    const { propertyIds } = req.body;

    // Delete all existing saved properties
    await SavedProperty.deleteMany({ tenant: req.user._id });

    // Add new ones
    const savedProperties = propertyIds.map(propertyId => ({
      tenant: req.user._id,
      property: propertyId
    }));

    await SavedProperty.insertMany(savedProperties);

    res.json({
      success: true,
      message: 'Saved properties list updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// FAQ Handler
const generateFAQ = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // const predefined = getPredefinedResponse(message);
    // if (predefined) {
    //   return res.json({ reply: predefined });
    // }

    const reply = await getChatbotResponse(message);

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  getProfile,
  createProfile,
  updateProfile,
  uploadAvatar,
  uploadProfilePhoto,
  uploadDocument,
  getDocuments,
  deleteDocument,
  verifyKYC,
  getDashboardSummary,
  getSavedProperties,
  saveProperty,
  deleteSavedProperty,
  generateFAQ,
  bulkDeleteSavedProperties,
  replaceSavedProperties
};