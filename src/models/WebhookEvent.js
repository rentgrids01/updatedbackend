const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  gateway: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  signature: String,
  processed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

webhookEventSchema.index({ gateway: 1, eventType: 1 });
webhookEventSchema.index({ processed: 1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);