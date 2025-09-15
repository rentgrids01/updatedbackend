const express = require('express');
const {
  getPublishedPlans,
  getPlanByCode
} = require('../controllers/subscriptionCatalogController');
const requestId = require('../middleware/requestId');

const router = express.Router();

// Apply request ID middleware
router.use(requestId);

// Public Catalog Routes
router.get('/plans', getPublishedPlans);
router.get('/plans/:code', getPlanByCode);

module.exports = router;