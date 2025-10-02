const mongoose = require('mongoose');
const { saveFile } = require('../utils/fileUpload');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');

// Get models that were defined in chatController
let Chat, Message;
try {
  Chat = mongoose.model('Chat');
  Message = mongoose.model('Message');
} catch (error) {
  // If models don't exist, create them inline
  const chatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
    isGroupChat: { type: Boolean, default: false },
    chatName: String,
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastActivity: { type: Date, default: Date.now },
    unreadCount: [{ user: mongoose.Schema.Types.ObjectId, count: { type: Number, default: 0 } }],
    mutedBy: [{ user: mongoose.Schema.Types.ObjectId, mutedUntil: Date }],
    archivedBy: [mongoose.Schema.Types.ObjectId]
  }, { timestamps: true });

  const messageSchema = new mongoose.Schema({
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    messageType: { type: String, enum: ['text', 'image', 'location', 'document', 'video', 'audio'], default: 'text' },
    content: String,
    imageUrl: String, documentUrl: String, videoUrl: String, audioUrl: String,
    fileName: String, fileSize: Number, fileMimeType: String,
    location: { latitude: Number, longitude: Number, address: String },
    readBy: [{ user: mongoose.Schema.Types.ObjectId, readAt: { type: Date, default: Date.now } }],
    isEdited: { type: Boolean, default: false },
    originalContent: String,
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    isDeleted: { type: Boolean, default: false }
  }, { timestamps: true });

  Chat = mongoose.model('Chat', chatSchema);
  Message = mongoose.model('Message', messageSchema);
}

// const { uploadToCloudinary } = require("../utils/cloudinary");

