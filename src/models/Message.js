const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['Tenant', 'Owner']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location', 'document', 'video', 'audio'],
    default: 'text'
  },
  content: {
    type: String,
    trim: true
  },
  imageUrl: String,
  documentUrl: String,
  videoUrl: String,
  audioUrl: String,
  fileName: String,
  fileSize: Number,
  fileMimeType: String,
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    address: {
      type: String,
      trim: true
    }
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'ReadBy user is required'],
      validate: {
        validator: function(v) {
          return v != null && mongoose.Types.ObjectId.isValid(v);
        },
        message: 'ReadBy user must be a valid ObjectId'
      }
    },
    readAt: {
      type: Date,
      default: Date.now,
      required: [true, 'ReadAt timestamp is required']
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  originalContent: String,
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  tenancyInviteContext: {
    type: String,
    enum: ['none', 'invite_message', 'tenant_only', 'owner_only', 'tenant_application'],
    default: 'none'
  },
  tenancyInviteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyInvite',
    default: null
  }
}, {
  timestamps: true
});

// Pre-save middleware to clean up corrupted readBy data
messageSchema.pre('save', function(next) {
  // Remove any readBy entries with invalid user values
  this.readBy = this.readBy.filter(read => 
    read.user && 
    mongoose.Types.ObjectId.isValid(read.user) &&
    read.readAt
  );
  
  // Remove duplicates based on user ID
  const seenUsers = new Set();
  this.readBy = this.readBy.filter(read => {
    const userId = read.user.toString();
    if (seenUsers.has(userId)) {
      return false; // Remove duplicate
    }
    seenUsers.add(userId);
    return true;
  });
  
  next();
});

// Indexes for better performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ chat: 1, isDeleted: 1 });
messageSchema.index({ "readBy.user": 1 });
messageSchema.index({ tenancyInviteId: 1 });
messageSchema.index({ chat: 1, tenancyInviteId: 1 });

// Instance method to check if message is read by specific user
messageSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => read.user && read.user.equals && read.user.equals(userId));
};

// Instance method to get read count
messageSchema.methods.getReadCount = function() {
  return this.readBy.length;
};

// Instance method to mark as read by user
messageSchema.methods.markAsReadByUser = function(userId) {
  if (!this.isReadByUser(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  return this;
};

// Instance method to get read status info
messageSchema.methods.getReadStatusInfo = function(totalParticipants) {
  const readCount = this.readBy.length;
  const unreadCount = totalParticipants - readCount;
  
  return {
    readCount,
    unreadCount,
    totalParticipants,
    readPercentage: totalParticipants > 0 ? (readCount / totalParticipants) * 100 : 0,
    isFullyRead: readCount === totalParticipants,
    readBy: this.readBy.map(read => ({
      user: read.user,
      readAt: read.readAt
    }))
  };
};

// Static method to get unread messages for user in chat
messageSchema.statics.getUnreadMessagesForUser = function(chatId, userId) {
  return this.find({
    chat: chatId,
    "readBy.user": { $ne: userId },
    isDeleted: false
  }).sort({ createdAt: 1 });
};

// Static method to mark multiple messages as read
messageSchema.statics.markMultipleAsRead = function(messageIds, userId) {
  return this.updateMany(
    {
      _id: { $in: messageIds },
      "readBy.user": { $ne: userId }
    },
    {
      $push: {
        readBy: {
          user: userId,
          readAt: new Date()
        }
      }
    }
  );
};

module.exports = mongoose.model('Message', messageSchema);
