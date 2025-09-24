const express = require('express');
const {
  submitContactForm,
  getContactSubmissions,
  updateContactStatus
} = require('../controllers/contactController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public Contact Form Routes (No Authentication Required)
router.post('/', submitContactForm);

// Admin Contact Management Routes (Authentication Required - For Future Use)
router.get('/', auth, requireRole(['admin']), getContactSubmissions);
router.patch('/:contactId/status', auth, requireRole(['admin']), updateContactStatus);

module.exports = router;