const express = require('express');
const {
  createPlan,
  updatePlan,
  publishPlan,
  getAllPlans,
  getPlanById,
  deletePlan,
  addPlanFeature,
  updatePlanFeature,
  deletePlanFeature,
  createCoupon,
  updateCoupon,
  getAllCoupons,
  deleteCoupon,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscriptionStatus,
  getAllInvoices,
  getAllPayments
} = require('../controllers/adminSubscriptionController');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply admin auth to all routes
router.use(adminAuth);

// Plan Management
router.post('/plans', upload.single('planImage'), createPlan);
router.put('/plans/:id', upload.single('planImage'), updatePlan);
router.patch('/plans/:id/publish', publishPlan);
router.get('/plans', getAllPlans);
router.get('/plans/:id', getPlanById);
router.delete('/plans/:id', deletePlan);

// Feature Management
router.post('/plans/:id/features', addPlanFeature);
router.put('/plans/:id/features/:featureKey', updatePlanFeature);
router.delete('/plans/:id/features/:featureKey', deletePlanFeature);

// Coupon Management
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.get('/coupons', getAllCoupons);
router.delete('/coupons/:id', deleteCoupon);

// Oversight
router.get('/subscriptions', getAllSubscriptions);
router.get('/subscriptions/:id', getSubscriptionById);
router.patch('/subscriptions/:id/status', updateSubscriptionStatus);
router.get('/invoices', getAllInvoices);
router.get('/payments', getAllPayments);

module.exports = router;