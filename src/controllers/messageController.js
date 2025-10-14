const mongoose = require('mongoose');
const { saveFile } = require('../utils/fileUpload');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Helper function to create contact object for a specific user
const createContactObject = async (userId, chatData, currentUserId, req) => {
  try {
    // Get user details from either Tenant or Owner collection
    let user = await Tenant.findById(userId).select('fullName phonenumber profilePhoto userType');
    
    if (!user) {
      user = await Owner.findById(userId).select('fullName phonenumber profilePhoto userType');
    }
    
    if (!user) {
      return null;
    }

    const contactObj = {
      _id: user._id,
      fullName: user.fullName,
      phonenumber: user.phonenumber,
      profilePhoto: user.profilePhoto,
      userType: user.userType
    };

    // Add full URL for profile photo
    if (user.profilePhoto) {
      contactObj.profilePhotoUrl = `${req.protocol}://${req.get('host')}${user.profilePhoto}`;
    }

    // Add chat information
    if (chatData) {
      // Get unread count for the current user
      const unreadEntry = chatData.unreadCount.find(entry => 
        entry.user.toString() === currentUserId.toString()
      );

      // Create lastMessage object with sender details
      let lastMessageWithSender = null;
      if (chatData.lastMessage) {
        const lastMessage = chatData.lastMessage.toObject ? chatData.lastMessage.toObject() : chatData.lastMessage;
        
        if (lastMessage.sender) {
          let sender = await Tenant.findById(lastMessage.sender).select('fullName phonenumber profilePhoto userType');
          
          if (!sender) {
            sender = await Owner.findById(lastMessage.sender).select('fullName phonenumber profilePhoto userType');
          }
          
          if (sender) {
            lastMessageWithSender = {
              ...lastMessage,
              sender: {
                _id: lastMessage.sender,
                fullName: sender.fullName,
                phonenumber: sender.phonenumber,
                profilePhoto: sender.profilePhoto,
                userType: sender.userType
              }
            };
            
            // Add full URL for sender profile photo
            if (sender.profilePhoto) {
              lastMessageWithSender.sender.profilePhotoUrl = `${req.protocol}://${req.get('host')}${sender.profilePhoto}`;
            }
            
            // Add full URLs for message media
            if (lastMessage.imageUrl) {
              lastMessageWithSender.imageFullUrl = `${req.protocol}://${req.get('host')}${lastMessage.imageUrl}`;
            }
            if (lastMessage.videoUrl) {
              lastMessageWithSender.videoFullUrl = `${req.protocol}://${req.get('host')}${lastMessage.videoUrl}`;
            }
            if (lastMessage.audioUrl) {
              lastMessageWithSender.audioFullUrl = `${req.protocol}://${req.get('host')}${lastMessage.audioUrl}`;
            }
            if (lastMessage.documentUrl) {
              lastMessageWithSender.documentFullUrl = `${req.protocol}://${req.get('host')}${lastMessage.documentUrl}`;
            }
          }
        }
      }

      contactObj.chat = {
        _id: chatData._id,
        isGroupChat: chatData.isGroupChat,
        lastActivity: chatData.lastActivity,
        unreadCount: unreadEntry ? unreadEntry.count : 0,
        lastMessage: lastMessageWithSender
      };
    } else {
      contactObj.chat = null;
    }

    return contactObj;
  } catch (error) {
    console.error('Error creating contact object:', error);
    return null;
  }
};

