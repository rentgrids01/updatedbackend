const jwt = require('jsonwebtoken');
const Owner = require('../models/Owner');

const adminAuth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. No token provided.'
        }
      });
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userType !== 'owner') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required'
        }
      });
    }

    const user = await Owner.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token. User not found.'
        }
      });
    }

    // Add admin role check here if you have role-based system
    // For now, all owners are considered admins

    req.user = user;
    req.userType = 'owner';
    req.requestId = require('uuid').v4();
    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token.'
      }
    });
  }
};

module.exports = adminAuth;