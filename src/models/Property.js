const mongoose = require("mongoose");

const generatePropertyId = () => {
  const prefix = "RENT";
  const randomNum = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}${randomNum}`;
};

const propertySchema = new mongoose.Schema({
  propertyId: {
    type: String,
    unique: true,
    default: generatePropertyId,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  propertyType: {
    type: String,
    required: true,
    enum: ["apartment", "house", "villa", "studio", "pg", "hostel"],
  },
  monthlyRent: {
    type: Number,
    required: true,
  },
  securityDeposit: {
    type: Number,
    required: true,
  },
  areaUnit: {
    type: Number,
    required: true,
  },
  bedroom: {
    type: Number,
    required: true,
  },
  bathroom: {
    type: Number,
    required: true,
  },
  floor: {
    type: Number,
    required: true,
  },
  bhk: {
    type: String,
    required: true,
    enum: ["1RK", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK+"],
  },
  furnishType: {
    type: String,
    enum: ["furnished", "semi-furnished", "unfurnished"],
    required: true,
  },
  availableFrom: Date,
  ageOfBuilding: {
    type: String,
    default: "Not specified",
  },
  availableFor: {
    type: String,
    enum: ["Family", "Bachelor Male", "Bachelor Female", "Anyone"],
  },
  landlord: {
    type: String,
    default: "Property Owner",
  },
  nearbyPlaces: {
    type: [String],
    default: false,
  },
  location: {
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    locality: {
      type: String,
      required: true,
    },
    landmark: String,
    zipcode: String,
    fullAddress: {
      type: String,
      required: true,
    },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  features: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feature",
    },
  ],
  amenities: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Amenity",
    },
  ],
  images: [String],
  status: {
    type: String,
    // enum: ["request", "draft", "published", "rented", "sold", "inactive"],
    enum: ["pending", "draft", "active", "reject", "deleted", "inactive"],
    default: "pending",
  },
  views: {
    type: Number,
    default: 0,
  },
  contactCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  landlordSchedule: {
    type: [
      {
        scheduledDate: {
          type: Date,
          required: true,
        },
        slots: {
          type: [
            {
              scheduledTime: {
                type: String,
                required: true,
                match: /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i,
              },
            },
          ],
          validate: {
            validator: function (val) {
              return val.length > 0; // at least one slot per date
            },
            message: "At least one slot is required for each date.",
          },
        },
      },
    ],
    validate: {
      validator: function (val) {
        const dates = val.map(
          (v) => v.scheduledDate?.toISOString().split("T")[0]
        );
        return new Set(dates).size === dates.length;
      },
      message: "Duplicate scheduled dates are not allowed.",
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
propertySchema.index({ "location.city": 1, monthlyRent: 1, bhk: 1 });
propertySchema.index({ owner: 1, status: 1 });
propertySchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model("Property", propertySchema);
