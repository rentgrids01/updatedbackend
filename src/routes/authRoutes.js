const express = require('express');
const {
  registerTenant,
  registerOwner,
  loginTenant,
  loginOwner,
  logout,
  forgotPassword,
  sendOTP,
  verifyOTPController,
  resetPasswordWithOTP,
  verifyOTPForPasswordReset,
  setNewPasswordWithOTP,
  registerValidation,
  loginValidation,
  verifyOTPValidation,
  resetPasswordOTPValidation,
  forgotPasswordValidation,
  verifyOTPForPasswordResetValidation,
  setNewPasswordValidation
} = require('../controllers/authController');
const {
  generateResetToken,
  verifyResetToken,
  setNewPassword
} = require('../controllers/passwordResetController');
const validateRequest = require('../middleware/validation');

const router = express.Router();

// Tenant Auth Routes
router.post('/tenant/register', registerValidation, validateRequest, registerTenant);
router.post('/tenant/login', loginValidation, validateRequest, loginTenant);
router.post('/tenant/logout', logout);

// Owner Auth Routes
router.post('/owner/register', registerValidation, validateRequest, registerOwner);
router.post('/owner/login', loginValidation, validateRequest, loginOwner);
router.post('/owner/logout', logout);

// Common routes
router.post('/forgot-password', forgotPasswordValidation, validateRequest, forgotPassword);

// Password Reset Routes
router.post('/password-reset/generate', generateResetToken);
router.get('/password-reset/verify', verifyResetToken);
router.post('/password-reset/confirm', setNewPassword);

// OTP-based Password Reset Routes
router.post('/password-reset/otp', resetPasswordOTPValidation, validateRequest, resetPasswordWithOTP);

// Two-step OTP Password Reset Routes
router.post('/password-reset/verify-otp', verifyOTPForPasswordResetValidation, validateRequest, verifyOTPForPasswordReset);
router.post('/password-reset/set-password', setNewPasswordValidation, validateRequest, setNewPasswordWithOTP);

// Email Verification Routes
router.post('/email/send-otp', sendOTP);
router.post('/email/verify-otp', verifyOTPValidation, validateRequest, verifyOTPController);

module.exports = router;