// Send Text Message
const sendMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({
        success: false,
        message: "Content and chat ID are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "text",
      content
    });

    // Update chat's last message and activity
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", messageObj);

    res.status(201).json({
      success: true,
      message: "Text message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Messages
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const messages = await Message.find({
      chat: chatId,
      isDeleted: false
    })
      .sort({ createdAt: 1 }); // Get all messages sorted by creation time

    // Manually populate sender details from both Tenant and Owner collections
    const messagesWithFullDetails = await Promise.all(
      messages.map(async (message) => {
        const messageObj = message.toObject();
        
        // Populate sender details
        if (messageObj.sender) {
          // Try to find in Tenant collection first
          let sender = await Tenant.findById(messageObj.sender).select('fullName phonenumber profilePhoto userType');
          
          // If not found in Tenant, try Owner collection
          if (!sender) {
            sender = await Owner.findById(messageObj.sender).select('fullName phonenumber profilePhoto userType');
          }
          
          if (sender) {
            messageObj.sender = {
              _id: messageObj.sender,
              fullName: sender.fullName,
              phonenumber: sender.phonenumber,
              profilePhoto: sender.profilePhoto,
              userType: sender.userType
            };
            
            // Add full URL for profile photo
            if (sender.profilePhoto) {
              messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${sender.profilePhoto}`;
            }
          } else {
            messageObj.sender = {
              _id: messageObj.sender,
              fullName: 'Unknown User',
              phonenumber: '',
              profilePhoto: '',
              userType: 'unknown'
            };
          }
        }
        
        // Add full URLs for media files
        if (messageObj.imageUrl) {
          messageObj.imageFullUrl = `${req.protocol}://${req.get('host')}${messageObj.imageUrl}`;
        }
        if (messageObj.videoUrl) {
          messageObj.videoFullUrl = `${req.protocol}://${req.get('host')}${messageObj.videoUrl}`;
        }
        if (messageObj.audioUrl) {
          messageObj.audioFullUrl = `${req.protocol}://${req.get('host')}${messageObj.audioUrl}`;
        }
        if (messageObj.documentUrl) {
          messageObj.documentFullUrl = `${req.protocol}://${req.get('host')}${messageObj.documentUrl}`;
        }
        
        return messageObj;
      })
    );

    res.json({
      success: true,
      data: {
        messages: messagesWithFullDetails,
        totalMessages: messages.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send Photo Message
const sendPhotoMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and image are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Use saveFile utility to upload image
    const result = await saveFile(
      req.file.buffer,
      "chat_images",
      req.file.originalname
    );

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "image",
      imageUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    messageObj.imageFullUrl = `${req.protocol}://${req.get('host')}${result.url}`;
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    res.status(201).json({
      success: true,
      message: "Photo message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send Location Message
const sendLocationMessage = async (req, res) => {
  try {
    const { chatId, lat, lng, address } = req.body;

    if (!chatId || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, latitude, and longitude are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "location",
      location: {
        latitude: lat,
        longitude: lng,
        address: address || ""
      }
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", messageObj);

    res.status(201).json({
      success: true,
      message: "Location message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send Video Message
const sendVideoMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and video are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Use saveFile utility to upload video
    const result = await saveFile(
      req.file.buffer,
      "chat_videos",
      req.file.originalname
    );

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "video",
      videoUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    messageObj.videoFullUrl = `${req.protocol}://${req.get('host')}${result.url}`;
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", messageObj);

    res.status(201).json({
      success: true,
      message: "Video message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send Document Message
const sendDocumentMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and document are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Use saveFile utility to upload document
    const result = await saveFile(
      req.file.buffer,
      "chat_documents",
      req.file.originalname
    );

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "document",
      documentUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    messageObj.documentFullUrl = `${req.protocol}://${req.get('host')}${result.url}`;
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", messageObj);

    res.status(201).json({
      success: true,
      message: "Document message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send Audio Message
const sendAudioMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId || !req.file) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and audio are required"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Use saveFile utility to upload audio
    const result = await saveFile(
      req.file.buffer,
      "chat_audio",
      req.file.originalname
    );

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: "audio",
      audioUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();

    // Update unread count for other participants
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = chat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          chat.unreadCount[unreadIndex].count += 1;
        } else {
          chat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "fullName profilePhoto");

    // Add full URLs to response
    const messageObj = populatedMessage.toObject();
    messageObj.audioFullUrl = `${req.protocol}://${req.get('host')}${result.url}`;
    if (messageObj.sender && messageObj.sender.profilePhoto) {
      messageObj.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${messageObj.sender.profilePhoto}`;
    }

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", messageObj);

    res.status(201).json({
      success: true,
      message: "Audio message sent successfully",
      data: messageObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Edit Message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Content is required for editing"
      });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to edit this message"
      });
    }

    // Only text messages can be edited
    if (message.messageType !== "text") {
      return res.status(400).json({
        success: false,
        message: "Only text messages can be edited"
      });
    }

    // Save original content before editing
    if (!message.isEdited) {
      message.originalContent = message.content;
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "fullName profilePhoto");

    // Emit socket event
    req.app.get("io").to(message.chat.toString()).emit("messageEdited", updatedMessage);

    res.json({
      success: true,
      data: updatedMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Forward Message
const forwardMessage = async (req, res) => {
  try {
    const { messageId, chatId } = req.params;

    const sourceMessage = await Message.findById(messageId);
    if (!sourceMessage || sourceMessage.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const targetChat = await Chat.findById(chatId);
    if (!targetChat) {
      return res.status(404).json({
        success: false,
        message: "Target chat not found"
      });
    }

    if (!targetChat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to forward to this chat"
      });
    }

    // Create a new message in the target chat with the same content
    const newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: sourceMessage.messageType,
      content: sourceMessage.content,
      imageUrl: sourceMessage.imageUrl,
      videoUrl: sourceMessage.videoUrl,
      audioUrl: sourceMessage.audioUrl,
      documentUrl: sourceMessage.documentUrl,
      location: sourceMessage.location,
      fileName: sourceMessage.fileName,
      fileSize: sourceMessage.fileSize,
      fileMimeType: sourceMessage.fileMimeType,
      forwardedFrom: messageId
    });

    // Update target chat
    targetChat.lastMessage = newMessage._id;
    targetChat.lastActivity = new Date();

    // Update unread count for other participants
    targetChat.participants.forEach(participantId => {
      if (participantId.toString() !== req.user._id.toString()) {
        const unreadIndex = targetChat.unreadCount.findIndex(
          uc => uc.user.toString() === participantId.toString()
        );

        if (unreadIndex !== -1) {
          targetChat.unreadCount[unreadIndex].count += 1;
        } else {
          targetChat.unreadCount.push({
            user: participantId,
            count: 1
          });
        }
      }
    });

    await targetChat.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "fullName profilePhoto");

    // Emit socket event
    req.app.get("io").to(chatId).emit("newMessage", populatedMessage);

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    message.isDeleted = true;
    await message.save();

    // Emit socket event
    req.app.get("io").to(message.chat.toString()).emit("messageDeleted", messageId);

    res.json({
      success: true,
      message: "Message deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Media/File (but keep the message)
const deleteMediaFile = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    if (!["image", "video", "audio", "document"].includes(message.messageType)) {
      return res.status(400).json({
        success: false,
        message: "Message does not contain media to delete"
      });
    }

    // Clear the media URL but keep message entry
    if (message.messageType === "image") {
      message.imageUrl = null;
    } else if (message.messageType === "video") {
      message.videoUrl = null;
    } else if (message.messageType === "audio") {
      message.audioUrl = null;
    } else if (message.messageType === "document") {
      message.documentUrl = null;
    }

    message.content = "Media removed";
    await message.save();

    // Emit socket event
    req.app.get("io").to(message.chat.toString()).emit("mediaDeleted", messageId);

    res.json({
      success: true,
      message: "Media deleted successfully",
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  sendPhotoMessage,
  sendLocationMessage,
  sendVideoMessage,
  sendDocumentMessage,
  sendAudioMessage,
  editMessage,
  forwardMessage,
  deleteMessage,
  deleteMediaFile
};
