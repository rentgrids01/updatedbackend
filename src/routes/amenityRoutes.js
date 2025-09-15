const express = require('express');
const {
  getAllAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity
} = require('../controllers/amenityController');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', getAllAmenities);

// Admin routes (require landlord role for now)
router.post('/', auth, requireRole(['landlord']), upload.single('icon'), createAmenity);
router.put('/:amenityId', auth, requireRole(['landlord']), upload.single('icon'), updateAmenity);
router.delete('/:amenityId', auth, requireRole(['landlord']), deleteAmenity);

module.exports = router;