const express = require('express');
const {
  createVisitRequest,
  getVisitRequests,
  getVisitRequestDetails,
  cancelVisitRequest,
  createPaymentIntent,
  getPaymentStatus,
  reapplyVisitRequest
} = require('../controllers/visitController');
const { auth, requireUserType } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(auth);

// Visit request routes (tenant only)
router.post('/requests', requireUserType(['tenant']), createVisitRequest);
router.get('/requests', requireUserType(['tenant']), getVisitRequests);
router.get('/requests/:id', requireUserType(['tenant']), getVisitRequestDetails);
router.patch('/requests/:id/cancel', requireUserType(['tenant']), cancelVisitRequest);
router.post('/requests/:id/reapply', requireUserType(['tenant']), reapplyVisitRequest);

// Payment routes
router.post('/:id/payments/intent', requireUserType(['tenant']), createPaymentIntent);
router.get('/payments/:paymentId', getPaymentStatus);

module.exports = router;