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
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.fullName} connected`);

    // Join user to their chats
    socket.on('join-chats', async () => {
      try {
        const userChats = await Chat.find({
          participants: socket.user._id
        });
        
        userChats.forEach(chat => {
          socket.join(chat._id.toString());
        });
      } catch (error) {
        console.error('Error joining chats:', error);
      }
    });

    // Join specific chat
    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.user.fullName} joined chat ${chatId}`);
    });

    // Leave chat
    socket.on('leave-chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.user.fullName} left chat ${chatId}`);
    });

    // Handle typing events
    socket.on('typing', (data) => {
      socket.to(data.chatId).emit('typing', {
        userId: socket.user._id,
        fullName: socket.user.fullName
      });
    });

    socket.on('stop-typing', (data) => {
      socket.to(data.chatId).emit('stop-typing', {
        userId: socket.user._id
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.fullName} disconnected`);
    });
  });
};

module.exports = socketHandler;