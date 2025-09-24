const jwt = require('jsonwebtoken');
const SocialAuth = require('../models/SocialAuth');
const Owner = require('../models/Owner');
const Tenant = require('../models/Tenant');

// Generate JWT token
const generateToken = (user, userType) => {
  const payload = {
    userId: user._id,
    userType: userType.toLowerCase(),
    email: user.emailId,
    name: user.fullName,
    isEmailVerified: user.isEmailVerified
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d' // Token valid for 7 days
  });
};

// Get user type from model name
const getUserType = (user) => {
  return user.constructor.modelName; // Returns 'Owner' or 'Tenant'
};

// Google OAuth Success Handler
const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.CLIENT_URL}/auth/failure?error=authentication_failed`);
    }

    const userType = getUserType(req.user);
    const token = generateToken(req.user, userType);
    
    // Get social auth info
    const socialAuth = await SocialAuth.findOne({
      userId: req.user._id,
      userType: userType,
      provider: 'google'
    });

    // Update last login
    req.user.lastLogin = new Date();
    await req.user.save();

    // Redirect to frontend with token
    const redirectUrl = `${process.env.CLIENT_URL}/auth/success?token=${token}&userType=${userType.toLowerCase()}&provider=google`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Google auth success error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth/failure?error=token_generation_failed`);
  }
};

// Facebook OAuth Success Handler
const facebookAuthSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.CLIENT_URL}/auth/failure?error=authentication_failed`);
    }

    const userType = getUserType(req.user);
    const token = generateToken(req.user, userType);
    
    // Get social auth info
    const socialAuth = await SocialAuth.findOne({
      userId: req.user._id,
      userType: userType,
      provider: 'facebook'
    });

    // Update last login
    req.user.lastLogin = new Date();
    await req.user.save();

    // Redirect to frontend with token
    const redirectUrl = `${process.env.CLIENT_URL}/auth/success?token=${token}&userType=${userType.toLowerCase()}&provider=facebook`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Facebook auth success error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth/failure?error=token_generation_failed`);
  }
};

// OAuth Failure Handler
const authFailure = (req, res) => {
  const error = req.query.error || 'authentication_failed';
  const message = getErrorMessage(error);
  
  res.redirect(`${process.env.CLIENT_URL}/auth/failure?error=${error}&message=${encodeURIComponent(message)}`);
};

// Get user-friendly error message
const getErrorMessage = (error) => {
  const messages = {
    authentication_failed: 'Authentication failed. Please try again.',
    token_generation_failed: 'Failed to generate access token. Please try again.',
    email_required: 'Email address is required but not provided by the social provider.',
    account_creation_failed: 'Failed to create your account. Please try again.',
    invalid_provider: 'Invalid social authentication provider.',
    user_cancelled: 'Authentication was cancelled by user.'
  };
  
  return messages[error] || 'An unknown error occurred during authentication.';
};

// Get current user info (for authenticated requests)
const getCurrentUser = async (req, res) => {
  try {
    const { userId, userType } = req.user;
    
    let user;
    if (userType === 'owner') {
      user = await Owner.findById(userId).select('-password');
    } else if (userType === 'tenant') {
      user = await Tenant.findById(userId).select('-password');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get linked social accounts
    const socialAccounts = await SocialAuth.find({
      userId: user._id,
      userType: userType === 'owner' ? 'Owner' : 'Tenant',
      isActive: true
    }).select('provider providerEmail providerPicture lastUsed -_id');

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          emailId: user.emailId,
          phonenumber: user.phonenumber,
          profilePhoto: user.profilePhoto,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          verificationStatus: user.verificationStatus,
          userType: userType,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        socialAccounts: socialAccounts
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unlink social account
const unlinkSocialAccount = async (req, res) => {
  try {
    const { provider } = req.params;
    const { userId, userType } = req.user;

    if (!['google', 'facebook'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid social provider'
      });
    }

    const socialAuth = await SocialAuth.findOne({
      userId: userId,
      userType: userType === 'owner' ? 'Owner' : 'Tenant',
      provider: provider,
      isActive: true
    });

    if (!socialAuth) {
      return res.status(404).json({
        success: false,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account not linked`
      });
    }

    // Check if user has a password (can't unlink if it's their only login method)
    let user;
    if (userType === 'owner') {
      user = await Owner.findById(userId);
    } else {
      user = await Tenant.findById(userId);
    }

    // Check if they have other social accounts or a password
    const otherSocialAccounts = await SocialAuth.countDocuments({
      userId: userId,
      userType: userType === 'owner' ? 'Owner' : 'Tenant',
      provider: { $ne: provider },
      isActive: true
    });

    const hasPassword = user.password && user.password !== '' && user.password.length >= 6;

    if (!hasPassword && otherSocialAccounts === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink the only authentication method. Please set a password first.'
      });
    }

    // Deactivate the social auth record
    socialAuth.isActive = false;
    await socialAuth.save();

    res.status(200).json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`
    });

  } catch (error) {
    console.error('Unlink social account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get social login status
const getSocialLoginStatus = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Social login endpoints are active',
      data: {
        providers: {
          google: {
            available: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
            loginUrl: '/auth/google',
            callbackUrl: '/auth/google/callback'
          },
          facebook: {
            available: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
            loginUrl: '/auth/facebook',
            callbackUrl: '/auth/facebook/callback'
          }
        },
        endpoints: {
          success_callback: '/auth/success',
          failure_callback: '/auth/failure',
          user_info: '/auth/me',
          unlink: '/auth/unlink/:provider'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  googleAuthSuccess,
  facebookAuthSuccess,
  authFailure,
  getCurrentUser,
  unlinkSocialAccount,
  getSocialLoginStatus,
  generateToken,
  getUserType
};