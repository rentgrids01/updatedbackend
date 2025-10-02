const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const Owner = require('../models/Owner');
const Chat = require('../models/Chat');

const socketHandler = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      let user;
      if (decoded.userType === 'tenant') {
        user = await Tenant.findById(decoded.userId).select('-password');
      } else if (decoded.userType === 'owner') {
        user = await Owner.findById(decoded.userId).select('-password');
      }
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.fullName} (${socket.userId}) connected`);

    // Join user to their personal room for direct messaging
    socket.join(socket.userId);
    console.log(`User ${socket.user.fullName} joined personal room: ${socket.userId}`);

    // Auto-join all user's existing chats when they connect
    socket.on('join-user-chats', async (callback) => {
      try {
        const userChats = await Chat.find({
          participants: socket.user._id
        }).select('_id');
        
        let joinedChats = [];
        userChats.forEach(chat => {
          const chatId = chat._id.toString();
          socket.join(chatId);
          joinedChats.push(chatId);
        });

        console.log(`User ${socket.user.fullName} auto-joined ${joinedChats.length} chats`);
        
        if (callback) {
          callback({
            success: true,
            message: `Joined ${joinedChats.length} chats`,
            chatIds: joinedChats
          });
        }
      } catch (error) {
        console.error('Error joining user chats:', error);
        if (callback) {
          callback({
            success: false,
            message: 'Failed to join chats',
            error: error.message
          });
        }
      }
    });

    // Join specific chat
    socket.on('join-chat', async (chatId, callback) => {
      try {
        // Verify user is participant in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.user._id)) {
          if (callback) {
            callback({
              success: false,
              message: 'Unauthorized to join this chat'
            });
          }
          return;
        }

        socket.join(chatId);
        console.log(`User ${socket.user.fullName} joined chat ${chatId}`);
        
        // Notify other participants that user is online in this chat
        socket.to(chatId).emit('user-joined-chat', {
          userId: socket.userId,
          fullName: socket.user.fullName,
          userType: socket.user.userType
        });

        if (callback) {
          callback({
            success: true,
            message: 'Successfully joined chat',
            chatId: chatId
          });
        }
      } catch (error) {
        console.error('Error joining chat:', error);
        if (callback) {
          callback({
            success: false,
            message: 'Failed to join chat',
            error: error.message
          });
        }
      }
    });

    // Leave chat
    socket.on('leave-chat', (chatId, callback) => {
      socket.leave(chatId);
      console.log(`User ${socket.user.fullName} left chat ${chatId}`);
      
      // Notify other participants that user left
      socket.to(chatId).emit('user-left-chat', {
        userId: socket.userId,
        fullName: socket.user.fullName
      });

      if (callback) {
        callback({
          success: true,
          message: 'Successfully left chat',
          chatId: chatId
        });
      }
    });

    // Handle typing events
    socket.on('typing', (data, callback) => {
      const { chatId } = data;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        fullName: socket.user.fullName,
        chatId: chatId,
        timestamp: new Date()
      });

      if (callback) {
        callback({
          success: true,
          message: 'Typing status sent'
        });
      }
    });

    socket.on('stop-typing', (data, callback) => {
      const { chatId } = data;
      socket.to(chatId).emit('user-stop-typing', {
        userId: socket.userId,
        chatId: chatId,
        timestamp: new Date()
      });

      if (callback) {
        callback({
          success: true,
          message: 'Stop typing status sent'
        });
      }
    });

    // Handle message read receipts
    socket.on('message-read', (data, callback) => {
      const { chatId, messageId } = data;
      socket.to(chatId).emit('message-read-by', {
        messageId: messageId,
        readBy: {
          userId: socket.userId,
          fullName: socket.user.fullName,
          readAt: new Date()
        }
      });

      if (callback) {
        callback({
          success: true,
          message: 'Read receipt sent'
        });
      }
    });

    // Handle online/offline status
    socket.on('user-online', (callback) => {
      // Broadcast to all user's chats that they are online
      socket.rooms.forEach(room => {
        if (room !== socket.id && room !== socket.userId) {
          socket.to(room).emit('user-status-change', {
            userId: socket.userId,
            fullName: socket.user.fullName,
            status: 'online',
            timestamp: new Date()
          });
        }
      });

      if (callback) {
        callback({
          success: true,
          message: 'Online status broadcasted'
        });
      }
    });

    // Handle contact list refresh request
    socket.on('refresh-contacts', (callback) => {
      // This event is handled by the client to trigger a contacts API call
      // The server acknowledges the request
      if (callback) {
        callback({
          success: true,
          message: 'Contact refresh acknowledged'
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`User ${socket.user.fullName} disconnected: ${reason}`);
      
      // Broadcast offline status to all user's chats
      socket.rooms.forEach(room => {
        if (room !== socket.id && room !== socket.userId) {
          socket.to(room).emit('user-status-change', {
            userId: socket.userId,
            fullName: socket.user.fullName,
            status: 'offline',
            timestamp: new Date(),
            reason: reason
          });
        }
      });
    });

    // Auto-join user chats when they connect
    socket.emit('auto-join-chats');
  });
};

module.exports = socketHandler;