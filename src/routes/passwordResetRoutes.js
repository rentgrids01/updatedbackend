const express = require('express');
const {
  generateResetToken,
  verifyResetToken,
  setNewPassword
} = require('../controllers/passwordResetController');

const router = express.Router();

// Password Reset Routes
router.post('/forgot-password', generateResetToken);
router.get('/reset-password/verify', verifyResetToken);
router.post('/reset-password', setNewPassword);

module.exports = router;