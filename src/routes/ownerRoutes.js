const express = require("express");
const {
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
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  RescheduleVisit,
  createPreferredTenant,
  getPreferredTenants,
  updatePreferredTenant,
  deletePreferredTenant,
  getDashboard,
  // Multi-step profile setup
  initializeProfileSetup,
  savePersonalDetails,
  selectAvatar,
  uploadSetupPhoto,
  completeProfileDetails,
  uploadIdDocument,
  finalizeProfileSetup,
  getSetupStatus,
  verifyVisitRequest
} = require("../controllers/ownerController");
const { auth, requireUserType } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Apply auth middleware to all owner routes
router.use(auth);
router.use(requireUserType(["owner"]));

router.get('/dashboard',getDashboard)

// 🚀 Multi-Step Profile Setup Routes
router.post("/profile/setup/initialize", initializeProfileSetup);
router.post("/profile/setup/:setupId/personal-details", savePersonalDetails);
router.post("/profile/setup/:setupId/avatar", selectAvatar);
router.post("/profile/setup/:setupId/photo", upload.single("uploadedImage"), uploadSetupPhoto);
router.post("/profile/setup/:setupId/complete-profile", completeProfileDetails);
router.post("/profile/setup/:setupId/id-document", upload.single("uploadedIdFile"), uploadIdDocument);
router.post("/profile/setup/:setupId/finalize", finalizeProfileSetup);
router.get("/profile/setup/:setupId/status", getSetupStatus);

// Profile Routes
router.get("/profile", getProfile);
router.post("/profile", createProfile);
router.put("/profile", updateProfile);
router.post("/profile/avatar", uploadAvatar);
router.post("/profile/photo", upload.single("photo"), uploadProfilePhoto);

// Documents
router.post("/documents", upload.single("file"), uploadDocument);
router.get("/documents", getDocuments);
router.put("/documents/:id", updateDocument);
router.delete("/documents/:id", deleteDocument);
router.patch("/verify", verifyKYC);

// Preferred Tenants
router.post("/property/:propertyId/preferred-tenants", createPreferredTenant);
router.get("/property/:propertyId/preferred-tenants", getPreferredTenants);
router.patch(
  "/property/:propertyId/preferred-tenants/:preferredTenantId",
  updatePreferredTenant
);
router.delete("/property/:preferredTenantId/preferred-tenants", deletePreferredTenant);

// Visit Requests
router.get("/visit-requests", getVisitRequests);
router.patch("/visit-requests/:requestId", updateVisitRequest);

// verify Visit - OTP Verification
router.post("/visit-requests/:requestId/verify", verifyVisitRequest);

// Visit Request Reschedule Actions From Tenant
router.patch(
  "/visit-requests/:requestId/accept-reschedule",
  acceptRescheduleRequest
);
router.patch(
  "/visit-requests/:requestId/reject-reschedule",
  rejectRescheduleRequest
);

// Reschedule Visit Request
router.patch("/visit-requests/:requestId/reschedule", RescheduleVisit);

module.exports = router;