// Helper function to populate message with sender details and emit to socket
const populateAndEmitMessage = async (messageId, chatId, req) => {
  try {
    console.log(`[MESSAGE] Starting emission for message ${messageId} in chat ${chatId}`);
    
    // Get the message and chat
    const message = await Message.findById(messageId);
    const chat = await Chat.findById(chatId).populate('lastMessage');
    
    if (!message || !chat) {
      console.error(`[MESSAGE] Message or chat not found - Message: ${!!message}, Chat: ${!!chat}`);
      return null;
    }

    const messageObj = message.toObject();

    // Manually populate sender details
    if (messageObj.sender) {
      let sender = await Tenant.findById(messageObj.sender).select('fullName phonenumber profilePhoto userType');
      
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
        
        console.log(`[MESSAGE] Populated sender details for ${sender.fullName} (${sender.userType})`);
      } else {
        console.warn(`[MESSAGE] Sender not found for message ${messageId}`);
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

    const io = req.app.get("io");
    
    // Get room info for debugging
    const room = io.sockets.adapter.rooms.get(chatId);
    const roomSize = room ? room.size : 0;
    console.log(`[SOCKET] Chat room ${chatId} has ${roomSize} connected clients`);

    // Emit new message to chat participants with acknowledgment tracking
    let deliveryCount = 0;
    io.to(chatId).emit("newMessage", messageObj, (acks) => {
      deliveryCount = Array.isArray(acks) ? acks.length : (acks ? 1 : 0);
      console.log(`[SOCKET] Message ${messageId} delivered to ${deliveryCount} clients in room ${chatId}`);
      
      // Emit delivery confirmation back to sender
      if (messageObj.sender && messageObj.sender._id) {
        io.to(messageObj.sender._id.toString()).emit("messageDelivered", {
          messageId: messageId,
          chatId: chatId,
          deliveredTo: deliveryCount,
          timestamp: new Date()
        });
      }
    });

    // Emit contact updates to all participants (existing functionality)
    console.log(`[CONTACT] Sending contact updates to ${chat.participants.length} participants`);
    for (const participantId of chat.participants) {
      try {
        // Create contact object for each participant
        const otherParticipants = chat.participants.filter(p => p.toString() !== participantId.toString());
        
        for (const otherParticipantId of otherParticipants) {
          const contactObj = await createContactObject(otherParticipantId, chat, participantId, req);
          if (contactObj) {
            // Emit to the participant's personal room
            io.to(participantId.toString()).emit("contactUpdated", contactObj, (ack) => {
              console.log(`[CONTACT] Contact update sent to user ${participantId} - Ack: ${!!ack}`);
            });
          }
        }
      } catch (error) {
        console.error(`[CONTACT] Error sending contact update to participant ${participantId}:`, error);
      }
    }

    console.log(`[MESSAGE] Successfully emitted message ${messageId} to chat ${chatId}`);
    return messageObj;
  } catch (error) {
    console.error(`[MESSAGE] Error populating and emitting message:`, error);
    return null;
  }
};

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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "text",
      content,
      tenancyInviteContext: 'none', // Regular message
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

    // Save chat first
    await chat.save();

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
    }

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
    const { tenancyInviteId } = req.query; // Get tenancy invite ID from query params
    
    console.log(`[API] Getting messages for chat ${chatId} by user ${req.user._id}${tenancyInviteId ? ` filtered by tenancy invite ${tenancyInviteId}` : ''}`);

    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.warn(`[API] Chat ${chatId} not found`);
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      console.warn(`[API] User ${req.user._id} unauthorized for chat ${chatId}`);
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Get current user's type
    let currentUser = await Tenant.findById(req.user._id).select('userType');
    if (!currentUser) {
      currentUser = await Owner.findById(req.user._id).select('userType');
    }
    
    if (!currentUser) {
      console.warn(`[API] User ${req.user._id} not found in Tenant or Owner collections`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Build query filter based on user type and tenancy invite context
    let messageFilter = {
      chat: chatId,
      isDeleted: false
    };

    // If tenancyInviteId is provided, filter messages related to that specific invite
    if (tenancyInviteId) {
      messageFilter.$or = [
        { tenancyInviteId: tenancyInviteId }, // Messages linked to this specific invite
        { tenancyInviteContext: 'none' } // Regular messages (not linked to any invite)
      ];
    } else {
      // If current user is a tenant, filter to show only relevant messages
      if (currentUser.userType === 'tenant') {
        messageFilter.$or = [
          { tenancyInviteContext: 'none' }, // Regular messages
          { tenancyInviteContext: 'invite_message' }, // Owner invite messages
          { tenancyInviteContext: 'tenant_only' }, // Tenant-specific messages
          { tenancyInviteContext: 'tenant_application' } // Tenant application messages
        ];
      }
      // If current user is an owner, show all messages except tenant-only
      else if (currentUser.userType === 'owner') {
        messageFilter.$or = [
          { tenancyInviteContext: 'none' }, // Regular messages
          { tenancyInviteContext: 'invite_message' }, // Owner invite messages
          { tenancyInviteContext: 'owner_only' }, // Owner-specific messages
          { tenancyInviteContext: 'tenant_application' } // Tenant application messages
        ];
      }
    }

    // Get all messages with proper sorting (oldest first for chronological order)
    const messages = await Message.find(messageFilter)
      .sort({ createdAt: 1 }) // ASC order as requested
      .lean(); // Use lean for better performance

    console.log(`[API] Found ${messages.length} messages in chat ${chatId}${tenancyInviteId ? ` for tenancy invite ${tenancyInviteId}` : ''}`);
    
    if (tenancyInviteId) {
      const inviteMessages = messages.filter(m => m.tenancyInviteId);
      console.log(`[API] ${inviteMessages.length} messages are linked to tenancy invites`);
    }

    // Manually populate sender details from both Tenant and Owner collections
    const messagesWithFullDetails = await Promise.all(
      messages.map(async (messageObj) => {
        // Populate sender details
        if (messageObj.sender) {
          // Try to find in Tenant collection first
          let sender = await Tenant.findById(messageObj.sender).select('fullName phonenumber profilePhoto userType').lean();
          
          // If not found in Tenant, try Owner collection
          if (!sender) {
            sender = await Owner.findById(messageObj.sender).select('fullName phonenumber profilePhoto userType').lean();
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
            console.warn(`[API] Sender ${messageObj.sender} not found for message ${messageObj._id}`);
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

        // Ensure all required fields are present
        messageObj.isEdited = messageObj.isEdited || false;
        messageObj.isDeleted = messageObj.isDeleted || false;
        messageObj.readBy = messageObj.readBy || [];
        
        // Add read status for current user
        const currentUserRead = messageObj.readBy.find(read => 
          read.user && read.user.toString() === req.user._id.toString()
        );
        messageObj.isReadByCurrentUser = !!currentUserRead;
        if (currentUserRead) {
          messageObj.readByCurrentUserAt = currentUserRead.readAt;
        }
        
        return messageObj;
      })
    );

    console.log(`[API] Successfully processed and returning ${messagesWithFullDetails.length} messages`);

    res.json({
      success: true,
      data: {
        chatId: chatId,
        messages: messagesWithFullDetails,
        totalMessages: messages.length,
        participants: chat.participants,
        lastActivity: chat.lastActivity,
        filteredByTenancyInvite: tenancyInviteId ? tenancyInviteId : null
      }
    });
  } catch (error) {
    console.error(`[API] Error getting messages for chat ${req.params.chatId}:`, error);
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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "image",
      imageUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "location",
      location: {
        latitude: lat,
        longitude: lng,
        address: address || ""
      },
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
    }

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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "video",
      videoUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
    }

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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "document",
      documentUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
    }

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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
      messageType: "audio",
      audioUrl: result.url,
      fileName: result.filename,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(message._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message sent but failed to broadcast to other users"
      });
    }

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
      senderModel: req.user.userType === "tenant" ? "Tenant" : "Owner",
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
      forwardedFrom: messageId,
      tenancyInviteContext: 'none', // Regular message
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

    // Populate message with full details and emit to socket
    const messageObj = await populateAndEmitMessage(newMessage._id, chatId, req);

    if (!messageObj) {
      return res.status(500).json({
        success: false,
        message: "Message forwarded but failed to broadcast to other users"
      });
    }

    res.status(201).json({
      success: true,
      data: messageObj
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

// Get read status for specific messages
const getMessageReadStatus = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const currentUserId = req.user.id;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: 'messageIds array is required'
      });
    }

    // Get messages with their read status
    const messages = await Message.find({
      _id: { $in: messageIds }
    })
    .select('_id readBy chat sender createdAt')
    .populate({
      path: 'readBy.user',
      select: 'fullName profilePhoto userType'
    })
    .populate({
      path: 'sender',
      select: 'fullName profilePhoto userType'
    });

    // Verify user has access to these messages by checking chat participation
    const chatIds = [...new Set(messages.map(msg => msg.chat.toString()))];
    const userChats = await Chat.find({
      _id: { $in: chatIds },
      participants: currentUserId
    }).select('_id participants');

    const authorizedChatIds = userChats.map(chat => chat._id.toString());
    const chatParticipantMap = {};
    
    userChats.forEach(chat => {
      chatParticipantMap[chat._id.toString()] = chat.participants.length;
    });
    
    // Filter messages to only include those from chats user has access to
    const authorizedMessages = messages.filter(msg => 
      authorizedChatIds.includes(msg.chat.toString())
    );

    const readStatusData = authorizedMessages.map(message => {
      const totalParticipants = chatParticipantMap[message.chat.toString()] || 0;
      return {
        messageId: message._id,
        chatId: message.chat,
        sender: {
          _id: message.sender._id,
          fullName: message.sender.fullName,
          profilePhoto: message.sender.profilePhoto,
          userType: message.sender.userType
        },
        createdAt: message.createdAt,
        readBy: message.readBy.map(read => ({
          userId: read.user._id,
          fullName: read.user.fullName,
          profilePhoto: read.user.profilePhoto,
          userType: read.user.userType,
          readAt: read.readAt
        })),
        readCount: message.readBy.length,
        unreadCount: totalParticipants - message.readBy.length,
        totalParticipants: totalParticipants,
        isFullyRead: message.readBy.length === totalParticipants,
        isReadByCurrentUser: message.readBy.some(read => 
          read.user && read.user._id && read.user._id.toString() === currentUserId.toString()
        )
      };
    });

    res.status(200).json({
      success: true,
      message: 'Read status retrieved successfully',
      data: readStatusData
    });

  } catch (error) {
    console.error('Error getting message read status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get read status',
      error: error.message
    });
  }
};

