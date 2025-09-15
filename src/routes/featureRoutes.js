const express = require('express');
const {
  getAllFeatures,
  createFeature,
  updateFeature,
  deleteFeature
} = require('../controllers/featureController');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', getAllFeatures);

// Admin routes (require landlord role for now)
router.post('/', auth, requireRole(['landlord']), upload.single('icon'), createFeature);
router.put('/:featureId', auth, requireRole(['landlord']), upload.single('icon'), updateFeature);
router.delete('/:featureId', auth, requireRole(['landlord']), deleteFeature);

module.exports = router;