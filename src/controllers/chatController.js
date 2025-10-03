const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Test Chat Model (for debugging)
const testChatModel = async (req, res) => {
  try {
    console.log('Testing Chat model...');
    console.log('Chat model:', Chat);
    console.log('Chat.find:', typeof Chat.find);
    
    // Simple test query
    const count = await Chat.countDocuments({});
    console.log('Total chats in database:', count);
    
    res.json({
      success: true,
      message: 'Chat model is working',
      data: {
        modelName: Chat.modelName,
        totalChats: count,
        functions: {
          find: typeof Chat.find,
          findOne: typeof Chat.findOne,
          create: typeof Chat.create
        }
      }
    });
  } catch (error) {
    console.error('Test chat model error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Chats
const getAllChats = async (req, res) => {
  try {
    // Validate user ID
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('lastMessage')
      .sort({ lastActivity: -1 });

    // Manually populate participant details from both Tenant and Owner collections
    const populatedChats = await Promise.all(
      chats.map(async (chat) => {
        const chatObj = chat.toObject();
        
        // Populate participants
        const participantDetails = await Promise.all(
          chatObj.participants.map(async (participantId) => {
            // Try to find in Tenant collection first
            let user = await Tenant.findById(participantId).select('fullName phonenumber profilePhoto userType');
            
            // If not found in Tenant, try Owner collection
            if (!user) {
              user = await Owner.findById(participantId).select('fullName phonenumber profilePhoto userType');
            }
            
            return user ? {
              _id: participantId,
              fullName: user.fullName,
              phonenumber: user.phonenumber,
              profilePhoto: user.profilePhoto,
              userType: user.userType
            } : {
              _id: participantId,
              fullName: 'Unknown User',
              phonenumber: '',
              profilePhoto: '',
              userType: 'unknown'
            };
          })
        );
        
        // Populate lastMessage sender if exists
        if (chatObj.lastMessage && chatObj.lastMessage.sender) {
          let sender = await Tenant.findById(chatObj.lastMessage.sender).select('fullName phonenumber profilePhoto userType');
          
          if (!sender) {
            sender = await Owner.findById(chatObj.lastMessage.sender).select('fullName phonenumber profilePhoto userType');
          }
          
          if (sender) {
            chatObj.lastMessage.sender = {
              _id: chatObj.lastMessage.sender,
              fullName: sender.fullName,
              phonenumber: sender.phonenumber,
              profilePhoto: sender.profilePhoto,
              userType: sender.userType
            };
          }
        }
        
        return {
          ...chatObj,
          participants: participantDetails
        };
      })
    );

    res.json({
      success: true,
      data: populatedChats
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Single Chat Details
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('participants', 'fullName profilePhoto userType lastSeen isOnline')
      .populate('lastMessage');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.find(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if chat is muted for the current user
    const mutedInfo = chat.mutedBy.find(m => m.user.toString() === req.user._id.toString());
    const isMuted = mutedInfo && (!mutedInfo.mutedUntil || mutedInfo.mutedUntil > new Date());

    // Check if chat is archived for the current user
    const isArchived = chat.archivedBy.includes(req.user._id);

    res.json({
      success: true,
      data: {
        ...chat.toObject(),
        isMuted,
        isArchived
      }
    });
  } catch (error) {
    console.error('Get chat details error:', error);
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

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
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
    console.error('Access chat error:', error);
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

// Mute Chat
const muteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { duration } = req.body; // duration in hours, null for indefinite

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

    // Remove existing mute entry for this user
    chat.mutedBy = chat.mutedBy.filter(m => m.user.toString() !== req.user._id.toString());

    // Add new mute entry
    const muteEntry = {
      user: req.user._id,
      mutedUntil: duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null
    };

    chat.mutedBy.push(muteEntry);
    await chat.save();

    res.json({
      success: true,
      message: `Chat muted ${duration ? `for ${duration} hours` : 'indefinitely'}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Unmute Chat
const unmuteChat = async (req, res) => {
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

    // Remove mute entry for this user
    chat.mutedBy = chat.mutedBy.filter(m => m.user.toString() !== req.user._id.toString());
    await chat.save();

    res.json({
      success: true,
      message: 'Chat unmuted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Archive Chat
const archiveChat = async (req, res) => {
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

    // Add user to archived list if not already archived
    if (!chat.archivedBy.includes(req.user._id)) {
      chat.archivedBy.push(req.user._id);
      await chat.save();
    }

    res.json({
      success: true,
      message: 'Chat archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Unarchive Chat
const unarchiveChat = async (req, res) => {
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

    // Remove user from archived list
    chat.archivedBy = chat.archivedBy.filter(userId => userId.toString() !== req.user._id.toString());
    await chat.save();

    res.json({
      success: true,
      message: 'Chat unarchived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Contacts (All possible chat partners with their chat info if exists)
const getContacts = async (req, res) => {
  try {
    // Validate user ID
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Determine user type and get appropriate contacts
    const currentUser = await Tenant.findById(req.user._id) || await Owner.findById(req.user._id);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let potentialContacts = [];
    
    // If current user is tenant, get all owners
    if (currentUser.userType === 'tenant') {
      potentialContacts = await Owner.find({}).select('_id');
    } 
    // If current user is owner, get all tenants
    else if (currentUser.userType === 'owner') {
      potentialContacts = await Tenant.find({}).select('_id');
    }

    // Get all chats for the current user with populated lastMessage
    const userChats = await Chat.find({
      participants: req.user._id
    }).populate('lastMessage').sort({ lastActivity: -1 });

    // Create a map of userId to chat for quick lookup
    const chatMap = new Map();
    userChats.forEach(chat => {
      const otherParticipant = chat.participants.find(p => p.toString() !== req.user._id.toString());
      if (otherParticipant) {
        chatMap.set(otherParticipant.toString(), chat);
      }
    });

    // Import createContactObject helper from messageController
    const { createContactObject } = require('./messageController');

    // Build contacts list
    const contactsWithChats = [];
    const contactsWithoutChats = [];

    for (const contact of potentialContacts) {
      const contactId = contact._id.toString();
      const chat = chatMap.get(contactId);
      
      if (chat) {
        // Contact with existing chat
        const contactObj = await createContactObject(contact._id, chat, req.user._id, req);
        if (contactObj) {
          contactObj.sortDate = chat.lastActivity;
          contactsWithChats.push(contactObj);
        }
      } else {
        // Contact without chat
        const contactObj = await createContactObject(contact._id, null, req.user._id, req);
        if (contactObj) {
          contactObj.sortDate = new Date(0); // Very old date for sorting
          contactsWithoutChats.push(contactObj);
        }
      }
    }

    // Sort contacts with chats by lastActivity (most recent first)
    contactsWithChats.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    // Sort contacts without chats alphabetically
    contactsWithoutChats.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Combine lists: contacts with chats first, then contacts without chats
    const allContacts = [...contactsWithChats, ...contactsWithoutChats];

    // Remove temporary sortDate field
    const cleanedContacts = allContacts.map(contact => {
      const { sortDate, ...contactWithoutSort } = contact;
      return contactWithoutSort;
    });

    res.json({
      success: true,
      data: cleanedContacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllChats,
  getChatDetails,
  accessChat,
  createGroupChat,
  searchChats,
  getChatsWithUnread,
  markChatAsRead,
  deleteChat,
  muteChat,
  unmuteChat,
  archiveChat,
  unarchiveChat,
  getContacts
};