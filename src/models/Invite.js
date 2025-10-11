const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  owner:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner",
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VisitRequest",
    required: true,
  },
  tenantInviteStatus: {
    type: String,
    enum: ["accepted", "rejected","pending"],
    default:"pending",
  },
  ownerInviteStatus: {
    type: String,
    enum: ["accepted", "rejected","pending"],
    default:"pending",
  },
  message: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Invite", InviteSchema);
