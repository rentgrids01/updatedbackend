const express = require('express');
const {
  sendMessage,
  getMessages,
  sendPhotoMessage,
  sendLocationMessage,
  sendVideoMessage,
  sendDocumentMessage,
  sendAudioMessage,
  editMessage,
  forwardMessage,
  deleteMessage,
  deleteMediaFile
} = require('../controllers/messageController');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Apply auth middleware to all message routes
router.use(auth);

// Existing routes
router.post('/', sendMessage);
router.get('/:chatId', getMessages);
router.post('/photo', upload.single('image'), sendPhotoMessage);
router.post('/location', sendLocationMessage);
router.delete('/:messageId', deleteMessage);

// New routes
router.post('/video', upload.single('video'), sendVideoMessage);
router.post('/document', upload.single('document'), sendDocumentMessage);
router.post('/audio', upload.single('audio'), sendAudioMessage);
router.put('/:messageId/edit', editMessage);
router.put('/:messageId/forward/:chatId', forwardMessage);
router.delete('/:messageId/file', deleteMediaFile);

module.exports = router;