const express = require('express');
const {
  getAllChats,
  getChatDetails,
  accessChat,
  createGroupChat,
  searchChats,
  getChatsWithUnread,
  markChatAsRead,
  deleteChat,
  muteChat,
  unmuteChat,
  archiveChat,
  unarchiveChat
} = require('../controllers/chatController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(auth);

// Existing routes
router.get('/', getAllChats);
router.post('/access', accessChat);
router.post('/group', createGroupChat); 
router.get('/search', searchChats);
router.get('/unread', getChatsWithUnread);
router.put('/:chatId/read', markChatAsRead);
router.delete('/:chatId', deleteChat);

// New routes
router.get('/:chatId', getChatDetails);
router.put('/:chatId/mute', muteChat);
router.put('/:chatId/unmute', unmuteChat);
router.put('/:chatId/archive', archiveChat);
router.put('/:chatId/unarchive', unarchiveChat);

module.exports = router;