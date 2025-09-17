const express = require("express");
const {
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
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  RescheduleVisit,
  createPreferredTenant,
  getPreferredTenants,
  updatePreferredTenant,
  deletePreferredTenant,
} = require("../controllers/ownerController");
const { auth, requireUserType } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Apply auth middleware to all owner routes
router.use(auth);
router.use(requireUserType(["owner"]));

// Profile Routes
router.get("/profile", getProfile);
router.post("/profile", createProfile);
router.put("/profile", updateProfile);
router.post("/profile/avatar", uploadAvatar);
router.post("/profile/photo", upload.single("photo"), uploadProfilePhoto);

// Documents
router.post("/documents", upload.single("file"), uploadDocument);
router.get("/documents", getDocuments);
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
