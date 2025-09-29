const express = require('express');
const passport = require('passport');
const router = express.Router();
const { auth } = require('../middleware/auth');
const socialAuthController = require('../controllers/socialAuthController');

// Social auth status endpoint
router.get('/status', socialAuthController.getSocialLoginStatus);

// Google OAuth Routes (only if Google credentials are configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  
  router.get('/google/callback',
    passport.authenticate('google', { 
      failureRedirect: '/auth/failure',
      session: false 
    }),
    socialAuthController.googleAuthSuccess
  );
}

// Facebook OAuth Routes (only if Facebook credentials are configured)
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
  
  router.get('/facebook/callback',
    passport.authenticate('facebook', { 
      failureRedirect: '/auth/failure',
      session: false 
    }),
    socialAuthController.facebookAuthSuccess
  );
}

// OAuth Success callback - redirects to frontend with token
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

// OAuth Failure callback - redirects to frontend with error
router.get('/failure', socialAuthController.authFailure);

// Protected routes (require JWT token)
router.get('/me', auth, socialAuthController.getCurrentUser);
router.delete('/unlink/:provider', auth, socialAuthController.unlinkSocialAccount);

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

module.exports = router;