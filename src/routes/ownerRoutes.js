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
  getVisitRequests,
  updateVisitRequest
} = require('../controllers/ownerController');
const { auth, requireUserType } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply auth middleware to all owner routes
router.use(auth);
router.use(requireUserType(['owner']));

// Profile Routes
router.get('/profile', getProfile);
router.post('/profile', createProfile);
router.put('/profile', updateProfile);
router.post('/profile/avatar', uploadAvatar);
router.post('/profile/photo', upload.single('photo'), uploadProfilePhoto);

// Documents
router.post('/documents', upload.single('file'), uploadDocument);
router.get('/documents', getDocuments);
router.delete('/documents/:id', deleteDocument);
router.patch('/verify', verifyKYC);

// Visit Requests
router.get('/visit-requests', getVisitRequests);
router.patch('/visit-requests/:requestId', updateVisitRequest);

module.exports = router;