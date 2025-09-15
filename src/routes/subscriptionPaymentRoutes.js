const express = require('express');
const {
  getUserInvoices,
  getInvoiceById,
  initializePayment,
  confirmPayment
} = require('../controllers/subscriptionPaymentController');
const { auth } = require('../middleware/auth');
const requestId = require('../middleware/requestId');

const router = express.Router();

// Apply auth and request ID middleware
router.use(auth);
router.use(requestId);

// Invoice & Payment Routes
router.get('/invoices', getUserInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/payments/init', initializePayment);
router.post('/payments/confirm', confirmPayment);

module.exports = router;