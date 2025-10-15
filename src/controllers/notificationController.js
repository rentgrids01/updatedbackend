const notificationService = require("../services/notificationService");

const getMyNotifications = async (req, res) => {
  try {
    // Map req.user.userType to recipientModel used when notifications are created
    const userType = req.user.userType || req.userType || req.user?.userType;
    const recipientModel =
      userType === "owner"
        ? "Owner"
        : userType === "tenant"
        ? "Tenant"
        : "User";

    const notifications = await notificationService.getNotificationsForUser(
      req.user._id,
      { recipientModel, unreadOnly: false }
    );

    // Get Socket.IO instance and emit real-time notifications
    const io = req.app.get("io");
    if (io) {
      // Emit to user's personal room for real-time updates
      io.to(req.user._id.toString()).emit("notifications-fetched", {
        success: true,
        data: notifications,
        timestamp: new Date(),
        userId: req.user._id,
        userType: userType,
        totalCount: notifications.length,
        unreadCount: notifications.filter(notification => !notification.read).length
      });

      // Also emit to user's notification room if they're subscribed
      const notificationRoom = `notifications-${req.user._id}`;
      io.to(notificationRoom).emit("notifications-updated", {
        notifications: notifications,
        timestamp: new Date(),
        event: "notifications_fetched"
      });

      console.log(`[NOTIFICATION] Real-time notifications sent to user ${req.user._id} (${userType})`);
    }

    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await notificationService.markAsRead(id);

    // Get Socket.IO instance and emit real-time updates
    const io = req.app.get("io");
    if (io && updated) {
      // Emit to user's personal room for real-time updates
      io.to(req.user._id.toString()).emit("notification-marked-read", {
        success: true,
        notificationId: id,
        updatedNotification: updated,
        timestamp: new Date(),
        userId: req.user._id
      });

      // Also emit to user's notification room if they're subscribed
      const notificationRoom = `notifications-${req.user._id}`;
      io.to(notificationRoom).emit("notification-read-update", {
        notificationId: id,
        notification: updated,
        timestamp: new Date(),
        event: "notification_marked_read"
      });

      console.log(`[NOTIFICATION] Real-time notification read update sent for notification ${id} to user ${req.user._id}`);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getNotificationCount = async (req, res) => {
  try {
    // Map req.user.userType to recipientModel used when notifications are created
    const userType = req.user.userType || req.userType || req.user?.userType;
    const recipientModel =
      userType === "owner"
        ? "Owner"
        : userType === "tenant"
        ? "Tenant"
        : "User";

    // Get total and unread counts
    const totalNotifications = await notificationService.getNotificationsForUser(
      req.user._id,
      { recipientModel, unreadOnly: false }
    );
    
    const unreadNotifications = await notificationService.getNotificationsForUser(
      req.user._id,
      { recipientModel, unreadOnly: true }
    );

    const counts = {
      total: totalNotifications.length,
      unread: unreadNotifications.length,
      read: totalNotifications.length - unreadNotifications.length
    };

    // Get Socket.IO instance and emit real-time count updates
    const io = req.app.get("io");
    if (io) {
      // Emit to user's personal room for real-time updates
      io.to(req.user._id.toString()).emit("notification-count-updated", {
        success: true,
        counts: counts,
        timestamp: new Date(),
        userId: req.user._id,
        userType: userType
      });

      // Also emit to user's notification room if they're subscribed
      const notificationRoom = `notifications-${req.user._id}`;
      io.to(notificationRoom).emit("notification-counts", {
        counts: counts,
        timestamp: new Date(),
        event: "notification_count_fetched"
      });

      console.log(`[NOTIFICATION] Real-time notification counts sent to user ${req.user._id} (${userType}): ${JSON.stringify(counts)}`);
    }

    res.json({ success: true, data: counts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  getNotificationCount,
};
