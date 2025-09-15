const express = require('express');
const {
  subscribeToPlan,
  getUserSubscriptions,
  getSubscriptionById,
  getUserEntitlements,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  reportUsage
} = require('../controllers/userSubscriptionController');
const { auth } = require('../middleware/auth');
const requestId = require('../middleware/requestId');

const router = express.Router();

// Apply auth and request ID middleware
router.use(auth);
router.use(requestId);

// Subscription Management
router.post('/subscriptions', subscribeToPlan);
router.get('/subscriptions', getUserSubscriptions);
router.get('/subscriptions/:id', getSubscriptionById);
router.get('/entitlements', getUserEntitlements);
router.post('/subscriptions/:id/cancel', cancelSubscription);
router.post('/subscriptions/:id/pause', pauseSubscription);
router.post('/subscriptions/:id/resume', resumeSubscription);

// Usage Reporting
router.post('/usage/consume', reportUsage);

module.exports = router;