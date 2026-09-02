import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    houseNumber: String,
    landmark: String,
    village: String,
    town: String,
    district: String,
    state: String,
    pincode: String,
    fullAddress: String,
  },
  { _id: false }
);

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const endpointSchema = new mongoose.Schema(
  {
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    address: addressSchema,
    location: { type: pointSchema, required: true },
  },
  { _id: false }
);

const parcelSchema = new mongoose.Schema(
  {
    parcelId: { type: String, required: true, unique: true, trim: true },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pickup: { type: endpointSchema, required: true },
    drop: { type: endpointSchema, required: true },

    package: {
      type: {
        type: String,
        enum: ["Documents", "Electronics", "Food", "Clothes", "Medicines", "Other"],
        default: "Other",
      },
      weightKg: { type: Number, default: 1, min: 0 },
      description: { type: String, trim: true, maxlength: 300 },
      photos: [String],
    },

    distanceKm: { type: Number, required: true, min: 0 },
    // real road route from pickup → drop (for map + ETA)
    routePolyline: { type: [[Number]], default: undefined },
    routeDurationMin: { type: Number, default: 0 },
    driverNearNotified: { type: Boolean, default: false },
    deliveryCharge: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY"],
      default: "COD",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "POOLED",
        "ASSIGNED",
        "PICKED_UP",
        "IN_TRANSIT",
        "DELIVERED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "REQUESTED",
    },

    assignedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },

    pickupOtp: { type: String },
    deliveryOtp: { type: String },

    poolExpiresAt: { type: Date },

    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: String,
        _id: false,
      },
    ],

    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

parcelSchema.index({ "pickup.location": "2dsphere" });
parcelSchema.index({ "drop.location": "2dsphere" });
parcelSchema.index({ assignedPartner: 1, status: 1 });
parcelSchema.index({ status: 1, paymentStatus: 1 });

const Parcel = mongoose.model("Parcel", parcelSchema);

export default Parcel;
