import mongoose from "mongoose";

export const INCIDENT_TYPES = [
  "LANDSLIDE",
  "FLOOD",
  "ROAD_DAMAGE",
  "BRIDGE_DAMAGE",
  "SNOW_ICE",
  "TREE_FALL",
  "ACCIDENT",
  "BLOCKADE",
  "CONGESTION",
  "CONSTRUCTION",
  "OTHER",
];

export const INCIDENT_SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const INCIDENT_STATUS = ["REPORTED", "VERIFIED", "REJECTED", "RESOLVED"];

export const TYPE_IMPLIES_STATUS = {
  LANDSLIDE: "BLOCKED",
  FLOOD: "BLOCKED",
  BRIDGE_DAMAGE: "BLOCKED",
  SNOW_ICE: "RESTRICTED",
  ROAD_DAMAGE: "RESTRICTED",
  TREE_FALL: "RESTRICTED",
  BLOCKADE: "BLOCKED",
  ACCIDENT: "SLOW",
  CONGESTION: "SLOW",
  CONSTRUCTION: "SLOW",
  OTHER: "SLOW",
};

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true, trim: true },

    clientId: { type: String, required: true, unique: true, index: true, trim: true },

    reportedBy: { type: mongoose.Schema.Types.ObjectId, refPath: "reporterModel" },
    reporterModel: {
      type: String,
      enum: ["FieldOfficer", "Partner", "User"],
      default: "FieldOfficer",
    },
    reporterName: { type: String, trim: true },
    reporterPhone: { type: String, trim: true },

    type: { type: String, enum: INCIDENT_TYPES, required: true },
    severity: { type: String, enum: INCIDENT_SEVERITY, default: "MEDIUM" },
    description: { type: String, trim: true, maxlength: 1000 },
    photos: [String],

    location: { type: pointSchema, required: true },
    accuracyM: { type: Number, default: 0 },
    address: { type: String, trim: true },
    district: { type: String, index: true },
    state: { type: String, index: true },

    segment: { type: mongoose.Schema.Types.ObjectId, ref: "RoadSegment", index: true },
    segmentId: { type: String, index: true },
    distanceToSegmentKm: { type: Number },

    capturedAt: { type: Date, required: true },
    syncedAt: { type: Date, default: Date.now },
    wasOffline: { type: Boolean, default: false },

    impact: {
      blocksTraffic: { type: Boolean, default: false },
      passableBy: [{ type: String, enum: ["bike", "auto", "car", "pickup", "truck"] }],
      estimatedClearanceHours: { type: Number },
      affectedLengthM: { type: Number },
    },

    status: { type: String, enum: INCIDENT_STATUS, default: "REPORTED", index: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "FieldOfficer" },
    verifiedAt: { type: Date },
    verificationNote: { type: String, trim: true, maxlength: 500 },
    resolvedAt: { type: Date },

    corroboratedByProbe: { type: Boolean, default: false },
    probeSpeedRatioAtReport: { type: Number },

    usedForTraining: { type: Boolean, default: false },
  },
  { timestamps: true }
);

incidentSchema.index({ location: "2dsphere" });
incidentSchema.index({ segmentId: 1, status: 1, capturedAt: -1 });
incidentSchema.index({ district: 1, capturedAt: -1 });

incidentSchema.methods.isActionable = function () {
  if (this.status === "REJECTED" || this.status === "RESOLVED") return false;
  return this.status === "VERIFIED" || this.corroboratedByProbe;
};

incidentSchema.methods.impliedStatus = function () {
  return TYPE_IMPLIES_STATUS[this.type] || "SLOW";
};

const Incident = mongoose.models.Incident || mongoose.model("Incident", incidentSchema);

export default Incident;
