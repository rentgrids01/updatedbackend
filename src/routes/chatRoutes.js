const express = require('express');
const {
  getAllChats,
  accessChat,
  createGroupChat,
  searchChats,
  getChatsWithUnread,
  markChatAsRead,
  deleteChat
} = require('../controllers/chatController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(auth);

router.get('/', getAllChats);
router.post('/access', accessChat);
router.post('/group', createGroupChat);
router.get('/search', searchChats);
router.get('/unread', getChatsWithUnread);
router.put('/:chatId/read', markChatAsRead);
router.delete('/:chatId', deleteChat);

module.exports = router;