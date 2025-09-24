const express = require('express');
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
  getDashboardSummary,
  getSavedProperties,
  saveProperty,
  deleteSavedProperty,
  bulkDeleteSavedProperties,
  replaceSavedProperties,
  generateFAQ ,
  getApplications,
  createApplication,
  updateApplicationStep2,
  updateApplicationStep3,
  rescheduleRequest,
  acceptRescheduleRequest,
  rejectRescheduleRequest,
  createscheduleVisitRequest,
  getVisitRequestStatus
} = require('../controllers/tenantController');

const {
  initializeProfileSetup,
  savePersonalDetails,
  selectAvatar,
  uploadProfilePhoto: uploadSetupPhoto,
  completeProfileDetails,
  uploadIdDocument,
  finalizeProfileSetup,
  getSetupStatus,
  getDocuments: getProfileDocuments,
  uploadDocument: uploadProfileDocument,
  updateDocument,
  deleteDocument: deleteProfileDocument
} = require('../controllers/tenantProfileController');
const { auth, requireUserType } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply auth middleware to all tenant routes
router.use(auth);
router.use(requireUserType(["tenant"]));

// Profile Routes
router.get('/profile', getProfile);
router.post('/profile', createProfile);
router.put('/profile', updateProfile);
router.post('/profile/avatar', uploadAvatar);
router.post('/profile/photo', upload.single('photo'), uploadProfilePhoto);

// Multi-Step Profile Setup Routes
router.post('/profile/setup/initialize', initializeProfileSetup);
router.post('/profile/setup/:setupId/personal-details', savePersonalDetails);
router.post('/profile/setup/:setupId/avatar', selectAvatar);
router.post('/profile/setup/:setupId/photo', upload.single('uploadedImage'), uploadSetupPhoto);
router.post('/profile/setup/:setupId/complete-profile', completeProfileDetails);
router.post('/profile/setup/:setupId/id-document', upload.single('uploadedIdFile'), uploadIdDocument);
router.post('/profile/setup/:setupId/finalize', finalizeProfileSetup);
router.get('/profile/setup/:setupId/status', getSetupStatus);

// Document Management Routes
router.get('/profile/documents', getProfileDocuments);
router.post('/profile/documents', upload.single('document'), uploadProfileDocument);
router.put('/profile/documents/:documentId', updateDocument);
router.delete('/profile/documents/:documentId', deleteProfileDocument);

// Documents
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', getDocuments);
router.delete('/documents/:id', deleteDocument);
router.patch('/verify', verifyKYC);

// Dashboard
router.get('/dashboard/summary', getDashboardSummary);

// Saved Properties
router.get('/saved-properties', getSavedProperties);
router.post('/saved-properties', saveProperty);
router.delete('/saved-properties/:id', deleteSavedProperty);
router.post('/saved-properties/bulk-delete', bulkDeleteSavedProperties);
router.post('/saved-properties/replace', replaceSavedProperties);


// FAQ Route
router.post("/faq", generateFAQ);

// Universal Tenant Application Routes
router.get('/applications/:applicationId', getApplications);
router.post('/applications/step1', createApplication);
router.patch('/applications/step2', updateApplicationStep2);
router.patch('/applications/step3', updateApplicationStep3);


//Schedule Visit Request
router.post("/visit-requests", createscheduleVisitRequest);

//Visit Request Status
router.get("/visit-requests", getVisitRequestStatus);

// Reschedule Visits
router.patch("/visit-requests/:requestId/reschedule", rescheduleRequest);

// Accetpt and Reject Reschedule Request From Landlord
router.patch("/visit-requests/:requestId/accept-reschedule", acceptRescheduleRequest);
router.patch("/visit-requests/:requestId/reject-reschedule", rejectRescheduleRequest);
module.exports = router;