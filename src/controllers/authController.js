const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const { generateToken } = require('../utils/jwtUtils');
const { sendOTPEmail, verifyOTP } = require('../utils/emailService');
const { body } = require('express-validator');

// Validation rules
const registerValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('emailId').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phonenumber').notEmpty().withMessage('Phone number is required')
];

const loginValidation = [
  body('userName').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
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
    const { email, otp } = req.body;

    const result = await verifyOTP(email, otp, 'verification');

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Update user email verification status
    const tenant = await Tenant.findOne({ emailId: email });
    const owner = await Owner.findOne({ emailId: email });

    if (tenant) {
      tenant.isEmailVerified = true;
      await tenant.save();
    } else if (owner) {
      owner.isEmailVerified = true;
      await owner.save();
    }

    res.json({
      success: true,
      message: 'Email verified successfully'
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
  registerValidation,
  loginValidation
};