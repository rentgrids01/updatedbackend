const express = require('express');
const passport = require('passport');
const router = express.Router();
const { auth } = require('../middleware/auth');
const socialAuthController = require('../controllers/socialAuthController');

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/auth/failure',
    session: false 
  }),
  socialAuthController.googleAuthSuccess
);

// Facebook OAuth Routes
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback',
  passport.authenticate('facebook', { 
    failureRedirect: '/auth/failure',
    session: false 
  }),
  socialAuthController.facebookAuthSuccess
);

// OAuth Success Route (fallback if needed)
router.get('/success', (req, res) => {
  res.json({
    success: true,
    message: 'Authentication successful',
    data: {
      token: req.query.token || null,
      userType: req.query.userType || null,
      provider: req.query.provider || null
    }
  });
});

// OAuth Failure Route
router.get('/failure', socialAuthController.authFailure);

// Alternative failure route for direct API calls
router.get('/failure-json', (req, res) => {
  const error = req.query.error || 'authentication_failed';
  const message = req.query.message || 'Authentication failed';
  
  res.status(400).json({
    success: false,
    message: decodeURIComponent(message),
    error: error
  });
});

// Social login status endpoint (public)
router.get('/status', socialAuthController.getSocialLoginStatus);

// Test endpoints for development
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Social auth routes are working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: err.message
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Protected routes (require JWT token)
// Get current authenticated user info
router.get('/me', auth, socialAuthController.getCurrentUser);

// Unlink social account
router.delete('/unlink/:provider', auth, socialAuthController.unlinkSocialAccount);

// Social login testing endpoints (for development/testing)
if (process.env.NODE_ENV === 'development') {
  // Test Google auth without browser
  router.get('/test-google', (req, res) => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL)}&` +
      `response_type=code&` +
      `scope=profile%20email&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    res.json({
      success: true,
      message: 'Google OAuth URL generated',
      data: {
        authUrl: authUrl,
        instructions: 'Visit this URL in your browser to test Google OAuth'
      }
    });
  });

  // Test Facebook auth without browser
  router.get('/test-facebook', (req, res) => {
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.FACEBOOK_CALLBACK_URL)}&` +
      `response_type=code&` +
      `scope=email`;
    
    res.json({
      success: true,
      message: 'Facebook OAuth URL generated',
      data: {
        authUrl: authUrl,
        instructions: 'Visit this URL in your browser to test Facebook OAuth'
      }
    });
  });
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Social auth service is healthy',
    timestamp: new Date().toISOString(),
    services: {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      facebook: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET)
    }
  });
});

// Rate limiting info
router.get('/limits', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limit information',
    data: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      message: 'Standard rate limiting applied to OAuth endpoints'
    }
  });
});

module.exports = router;