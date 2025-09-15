const Owner = require('../models/Owner');
const Property = require('../models/Property');
const VisitRequest = require('../models/VisitRequest');
const { saveFile } = require('../utils/fileUpload');
const User = require("../models/User");
const LandlordProfile = require("../models/LandlordProfile");
const VisitRequest = require("../models/VisitRequest");
const PreferredTenant = require("../models/PreferredTenant");
const Property = require("../models/Property");
const { uploadToCloudinary } = require("../utils/cloudinary");

// Get Profile
const getProfile = async (req, res) => {
  try {
    const owner = await Owner.findById(req.user._id).select('-password');

    // const profile = await LandlordProfile.findOne({
    //   userId: req.user._id,
    // }).populate("userId", "fullName emailId phonenumber profilePhoto");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: owner
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
      companyName,
      gstNumber,
      panCard,
      aadhaarCard,
      address
    } = req.body;

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      {
        fullName: fullName || req.user.fullName,
        emailId: email || req.user.emailId,
        phonenumber: phone || req.user.phonenumber,
        dob,
        gender,
        companyName,
        gstNumber,
        panCard,
        aadhaarCard,
        address,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile created successfully',
      data: owner
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

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: owner
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

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      { avatar, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatar: owner.avatar }
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

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: result.url, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { profilePhoto: owner.profilePhoto }
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
      'owner_documents',
      req.file.originalname
    );

    const owner = await Owner.findById(req.user._id);
    owner.documents.push({
      docType,
      docUrl: result.url
    });
    await owner.save();

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
    const owner = await Owner.findById(req.user._id).select('documents');
    
    res.json({
      success: true,
      data: owner.documents
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

    const owner = await Owner.findById(req.user._id);
    owner.documents = owner.documents.filter(doc => doc._id.toString() !== id);
    await owner.save();

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

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      { verificationStatus, verifiedBy, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'KYC verification updated successfully',
      data: { verificationStatus: owner.verificationStatus }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Visit Requests
const getVisitRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { landlord: req.user._id };
    if (status) {
      query.status = status;
    }

    const visitRequests = await VisitRequest.find(query)
      .populate('tenant', 'fullName emailId phonenumber profilePhoto')
      .populate('property', 'title location images propertyId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VisitRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        visitRequests,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Visit Request
const updateVisitRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, date, note } = req.body;

    const visitRequest = await VisitRequest.findById(requestId);
    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: 'Visit request not found'
      });
    }

    if (visitRequest.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let updateData = { updatedAt: new Date() };

    switch (action) {
      case 'accept':
        updateData.status = 'landlord_approved';
        updateData.progress = 80;
        break;
      case 'reject':
        updateData.status = 'landlord_rejected';
        updateData.progress = 100;
        break;
      case 'schedule':
        updateData.status = 'scheduled';
        updateData.scheduledDate = new Date(date);
        updateData.notes = note;
        updateData.progress = 100;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    const updatedRequest = await VisitRequest.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: `Visit request ${action}ed successfully`,
      data: updatedRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// Create Preferred Tenant
const createPreferredTenant = async (req, res) => {
  try {
    const { propertyId, tenantTypes, notes } = req.body
    const {
      moveInDate,
      leaseDurationPreference,
      numberOfOccupants,
      agePreference,
      genderPreferences,
      languagePreferences,
      petsAllowed,
      smokingAllowed,
      coupleFriendly,
    } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }


      if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to set preferences for this property",
      });
    }

    const existingCriteria = await PreferredTenant.findOne({
      landlord: req.user._id,
      property: propertyId,
    });

    if (existingCriteria) {
      return res.status(400).json({
        success: false,
        message: "Preferred tenant criteria already exists for this property",
      });
    }

    const preferredTenant = await PreferredTenant.create({
      landlord: req.user._id,
      property: propertyId,
      tenantTypes,
      notes,
       moveInDate,
      leaseDurationPreference,
      numberOfOccupants,
      agePreference,
      genderPreferences,
      languagePreferences,
      petsAllowed,
      smokingAllowed,
      coupleFriendly,
    });

    res.status(201).json({
      success: true,
      message: 'Preferred tenant created successfully',
      data: preferredTenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Preferred Tenants
const getPreferredTenants = async (req, res) => {
  try {
    const { propertyId } = req.query;
    
    const query = { landlord: req.user._id };
    if (propertyId) {
      query.property = propertyId;
    }

    const preferredTenants = await PreferredTenant.find(query)
      .populate('property', 'title location');

    res.json({
      success: true,
      data: preferredTenants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Preferred Tenant
const updatePreferredTenant = async (req, res) => {
  try {
    const { preferredTenantId } = req.params;
    const { tenantTypes, notes } = req.body;

    const preferredTenant = await PreferredTenant.findById(preferredTenantId);
    if (!preferredTenant) {
      return res.status(404).json({
        success: false,
        message: 'Preferred tenant not found'
      });
    }

    if (preferredTenant.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const updated = await PreferredTenant.findByIdAndUpdate(
      preferredTenantId,
      { tenantTypes, notes, updatedAt: new Date() },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Preferred tenant updated successfully',
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Preferred Tenant
const deletePreferredTenant = async (req, res) => {
  try {
    const { preferredTenantId } = req.params;

    const preferredTenant = await PreferredTenant.findById(preferredTenantId);
    if (!preferredTenant) {
      return res.status(404).json({
        success: false,
        message: 'Preferred tenant not found'
      });
    }

    if (preferredTenant.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    

    await PreferredTenant.findByIdAndDelete(preferredTenantId);

    res.json({
      success: true,
      message: 'Preferred tenant deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
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
  getVisitRequests,
  updateVisitRequest,
  createPreferredTenant,
  getPreferredTenants,
  updatePreferredTenant,
  deletePreferredTenant
};