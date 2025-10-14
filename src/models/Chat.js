const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }],
  isGroupChat: {
    type: Boolean,
    default: false
  },
  chatName: String,
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  unreadCount: [{
    user: {
      type: mongoose.Schema.Types.ObjectId
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId
    },
    mutedUntil: {
      type: Date,
      default: null
    }
  }],
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId
  }]
}, {
  timestamps: true
});

// Add indexes for better performance
chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ "unreadCount.user": 1 });

// Virtual for getting participant count
chatSchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.length : 0;
});

// Instance method to add participant
chatSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
  }
  return this;
};

// Instance method to update last activity
chatSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this;
};

// Instance method to increment unread count for a user
chatSchema.methods.incrementUnreadCount = function(userId) {
  const unreadEntry = this.unreadCount.find(entry => 
    entry.user && entry.user.equals(userId)
  );
  
  if (unreadEntry) {
    unreadEntry.count += 1;
  } else {
    this.unreadCount.push({
      user: userId,
      count: 1
    });
  }
  return this;
};

// Instance method to reset unread count for a user
chatSchema.methods.resetUnreadCount = function(userId) {
  const unreadEntry = this.unreadCount.find(entry => 
    entry.user && entry.user.equals(userId)
  );
  
  if (unreadEntry) {
    unreadEntry.count = 0;
  }
  return this;
};

// Instance method to get unread count for a user
chatSchema.methods.getUnreadCount = function(userId) {
  const unreadEntry = this.unreadCount.find(entry => 
    entry.user && entry.user.equals(userId)
  );
  return unreadEntry ? unreadEntry.count : 0;
};

// Instance method to check if user is participant
chatSchema.methods.hasParticipant = function(userId) {
  return this.participants.some(participant => 
    participant.equals(userId)
  );
};

// Static method to find chats for a user
chatSchema.statics.findUserChats = function(userId) {
  return this.find({
    participants: userId
  }).populate('lastMessage').sort({ lastActivity: -1 });
};

// Static method to find or create a chat between two users
chatSchema.statics.findOrCreateChat = async function(user1Id, user2Id) {
  const mongoose = require('mongoose');
  
  // Ensure we have valid ObjectIds
  if (!user1Id || !user2Id) {
    throw new Error('Both user IDs are required');
  }
  
  // Convert to ObjectIds if they're strings
  const userId1 = mongoose.Types.ObjectId.isValid(user1Id) ? user1Id : new mongoose.Types.ObjectId(user1Id);
  const userId2 = mongoose.Types.ObjectId.isValid(user2Id) ? user2Id : new mongoose.Types.ObjectId(user2Id);
  
  // First, try to find existing chat between these two users
  let chat = await this.findOne({
    isGroupChat: false,
    participants: { $all: [userId1, userId2], $size: 2 }
  });

  // If no chat exists, create a new one
  if (!chat) {
    chat = new this({
      participants: [userId1, userId2],
      isGroupChat: false
    });
    await chat.save();
  }

  return chat;
};

module.exports = mongoose.model('Chat', chatSchema);
