const express = require('express');
const {
  sendPropertyInquiry,
  getPendingInquiries,
  getAllInquiriesForOwner,
  getInquiriesForTenant,
  acceptInquiry,
  declineInquiry,
  getInquiryDetails,
  getChatFromInquiry,
  cleanupExpiredInquiries
} = require('../controllers/propertyInquiryController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Tenant routes
router.post('/send', sendPropertyInquiry);  // Send property inquiry
router.get('/tenant/my-inquiries', getInquiriesForTenant);  // Get tenant's inquiries

// Owner routes
router.get('/owner/pending', getPendingInquiries);  // Get pending inquiries for owner
router.get('/owner/all', getAllInquiriesForOwner);  // Get all inquiries for owner
router.post('/:inquiryId/accept', acceptInquiry);  // Accept inquiry and create chat
router.post('/:inquiryId/decline', declineInquiry);  // Decline inquiry

// Shared routes
router.get('/:inquiryId', getInquiryDetails);  // Get inquiry details
router.get('/:inquiryId/chat', getChatFromInquiry);  // Get chat from inquiry

// Admin/Utility routes
router.post('/cleanup/expired', cleanupExpiredInquiries);  // Clean up expired inquiries

module.exports = router;