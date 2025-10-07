const Owner = require("../models/Owner");
const Property = require("../models/Property");
const VisitRequest = require("../models/VisitRequest");
const { saveFile } = require("../utils/fileUpload");
// const User = require("../models/User");
// const LandlordProfile = require("../models/LandlordProfile");
const Schedule = require("../models/Schedule");
const PropertyTenantCriteria = require("../models/PropertyTenantCriteria");
// const { uploadToCloudinary } = require("../utils/cloudinary");
const UniversalTenantApplication = require("../models/UniversalTenantApplication");
const calculateMatchScore = require("../utils/calculateMatchScore");
const EmailOTP = require("../models/EmailOTP");
const {
  generateOTP,
  sendOTPEmail,
  verifyOTP,
} = require("../utils/emailService");
const {
  calculateProfileScoreOwner,
} = require("../utils/calculateProfileScore");
// Get Dashboard

const getDashboard = async (req, res) => {
  try {
    const ownerId = req.user._id;

    // Fetch owner data to calculate profile score
    const owner = await Owner.findById(ownerId).lean();
    const profileScore = owner ? calculateProfileScoreOwner(owner) : 0;

    const properties = await Property.find({ owner: ownerId }).lean();
    if (!properties.length)
      return res.json({ success: true, profileScore, data: [] });

    const propertyIds = properties.map((p) => p._id);
    const criteriaList = await PropertyTenantCriteria.find({
      property: { $in: propertyIds },
    }).lean();

    const visitRequests = await VisitRequest.find({
      property: { $in: propertyIds },
    })
      .populate({
        path: "tenant",
        select: "fullName emailId phonenumber age gender applicationId",
      })
      .sort({ createdAt: -1 })
      .lean();

    const tenantAppIds = visitRequests
      .map((vr) => vr.tenant.applicationId)
      .filter(Boolean);
    const tenantApplications = await UniversalTenantApplication.find({
      _id: { $in: tenantAppIds },
    }).lean();

    const tenantAppMap = {};
    tenantApplications.forEach((app) => {
      tenantAppMap[app.tenantId.toString()] = app;
    });

    const criteriaMap = {};
    criteriaList.forEach((c) => {
      criteriaMap[c.property.toString()] = c;
    });

    const dashboard = properties.map((property) => {
      const propertyCriteria = criteriaMap[property._id.toString()];

      const requestsForProperty = visitRequests.filter(
        (vr) => vr.property.toString() === property._id.toString()
      );

      const tenants = requestsForProperty.map((request) => {
        const tenantId = request.tenant._id.toString();
        const tenantApp = tenantAppMap[tenantId];

        return {
          tenant: request.tenant,
          visitRequest: request,
          matchScore: calculateMatchScore(propertyCriteria, tenantApp),
          budget : tenantApp?.propertyPreferences?.budget || null
        };
      });

      const topTenants = tenants
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);

      return {
        property,
        tenants: topTenants,
      };
    });

    return res.json({
      success: true,
      profileScore,
      data: dashboard,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const owner = await Owner.findById(req.user._id).select("-password");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Add full URLs for images
    const ownerData = owner.toObject();
    if (ownerData.profilePhoto) {
      ownerData.profilePhotoUrl = `${req.protocol}://${req.get("host")}${
        ownerData.profilePhoto
      }`;
    }
    if (ownerData.uploadedImage) {
      ownerData.uploadedImageUrl = `${req.protocol}://${req.get("host")}${
        ownerData.uploadedImage
      }`;
    }

    // Add full URLs to documents
    if (ownerData.documents && ownerData.documents.length > 0) {
      ownerData.documents = ownerData.documents.map((doc) => ({
        ...doc,
        documentUrl: doc.documentPath
          ? `${req.protocol}://${req.get("host")}${doc.documentPath}`
          : null,
      }));
    }

    res.json({
      success: true,
      data: ownerData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create Profile
const createProfile = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      dob,
      gender,
      companyName,
      gstNumber,
      panCard,
      aadhaarCard,
      address,
    } = req.body;

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      {
        fullName: fullName || req.user.fullName,
        phonenumber: phone || req.user.phonenumber,
        dob,
        gender,
        companyName,
        gstNumber,
        panCard,
        aadhaarCard,
        address,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile created successfully",
      data: owner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    const updateData = req.body;
    updateData.updatedAt = new Date();

    const owner = await Owner.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: owner,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    ).select("-password");

    res.json({
      success: true,
      message: "Avatar updated successfully",
      data: { avatar: owner.avatar },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload Profile Photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No photo uploaded",
      });
    }

    const result = await saveFile(
      req.file.buffer,
      "profile_photos",
      req.file.originalname
    );

    const owner = await Owner.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: result.url, updatedAt: new Date() },
      { new: true }
    ).select("-password");

    const photoUrl = `${req.protocol}://${req.get("host")}${result.url}`;

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        profilePhoto: owner.profilePhoto,
        profilePhotoUrl: photoUrl,
        filename: result.filename,
        originalName: result.originalName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload Document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No document uploaded",
      });
    }

    const { docType, documentName, tags, expiryDate } = req.body;

    const result = await saveFile(
      req.file.buffer,
      "owner_documents",
      req.file.originalname
    );

    const owner = await Owner.findById(req.user._id);
    const newDocument = {
      documentName: documentName || req.file.originalname,
      documentType: docType || "OTHER",
      documentPath: result.url,
      documentUrl: `${req.protocol}://${req.get("host")}${result.url}`,
      uploadDate: new Date(),
      verificationStatus: "pending",
      tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    };

    owner.documents.push(newDocument);
    await owner.save();

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        ...newDocument,
        _id: owner.documents[owner.documents.length - 1]._id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Documents
const getDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      documentType,
      verificationStatus,
    } = req.query;
    const skip = (page - 1) * limit;

    const owner = await Owner.findById(req.user._id).select("documents");

    let documents = owner.documents || [];

    // Apply filters
    if (documentType) {
      documents = documents.filter((doc) => doc.documentType === documentType);
    }
    if (verificationStatus) {
      documents = documents.filter(
        (doc) => doc.verificationStatus === verificationStatus
      );
    }

    // Add full URLs to documents
    const documentsWithUrls = documents.map((doc) => ({
      ...doc.toObject(),
      documentUrl: doc.documentPath
        ? `${req.protocol}://${req.get("host")}${doc.documentPath}`
        : null,
    }));

    // Apply pagination
    const paginatedDocuments = documentsWithUrls.slice(
      skip,
      skip + parseInt(limit)
    );

    const totalDocuments = documents.length;
    const totalPages = Math.ceil(totalDocuments / limit);

    res.json({
      success: true,
      data: {
        documents: paginatedDocuments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalDocuments,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await Owner.findById(req.user._id);
    owner.documents = owner.documents.filter(
      (doc) => doc._id.toString() !== id
    );
    await owner.save();

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    ).select("-password");

    res.json({
      success: true,
      message: "KYC verification updated successfully",
      data: { verificationStatus: owner.verificationStatus },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Visit Requests
const getVisitRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    console.log("landlord id", req.user._id);
    const query = { landlord: req.user._id };
    if (status) {
      query.status = status;
    }

    const visitRequests = await VisitRequest.find(query)
      .populate("tenant", "fullName emailId phonenumber profilePhoto")
      .populate("property", "title location images propertyId")
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
          hasNext: page * limit < total,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Visit Request
const updateVisitRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, note } = req.body;

    const visitRequest = await VisitRequest.findById(requestId).populate(
      "tenant",
      "email emailId"
    );
    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visitRequest.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    let updateData = { updatedAt: new Date() };

    switch (action) {
      case "reject":
        updateData.status = "landlord_rejected";
        updateData.notes = note || visitRequest.notes;
        break;

      case "accept_and_schedule":
        // Simply approve the visit request without requiring date/time from landlord
        // The tenant has already provided the schedule details when creating the request
        updateData.status = "landlord_approved";
        updateData.notes = note || visitRequest.notes;
        updateData.progress = 100;

        // Create a confirmed schedule using the existing visit request data
        await Schedule.create({
          tenant: visitRequest.tenant,
          landlord: visitRequest.landlord,
          property: visitRequest.property,
          date: visitRequest.scheduledDate,
          time: visitRequest.slots[0]?.scheduledTime, // Use first slot or you could modify this logic
          notes: note || visitRequest.notes,
          status: "confirmed",
        });

        const otp = generateOTP();
        await EmailOTP.create({
          email: visitRequest.tenant.emailId,
          otp,
          purpose: "visit-verification",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          verified: false,
        });

        await sendOTPEmail(visitRequest.tenant.emailId, "visit-verification");

        await visitRequest.save();

        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    await VisitRequest.findByIdAndUpdate(requestId, updateData);

    // Return updated visit request
    const updatedRequest = await VisitRequest.findById(requestId)
      .populate("tenant", "fullName emailId phonenumber")
      .populate("property", "title address");

    res.json({
      success: true,
      message: `Visit request ${action.replace("_", " ")} successfully`,
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating visit request:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyVisitRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { otp } = req.body;
    const ownerId = req.user._id;

    // Validate input
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    // Find the visit request
    const visitRequest = await VisitRequest.findById(requestId).populate(
      "tenant",
      "emailId"
    );

    if (!visitRequest) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visitRequest.landlord._id.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to verify this visit request",
      });
    }

    if (
      visitRequest.status !== "landlord_approved" &&
      visitRequest.status !== "scheduled"
    ) {
      return res.status(400).json({
        success: false,
        message: "Visit request is not in a verifiable state",
      });
    }

    const otpVerification = await verifyOTP(
      visitRequest.tenant.emailId,
      otp,
      "visit-verification"
    );

    if (!otpVerification.success) {
      return res.status(400).json({
        success: false,
        message: otpVerification.message || "Invalid or expired OTP",
      });
    }

    visitRequest.status = "completed";
    visitRequest.updatedAt = new Date();
    await visitRequest.save();

    res.json({
      success: true,
      message: "Visit verification successful. Visit marked as completed.",
      data: {
        requestId: visitRequest._id,
        status: visitRequest.status,
        completedAt: visitRequest.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error verifying visit request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify visit request",
      error: error.message,
    });
  }
};

// Accept Reschedule Request
const acceptRescheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user._id;

    const visit = await VisitRequest.findById(requestId);
    if (!visit) {
      return res
        .status(404)
        .json({ success: false, message: "Visit request not found" });
    }

    if (visit?.landlord.toString() !== ownerId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (visit.status === "rejected") {
      return res.status(400).json({
        success: false,
        message:
          "This visit request has already been rejected and cannot be updated again.",
      });
    }

    visit.status = "scheduled";
    visit.updatedAt = new Date();

    await visit.save();

    res.status(200).json({
      success: true,
      message: "Reschedule accepted successfully",
      data: visit,
    });
  } catch (error) {
    console.error("Error accepting reschedule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reject Reschedule Request
const rejectRescheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ownerId = req.user._id;

    const visit = await VisitRequest.findById(requestId);
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visit?.landlord.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this reschedule",
      });
    }

    visit.status = "rejected";
    visit.updatedAt = new Date();

    if (visit.status === "rejected") {
      return res.status(400).json({
        success: false,
        message:
          "This visit has been rejected and cannot be rescheduled again.",
      });
    }

    await visit.save();

    res.status(200).json({
      success: true,
      message: "Reschedule rejected successfully",
      data: visit,
    });
  } catch (error) {
    console.error("Error rejecting reschedule:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject rescheduled visit",
      error: error.message,
    });
  }
};

