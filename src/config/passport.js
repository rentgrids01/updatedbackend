const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const Owner = require('../models/Owner');
const Tenant = require('../models/Tenant');
const SocialAuth = require('../models/SocialAuth');

// Check if required environment variables are set
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Warning: Google OAuth credentials not configured. Google login will be disabled.');
}

if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
  console.warn('Warning: Facebook OAuth credentials not configured. Facebook login will be disabled.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
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

// Google OAuth Strategy (only if credentials are available)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      
      if (!email) {
        return done(new Error('No email provided by Google'), null);
      }

      // Check if user already exists with this social account
      let socialAuth = await SocialAuth.findOne({
        provider: 'google',
        providerId: profile.id,
        isActive: true
      });

      if (socialAuth) {
        // Update social auth record
        socialAuth.accessToken = accessToken;
        socialAuth.refreshToken = refreshToken;
        socialAuth.lastUsed = new Date();
        await socialAuth.save();

        // Get the user
        let user;
        if (socialAuth.userType === 'Owner') {
          user = await Owner.findById(socialAuth.userId);
        } else {
          user = await Tenant.findById(socialAuth.userId);
        }

        return done(null, user);
      }

      // Check if user exists with this email (to link accounts)
      let existingOwner = await Owner.findOne({ emailId: email });
      let existingTenant = await Tenant.findOne({ emailId: email });

      if (existingOwner) {
        // Link Google account to existing owner
        socialAuth = new SocialAuth({
          userId: existingOwner._id,
          userType: 'Owner',
          provider: 'google',
          providerId: profile.id,
          providerEmail: email,
          providerName: profile.displayName,
          providerPicture: profile.photos?.[0]?.value,
          accessToken: accessToken,
          refreshToken: refreshToken
        });
        await socialAuth.save();

        return done(null, existingOwner);
      }

      if (existingTenant) {
        // Link Google account to existing tenant
        socialAuth = new SocialAuth({
          userId: existingTenant._id,
          userType: 'Tenant',
          provider: 'google',
          providerId: profile.id,
          providerEmail: email,
          providerName: profile.displayName,
          providerPicture: profile.photos?.[0]?.value,
          accessToken: accessToken,
          refreshToken: refreshToken
        });
        await socialAuth.save();

        return done(null, existingTenant);
      }

      // Create new tenant (default user type for social login)
      const newTenant = new Tenant({
        fullName: profile.displayName,
        emailId: email,
        isEmailVerified: true,
        verificationStatus: 'verified',
        lastLogin: new Date(),
        profilePhoto: profile.photos?.[0]?.value
      });
      await newTenant.save();

      // Create social auth record
      socialAuth = new SocialAuth({
        userId: newTenant._id,
        userType: 'Tenant',
        provider: 'google',
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
      console.error('Google OAuth Error:', error);
      return done(error, null);
    }
  }));
}

// Facebook OAuth Strategy (only if credentials are available)
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'displayName', 'email', 'photos']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      
      if (!email) {
        return done(new Error('No email provided by Facebook'), null);
      }

      // Check if user already exists with this social account
      let socialAuth = await SocialAuth.findOne({
        provider: 'facebook',
        providerId: profile.id,
        isActive: true
      });

      if (socialAuth) {
        // Update social auth record
        socialAuth.accessToken = accessToken;
        socialAuth.refreshToken = refreshToken;
        socialAuth.lastUsed = new Date();
        await socialAuth.save();

        // Get the user
        let user;
        if (socialAuth.userType === 'Owner') {
          user = await Owner.findById(socialAuth.userId);
        } else {
          user = await Tenant.findById(socialAuth.userId);
        }

        return done(null, user);
      }

      // Check if user exists with this email (to link accounts)
      let existingOwner = await Owner.findOne({ emailId: email });
      let existingTenant = await Tenant.findOne({ emailId: email });

      if (existingOwner) {
        // Link Facebook account to existing owner
        socialAuth = new SocialAuth({
          userId: existingOwner._id,
          userType: 'Owner',
          provider: 'facebook',
          providerId: profile.id,
          providerEmail: email,
          providerName: profile.displayName,
          providerPicture: profile.photos?.[0]?.value,
          accessToken: accessToken,
          refreshToken: refreshToken
        });
        await socialAuth.save();

        return done(null, existingOwner);
      }

      if (existingTenant) {
        // Link Facebook account to existing tenant
        socialAuth = new SocialAuth({
          userId: existingTenant._id,
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

        return done(null, existingTenant);
      }

      // Create new tenant (default user type for social login)
      const newTenant = new Tenant({
        fullName: profile.displayName,
        emailId: email,
        isEmailVerified: true,
        verificationStatus: 'verified',
        lastLogin: new Date(),
        profilePhoto: profile.photos?.[0]?.value
      });
      await newTenant.save();

      // Create social auth record
      socialAuth = new SocialAuth({
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
}

module.exports = passport;