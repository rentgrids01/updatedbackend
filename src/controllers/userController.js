const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');

// Track typing status (in-memory storage - in production use Redis)
const typingStatus = new Map();

// Get User Online Status and Last Seen
const getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Try to find user in Tenant collection first, then Owner
    let user = await Tenant.findById(userId).select('fullName profilePhoto isOnline lastSeen userType');
    
    if (!user) {
      user = await Owner.findById(userId).select('fullName profilePhoto isOnline lastSeen userType');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is currently typing
    const isTyping = typingStatus.has(userId) && 
                     typingStatus.get(userId).isTyping && 
                     Date.now() - typingStatus.get(userId).lastTypingTime < 5000; // 5 seconds timeout

    res.json({
      success: true,
      data: {
        userId: user._id,
        fullName: user.fullName,
        profilePhoto: user.profilePhoto,
        userType: user.userType,
        isOnline: user.isOnline || false,
        lastSeen: user.lastSeen,
        isTyping
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Set Typing Status
const setTypingStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isTyping, chatId } = req.body;

    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - can only set your own typing status'
      });
    }

    if (isTyping) {
      typingStatus.set(userId, {
        isTyping: true,
        chatId,
        lastTypingTime: Date.now()
      });

      // Auto-clear typing status after 5 seconds
      setTimeout(() => {
        const current = typingStatus.get(userId);
        if (current && current.lastTypingTime <= Date.now() - 5000) {
          typingStatus.delete(userId);
          
          // Emit socket event for typing stopped
          req.app.get('io').to(chatId).emit('typingStopped', {
            userId,
            chatId
          });
        }
      }, 5000);
    } else {
      typingStatus.delete(userId);
    }

    // Emit socket event for typing status
    if (chatId) {
      req.app.get('io').to(chatId).emit(isTyping ? 'typingStarted' : 'typingStopped', {
        userId,
        chatId
      });
    }

    res.json({
      success: true,
      message: `Typing status ${isTyping ? 'started' : 'stopped'}`,
      data: {
        isTyping,
        chatId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update User Online Status (usually called when user connects/disconnects)
const updateOnlineStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isOnline } = req.body;

    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized - can only update your own status'
      });
    }

    // Try to update in Tenant collection first, then Owner
    let user = await Tenant.findById(userId);
    
    if (!user) {
      user = await Owner.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isOnline = isOnline;
    if (!isOnline) {
      user.lastSeen = new Date();
    }
    await user.save();

    // Emit socket event for status change
    req.app.get('io').emit('userStatusChanged', {
      userId,
      isOnline,
      lastSeen: user.lastSeen
    });

    res.json({
      success: true,
      message: `Status updated to ${isOnline ? 'online' : 'offline'}`,
      data: {
        isOnline,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getUserStatus,
  setTypingStatus,
  updateOnlineStatus
};