// Reschedule Visit Request
const RescheduleVisit = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { scheduledDate, slots } = req.body;
    const ownerId = req.user._id;

    if (!scheduledDate || !slots) {
      return res.status(400).json({
        success: false,
        message: "scheduledDate and time of slots are required",
      });
    }

    const visit = await VisitRequest.findById(requestId).populate(
      "property",
      "landlord"
    );

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visit?.landlord?.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reschedule this visit",
      });
    }

    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const newSlots = slots?.length ? slots : [{ scheduledTime: time }];
    const scheduledTimes = newSlots.map((s) => s.scheduledTime.trim());

    const existingDate = new Date(visit.scheduledDate);
    existingDate.setHours(0, 0, 0, 0);

    const sameDate = existingDate.getTime() === startOfDay.getTime();
    const sameSlots =
      visit.slots?.length === newSlots.length &&
      visit.slots.every((slot) =>
        scheduledTimes.includes(slot.scheduledTime.trim())
      );

    if (sameDate && sameSlots) {
      return res.status(400).json({
        success: false,
        message:
          "Same Date Same slot again can not Reschedule. Please choose a different time.",
      });
    }

    visit.scheduledDate = startOfDay;
    visit.slots = newSlots;
    visit.status = "scheduled";
    visit.updatedAt = new Date();

    await visit.save();

    return res.status(200).json({
      success: true,
      message: "Visit rescheduled successfully",
      data: visit,
    });
  } catch (error) {
    console.error("Error rescheduling visit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reschedule visit",
      error: error.message,
    });
  }
};

