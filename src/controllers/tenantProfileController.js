const Tenant = require('../models/Tenant');
const TenantProfile = require('../models/TenantProfile');
const ProfileSetup = require('../models/ProfileSetup');
const TenantDocument = require('../models/TenantDocument');
const { saveFile, deleteFile } = require('../utils/fileUpload');

// Helper function to get full image URL
const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}${imagePath}`;
};

// 1. Initialize Profile Setup
const initializeProfileSetup = async (req, res) => {
  try {
    const { email, fullName, contact } = req.body;
    const tenantId = req.user._id;

    // Check if there's an existing active setup
    let existingSetup = await ProfileSetup.findOne({
      tenant: tenantId,
      isProfileComplete: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingSetup) {
      return res.json({
        success: true,
        message: "Profile setup already initialized",
        data: {
          setupId: existingSetup.setupId,
          currentStep: existingSetup.currentStep,
          progress: existingSetup.progress
        }
      });
    }

    // Create new profile setup
    const profileSetup = new ProfileSetup({
      tenant: tenantId,
      personalDetails: { email, fullName, contact }
    });

    await profileSetup.save();
    profileSetup.advanceStep("INITIALIZATION");
    await profileSetup.save();

    res.status(201).json({
      success: true,
      message: "Profile setup initialized successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress
      }
    });

  } catch (error) {
    console.error('Initialize profile setup error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize profile setup",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. Save Personal Details
const savePersonalDetails = async (req, res) => {
  try {
    const { setupId } = req.params;
    const { fullName, email, contact, dateOfBirth, age, propertyType } = req.body;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    // Update personal details
    profileSetup.personalDetails = {
      fullName,
      email,
      contact,
      dateOfBirth,
      age,
      propertyType
    };

    profileSetup.advanceStep("PERSONAL_DETAILS");
    await profileSetup.save();

    res.json({
      success: true,
      message: "Personal details saved successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        personalDetails: profileSetup.personalDetails
      }
    });

  } catch (error) {
    console.error('Save personal details error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to save personal details",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 3. Select Avatar
const selectAvatar = async (req, res) => {
  try {
    const { setupId } = req.params;
    const { selectedAvatar, uploadedImage, isUploading } = req.body;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    // Save avatar selection
    profileSetup.avatar = {
      type: uploadedImage ? "uploaded" : "selected",
      avatarId: selectedAvatar,
      imageUrl: uploadedImage || `https://api.example.com/avatars/avatar${selectedAvatar}.png`,
      uploadedImagePath: uploadedImage
    };

    profileSetup.advanceStep("AVATAR_SELECTION");
    await profileSetup.save();

    res.json({
      success: true,
      message: "Avatar selected successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        avatar: profileSetup.avatar
      }
    });

  } catch (error) {
    console.error('Select avatar error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to select avatar",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 4. Upload Profile Photo
const uploadProfilePhoto = async (req, res) => {
  try {
    const { setupId } = req.params;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile photo file is required"
      });
    }

    // Save uploaded file
    const result = await saveFile(req.file.buffer, "profile_photos", req.file.originalname);

    profileSetup.profilePhoto = {
      imagePath: result.url,
      imageUrl: getFullImageUrl(result.url, req)
    };

    profileSetup.advanceStep("PROFILE_PHOTO");
    await profileSetup.save();

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        profilePhoto: profileSetup.profilePhoto
      }
    });

  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile photo",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 5. Complete Profile Details
