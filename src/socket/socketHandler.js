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
    console.log(`[SOCKET] User ${socket.user.fullName} (${socket.userId}) connected - Socket ID: ${socket.id}`);

    // Join user to their personal room for direct messaging
    socket.join(socket.userId);
    console.log(`[SOCKET] User ${socket.user.fullName} joined personal room: ${socket.userId}`);

    // Send connection confirmation
    socket.emit('connection-confirmed', {
      userId: socket.userId,
      fullName: socket.user.fullName,
      userType: socket.user.userType,
      socketId: socket.id,
      timestamp: new Date()
    });

    // Debug room information
    socket.on('debug-rooms', (callback) => {
      const rooms = Array.from(socket.rooms);
      const roomSizes = {};
      
      rooms.forEach(room => {
        const roomData = io.sockets.adapter.rooms.get(room);
        roomSizes[room] = roomData ? roomData.size : 0;
      });

      const debugInfo = {
        socketId: socket.id,
        userId: socket.userId,
        userRooms: rooms,
        roomSizes: roomSizes,
        totalConnectedSockets: io.sockets.sockets.size
      };

      console.log(`[DEBUG] Room info for ${socket.user.fullName}:`, debugInfo);
      
      if (callback) {
        callback(debugInfo);
      }
    });

    // Auto-join all user's existing chats when they connect
    socket.on('join-user-chats', async (callback) => {
      try {
        console.log(`[SOCKET] User ${socket.user.fullName} (${socket.userId}) requesting to join all chats`);
        
        const userChats = await Chat.find({
          participants: socket.user._id
        }).select('_id participants');
        
        let joinedChats = [];
        userChats.forEach(chat => {
          const chatId = chat._id.toString();
          socket.join(chatId);
          joinedChats.push(chatId);
          console.log(`[SOCKET] User ${socket.user.fullName} joined chat room: ${chatId}`);
        });

        console.log(`[SOCKET] User ${socket.user.fullName} auto-joined ${joinedChats.length} chat rooms`);
        
        if (callback) {
          callback({
            success: true,
            message: `Joined ${joinedChats.length} chats`,
            chatIds: joinedChats,
            totalRooms: socket.rooms.size
          });
        }
      } catch (error) {
        console.error(`[SOCKET] Error joining user chats for ${socket.userId}:`, error);
        if (callback) {
          callback({
            success: false,
            message: 'Failed to join chats',
            error: error.message
          });
        }
      }
    });

    // Join specific chat (when user opens a chat)
    socket.on('join-chat', async (chatId, callback) => {
      try {
        console.log(`[SOCKET] User ${socket.user.fullName} requesting to join chat: ${chatId}`);
        
        // Verify user is participant in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.user._id)) {
          console.warn(`[SOCKET] User ${socket.userId} unauthorized to join chat ${chatId}`);
          if (callback) {
            callback({
              success: false,
              message: 'Unauthorized to join this chat'
            });
          }
          return;
        }

        socket.join(chatId);
        console.log(`[SOCKET] User ${socket.user.fullName} successfully joined chat ${chatId}`);
        
        // Get room info for debugging
        const room = socket.adapter.rooms.get(chatId);
        const roomSize = room ? room.size : 0;
        console.log(`[SOCKET] Chat room ${chatId} now has ${roomSize} connected clients`);
        
        // Notify other participants that user is online in this chat
        socket.to(chatId).emit('user-joined-chat', {
          userId: socket.userId,
          fullName: socket.user.fullName,
          userType: socket.user.userType,
          timestamp: new Date()
        });

        if (callback) {
          callback({
            success: true,
            message: 'Successfully joined chat',
            chatId: chatId,
            roomSize: roomSize,
            userRooms: Array.from(socket.rooms)
          });
        }
      } catch (error) {
        console.error(`[SOCKET] Error joining chat ${chatId} for user ${socket.userId}:`, error);
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
      console.log(`[SOCKET] User ${socket.user.fullName} leaving chat ${chatId}`);
      
      socket.leave(chatId);
      
      // Notify other participants that user left
      socket.to(chatId).emit('user-left-chat', {
        userId: socket.userId,
        fullName: socket.user.fullName,
        timestamp: new Date()
      });

      if (callback) {
        callback({
          success: true,
          message: 'Successfully left chat',
          chatId: chatId,
          remainingRooms: Array.from(socket.rooms)
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
      console.log(`[SOCKET] User ${socket.user.fullName} (${socket.userId}) disconnected: ${reason}`);
      
      // Get rooms before disconnection for logging
      const userRooms = Array.from(socket.rooms);
      console.log(`[SOCKET] User was in rooms: ${userRooms.join(', ')}`);
      
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
          console.log(`[SOCKET] Broadcasted offline status to room: ${room}`);
        }
      });
    });

    // Auto-trigger chat joining when user connects
    console.log(`[SOCKET] Triggering auto-join for user ${socket.user.fullName}`);
    socket.emit('auto-join-chats');
  });
};

module.exports = socketHandler;