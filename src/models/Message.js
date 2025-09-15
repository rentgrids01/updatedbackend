const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location', 'document'],
    default: 'text'
  },
  content: String,
  imageUrl: String,
  documentUrl: String,
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);