const completeProfileDetails = async (req, res) => {
  try {
    const { setupId } = req.params;
    const { fullName, email, contact, dateOfBirth, age, selectedAvatar, uploadedImage, propertyType } = req.body;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    // Update all profile details
    profileSetup.personalDetails = {
      fullName,
      email,
      contact,
      dateOfBirth,
      age,
      propertyType
    };

    if (selectedAvatar || uploadedImage) {
      profileSetup.avatar = {
        type: uploadedImage ? "uploaded" : "selected",
        avatarId: selectedAvatar,
        imageUrl: uploadedImage || `https://api.example.com/avatars/avatar${selectedAvatar}.png`,
        uploadedImagePath: uploadedImage
      };
    }

    profileSetup.advanceStep("PROFILE_COMPLETION");
    await profileSetup.save();

    res.json({
      success: true,
      message: "Profile details completed successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        personalDetails: profileSetup.personalDetails,
        avatar: profileSetup.avatar
      }
    });

  } catch (error) {
    console.error('Complete profile details error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to complete profile details",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 6. Upload ID Document
const uploadIdDocument = async (req, res) => {
  try {
    const { setupId } = req.params;
    const { idFileName, documentType } = req.body;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "ID document file is required"
      });
    }

    if (!["AADHAR", "PAN", "DRIVING_LICENSE", "PASSPORT"].includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type. Must be AADHAR, PAN, DRIVING_LICENSE, or PASSPORT"
      });
    }

    // Save uploaded file
    const result = await saveFile(req.file.buffer, "tenant_documents", req.file.originalname);

    // Add document to setup
    const documentData = {
      documentType,
      fileName: idFileName || req.file.originalname,
      filePath: result.url,
      fileUrl: getFullImageUrl(result.url, req),
      uploadedAt: new Date()
    };

    profileSetup.idDocuments.push(documentData);
    profileSetup.advanceStep("ID_UPLOAD");
    await profileSetup.save();

    // Also create a separate document record
    const tenantDocument = new TenantDocument({
      tenant: tenantId,
      documentType,
      documentName: idFileName || req.file.originalname,
      fileName: req.file.originalname,
      filePath: result.url,
      fileUrl: getFullImageUrl(result.url, req),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      metadata: {
        uploadedVia: "api",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await tenantDocument.save();

    res.json({
      success: true,
      message: "ID document uploaded successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        document: documentData,
        documentId: tenantDocument._id
      }
    });

  } catch (error) {
    console.error('Upload ID document error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload ID document",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 7. Finalize Profile Setup
const finalizeProfileSetup = async (req, res) => {
  try {
    const { setupId } = req.params;
    const { profileComplete } = req.body;
    const tenantId = req.user._id;

    console.log('Finalizing profile setup:', { setupId, tenantId, profileComplete });

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId,
      isProfileComplete: false
    });

    if (!profileSetup) {
      console.log('Profile setup not found or already completed');
      return res.status(404).json({
        success: false,
        message: "Profile setup not found or already completed"
      });
    }

    console.log('Found profile setup:', profileSetup.setupId);

    if (profileComplete) {
      // Advance to finalization step
      profileSetup.advanceStep("FINALIZATION");
      await profileSetup.save();
      
      console.log('Advanced to finalization step, progress:', profileSetup.progress);

      // Update or create tenant profile - Note: TenantProfile uses 'userId' field
      let tenantProfile = await TenantProfile.findOne({ userId: tenantId });
      
      console.log('Existing tenant profile found:', !!tenantProfile);
      
      if (tenantProfile) {
        // Update existing profile
        const updateData = {};
        
        if (profileSetup.personalDetails?.fullName) {
          updateData.fullName = profileSetup.personalDetails.fullName;
        }
        if (profileSetup.personalDetails?.email) {
          updateData.email = profileSetup.personalDetails.email;
        }
        if (profileSetup.personalDetails?.contact) {
          updateData.phoneNumber = profileSetup.personalDetails.contact;
        }
        if (profileSetup.personalDetails?.dateOfBirth) {
          updateData.dob = profileSetup.personalDetails.dateOfBirth;
        }
        if (profileSetup.personalDetails?.age) {
          updateData['personalDetails.age'] = profileSetup.personalDetails.age;
        }
        if (profileSetup.profilePhoto?.imagePath || profileSetup.avatar?.imageUrl) {
          updateData.profilePhoto = profileSetup.profilePhoto?.imagePath || profileSetup.avatar?.imageUrl;
        }
        
        updateData.isProfileComplete = true;
        updateData.updatedAt = new Date();
        
        Object.assign(tenantProfile, updateData);
        console.log('Updating tenant profile with:', updateData);
      } else {
        // Create new profile - using correct field name 'userId'
        tenantProfile = new TenantProfile({
          userId: tenantId, // Correct field name
          fullName: profileSetup.personalDetails?.fullName,
          email: profileSetup.personalDetails?.email,
          phoneNumber: profileSetup.personalDetails?.contact,
          dob: profileSetup.personalDetails?.dateOfBirth,
          personalDetails: {
            age: profileSetup.personalDetails?.age
          },
          profilePhoto: profileSetup.profilePhoto?.imagePath || profileSetup.avatar?.imageUrl,
          isProfileComplete: true
        });
        console.log('Creating new tenant profile');
      }

      try {
        await tenantProfile.save();
        console.log('Tenant profile saved successfully');
      } catch (profileSaveError) {
        console.error('Error saving tenant profile:', profileSaveError);
        // Continue with the response even if profile save fails
      }
    }

    res.json({
      success: true,
      message: "Profile setup finalized successfully",
      data: {
        setupId: profileSetup.setupId,
        currentStep: profileSetup.currentStep,
        progress: profileSetup.progress,
        isProfileComplete: profileSetup.isProfileComplete,
        completedAt: profileSetup.completedAt
      }
    });

  } catch (error) {
    console.error('Finalize profile setup error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to finalize profile setup",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 8. Get Setup Status
const getSetupStatus = async (req, res) => {
  try {
    const { setupId } = req.params;
    const tenantId = req.user._id;

    const profileSetup = await ProfileSetup.findOne({
      setupId,
      tenant: tenantId
    });

    if (!profileSetup) {
      return res.status(404).json({
        success: false,
        message: "Profile setup not found"
      });
    }

    res.json({
      success: true,
      data: {
        setupId: profileSetup.setupId,
        userType: profileSetup.userType,
        currentStep: profileSetup.currentStep,
        stepsCompleted: profileSetup.stepsCompleted,
        progress: profileSetup.progress,
        expiresAt: profileSetup.expiresAt,
        personalDetails: profileSetup.personalDetails,
        avatar: profileSetup.avatar,
        profilePhoto: profileSetup.profilePhoto,
        idDocuments: profileSetup.idDocuments,
        isProfileComplete: profileSetup.isProfileComplete,
        completedAt: profileSetup.completedAt
      },
      message: "Setup status retrieved successfully"
    });

  } catch (error) {
    console.error('Get setup status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve setup status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Document Management APIs

// Get All Documents
const getDocuments = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { documentType, verificationStatus, page = 1, limit = 10 } = req.query;

    const query = { tenant: tenantId };
    
    if (documentType) query.documentType = documentType;
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const documents = await TenantDocument.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalDocuments = await TenantDocument.countDocuments(query);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalDocuments / limit),
          totalResults: totalDocuments,
          hasNext: page * limit < totalDocuments,
          hasPrev: page > 1,
          perPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve documents",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Upload Document
const uploadDocument = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { documentType, documentName, tags, expiryDate } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document file is required"
      });
    }

    // Save uploaded file
    const result = await saveFile(req.file.buffer, "tenant_documents", req.file.originalname);

    const tenantDocument = new TenantDocument({
      tenant: tenantId,
      documentType: documentType || "OTHER",
      documentName: documentName || req.file.originalname,
      fileName: req.file.originalname,
      filePath: result.url,
      fileUrl: getFullImageUrl(result.url, req),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      metadata: {
        uploadedVia: "api",
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await tenantDocument.save();

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: tenantDocument
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update Document
const updateDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const tenantId = req.user._id;
    const { documentName, documentType, tags, expiryDate } = req.body;

    const document = await TenantDocument.findOne({
      _id: documentId,
      tenant: tenantId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    // Update document details
    if (documentName) document.documentName = documentName;
    if (documentType) document.documentType = documentType;
    if (tags) document.tags = tags.split(',').map(tag => tag.trim());
    if (expiryDate) document.expiryDate = new Date(expiryDate);

    await document.save();

    res.json({
      success: true,
      message: "Document updated successfully",
      data: document
    });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update document",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete Document
const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const tenantId = req.user._id;

    const document = await TenantDocument.findOne({
      _id: documentId,
      tenant: tenantId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    // Delete file from storage
    try {
      await deleteFile(document.filePath);
    } catch (fileError) {
      console.warn('Failed to delete file from storage:', fileError.message);
    }

    // Delete document record
    await TenantDocument.findByIdAndDelete(documentId);

    res.json({
      success: true,
      message: "Document deleted successfully"
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  initializeProfileSetup,
  savePersonalDetails,
  selectAvatar,
  uploadProfilePhoto,
  completeProfileDetails,
  uploadIdDocument,
  finalizeProfileSetup,
  getSetupStatus,
  getDocuments,
  uploadDocument,
  updateDocument,
  deleteDocument
};