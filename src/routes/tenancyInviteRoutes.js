const express = require('express');
const {
  sendTenancyInvite,
  getPendingInvitesForTenant,
  getAllInvitesForTenant,
  getInvitesByOwner,
  acceptTenancyInvite,
  declineTenancyInvite,
  getInviteDetails,
  getChatFromInvite,
  sendInviteMessage,
  getInviteMessages
} = require('../controllers/tenancyInviteController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Owner routes
router.post('/send', sendTenancyInvite);  // Send tenancy invite to tenant
router.get('/owner/sent', getInvitesByOwner);  // Get invites sent by owner

// Tenant routes
router.get('/tenant/pending', getPendingInvitesForTenant);  // Get pending invites for tenant
router.get('/tenant/all', getAllInvitesForTenant);  // Get all invites for tenant
router.post('/:inviteId/accept', acceptTenancyInvite);  // Accept tenancy invite and create chat
router.post('/:inviteId/decline', declineTenancyInvite);  // Decline tenancy invite

// Shared routes - Invite details and chat
router.get('/:inviteId', getInviteDetails);  // Get invite details
router.get('/:inviteId/chat', getChatFromInvite);  // Get chat from invite

// Real-time messaging routes
router.post('/:inviteId/message', sendInviteMessage);  // Send real-time message in invite
router.get('/:inviteId/messages', getInviteMessages);  // Get invite message history

module.exports = router;