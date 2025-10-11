const Notification = require("../models/Notification");

/**
 * createNotification
 * - recipient: ObjectId of the recipient
 * - recipientModel: string name of the model the recipient belongs to (e.g. 'Tenant' or 'Owner')
 */
const createNotification = async ({
  recipient,
  recipientModel,
  type,
  title,
  message,
  data = {},
  relatedId,
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
  