import mongoose from "mongoose";

export const SEGMENT_STATUS = ["OPEN", "SLOW", "RESTRICTED", "BLOCKED", "UNKNOWN"];
export const STATUS_SOURCE = ["PROBE", "FIELD_REPORT", "WEATHER", "MANUAL", "SEED"];
export const RISK_LEVEL = ["LOW", "MODERATE", "HIGH", "SEVERE"];

export const STATUS_SPEED_FACTOR = {
  OPEN: 1.0,
  SLOW: 0.55,
  RESTRICTED: 0.3,
  BLOCKED: 0,
  UNKNOWN: 0.85,
};

const lineStringSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["LineString"], default: "LineString" },
    coordinates: { type: [[Number]], required: true },
  },
  { _id: false }
);

const roadSegmentSchema = new mongoose.Schema(
  {
    segmentId: { type: String, required: true, unique: true, trim: true, index: true },
    corridorCode: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },

    geometry: { type: lineStringSchema, required: true },
    from: { name: String, coordinates: [Number] },
    to: { name: String, coordinates: [Number] },
    lengthKm: { type: Number, required: true, min: 0 },

    kind: {
      type: String,
      enum: ["ROAD", "BRIDGE", "PASS", "CULVERT", "TUNNEL", "FERRY"],
      default: "ROAD",
    },
    terrain: {
      type: String,
      enum: ["plain", "hill", "mountain", "high-mountain"],
      default: "hill",
    },
    districts: [{ type: String, index: true }],
    states: [{ type: String, index: true }],

    baselineSpeedKmph: { type: Number, default: 30, min: 1 },

    status: { type: String, enum: SEGMENT_STATUS, default: "UNKNOWN", index: true },
    statusSource: { type: String, enum: STATUS_SOURCE, default: "SEED" },
    statusNote: { type: String, trim: true, maxlength: 300 },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusExpiresAt: { type: Date },

    probe: {
      medianSpeedKmph: { type: Number, default: null },
      speedRatio: { type: Number, default: null },
      sampleCount: { type: Number, default: 0 },
      distinctVehicles: { type: Number, default: 0 },
      windowMinutes: { type: Number, default: 0 },
      updatedAt: { type: Date },
    },

    risk: {
      score: { type: Number, default: 0, min: 0, max: 1 },
      level: { type: String, enum: RISK_LEVEL, default: "LOW" },
      drivers: [{ factor: String, contribution: Number, detail: String }],
      rain24hMm: { type: Number, default: 0 },
      rain72hMm: { type: Number, default: 0 },
      computedAt: { type: Date },
      validUntil: { type: Date },
    },

    hazard: {
      landslideProne: { type: Boolean, default: false },
      floodProne: { type: Boolean, default: false },
      snowProne: { type: Boolean, default: false },
      historicalFailureRate: { type: Number, default: 0, min: 0, max: 1 },
      avgSlopeDeg: { type: Number, default: 0 },
      elevationM: { type: Number, default: 0 },
    },

    lifelineFor: [String],
    isChokepoint: { type: Boolean, default: false, index: true },
    chokepointNote: { type: String, trim: true },

    lastIncident: { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },
    openIncidentCount: { type: Number, default: 0 },
    statusHistory: [
      {
        status: { type: String, enum: SEGMENT_STATUS },
        source: { type: String, enum: STATUS_SOURCE },
        note: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

roadSegmentSchema.index({ geometry: "2dsphere" });
roadSegmentSchema.index({ status: 1, "risk.score": -1 });
roadSegmentSchema.index({ corridorCode: 1, segmentId: 1 });

roadSegmentSchema.methods.isPassable = function () {
  return this.status !== "BLOCKED";
};

roadSegmentSchema.methods.effectiveSpeedKmph = function () {
  if (this.probe?.medianSpeedKmph > 0) return this.probe.medianSpeedKmph;
  return this.baselineSpeedKmph * (STATUS_SPEED_FACTOR[this.status] ?? 0.85);
};

roadSegmentSchema.methods.applyStatus = function ({ status, source, note, expiresAt }) {
  const changed = this.status !== status;
  this.status = status;
  this.statusSource = source;
  this.statusNote = note || "";
  this.statusUpdatedAt = new Date();
  this.statusExpiresAt = expiresAt || undefined;
  if (changed) {
    this.statusHistory.push({ status, source, note });
    if (this.statusHistory.length > 50) this.statusHistory = this.statusHistory.slice(-50);
  }
  return changed;
};

const RoadSegment =
  mongoose.models.RoadSegment || mongoose.model("RoadSegment", roadSegmentSchema);

export default RoadSegment;
