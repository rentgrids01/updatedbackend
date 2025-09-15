const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  scope: {
    type: String,
    required: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours
  }
});

idempotencyKeySchema.index({ key: 1, scope: 1 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);