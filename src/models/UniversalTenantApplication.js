const mongoose = require("mongoose");

const universalTenantApplicationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    personalDetails: {
      fullName: String,
      emailId: String,
      phonenumber: String,
      age: Number,
    },
    workStatus: {
      employee: String,
      employer: String,
    },
    propertyPreferences: {
      bhkType: {
        type: String,
        enum: ["1RK", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK+"],
      },
      furnishingType: {
        type: String,
        enum: ["furnished", "semi-furnished", "unfurnished"],
      },
      amenities: [String],
      occupants: Number,
      budget: Number,
      location: String,
      leaseDuration: String,
      moveInDate: Date,
    },
    preferences: {
      gender: { type: String, enum: ["male", "female", "other"] },
      maritalStatus: {
        type: String,
        enum: ["single", "married", "divorced", "widowed"],
      },
      smoker: { type: Boolean, default: false },
      eating: { type: String, enum: ["veg", "non-veg", "both"] },
      language: String,
      pet: { type: Boolean, default: false },
      coupleFriendly: { type: Boolean, default: false },
    },
    rentalHistory: {
      duration: String,
      landlordContact: String,
      previousAddress: String,
      documents: [String],
    },
    documents: [
      {
        docName: String,
        docUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    videoIntroUrl: String,
    isProfileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "universalTenantApplication",
  universalTenantApplicationSchema
);
