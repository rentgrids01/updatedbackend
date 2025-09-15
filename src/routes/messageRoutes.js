const express = require('express');
const {
  sendMessage,
  getMessages,
  sendPhotoMessage,
  sendLocationMessage,
  deleteMessage
} = require('../controllers/messageController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply auth middleware to all message routes
router.use(auth);

router.post('/', sendMessage);
router.get('/:chatId', getMessages);
router.post('/photo', upload.single('image'), sendPhotoMessage);
router.post('/location', sendLocationMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;