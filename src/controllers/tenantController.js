const Tenant = require("../models/Tenant");
const SavedProperty = require("../models/SavedProperty");
const Property = require("../models/Property");
const VisitRequest = require("../models/VisitRequest");
const TenantProfile = require("../models/TenantProfile");
const UniversalTenantApplication = require("../models/UniversalTenantApplication");
const { saveFile } = require("../utils/fileUpload");
const { calculateProfileScore } = require("../utils/calculateProfileScore");
const {
  getPredefinedResponse,
  getChatbotResponse,
} = require("../utils/faqService");
const { verifyOTP } = require("../utils/emailService");
// Get Profile
const getProfile = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user._id).select("-password");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: tenant,
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
      // email,
      phone,
      dob,
      gender,
      profilePhoto,
    } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      {
        fullName: fullName || req.user.fullName,
        // emailId: email || req.user.emailId,
        phonenumber: phone || req.user.phonenumber,
        dob,
        gender,
        profilePhoto,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile created successfully",
      data: tenant,
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

    const tenant = await Tenant.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }
    const profileScore = calculateProfileScore(tenant);
    tenant.isProfileComplete = profileScore === 100;
    await tenant.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: tenant,
      profileScore,
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

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { avatar, updatedAt: new Date() },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Avatar updated successfully",
      data: { avatar: tenant.avatar },
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

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: result.url, updatedAt: new Date() },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: { profilePhoto: tenant.profilePhoto },
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
      "tenant_documents",
      req.file.originalname
    );

    const tenant = await Tenant.findById(req.user._id);
    tenant.documents.push({
      docType,
      docUrl: result.url,
    });
    await tenant.save();

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
    const tenant = await Tenant.findById(req.user._id).select("documents");

    res.json({
      success: true,
      data: tenant.documents,
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

    const tenant = await Tenant.findById(req.user._id);
    tenant.documents = tenant.documents.filter(
      (doc) => doc._id.toString() !== id
    );
    await tenant.save();

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

    const tenant = await Tenant.findByIdAndUpdate(
      req.user._id,
      { verificationStatus, verifiedBy, updatedAt: new Date() },
      { new: true }
    ).select("-password");

    res.json({
      success: true,
      message: "KYC verification updated successfully",
      data: { verificationStatus: tenant.verificationStatus },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Dashboard Summary
const getDashboardSummary = async (req, res) => {
  try {
    const visitRequests = await VisitRequest.find({ tenant: req.user._id });
    const savedProperties = await SavedProperty.find({ tenant: req.user._id });
    const profileScore = calculateProfileScore(req.user);

    const counters = {
      pendingVerification: req.user.verificationStatus === "pending" ? 1 : 0,
      requestedVisits: {
        pending: visitRequests.filter((v) =>
          ["submitted", "landlord_reviewing"].includes(v.status)
        ).length,
        accepted: visitRequests.filter((v) => v.status === "landlord_approved")
          .length,
        rejected: visitRequests.filter((v) => v.status === "landlord_rejected")
          .length,
      },
      scheduledVisits: visitRequests.filter((v) => v.status === "scheduled")
        .length,
      savedProperties: savedProperties.length,
      unreadMessages: 0, // TODO: implement messaging
      payments: {
        pending: visitRequests.filter((v) => v.paymentStatus === "pending")
          .length,
      },
    };

    const nextActions = [];
    const pendingPayments = visitRequests.filter(
      (v) => v.paymentStatus === "pending"
    );
    if (pendingPayments.length > 0) {
      nextActions.push({
        type: "complete_payment",
        visitRequestId: pendingPayments[0]._id,
        cta: {
          label: "Pay to Confirm Your Visit",
          href: `/tenant/visits/${pendingPayments[0]._id}`,
        },
      });
    }

    const recent = {
      requestedVisits: visitRequests.slice(-3).map((visit) => ({
        id: visit._id,
        property: {
          id: visit.property,
          // TODO: populate property details
        },
        status: visit.status,
        progress: visit.progress,
      })),
      savedProperties: savedProperties.slice(-3),
    };

    res.json({
      success: true,
      data: {
        tenant: {
          id: req.user._id,
          name: req.user.fullName,
          avatarUrl: req.user.profilePhoto,
          profileScore: profileScore,
          kyc: {
            status: req.user.verificationStatus,
            lastVerifiedAt: req.user.updatedAt,
          },
        },
        counters,
        nextActions,
        recent,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Saved Properties
const getSavedProperties = async (req, res) => {
  try {
    const savedProperties = await SavedProperty.find({ tenant: req.user._id })
      .populate("property")
      .sort({ savedAt: -1 });

    res.json({
      success: true,
      data: savedProperties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
        message: "Property not found",
      });
    }

    // Check if already saved
    const existingSaved = await SavedProperty.findOne({
      tenant: req.user._id,
      property: propertyId,
    });

    if (existingSaved) {
      return res.status(400).json({
        success: false,
        message: "Property already saved",
      });
    }

    const savedProperty = await SavedProperty.create({
      tenant: req.user._id,
      property: propertyId,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Property saved successfully",
      data: savedProperty,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Saved Property
const deleteSavedProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await SavedProperty.findOneAndDelete({
      _id: id,
      tenant: req.user._id,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Saved property not found",
      });
    }

    res.json({
      success: true,
      message: "Property removed from saved list",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk Delete Saved Properties
const bulkDeleteSavedProperties = async (req, res) => {
  try {
    const { propertyIds } = req.body;

    await SavedProperty.deleteMany({
      tenant: req.user._id,
      property: { $in: propertyIds },
    });

    res.json({
      success: true,
      message: "Properties removed from saved list",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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
    const savedProperties = propertyIds.map((propertyId) => ({
      tenant: req.user._id,
      property: propertyId,
    }));

    await SavedProperty.insertMany(savedProperties);

    res.json({
      success: true,
      message: "Saved properties list updated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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

const rescheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { scheduledDate, slots } = req.body;
    const tenantId = req.user._id;

    if (!scheduledDate || !slots) {
      return res.status(400).json({
        success: false,
        message: "scheduledDate and time of slots are required",
      });
    }

    const visit = await VisitRequest.findById(requestId).populate("property");

    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visit?.tenant?.toString() !== tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reschedule this visit",
      });
    }

    // Get property with landlord schedule
    const propertyDoc = await Property.findById(visit.property);
    if (!propertyDoc) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    // Check if landlord has set up their schedule
    if (!propertyDoc.landlordSchedule) {
      return res.status(400).json({
        success: false,
        message:
          "Landlord has not set up their availability schedule for this property.",
      });
    }

    const { scheduledDate: landlordDate, slots: landlordSlots } =
      propertyDoc.landlordSchedule;

    // Convert dates to compare
    const requestedDate = new Date(scheduledDate);
    requestedDate.setHours(0, 0, 0, 0);

    const availableDate = new Date(landlordDate);
    availableDate.setHours(0, 0, 0, 0);

    // Check if the requested date matches landlord's available date
    if (requestedDate.getTime() !== availableDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: `Visit can only be rescheduled to ${availableDate.toDateString()}. Please select from the landlord's available dates.`,
      });
    }

    // Extract available time slots from landlord's schedule
    const availableTimeSlots = landlordSlots.map((slot) => slot.scheduledTime);
    const requestedTimeSlots = slots.map((slot) => slot.scheduledTime);
    const invalidSlots = requestedTimeSlots.filter(
      (time) => !availableTimeSlots.includes(time)
    );

    if (invalidSlots.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following time slots are not available: ${invalidSlots.join(
          ", "
        )}. Available slots are: ${availableTimeSlots.join(", ")}`,
      });
    }

    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);

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

    // Check if any of the requested slots are already booked by other tenants
    const conflictingVisits = await VisitRequest.find({
      property: visit.property,
      scheduledDate: startOfDay,
      slots: {
        $elemMatch: {
          scheduledTime: { $in: requestedTimeSlots },
        },
      },
      status: { $in: ["pending", "scheduled", "landlord_approved"] },
      _id: { $ne: requestId }, // Exclude current visit request
    });

    if (conflictingVisits.length > 0) {
      const bookedSlots = conflictingVisits.flatMap((visit) =>
        visit.slots
          .filter((slot) => requestedTimeSlots.includes(slot.scheduledTime))
          .map((slot) => slot.scheduledTime)
      );

      return res.status(409).json({
        success: false,
        message: `The following time slots are already booked: ${[
          ...new Set(bookedSlots),
        ].join(", ")}. Please choose different time slots.`,
      });
    }

    visit.scheduledDate = startOfDay;
    visit.slots = newSlots;
    visit.status = "visit_requested";
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

// Accept Reschedule Request
const acceptRescheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user._id;

    const visit = await VisitRequest.findById(requestId);
    if (!visit) {
      return res
        .status(404)
        .json({ success: false, message: "Visit request not found" });
    }

    if (visit.tenant.toString() !== tenantId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
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
    const tenantId = req.user._id;

    const visit = await VisitRequest.findById(requestId);
    if (!visit) {
      return res.status(404).json({
        success: false,
        message: "Visit request not found",
      });
    }

    if (visit.tenant.toString() !== tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this reschedule",
      });
    }

    visit.status = "cancelled_by_tenant";
    visit.updatedAt = new Date();

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

// Universal Tenant Application Handlers
const getApplications = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await UniversalTenantApplication.findOne({
      _id: applicationId,
    });

    console.log("application", application);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: application,
      tenant: application.applicationId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Step 1 - Personal Details & Work Status
// const createApplication = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { personalDetails, workStatus } = req.body;

//     let tenantProfile = await Tenant.findOne({ _id: userId });
//     if (!tenantProfile) {
//       return res.status(404).json({
//         success: false,
//         message: "TenantProfile not found. Please create profile first.",
//       });
//     }

//     let application;
//     if (tenantProfile.applicationId) {
//       application = await UniversalTenantApplication.findById(
//         tenantProfile.applicationId
//       );
//     }

//     if (!application) {
//       application = new UniversalTenantApplication({
//         tenantId: tenantProfile._id,
//         personalDetails,
//         workStatus,
//       });
//       await application.save();
//       tenantProfile.applicationId = application._id;
//       await tenantProfile.save();
//     } else {
//       application.personalDetails = personalDetails;
//       application.workStatus = workStatus;
//       await application.save();
//     }

//     res.status(201).json({
//       success: true,
//       message: "Step 1 saved",
//       data: application,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// };

const createApplication = async (req, res) => {
  try {
    const userId = req.user._id;
    const { workStatus } = req.body;

    if (!workStatus || !workStatus.employee || !workStatus.employer) {
      return res.status(400).json({
        success: false,
        message: "Work status details (employee and employer) are required.",
      });
    }

    const tenantProfile = await Tenant.findById(userId);
    if (!tenantProfile) {
      return res.status(404).json({
        success: false,
        message: "Tenant profile not found. Please create profile first.",
      });
    }

    if (!tenantProfile.isProfileComplete) {
      return res.status(400).json({
        success: false,
        message:
          "Please complete your profile before filling out the application form.",
      });
    }

    const personalDetails = {
      fullName: tenantProfile.fullName,
      age: tenantProfile.age,
      emailId: tenantProfile.emailId,
      phonenumber: tenantProfile.phonenumber,
    };

    let application = null;

    if (tenantProfile.applicationId) {
      application = await UniversalTenantApplication.findById(
        tenantProfile.applicationId
      );
    }

    if (!application) {
      application = new UniversalTenantApplication({
        tenantId: tenantProfile._id,
        personalDetails,
        workStatus,
      });

      await application.save();

      tenantProfile.applicationId = application._id;
      await tenantProfile.save();

      return res.status(201).json({
        success: true,
        message: "Application created successfully - Step 1 saved",
        data: application,
      });
    } else {
      // Update existing application
      application.personalDetails = personalDetails;
      application.workStatus = workStatus;
      application.updatedAt = new Date();

      await application.save();

      return res.status(200).json({
        success: true,
        message: "Application updated successfully - Step 1 saved",
        data: application,
      });
    }
  } catch (err) {
    console.error("Error in createApplication:", err);

    // Handle specific MongoDB duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Application already exists for this tenant.",
        error: "Duplicate application error",
      });
    }

    // Handle validation errors

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

// Step 2 - Property Preferences, Rental History, Preferences, Documents
const updateApplicationStep2 = async (req, res) => {
  try {
    const userId = req.user._id;
    const { propertyPreferences, rentalHistory, preferences, documents } =
      req.body;

    const tenantProfile = await Tenant.findOne({ _id: userId }).populate(
      "applicationId"
    );
    if (!tenantProfile)
      return res.status(404).json({
        success: false,
        message: "TenantProfile not found.",
      });

    const application = tenantProfile.applicationId;
    if (!application)
      return res.status(404).json({
        success: false,
        message: "Application not found. Please complete step 1 first.",
      });

    if (propertyPreferences) {
      if (typeof propertyPreferences === "string") {
        try {
          const parsedPrefs = JSON.parse(propertyPreferences);
          if (parsedPrefs.moveInDate) {
            parsedPrefs.moveInDate = new Date(parsedPrefs.moveInDate);
          }
          application.propertyPreferences = parsedPrefs;
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid propertyPreferences format",
            error: error.message,
          });
        }
      } else {
        if (propertyPreferences.moveInDate) {
          propertyPreferences.moveInDate = new Date(
            propertyPreferences.moveInDate
          );
        }
        application.propertyPreferences = propertyPreferences;
      }
    }
    if (rentalHistory) {
      if (typeof rentalHistory === "string") {
        try {
          const rentalObj = JSON.parse(rentalHistory);
          rentalObj.documents = rentalObj.documents || [];
          application.rentalHistory = rentalObj;
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid rentalHistory format",
            error: error.message,
          });
        }
      } else {
        application.rentalHistory = rentalHistory;
      }
    }

    // Preferences
    if (preferences) {
      if (typeof preferences === "string") {
        try {
          application.preferences = JSON.parse(preferences);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid preferences format",
            error: error.message,
          });
        }
      } else {
        application.preferences = preferences;
      }
    }

    if (req.files?.documents) {
      application.documents = application.documents || [];
      for (const [idx, file] of req.files.documents.entries()) {
        try {
          const result = await saveFile(
            file.buffer,
            "application_documents",
            file.originalname
          );
          application.documents.push({
            docName: Array.isArray(req.body.docType)
              ? req.body.docType[idx]
              : req.body.docType || "Document",
            docUrl: result.url,
            uploadedAt: new Date(),
          });
        } catch (error) {
          console.error("Application document upload failed:", error.message);
          // Continue with other uploads even if one fails
        }
      }
    }

    if (req.files?.rentalHistoryDocs) {
      // Ensure rentalHistory object exists
      application.rentalHistory = application.rentalHistory || {};
      application.rentalHistory.rentalHistoryDocs =
        application.rentalHistory.rentalHistoryDocs || [];

      for (const [idx, file] of req.files.rentalHistoryDocs.entries()) {
        try {
          const result = await saveFile(
            file.buffer,
            "rental_history_documents",
            file.originalname
          );
          application.rentalHistory.rentalHistoryDocs.push({
            docName: Array.isArray(req.body.rentalDocName)
              ? req.body.rentalDocName[idx]
              : req.body.rentalDocName || file.originalname,
            docUrl: result.url,
            uploadedAt: new Date(),
          });
        } catch (error) {
          console.error("Rental history doc upload failed:", error.message);
        }
      }
    }

    await application.save();

    res.status(200).json({
      success: true,
      message: "Step 2 saved",
      data: application,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Step 3 - Video Introduction & Complete Application
const updateApplicationStep3 = async (req, res) => {
  try {
    const userId = req.user._id;
    const { videoIntroUrl } = req.body;

    // Fetch tenant profile and populate application
    const tenantProfile = await Tenant.findOne({ _id: userId }).populate(
      "applicationId"
    );

    if (!tenantProfile) {
      return res
        .status(404)
        .json({ success: false, message: "TenantProfile not found." });
    }

    const application = tenantProfile.applicationId;
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found. Please complete step 1 first.",
      });
    }

    // Handle video introduction upload
    if (req.file) {
      try {
        // Validate file type (optional)
        const allowedTypes = [
          "video/mp4",
          "video/avi",
          "video/mov",
          "video/wmv",
          "video/webm",
        ];
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid video format. Please upload MP4, AVI, MOV, WMV, or WebM files.",
          });
        }

        const result = await saveFile(
          req.file.buffer,
          "video_intros",
          req.file.originalname
        );
        application.videoIntroUrl = result.url;

        // Save video metadata
        application.videoIntroMetadata = {
          originalName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date(),
        };
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload video",
          error: error.message,
        });
      }
    } else if (req.body.videoIntroUrl) {
      // Validate URL format (optional)
      try {
        new URL(req.body.videoIntroUrl);
        application.videoIntroUrl = req.body.videoIntroUrl;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid video URL format.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide a video file or a valid video URL.",
      });
    }
    application.isCompleted = true;

    await application.save();

    res.status(200).json({
      success: true,
      message: "Step 3 saved & application completed",
      data: application,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Schedule Visit Request
const createscheduleVisitRequest = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { property, scheduledDate, slots, status, notes } = req.body;
    const propertyDoc = await Property.findById(property);

    if (!propertyDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    const landlordId = propertyDoc?.owner;

    // Validate required fields
    if (
      !tenantId ||
      !property ||
      !scheduledDate ||
      !slots ||
      slots.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "property, scheduledDate, and slots are required",
      });
    }

    // Check if landlord has set up their schedule for this property
    if (!propertyDoc.landlordSchedule) {
      return res.status(400).json({
        success: false,
        message:
          "Landlord has not set up their availability schedule for this property. Please contact the landlord.",
      });
    }

    const { scheduledDate: landlordDate, slots: landlordSlots } =
      propertyDoc.landlordSchedule;

    // Convert dates to compare (normalize to just date, ignore time)
    const requestedDate = new Date(scheduledDate);
    requestedDate.setHours(0, 0, 0, 0);

    const availableDate = new Date(landlordDate);
    availableDate.setHours(0, 0, 0, 0);

    // Check if the requested date matches landlord's available date
    if (requestedDate.getTime() !== availableDate.getTime()) {
      return res.status(400).json({
        success: false,
        message: `Visit can only be scheduled on ${availableDate.toDateString()}. Please select from the landlord's available dates.`,
      });
    }

    // Extract available time slots from landlord's schedule
    const availableTimeSlots = landlordSlots.map((slot) => slot.scheduledTime);

    // Check if all requested time slots are available in landlord's schedule
    const requestedTimeSlots = slots.map((slot) => slot.scheduledTime);
    const invalidSlots = requestedTimeSlots.filter(
      (time) => !availableTimeSlots.includes(time)
    );

    if (invalidSlots.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following time slots are not available: ${invalidSlots.join(
          ", "
        )}. Available slots are: ${availableTimeSlots.join(", ")}`,
      });
    }

    // Check for existing visit requests for the same property, date, and time slots
    const existingSlot = await VisitRequest.findOne({
      tenant: tenantId,
      property,
      scheduledDate,
      slots: {
        $elemMatch: {
          scheduledTime: { $in: requestedTimeSlots },
        },
      },
      status: { $in: ["pending", "scheduled"] },
    });

    if (existingSlot) {
      return res.status(409).json({
        success: false,
        message: "You already have a visit request for this exact time slot.",
      });
    }

    // Check if any of the requested slots are already booked by other tenants
    const conflictingVisits = await VisitRequest.find({
      property,
      scheduledDate,
      slots: {
        $elemMatch: {
          scheduledTime: { $in: requestedTimeSlots },
        },
      },
      status: { $in: ["pending", "scheduled", "landlord_approved"] },
      tenant: { $ne: tenantId }, // Exclude current tenant
    });

    if (conflictingVisits.length > 0) {
      const bookedSlots = conflictingVisits.flatMap((visit) =>
        visit.slots
          .filter((slot) => requestedTimeSlots.includes(slot.scheduledTime))
          .map((slot) => slot.scheduledTime)
      );

      return res.status(409).json({
        success: false,
        message: `The following time slots are already booked: ${[
          ...new Set(bookedSlots),
        ].join(", ")}. Please choose different time slots.`,
      });
    }

    const visitRequest = await VisitRequest.create({
      tenant: tenantId,
      landlord: landlordId,
      property,
      scheduledDate,
      slots,
      notes,
      status: status || "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Visit request scheduled successfully",
      data: visitRequest,
    });
  } catch (error) {
    console.error("Error scheduling visit request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to schedule visit request",
      error: error.message,
    });
  }
};

// Get Visit Request Status
const getVisitRequestStatus = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { status } = req.query;

    const filter = { tenant: tenantId };
    if (status) {
      filter.status = status;
    }

    const visitRequests = await VisitRequest.find(filter)
      .populate("landlord", "name email")
      .populate("property", "title location");

    res.status(200).json({
      success: true,
      data: visitRequests,
    });
  } catch (error) {
    console.error("Error fetching tenant visit requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch visit requests",
      error: error.message,
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
  getDashboardSummary,
  getSavedProperties,
  saveProperty,
  deleteSavedProperty,
  generateFAQ,
  bulkDeleteSavedProperties,
  replaceSavedProperties,
  rescheduleRequest,
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  getApplications,
  createApplication,
  updateApplicationStep2,
  updateApplicationStep3,
  createscheduleVisitRequest,
  getVisitRequestStatus,
};
