const Owner = require("../models/Owner");
const Property = require("../models/Property");
const VisitRequest = require("../models/VisitRequest");
// const { saveFile } = require('../utils/fileUpload');
// const User = require("../models/User");
// const LandlordProfile = require("../models/LandlordProfile");
const Schedule = require("../models/Schedule");
const PropertyTenantCriteria = require("../models/PropertyTenantCriteria");
// const { uploadToCloudinary } = require("../utils/cloudinary");
const UniversalTenantApplication = require("../models/UniversalTenantApplication");
const calculateMatchScore = require("../utils/calculateMatchScore");

// Get Dashboard

const getDashboard = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const properties = await Property.find({ owner: ownerId }).lean();
    if (!properties.length) return res.json({ success: true, data: [] });

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
        };
      });

      const topTenants = tenants
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);

      return {
        property,
        tenants:topTenants,
      };
    });

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const owner = await Owner.findById(req.user._id).select("-password");

    // const profile = await LandlordProfile.findOne({
    //   userId: req.user._id,
    // }).populate("userId", "fullName emailId phonenumber profilePhoto");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: owner,
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
      email,
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
        emailId: email || req.user.emailId,
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

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: { profilePhoto: owner.profilePhoto },
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

    const { docType } = req.body;

    const result = await saveFile(
      req.file.buffer,
      "owner_documents",
      req.file.originalname
    );

    const owner = await Owner.findById(req.user._id);
    owner.documents.push({
      docType,
      docUrl: result.url,
    });
    await owner.save();

    res.json({
      success: true,
      message: "Document uploaded successfully",
      document: {
        docType,
        docUrl: result.url,
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
    const owner = await Owner.findById(req.user._id).select("documents");

    res.json({
      success: true,
      data: owner.documents,
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
    const { action, date, time, note } = req.body;

    const visitRequest = await VisitRequest.findById(requestId);
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
        if (!date || !time) {
          return res.status(400).json({
            success: false,
            message: "Date and time are required to schedule a visit",
          });
        }

        // Normalize times for comparison
        const normalizedTime = time.trim().toLowerCase();

        // Find matching slot
        const matchedSlot = visitRequest.slots.find(
          (slot) => slot.scheduledTime.trim().toLowerCase() === normalizedTime
        );

        if (!matchedSlot) {
          return res.status(400).json({
            success: false,
            message: "Selected time does not match tenant's available slots",
          });
        }

        // Update visit request
        updateData.status = "landlord_approved";
        updateData.scheduledDate = date;
        updateData.scheduledTime = time;
        updateData.notes = note || visitRequest.notes;
        updateData.progress = 100;

        // Create a confirmed schedule
        await Schedule.create({
          tenant: visitRequest.tenant,
          landlord: visitRequest.landlord,
          property: visitRequest.property,
          date,
          time,
          notes: note,
          status: "confirmed",
        });

        // Remove booked slot safely
        visitRequest.slots = visitRequest.slots.filter(
          (slot) => slot.scheduledTime.trim().toLowerCase() !== normalizedTime
        );
        await visitRequest.save();

        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    // Return updated visit request
    const updatedRequest = await VisitRequest.findById(requestId);

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
  deletePreferredTenant,
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  RescheduleVisit,
  getDashboard,
};
