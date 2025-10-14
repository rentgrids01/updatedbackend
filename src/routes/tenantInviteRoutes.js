const express = require('express');
const {
  sendTenantInvite,
  getTenantInvitesByOwner,
  getTenantInvitesByTenant,
  acceptTenantInvite,
  declineTenantInvite,
  getTenantInviteDetails
} = require('../controllers/tenantInviteController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Tenant sends invite to owner
router.post('/send', sendTenantInvite);

// Get tenant invites by owner (applications received by owner)
router.get('/owner', getTenantInvitesByOwner);

// Get tenant invites by tenant (applications sent by tenant)
router.get('/tenant', getTenantInvitesByTenant);

// Get specific tenant invite details
router.get('/:inviteId', getTenantInviteDetails);

// Owner accepts tenant invite
router.post('/:inviteId/accept', acceptTenantInvite);

// Owner declines tenant invite
router.post('/:inviteId/decline', declineTenantInvite);

module.exports = router;