// Mark message as read
const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: 'messageId is required'
      });
    }

    // Find the message and verify access
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.participants.some(p => p.equals(currentUserId))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to mark this message as read'
      });
    }

    // Check if user has already read this message
    const alreadyRead = message.readBy.some(read => 
      read.user && read.user.equals && read.user.equals(currentUserId)
    );

    if (!alreadyRead) {
      // Mark as read
      message.readBy.push({
        user: currentUserId,
        readAt: new Date()
      });
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message marked as read successfully',
      data: {
        messageId: messageId,
        alreadyRead: alreadyRead,
        readAt: new Date(),
        readCount: message.readBy.length
      }
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
};

// Mark multiple messages as read
const markMessagesAsRead = async (req, res) => {
  try {
    const { messageIds, chatId } = req.body;
    const currentUserId = req.user.id;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: 'messageIds array is required'
      });
    }

    // Verify user is participant in the chat if chatId is provided
    if (chatId) {
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.participants.some(p => p.equals(currentUserId))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to mark messages in this chat as read'
        });
      }
    }

    // Update multiple messages at once
    const updateQuery = {
      _id: { $in: messageIds },
      "readBy.user": { $ne: currentUserId }
    };

    if (chatId) {
      updateQuery.chat = chatId;
    }

    const result = await Message.updateMany(
      updateQuery,
      {
        $push: {
          readBy: {
            user: currentUserId,
            readAt: new Date()
          }
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} messages marked as read`,
      data: {
        messageIds: messageIds,
        chatId: chatId,
        modifiedCount: result.modifiedCount,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// Get unread messages count for user
const getUnreadMessagesCount = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all chats for the user
    const userChats = await Chat.find({
      participants: currentUserId
    }).select('_id');

    const chatIds = userChats.map(chat => chat._id);

    // Count unread messages across all chats
    const unreadCount = await Message.countDocuments({
      chat: { $in: chatIds },
      "readBy.user": { $ne: currentUserId },
      isDeleted: false
    });

    res.status(200).json({
      success: true,
      message: 'Unread messages count retrieved successfully',
      data: {
        unreadCount: unreadCount,
        totalChats: chatIds.length
      }
    });

  } catch (error) {
    console.error('Error getting unread messages count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread messages count',
      error: error.message
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
  deleteMediaFile,
  createContactObject,
  getMessageReadStatus,
  markMessageAsRead,
  markMessagesAsRead,
  getUnreadMessagesCount
};
