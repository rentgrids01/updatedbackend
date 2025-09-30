const express = require('express');
const {
  getUserStatus,
  setTypingStatus,
  updateOnlineStatus
} = require('../controllers/userController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all user routes
router.use(auth);

router.get('/:userId/status', getUserStatus);
router.put('/:userId/typing', setTypingStatus);
router.put('/:userId/online', updateOnlineStatus);

module.exports = router;
