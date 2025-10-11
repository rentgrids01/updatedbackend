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
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await notificationService.markAsRead(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
};
