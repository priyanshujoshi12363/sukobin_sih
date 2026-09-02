import mongoose from "mongoose";

const locationPingSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    vehicleType: { type: String, enum: ["bike", "auto", "car", "pickup", "truck"] },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },

    speedKmph: { type: Number, default: null },
    headingDeg: { type: Number, default: null },
    accuracyM: { type: Number, default: null },

    segmentId: { type: String, index: true, default: null },
    distanceToSegmentKm: { type: Number, default: null },

    onTrip: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

locationPingSchema.index({ location: "2dsphere" });
locationPingSchema.index({ segmentId: 1, at: -1 });
locationPingSchema.index(
  { at: 1 },
  { expireAfterSeconds: Number(process.env.PING_TTL_SECONDS) || 60 * 60 * 24 * 30 }
);

const LocationPing =
  mongoose.models.LocationPing || mongoose.model("LocationPing", locationPingSchema);

export default LocationPing;
