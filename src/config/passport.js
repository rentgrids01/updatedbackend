const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const Owner = require('../models/Owner');
const Tenant = require('../models/Tenant');
const SocialAuth = require('../models/SocialAuth');

// Serialize user for session
passport.serializeUser((user, done) => {
  // Store user id and type in session
  done(null, { id: user._id, type: user.constructor.modelName });
});

// Deserialize user from session
passport.deserializeUser(async (sessionData, done) => {
  try {
    let user;
    if (sessionData.type === 'Owner') {
      user = await Owner.findById(sessionData.id);
    } else if (sessionData.type === 'Tenant') {
      user = await Tenant.findById(sessionData.id);
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth Profile:', {
      id: profile.id,
      email: profile.emails[0]?.value,
      name: profile.displayName,
      picture: profile.photos[0]?.value
    });

    // Check if user already exists with this Google account
    const existingSocialAuth = await SocialAuth.findByProvider('google', profile.id);
    
    if (existingSocialAuth) {
      // User exists, update their last used timestamp and token info
      existingSocialAuth.accessToken = accessToken;
      existingSocialAuth.refreshToken = refreshToken;
      existingSocialAuth.lastUsed = new Date();
      await existingSocialAuth.save();

      // Get the actual user record
      let user;
      if (existingSocialAuth.userType === 'Owner') {
        user = await Owner.findById(existingSocialAuth.userId);
      } else {
        user = await Tenant.findById(existingSocialAuth.userId);
      }

      return done(null, user);
    }

    // Check if user exists with this email (might want to link accounts)
    const email = profile.emails[0]?.value;
    let existingUser;
    
    // Check in Owner collection first
    existingUser = await Owner.findOne({ emailId: email });
    let userType = 'Owner';
    
    // If not found in Owner, check Tenant
    if (!existingUser) {
      existingUser = await Tenant.findOne({ emailId: email });
      userType = 'Tenant';
    }

    if (existingUser) {
      // Link existing account with Google
      const socialAuth = new SocialAuth({
        userId: existingUser._id,
        userType: userType,
        provider: 'google',
        providerId: profile.id,
        providerEmail: email,
        providerName: profile.displayName,
        providerPicture: profile.photos[0]?.value,
        accessToken: accessToken,
        refreshToken: refreshToken
      });
      await socialAuth.save();

      // Update profile picture if not set
      if (!existingUser.profilePhoto && profile.photos[0]?.value) {
        existingUser.profilePhoto = profile.photos[0].value;
        await existingUser.save();
      }

      return done(null, existingUser);
    }

    // Create new tenant account (default for social signups)
    const newTenant = new Tenant({
      fullName: profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName,
      emailId: email,
      password: Math.random().toString(36).slice(-12), // Random password for social users
      phonenumber: '', // Will be collected later
      isEmailVerified: true, // Google emails are verified
      profilePhoto: profile.photos[0]?.value || '',
      verificationStatus: 'pending'
    });

    await newTenant.save();

    // Create social auth record
    const socialAuth = new SocialAuth({
      userId: newTenant._id,
      userType: 'Tenant',
      provider: 'google',
      providerId: profile.id,
      providerEmail: email,
      providerName: profile.displayName,
      providerPicture: profile.photos[0]?.value,
      accessToken: accessToken,
      refreshToken: refreshToken
    });
    await socialAuth.save();

    return done(null, newTenant);

  } catch (error) {
    console.error('Google OAuth Error:', error);
    return done(error, null);
  }
}));

// Facebook OAuth Strategy  
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: process.env.FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'displayName', 'email', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Facebook OAuth Profile:', {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value
    });

    // Check if user already exists with this Facebook account
    const existingSocialAuth = await SocialAuth.findByProvider('facebook', profile.id);
    
    if (existingSocialAuth) {
      // User exists, update their last used timestamp and token info
      existingSocialAuth.accessToken = accessToken;
      existingSocialAuth.refreshToken = refreshToken;
      existingSocialAuth.lastUsed = new Date();
      await existingSocialAuth.save();

      // Get the actual user record
      let user;
      if (existingSocialAuth.userType === 'Owner') {
        user = await Owner.findById(existingSocialAuth.userId);
      } else {
        user = await Tenant.findById(existingSocialAuth.userId);
      }

      return done(null, user);
    }

    // Check if user exists with this email (might want to link accounts)
    const email = profile.emails?.[0]?.value;
    let existingUser;
    let userType = 'Owner';
    
    if (email) {
      // Check in Owner collection first
      existingUser = await Owner.findOne({ emailId: email });
      
      // If not found in Owner, check Tenant
      if (!existingUser) {
        existingUser = await Tenant.findOne({ emailId: email });
        userType = 'Tenant';
      }
    }

    if (existingUser && email) {
      // Link existing account with Facebook
      const socialAuth = new SocialAuth({
        userId: existingUser._id,
        userType: userType,
        provider: 'facebook',
        providerId: profile.id,
        providerEmail: email,
        providerName: profile.displayName,
        providerPicture: profile.photos?.[0]?.value,
        accessToken: accessToken,
        refreshToken: refreshToken
      });
      await socialAuth.save();

      // Update profile picture if not set
      if (!existingUser.profilePhoto && profile.photos?.[0]?.value) {
        existingUser.profilePhoto = profile.photos[0].value;
        await existingUser.save();
      }

      return done(null, existingUser);
    }

    // Create new tenant account (default for social signups)
    // Note: Facebook might not always provide email
    if (!email) {
      return done(new Error('Email is required but not provided by Facebook'), null);
    }

    const newTenant = new Tenant({
      fullName: profile.displayName || 'Facebook User',
      emailId: email,
      password: Math.random().toString(36).slice(-12), // Random password for social users
      phonenumber: '', // Will be collected later
      isEmailVerified: true, // Assuming Facebook emails are verified
      profilePhoto: profile.photos?.[0]?.value || '',
      verificationStatus: 'pending'
    });

    await newTenant.save();

    // Create social auth record
    const socialAuth = new SocialAuth({
      userId: newTenant._id,
      userType: 'Tenant',
      provider: 'facebook',
      providerId: profile.id,
      providerEmail: email,
      providerName: profile.displayName,
      providerPicture: profile.photos?.[0]?.value,
      accessToken: accessToken,
      refreshToken: refreshToken
    });
    await socialAuth.save();

    return done(null, newTenant);

  } catch (error) {
    console.error('Facebook OAuth Error:', error);
    return done(error, null);
  }
}));

module.exports = passport;