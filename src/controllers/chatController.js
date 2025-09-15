const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');

// Get All Chats
const getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'fullName profilePhoto userType')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Access or Create Chat
const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [req.user._id, userId] }
    }).populate('participants', 'fullName profilePhoto userType');

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        participants: [req.user._id, userId],
        isGroupChat: false
      });

      chat = await Chat.findById(chat._id)
        .populate('participants', 'fullName profilePhoto userType');
    }

    res.json({
      success: true,
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create Group Chat
const createGroupChat = async (req, res) => {
  try {
    const { name, users } = req.body;

    if (!name || !users || users.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name and at least 2 users are required'
      });
    }

    const participants = [...users, req.user._id];

    const groupChat = await Chat.create({
      chatName: name,
      participants,
      isGroupChat: true
    });

    const populatedChat = await Chat.findById(groupChat._id)
      .populate('participants', 'fullName profilePhoto userType');

    res.status(201).json({
      success: true,
      data: populatedChat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Search Chats
const searchChats = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const chats = await Chat.find({
      participants: req.user._id,
      $or: [
        { chatName: new RegExp(query, 'i') },
        {
          participants: {
            $in: await User.find({
              fullName: new RegExp(query, 'i')
            }).distinct('_id')
          }
        },
        {
          participants: {
            $in: [
              ...(await Tenant.find({ fullName: new RegExp(query, 'i') }).distinct('_id')),
              ...(await Owner.find({ fullName: new RegExp(query, 'i') }).distinct('_id'))
            ]
          }
        }
      ]
    })
      .populate('participants', 'fullName profilePhoto userType')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    res.json({
      success: true,
      data: chats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Chats with Unread Count
const getChatsWithUnread = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'fullName profilePhoto userType')
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    // Add unread count for each chat
    const chatsWithUnread = chats.map(chat => {
      const unreadInfo = chat.unreadCount.find(
        uc => uc.user.toString() === req.user._id.toString()
      );

      return {
        ...chat.toObject(),
        unreadMessages: unreadInfo ? unreadInfo.count : 0
      };
    });

    res.json({
      success: true,
      data: chatsWithUnread
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark Chat as Read
const markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;

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

    // Reset unread count for this user
    const unreadIndex = chat.unreadCount.findIndex(
      uc => uc.user.toString() === req.user._id.toString()
    );

    if (unreadIndex !== -1) {
      chat.unreadCount[unreadIndex].count = 0;
    } else {
      chat.unreadCount.push({
        user: req.user._id,
        count: 0
      });
    }

    await chat.save();

    res.json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Chat
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

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

    // Delete all messages in the chat
    await Message.deleteMany({ chat: chatId });

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllChats,
  accessChat,
  createGroupChat,
  searchChats,
  getChatsWithUnread,
  markChatAsRead,
  deleteChat
};