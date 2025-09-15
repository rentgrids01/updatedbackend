const express = require('express');
const {
  getAllProperties,
  getPropertyById,
  getSimilarProperties,
  getOwnerProperties,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  deleteProperty,
  uploadPropertyImages,
  deletePropertyImage,
  uploadPropertyDocuments,
  deletePropertyDocument
} = require('../controllers/propertyController');
const { auth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Public Property Routes (no auth required)
router.get('/', getAllProperties);
router.get('/:propertyId', getPropertyById);
router.get('/:propertyId/similar', getSimilarProperties);

// Owner Property Routes (auth required)
router.get('/owner/properties', auth, requireRole(['landlord']), getOwnerProperties);
router.post('/', auth, requireRole(['landlord']), upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'documents', maxCount: 5 }
]), createProperty);
router.put('/:propertyId', auth, requireRole(['landlord']), updateProperty);
router.patch('/:propertyId/status', auth, requireRole(['landlord']), updatePropertyStatus);
router.delete('/:propertyId', auth, requireRole(['landlord']), deleteProperty);

// Property Media Routes
router.post('/:propertyId/images', auth, requireRole(['landlord']), upload.array('images', 10), uploadPropertyImages);
router.delete('/:propertyId/images', auth, requireRole(['landlord']), deletePropertyImage);
router.post('/:propertyId/documents', auth, requireRole(['landlord']), upload.array('documents', 5), uploadPropertyDocuments);
router.delete('/:propertyId/documents', auth, requireRole(['landlord']), deletePropertyDocument);

module.exports = router;