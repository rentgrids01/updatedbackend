const Message = require('../models/Message');
const Chat = require('../models/Chat');
// const { uploadToCloudinary } = require('../utils/cloudinary');

// Send Text Message
const sendMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({
        success: false,
        message: 'Content and chat ID are required'
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: 'text',
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
      .populate('sender', 'fullName profilePhoto');

    // Emit socket event
    req.app.get('io').to(chatId).emit('newMessage', populatedMessage);

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

// Get Messages
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const messages = await Message.find({
      chat: chatId,
      isDeleted: false
    })
      .populate('sender', 'fullName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({
      chat: chatId,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
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
        message: 'Chat ID and image are required'
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // const result = await uploadToCloudinary(
    //   req.file.buffer,
    //   'chat_images',
    //   'image'
    // );

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: 'image',
      imageUrl: result.secure_url
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName profilePhoto');

    // Emit socket event
    req.app.get('io').to(chatId).emit('newMessage', populatedMessage);

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

// Send Location Message
const sendLocationMessage = async (req, res) => {
  try {
    const { chatId, lat, lng, address } = req.body;

    if (!chatId || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID, latitude, and longitude are required'
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      messageType: 'location',
      location: {
        latitude: lat,
        longitude: lng,
        address: address || ''
      }
    });

    // Update chat
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'fullName profilePhoto');

    // Emit socket event
    req.app.get('io').to(chatId).emit('newMessage', populatedMessage);

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
        message: 'Message not found'
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    message.isDeleted = true;
    await message.save();

    // Emit socket event
    req.app.get('io').to(message.chat.toString()).emit('messageDeleted', messageId);

    res.json({
      success: true,
      message: 'Message deleted successfully'
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
  deleteMessage
};