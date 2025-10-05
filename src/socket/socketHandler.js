const jwt = require("jsonwebtoken");
const Tenant = require("../models/Tenant");
const Owner = require("../models/Owner");
const Chat = require("../models/Chat");
const Message = require("../models/Message");

const socketHandler = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user;
      if (decoded.userType === "tenant") {
        user = await Tenant.findById(decoded.userId).select("-password");
      } else if (decoded.userType === "owner") {
        user = await Owner.findById(decoded.userId).select("-password");
      }

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `[SOCKET] User ${socket.user.fullName} (${socket.userId}) connected - Socket ID: ${socket.id}`
    );

    // Join user to their personal room for direct messaging
    socket.join(socket.userId);
    console.log(
      `[SOCKET] User ${socket.user.fullName} joined personal room: ${socket.userId}`
    );

    // Send connection confirmation
    socket.emit("connection-confirmed", {
      userId: socket.userId,
      fullName: socket.user.fullName,
      userType: socket.user.userType,
      socketId: socket.id,
      timestamp: new Date(),
    });

    // Debug room information
    socket.on("debug-rooms", (callback) => {
      const rooms = Array.from(socket.rooms);
      const roomSizes = {};

      rooms.forEach((room) => {
        const roomData = io.sockets.adapter.rooms.get(room);
        roomSizes[room] = roomData ? roomData.size : 0;
      });

      const debugInfo = {
        socketId: socket.id,
        userId: socket.userId,
        userRooms: rooms,
        roomSizes: roomSizes,
        totalConnectedSockets: io.sockets.sockets.size,
      };

      console.log(`[DEBUG] Room info for ${socket.user.fullName}:`, debugInfo);

      if (callback) {
        callback(debugInfo);
      }
    });

    // Auto-join all user's existing chats when they connect
    socket.on("join-user-chats", async (callback) => {
      try {
        console.log(
          `[SOCKET] User ${socket.user.fullName} (${socket.userId}) requesting to join all chats`
        );

        const userChats = await Chat.find({
          participants: socket.user._id,
        }).select("_id participants");

        let joinedChats = [];
        userChats.forEach((chat) => {
          const chatId = chat._id.toString();
          socket.join(chatId);
          joinedChats.push(chatId);
          console.log(
            `[SOCKET] User ${socket.user.fullName} joined chat room: ${chatId}`
          );
        });

        console.log(
          `[SOCKET] User ${socket.user.fullName} auto-joined ${joinedChats.length} chat rooms`
        );

        if (callback) {
          callback({
            success: true,
            message: `Joined ${joinedChats.length} chats`,
            chatIds: joinedChats,
            totalRooms: socket.rooms.size,
          });
        }
      } catch (error) {
        console.error(
          `[SOCKET] Error joining user chats for ${socket.userId}:`,
          error
        );
        if (callback) {
          callback({
            success: false,
            message: "Failed to join chats",
            error: error.message,
          });
        }
      }
    });

    // Join specific chat (when user opens a chat)
    socket.on("join-chat", async (chatId, callback) => {
      try {
        console.log(
          `[SOCKET] User ${socket.user.fullName} requesting to join chat: ${chatId}`
        );

        // Verify user is participant in this chat
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.user._id)) {
          console.warn(
            `[SOCKET] User ${socket.userId} unauthorized to join chat ${chatId}`
          );
          if (callback) {
            callback({
              success: false,
              message: "Unauthorized to join this chat",
            });
          }
          return;
        }

        socket.join(chatId);
        console.log(
          `[SOCKET] User ${socket.user.fullName} successfully joined chat ${chatId}`
        );

        // Get room info for debugging
        const room = socket.adapter.rooms.get(chatId);
        const roomSize = room ? room.size : 0;
        console.log(
          `[SOCKET] Chat room ${chatId} now has ${roomSize} connected clients`
        );

        // Notify other participants that user is online in this chat
        socket.to(chatId).emit("user-joined-chat", {
          userId: socket.userId,
          fullName: socket.user.fullName,
          userType: socket.user.userType,
          timestamp: new Date(),
        });

        if (callback) {
          callback({
            success: true,
            message: "Successfully joined chat",
            chatId: chatId,
            roomSize: roomSize,
            userRooms: Array.from(socket.rooms),
          });
        }
      } catch (error) {
        console.error(
          `[SOCKET] Error joining chat ${chatId} for user ${socket.userId}:`,
          error
        );
        if (callback) {
          callback({
            success: false,
            message: "Failed to join chat",
            error: error.message,
          });
        }
      }
    });

    // Leave chat
    socket.on("leave-chat", (chatId, callback) => {
      console.log(
        `[SOCKET] User ${socket.user.fullName} leaving chat ${chatId}`
      );

      socket.leave(chatId);

      // Notify other participants that user left
      socket.to(chatId).emit("user-left-chat", {
        userId: socket.userId,
        fullName: socket.user.fullName,
        timestamp: new Date(),
      });

      if (callback) {
        callback({
          success: true,
          message: "Successfully left chat",
          chatId: chatId,
          remainingRooms: Array.from(socket.rooms),
        });
      }
    });

    // Handle typing events
    socket.on("typing", (data, callback) => {
      const { chatId } = data;
      socket.to(chatId).emit("user-typing", {
        userId: socket.userId,
        fullName: socket.user.fullName,
        chatId: chatId,
        timestamp: new Date(),
      });

      if (callback) {
        callback({
          success: true,
          message: "Typing status sent",
        });
      }
    });

    socket.on("stop-typing", (data, callback) => {
      const { chatId } = data;
      socket.to(chatId).emit("user-stop-typing", {
        userId: socket.userId,
        chatId: chatId,
        timestamp: new Date(),
      });

      if (callback) {
        callback({
          success: true,
          message: "Stop typing status sent",
        });
      }
    });

    // Handle sending new messages
    socket.on("send-message", async (data, callback) => {
      try {
        const {
          chatId,
          content,
          messageType = "text",
          fileUrl,
          fileName,
          fileMimeType,
          fileSize,
          location,
        } = data;

        if (!chatId) {
          return callback?.({
            success: false,
            message: "chatId is required",
          });
        }

        // Verify user is participant
        const chat = await Chat.findById(chatId);
        if (
          !chat ||
          !chat.participants.some((p) => p.equals(socket.user._id))
        ) {
          return callback?.({
            success: false,
            message: "Unauthorized to send message",
          });
        }

        // Prepare message payload
        const messagePayload = {
          chat: chatId,
          sender: socket.user._id,
          senderModel: socket.user.userType === "tenant" ? "Tenant" : "Owner",
          content: messageType === "text" ? content : null,
          messageType,
          readBy: [{ user: socket.user._id, readAt: new Date() }],
        };

        // Add file info if messageType is not text
        if (["image", "video", "document", "audio"].includes(messageType)) {
          // Map fileUrl to the correct field based on messageType
          if (messageType === "image") {
            messagePayload.imageUrl = fileUrl;
          } else if (messageType === "video") {
            messagePayload.videoUrl = fileUrl;
          } else if (messageType === "document") {
            messagePayload.documentUrl = fileUrl;
          } else if (messageType === "audio") {
            messagePayload.audioUrl = fileUrl;
          }

          messagePayload.fileName = fileName;
          messagePayload.fileMimeType = fileMimeType;
          messagePayload.fileSize = fileSize;
        }

        // Add location if messageType is location
        if (messageType === "location") {
          messagePayload.location = location;
        }

        // Create message
        const newMessage = await Message.create(messagePayload);

        // Populate sender details
        await newMessage.populate({
          path: "sender",
          select: "fullName email phoneNumber profilePhoto userType",
        });

        // Update chat lastMessage + lastActivity and increment unread count for other participants
        chat.lastMessage = newMessage._id;
        chat.updateLastActivity();
        
        // Increment unread count for all participants except the sender
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== socket.userId) {
            chat.incrementUnreadCount(participantId);
          }
        });
        
        await chat.save();

        // Broadcast message to chat room
        io.to(chatId).emit("new-message", newMessage);

        // Send unread count updates to each participant
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== socket.userId) {
            const unreadCount = chat.getUnreadCount(participantId);
            io.to(participantId.toString()).emit("unread-count-updated", {
              chatId: chatId,
              unreadCount: unreadCount,
              newMessage: {
                _id: newMessage._id,
                content: newMessage.content,
                messageType: newMessage.messageType,
                sender: {
                  _id: socket.user._id,
                  fullName: socket.user.fullName,
                },
                createdAt: newMessage.createdAt,
              },
              timestamp: new Date(),
            });
            io.to(participantId.toString()).emit("refresh-contacts");
          }
        });

        // Respond to sender
        callback?.({
          success: true,
          message: `${
            messageType.charAt(0).toUpperCase() + messageType.slice(1)
          } message sent successfully`,
          data: newMessage,
        });
      } catch (error) {
        console.error(`[SOCKET] Error sending message:`, error);
        callback?.({
          success: false,
          message: "Failed to send message",
          error: error.message,
        });
      }
    });

    // Handle message read receipts
    socket.on("message-read", (data, callback) => {
      const { chatId, messageId } = data;
      socket.to(chatId).emit("message-read-by", {
        messageId: messageId,
        readBy: {
          userId: socket.userId,
          fullName: socket.user.fullName,
          readAt: new Date(),
        },
      });

      if (callback) {
        callback({
          success: true,
          message: "Read receipt sent",
        });
      }
    });

    // Handle mark chat as read
    socket.on("mark-chat-read", async (data, callback) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return callback?.({
            success: false,
            message: "chatId is required",
          });
        }

        // Find the chat and verify user is participant
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some((p) => p.equals(socket.user._id))) {
          return callback?.({
            success: false,
            message: "Unauthorized to mark this chat as read",
          });
        }

        // Get current unread count before resetting
        const previousUnreadCount = chat.getUnreadCount(socket.user._id);

        // Reset unread count for this user
        chat.resetUnreadCount(socket.user._id);
        await chat.save();

        // Mark all unread messages in this chat as read by this user
        await Message.updateMany(
          {
            chat: chatId,
            "readBy.user": { $ne: socket.user._id },
          },
          {
            $push: {
              readBy: {
                user: socket.user._id,
                readAt: new Date(),
              },
            },
          }
        );

        // Broadcast to the chat room that messages have been read
        socket.to(chatId).emit("chat-marked-read", {
          chatId: chatId,
          readBy: {
            userId: socket.userId,
            fullName: socket.user.fullName,
            readAt: new Date(),
          },
          previousUnreadCount: previousUnreadCount,
        });

        // Broadcast unread count update to user's personal room
        socket.emit("unread-count-updated", {
          chatId: chatId,
          unreadCount: 0,
          previousCount: previousUnreadCount,
          timestamp: new Date(),
        });

        // Trigger contacts refresh for real-time UI update
        socket.emit("refresh-contacts-needed");

        console.log(
          `[SOCKET] User ${socket.user.fullName} marked chat ${chatId} as read (${previousUnreadCount} messages)`
        );

        callback?.({
          success: true,
          message: "Chat marked as read successfully",
          data: {
            chatId: chatId,
            previousUnreadCount: previousUnreadCount,
            newUnreadCount: 0,
          },
        });
      } catch (error) {
        console.error(`[SOCKET] Error marking chat as read:`, error);
        callback?.({
          success: false,
          message: "Failed to mark chat as read",
          error: error.message,
        });
      }
    });

    // Handle online/offline status
    socket.on("user-online", (callback) => {
      // Broadcast to all user's chats that they are online
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room !== socket.userId) {
          socket.to(room).emit("user-status-change", {
            userId: socket.userId,
            fullName: socket.user.fullName,
            status: "online",
            timestamp: new Date(),
          });
        }
      });

      if (callback) {
        callback({
          success: true,
          message: "Online status broadcasted",
        });
      }
    });

    // Handle contact list refresh request
    socket.on("refresh-contacts", async () => {
      console.log("Contacts refresh triggered by socket");

      const response = await fetch("/api/contacts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setContacts(data.data);
      }
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(
        `[SOCKET] User ${socket.user.fullName} (${socket.userId}) disconnected: ${reason}`
      );

      // Get rooms before disconnection for logging
      const userRooms = Array.from(socket.rooms);
      console.log(`[SOCKET] User was in rooms: ${userRooms.join(", ")}`);

      // Broadcast offline status to all user's chats
      socket.rooms.forEach((room) => {
        if (room !== socket.id && room !== socket.userId) {
          socket.to(room).emit("user-status-change", {
            userId: socket.userId,
            fullName: socket.user.fullName,
            status: "offline",
            timestamp: new Date(),
            reason: reason,
          });
          console.log(`[SOCKET] Broadcasted offline status to room: ${room}`);
        }
      });
    });

    // Auto-trigger chat joining when user connects
    console.log(
      `[SOCKET] Triggering auto-join for user ${socket.user.fullName}`
    );
    socket.emit("auto-join-chats");
  });
};

module.exports = socketHandler;
