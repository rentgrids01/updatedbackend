const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const PasswordReset = require('../models/PasswordReset');
const { sendOTPEmail } = require('../utils/emailService');

// Generate Password Reset Token
const generateResetToken = async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Email and user type are required'
      });
    }

    let user;
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId: email });
    } else if (userType === 'owner') {
      user = await Owner.findOne({ emailId: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Save reset token
    await PasswordReset.create({
      userId: user._id,
      userType: userType === 'tenant' ? 'Tenant' : 'Owner',
      email: email,
      token: resetToken
    });

    // Send reset email (you can customize this)
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    // For now, we'll use the existing email service
    await sendOTPEmail(email, 'password-reset');

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email',
      resetUrl // Remove this in production
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify Reset Token
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        valid: false,
        message: 'Reset token is required'
      });
    }

    const resetRecord = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({
        valid: false,
        message: 'Invalid or expired reset token'
      });
    }

    res.json({
      valid: true,
      message: 'Token is valid. You may now reset your password.',
      email: resetRecord.email
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      message: error.message
    });
  }
};

// Set New Password
const setNewPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    // Validation
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, new password, and confirm password are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,12}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8-12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    // Find reset record
    const resetRecord = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Find user and update password
    let user;
    if (resetRecord.userType === 'Tenant') {
      user = await Tenant.findById(resetRecord.userId);
    } else {
      user = await Owner.findById(resetRecord.userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetRecord.used = true;
    await resetRecord.save();

    res.json({
      success: true,
      message: 'Password updated successfully. Please log in with your new password.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  generateResetToken,
  verifyResetToken,
  setNewPassword
};