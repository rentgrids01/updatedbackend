const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const { generateToken } = require('../utils/jwtUtils');
const { sendOTPEmail, verifyOTP } = require('../utils/emailService');
const { body } = require('express-validator');

// Validation rules
const registerValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('emailId').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8, max: 20 }).withMessage('Password must be 8-20 characters long'),
  body('phonenumber').notEmpty().withMessage('Phone number is required')
];

const loginValidation = [
  body('userName').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const verifyOTPValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('userType').isIn(['tenant', 'owner']).withMessage('userType must be either "tenant" or "owner"')
];

const resetPasswordOTPValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 8, max: 20 }).withMessage('Password must be 8-20 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('userType').isIn(['tenant', 'owner']).withMessage('userType must be either "tenant" or "owner"')
];

const forgotPasswordValidation = [
  body('emailId').isEmail().withMessage('Valid email is required'),
  body('userType').isIn(['tenant', 'owner']).withMessage('userType must be either "tenant" or "owner"')
];

const verifyOTPForPasswordResetValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('userType').isIn(['tenant', 'owner']).withMessage('userType must be either "tenant" or "owner"')
];

const setNewPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('newPassword').isLength({ min: 8, max: 20 }).withMessage('Password must be 8-20 characters long'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('userType').isIn(['tenant', 'owner']).withMessage('userType must be either "tenant" or "owner"')
];

// Register Tenant
const registerTenant = async (req, res) => {
  try {
    const { fullName, emailId, password, phonenumber } = req.body;

    const existingTenant = await Tenant.findOne({ emailId });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant already exists with this email'
      });
    }

    const tenant = new Tenant({
      fullName,
      emailId,
      password,
      phonenumber
    });

    await tenant.save();

    // Send verification email
    await sendOTPEmail(emailId, 'verification');

    res.status(201).json({
      success: true,
      message: 'Tenant registered successfully. Please verify your email.',
      tenant: {
        id: tenant._id,
        fullName: tenant.fullName,
        emailId: tenant.emailId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Register Owner
const registerOwner = async (req, res) => {
  try {
    const { fullName, emailId, password, phonenumber } = req.body;

    const existingOwner = await Owner.findOne({ emailId });
    if (existingOwner) {
      return res.status(400).json({
        success: false,
        message: 'Owner already exists with this email'
      });
    }

    const owner = new Owner({
      fullName,
      emailId,
      password,
      phonenumber
    });

    await owner.save();

    // Send verification email
    await sendOTPEmail(emailId, 'verification');

    res.status(201).json({
      success: true,
      message: 'Owner registered successfully. Please verify your email.',
      owner: {
        id: owner._id,
        fullName: owner.fullName,
        emailId: owner.emailId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Login Tenant
const loginTenant = async (req, res) => {
  try {
    const { userName, password } = req.body;

    const tenant = await Tenant.findOne({ emailId: userName });
    if (!tenant) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isValidPassword = await tenant.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!tenant.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    const token = generateToken(tenant._id, 'tenant');

    // Update last login
    tenant.lastLogin = new Date();
    await tenant.save();

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      tenant: {
        id: tenant._id,
        fullName: tenant.fullName,
        emailId: tenant.emailId,
        isEmailVerified: tenant.isEmailVerified
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Login Owner
const loginOwner = async (req, res) => {
  try {
    const { userName, password } = req.body;

    const owner = await Owner.findOne({ emailId: userName });
    if (!owner) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isValidPassword = await owner.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!owner.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    const token = generateToken(owner._id, 'owner');

    // Update last login
    owner.lastLogin = new Date();
    await owner.save();

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      owner: {
        id: owner._id,
        fullName: owner.fullName,
        emailId: owner.emailId,
        isEmailVerified: owner.isEmailVerified
      },
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    res.clearCookie('token');
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { emailId, userType } = req.body;

    let user;
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId });
    } else {
      user = await Owner.findOne({ emailId });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Send OTP for password reset
    await sendOTPEmail(emailId, 'password-reset');

    res.json({
      success: true,
      message: 'Password reset OTP sent to your email'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send OTP
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    await sendOTPEmail(email, 'verification');

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP
const verifyOTPController = async (req, res) => {
  try {
    const { email, otp, userType } = req.body;

    // Validate userType parameter
    if (!userType || !['tenant', 'owner'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'userType is required and must be either "tenant" or "owner"'
      });
    }

    const result = await verifyOTP(email, otp, 'verification');

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    let user = null;
    let verifiedUser = null;

    // Find the specific user based on userType
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId: email });
    } else if (userType === 'owner') {
      user = await Owner.findOne({ emailId: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} not found with this email`
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} email is already verified`
      });
    }

    // Verify the specific user
    user.isEmailVerified = true;
    await user.save();
    verifiedUser = user;

    res.json({
      success: true,
      message: `Email verified successfully for ${userType}`,
      userType: userType,
      user: {
        id: verifiedUser._id,
        fullName: verifiedUser.fullName,
        emailId: verifiedUser.emailId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reset Password with OTP
const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword, userType } = req.body;

    // Validate userType parameter
    if (!userType || !['tenant', 'owner'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'userType is required and must be either "tenant" or "owner"'
      });
    }

    // Verify passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8-20 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    // Verify OTP for password reset
    const otpResult = await verifyOTP(email, otp, 'password-reset');

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Find the specific user based on userType
    let user = null;
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId: email });
    } else if (userType === 'owner') {
      user = await Owner.findOne({ emailId: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} not found with this email`
      });
    }

    // Hash new password and update user
    user.password = newPassword; // The password will be hashed by the pre-save middleware in the model
    await user.save();

    res.json({
      success: true,
      message: `Password reset successfully for ${userType}. Please login with your new password.`,
      userType: userType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP for Password Reset (Step 1)
const verifyOTPForPasswordReset = async (req, res) => {
  try {
    const { email, otp, userType } = req.body;

    // Validate userType parameter
    if (!userType || !['tenant', 'owner'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'userType is required and must be either "tenant" or "owner"'
      });
    }

    // Verify OTP for password reset
    const otpResult = await verifyOTP(email, otp, 'password-reset');

    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Find the specific user based on userType to ensure they exist
    let user = null;
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId: email });
    } else if (userType === 'owner') {
      user = await Owner.findOne({ emailId: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} not found with this email`
      });
    }

    res.json({
      success: true,
      message: `OTP verified successfully for ${userType}. You can now set your new password.`,
      userType: userType,
      email: email
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Set New Password after OTP Verification (Step 2)
const setNewPasswordWithOTP = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword, userType } = req.body;

    // Validate userType parameter
    if (!userType || !['tenant', 'owner'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'userType is required and must be either "tenant" or "owner"'
      });
    }

    // Verify passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8-20 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    // Find the specific user based on userType
    let user = null;
    if (userType === 'tenant') {
      user = await Tenant.findOne({ emailId: email });
    } else if (userType === 'owner') {
      user = await Owner.findOne({ emailId: email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `${userType.charAt(0).toUpperCase() + userType.slice(1)} not found with this email`
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    res.json({
      success: true,
      message: `Password updated successfully for ${userType}. Please login with your new password.`,
      userType: userType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
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
};