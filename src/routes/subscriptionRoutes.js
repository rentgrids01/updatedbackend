const express = require('express');
const {
  getSubscriptionPlans,
  purchaseSubscription,
  getSubscriptionStatus,
  getSubscriptionFeatures,
  cancelSubscription
} = require('../controllers/subscriptionController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(auth);

// Subscription routes
router.get('/plans', getSubscriptionPlans);
router.post('/purchase', purchaseSubscription);
router.get('/status', getSubscriptionStatus);
router.get('/features', getSubscriptionFeatures);
router.patch('/cancel', cancelSubscription);

module.exports = router;