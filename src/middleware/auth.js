const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');

const auth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      // Check for token in cookies as well
      token = req.cookies?.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Remove Bearer prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user;
    if (decoded.userType === 'tenant') {
      user = await Tenant.findById(decoded.userId).select('-password');
    } else if (decoded.userType === 'owner') {
      user = await Owner.findById(decoded.userId).select('-password');
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    req.user = user;
    req.userType = decoded.userType;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

const requireUserType = (types) => {
  return (req, res, next) => {
    if (!types.includes(req.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

// For backward compatibility
const requireRole = (roles) => {
  return (req, res, next) => {
    // Map roles to userTypes for compatibility
    const userTypeMap = {
      'landlord': 'owner',
      'owner': 'owner',
      'tenant': 'tenant'
    };
    
    const allowedUserTypes = roles.map(role => userTypeMap[role] || role);
    
    if (!allowedUserTypes.includes(req.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

module.exports = { auth, requireUserType, requireRole };