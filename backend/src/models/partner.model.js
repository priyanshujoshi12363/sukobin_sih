import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    phone: { type: String, required: true, unique: true, trim: true },

    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Vehicle details fetched from the Bharat Vahan / RC API
    vehicle: {
      ownerName: String,
      registrationNumber: String,
      registrationDate: String,
      vehicleClass: String, // raw RC class e.g. "LMV", "M-Cycle/Scooter", "Goods Carrier"
      maker: String,
      model: String,
      fuelType: String,
      color: String,
      rcStatus: String,
      insuranceValidUpto: String,
      fitnessValidUpto: String,
      source: { type: String, enum: ["vahan", "mock"], default: "mock" },
      verified: { type: Boolean, default: false },
    },

    // our derived category + parcel capacity
    vehicleType: {
      type: String,
      enum: ["bike", "auto", "car", "pickup", "truck"],
      default: "car",
    },
    capacity: { type: Number, default: 5 },

    role: { type: String, default: "partner" },

    expoPushToken: { type: String },
    fcmToken: { type: String },
    pushPlatform: { type: String, enum: ["expo", "android", "ios"] },

    isOnline: { type: Boolean, default: false },
    currentLocation: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },

    // the route the driver is currently watching (set on /route/match), used to
    // push them new jobs that fall on their corridor while they're online
    activeRoute: {
      polyline: { type: [[Number]], default: undefined }, // [[lng,lat], …]
      stations: { type: [String], default: undefined },
      origin: { type: [Number], default: undefined },      // [lng,lat] origin city centre
      destination: { type: [Number], default: undefined }, // [lng,lat] destination city centre
      originRadiusKm: { type: Number, default: 0 },
      destRadiusKm: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      durationMin: { type: Number, default: 0 },
      updatedAt: Date,
    },

    rating: { type: Number, default: 5 },
    totalTrips: { type: Number, default: 0 },
    totalDeliveries: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },

    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    lastActive: Date,
  },
  { timestamps: true }
);

// 2dsphere only indexes docs that actually have currentLocation set
partnerSchema.index({ currentLocation: "2dsphere" });

const Partner = mongoose.model("Partner", partnerSchema);

export default Partner;