// Create Preferred Tenant
const createPreferredTenant = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      preferTenantType,
      moveInDate,
      leaseDurationPreference,
      numberOfOccupants,
      agePreference,
      genderPreferences,
      languagePreferences,
      petsAllowed,
      smokingAllowed,
      coupleFriendly,
      notes,
    } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to set preferences for this property",
      });
    }

    const existingCriteria = await PropertyTenantCriteria.findOne({
      owner: req.user._id,
      property: propertyId,
    });

    if (existingCriteria) {
      return res.status(400).json({
        success: false,
        message: "Preferred tenant criteria already exists for this property",
      });
    }

    const preferredTenant = await PropertyTenantCriteria.create({
      owner: req.user._id,
      property: propertyId,
      preferTenantType,
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
      message: "Preferred tenant created successfully",
      data: preferredTenant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Preferred Tenants
const getPreferredTenants = async (req, res) => {
  try {
    const { propertyId } = req.query;

    const query = { owner: req.user._id };
    if (propertyId) {
      query.property = propertyId;
    }

    const preferredTenants = await PropertyTenantCriteria.find(query).populate(
      "property",
      "title location"
    );

    res.json({
      success: true,
      data: preferredTenants,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Preferred Tenant
const updatePreferredTenant = async (req, res) => {
  try {
    const { preferredTenantId } = req.params;

    const preferredTenant = await PropertyTenantCriteria.findById(
      preferredTenantId
    );
    if (!preferredTenant) {
      return res.status(404).json({
        success: false,
        message: "Preferred tenant not found",
      });
    }

    if (preferredTenant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to update this preferred tenant criteria",
      });
    }

    const updateFields = {};
    const allowedFields = [
      "preferTenantType",
      "moveInDate",
      "leaseDurationPreference",
      "numberOfOccupants",
      "agePreference",
      "genderPreferences",
      "languagePreferences",
      "petsAllowed",
      "smokingAllowed",
      "coupleFriendly",
      "notes",
    ];

    let hasFields = false;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        hasFields = true;
        if (field === "preferTenantType") {
          updateFields[field] = Array.isArray(req.body[field])
            ? req.body[field]
            : [req.body[field]];
        } else if (
          ["petsAllowed", "smokingAllowed", "coupleFriendly"].includes(field)
        ) {
          if (typeof req.body[field] === "string") {
            updateFields[field] = req.body[field].toLowerCase() === "true";
          } else {
            updateFields[field] = req.body[field];
          }
        } else {
          updateFields[field] = req.body[field];
        }
      }
    }

    if (!hasFields) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update",
      });
    }

    updateFields.updatedAt = new Date();

    const updatedTenant = await PropertyTenantCriteria.findByIdAndUpdate(
      preferredTenantId,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedTenant) {
      return res.status(500).json({
        success: false,
        message: "Update failed. Please try again.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Preferred tenant updated successfully",
      data: updatedTenant,
    });
  } catch (error) {
    console.error("Update Preferred Tenant Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Preferred Tenant
const deletePreferredTenant = async (req, res) => {
  try {
    const { preferredTenantId } = req.params;

    const preferredTenant = await PropertyTenantCriteria.findById(
      preferredTenantId
    );
    if (!preferredTenant) {
      return res.status(404).json({
        success: false,
        message: "Preferred tenant not found",
      });
    }

    if (preferredTenant.landlord.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await PropertyTenantCriteria.findByIdAndDelete(preferredTenantId);

    res.json({
      success: true,
      message: "Preferred tenant deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Document Details
const updateDocument = async (req, res) => {
  try {
    const { documentName, documentType, tags, expiryDate } = req.body;
    const documentId = req.params.id;
    const ownerId = req.user._id;

    const owner = await Owner.findById(ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    const documentIndex = owner.documents.findIndex(
      (doc) => doc._id.toString() === documentId
    );

    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Update document details
    if (documentName)
      owner.documents[documentIndex].documentName = documentName;
    if (documentType)
      owner.documents[documentIndex].documentType = documentType;
    if (tags)
      owner.documents[documentIndex].tags = tags
        .split(",")
        .map((tag) => tag.trim());
    if (expiryDate)
      owner.documents[documentIndex].expiryDate = new Date(expiryDate);

    await owner.save();

    res.json({
      success: true,
      message: "Document updated successfully",
      data: owner.documents[documentIndex],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 🚀 Multi-Step Profile Setup Methods

// Initialize Profile Setup
const initializeProfileSetup = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email, fullName, contact } = req.body;

    const setupId = `setup_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create or update owner with setup tracking
    let owner = await Owner.findById(ownerId);
    if (!owner) {
      owner = new Owner({
        userId: ownerId,
        setupId,
        setupProgress: {
          currentStep: 1,
          totalSteps: 7,
          completedSteps: [],
          isComplete: false,
        },
      });
    } else {
      owner.setupId = setupId;
      owner.setupProgress = {
        currentStep: 1,
        totalSteps: 7,
        completedSteps: [],
        isComplete: false,
      };
    }

    if (email) owner.email = email;
    if (fullName) owner.fullName = fullName;
    if (contact) owner.phoneNumber = contact;

    await owner.save();

    res.status(201).json({
      success: true,
      message: "Profile setup initialized successfully",
      data: {
        setupId,
        progress: owner.setupProgress,
        currentStep: 1,
        nextStep: "personal-details",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Save Personal Details
const savePersonalDetails = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;
    const { fullName, email, contact, dateOfBirth, age, propertyType } =
      req.body;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    // Update personal details
    if (fullName) owner.fullName = fullName;
    if (email) owner.email = email;
    if (contact) owner.phoneNumber = contact;
    if (dateOfBirth) owner.dateOfBirth = new Date(dateOfBirth);
    if (age) owner.age = parseInt(age);
    if (propertyType) owner.propertyType = propertyType;

    // Update progress
    if (!owner.setupProgress.completedSteps.includes("personal-details")) {
      owner.setupProgress.completedSteps.push("personal-details");
    }
    owner.setupProgress.currentStep = 2;

    await owner.save();

    res.json({
      success: true,
      message: "Personal details saved successfully",
      data: {
        progress: owner.setupProgress,
        currentStep: 2,
        nextStep: "avatar",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Select Avatar
const selectAvatar = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;
    const { selectedAvatar, uploadedImage, isUploading } = req.body;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    // Update avatar selection
    if (selectedAvatar !== undefined) owner.selectedAvatar = selectedAvatar;
    if (uploadedImage !== undefined) owner.uploadedImage = uploadedImage;
    if (isUploading !== undefined) owner.isUploading = isUploading;

    // Update progress
    if (!owner.setupProgress.completedSteps.includes("avatar")) {
      owner.setupProgress.completedSteps.push("avatar");
    }
    owner.setupProgress.currentStep = 3;

    await owner.save();

    res.json({
      success: true,
      message: "Avatar selected successfully",
      data: {
        progress: owner.setupProgress,
        currentStep: 3,
        nextStep: "photo",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload Setup Photo
const uploadSetupPhoto = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Process uploaded image using saveFile utility
    const result = await saveFile(
      req.file.buffer,
      "profile_photos",
      req.file.originalname
    );

    const photoUrl = `${req.protocol}://${req.get("host")}${result.url}`;
    owner.profilePhoto = result.url;
    owner.uploadedImage = result.url;

    // Update progress
    if (!owner.setupProgress.completedSteps.includes("photo")) {
      owner.setupProgress.completedSteps.push("photo");
    }
    owner.setupProgress.currentStep = 4;

    await owner.save();

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        photoPath: result.url,
        photoUrl: photoUrl,
        filename: result.filename,
        originalName: result.originalName,
        progress: owner.setupProgress,
        currentStep: 4,
        nextStep: "complete-profile",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Complete Profile Details
const completeProfileDetails = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;
    const {
      fullName,
      email,
      contact,
      dateOfBirth,
      age,
      selectedAvatar,
      uploadedImage,
      propertyType,
    } = req.body;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    // Final confirmation of all profile details
    if (fullName) owner.fullName = fullName;
    if (email) owner.email = email;
    if (contact) owner.phoneNumber = contact;
    if (dateOfBirth) owner.dateOfBirth = new Date(dateOfBirth);
    if (age) owner.age = parseInt(age);
    if (selectedAvatar !== undefined) owner.selectedAvatar = selectedAvatar;
    if (uploadedImage) owner.uploadedImage = uploadedImage;
    if (propertyType) owner.propertyType = propertyType;

    // Update progress
    if (!owner.setupProgress.completedSteps.includes("complete-profile")) {
      owner.setupProgress.completedSteps.push("complete-profile");
    }
    owner.setupProgress.currentStep = 5;

    await owner.save();

    res.json({
      success: true,
      message: "Profile details completed successfully",
      data: {
        progress: owner.setupProgress,
        currentStep: 5,
        nextStep: "id-document",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload ID Document
const uploadIdDocument = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;
    const { idFileName, documentType } = req.body;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Process uploaded document using saveFile utility
    const result = await saveFile(
      req.file.buffer,
      "owner_documents",
      req.file.originalname
    );

    const documentUrl = `${req.protocol}://${req.get("host")}${result.url}`;
    const newDocument = {
      documentName: idFileName || req.file.originalname,
      documentType: documentType || "OTHER",
      documentPath: result.url,
      documentUrl: documentUrl,
      filename: result.filename,
      originalName: result.originalName,
      uploadDate: new Date(),
      verificationStatus: "pending",
      tags: ["identity", "setup"],
    };

    if (!owner.documents) {
      owner.documents = [];
    }
    owner.documents.push(newDocument);

    // Update progress
    if (!owner.setupProgress.completedSteps.includes("id-document")) {
      owner.setupProgress.completedSteps.push("id-document");
    }
    owner.setupProgress.currentStep = 6;

    await owner.save();

    res.json({
      success: true,
      message: "ID document uploaded successfully",
      data: {
        document: {
          ...newDocument,
          _id: owner.documents[owner.documents.length - 1]._id,
        },
        progress: owner.setupProgress,
        currentStep: 6,
        nextStep: "finalize",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Finalize Profile Setup
const finalizeProfileSetup = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;
    const { profileComplete } = req.body;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    // Finalize setup
    if (profileComplete) {
      owner.setupProgress.completedSteps.push("finalize");
      owner.setupProgress.currentStep = 7;
      owner.setupProgress.isComplete = true;
      owner.profileCompleted = true;
    }

    await owner.save();

    res.json({
      success: true,
      message: "Profile setup finalized successfully",
      data: {
        progress: owner.setupProgress,
        profileComplete: true,
        setupComplete: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Setup Status
const getSetupStatus = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { setupId } = req.params;

    const owner = await Owner.findById(ownerId);
    if (!owner || owner.setupId !== setupId) {
      return res.status(404).json({
        success: false,
        message: "Invalid setup session",
      });
    }

    const stepMap = {
      1: "initialize",
      2: "personal-details",
      3: "avatar",
      4: "photo",
      5: "complete-profile",
      6: "id-document",
      7: "finalize",
    };

    // Prepare owner data with full URLs
    const ownerData = {
      fullName: owner.fullName,
      email: owner.email,
      phoneNumber: owner.phoneNumber,
      profilePhoto: owner.profilePhoto,
      selectedAvatar: owner.selectedAvatar,
    };

    // Add full URLs for images
    if (owner.profilePhoto) {
      ownerData.profilePhotoUrl = `${req.protocol}://${req.get("host")}${
        owner.profilePhoto
      }`;
    }
    if (owner.uploadedImage) {
      ownerData.uploadedImageUrl = `${req.protocol}://${req.get("host")}${
        owner.uploadedImage
      }`;
    }

    res.json({
      success: true,
      message: "Setup status retrieved successfully",
      data: {
        setupId: owner.setupId,
        progress: owner.setupProgress,
        currentStep: owner.setupProgress.currentStep,
        currentStepName: stepMap[owner.setupProgress.currentStep],
        completedSteps: owner.setupProgress.completedSteps,
        isComplete: owner.setupProgress.isComplete,
        owner: ownerData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
  updateDocument,
  deleteDocument,
  verifyKYC,
  getVisitRequests,
  updateVisitRequest,
  createPreferredTenant,
  getPreferredTenants,
  updatePreferredTenant,
  deletePreferredTenant,
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  RescheduleVisit,
  getDashboard,
  // Multi-step profile setup methods
  initializeProfileSetup,
  savePersonalDetails,
  selectAvatar,
  uploadSetupPhoto,
  completeProfileDetails,
  uploadIdDocument,
  finalizeProfileSetup,
  getSetupStatus,
  verifyVisitRequest,
};
