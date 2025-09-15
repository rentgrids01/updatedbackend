const express = require('express');
const { handleRazorpayWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Webhook Routes (no auth required)
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;