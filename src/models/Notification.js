const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "recipientModel",
  },
  recipientModel: { type: String, required: true },
  type: { type: String, required: true },
  title: { type: String },
  message: { type: String },
  data: { type: Object, default: {} },
  read: { type: Boolean, default: false },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});

// Index for quick lookup
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
