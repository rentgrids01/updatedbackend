const Notification = require("../models/Notification");

/**
 * createNotification
 * - recipient: ObjectId of the recipient
 * - recipientModel: string name of the model the recipient belongs to (e.g. 'Tenant' or 'Owner')
 * - io: Socket.IO instance for real-time emissions (optional)
 */
const createNotification = async ({
  recipient,
  recipientModel,
  type,
  title,
  message,
  data = {},
  relatedId,
  io = null,
}) => {
  const payload = {
    recipient,
    recipientModel,
    type,
    title,
    message,
    data,
    relatedId,
  };
  try {
    // debug helper: log minimal payload to trace why notifications might not be created
    console.debug("Creating notification ->", {
      recipient: payload.recipient?.toString?.() || payload.recipient,
      recipientModel: payload.recipientModel,
      type: payload.type,
    });
    const n = await Notification.create(payload);
    console.debug("Notification created ->", n._id?.toString?.());

    // Emit real-time notification if Socket.IO instance is provided
    if (io && n) {
      const recipientId = recipient.toString();
      
      // Emit to user's personal room
      io.to(recipientId).emit("new-notification", {
        notification: n,
        timestamp: new Date(),
        event: "notification_created"
      });

      // Emit to user's notification room
      const notificationRoom = `notifications-${recipientId}`;
      io.to(notificationRoom).emit("notification-created", {
        notification: n,
        timestamp: new Date(),
        type: type
      });

      console.log(`[NOTIFICATION] Real-time notification sent for ${type} to user ${recipientId}`);
    }

    return n;
  } catch (err) {
    console.error("notificationService.createNotification error:", err && err.message ? err.message : err);
    throw err; // rethrow so callers can handle if they choose
  }
};

const getNotificationsForUser = async (
  recipientId,
  { recipientModel = "User", unreadOnly = false, limit = 50 } = {}
) => {
  const filter = { recipient: recipientId, recipientModel };
  if (unreadOnly) filter.read = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
};

const markAsRead = async (notificationId) => {
  return Notification.findByIdAndUpdate(
    notificationId,
    { read: true },
    { new: true }
  );
};

module.exports = {
  createNotification,
  getNotificationsForUser,
  markAsRead,
};
  