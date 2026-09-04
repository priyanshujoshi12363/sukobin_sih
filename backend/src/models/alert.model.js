import mongoose from "mongoose";
import { ALERT_KINDS, LANGUAGES } from "../utils/i18n.js";

export const ALERT_SEVERITY = ["INFO", "WARNING", "CRITICAL"];
export const AUDIENCES = ["OFFICER", "PARTNER", "CUSTOMER", "MERCHANT"];

const textSchema = new mongoose.Schema(
  { title: String, body: String },
  { _id: false }
);

const alertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },

    kind: { type: String, enum: ALERT_KINDS, required: true, index: true },
    severity: { type: String, enum: ALERT_SEVERITY, default: "WARNING", index: true },

    // Two alerts with the same dedupeKey are the same news. The engine will not
    // raise a second one until the first goes stale.
    dedupeKey: { type: String, required: true, index: true },

    segmentId: { type: String, index: true },
    segmentName: { type: String },
    corridorCode: { type: String },
    districts: [{ type: String, index: true }],
    states: [{ type: String, index: true }],
    incident: { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },

    text: {
      type: Map,
      of: textSchema,
      default: undefined,
    },

    payload: { type: mongoose.Schema.Types.Mixed },

    audiences: [{ type: String, enum: AUDIENCES }],

    delivery: {
      attempted: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      inbox: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      byAudience: { type: mongoose.Schema.Types.Mixed },
      at: { type: Date },
    },

    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, index: true },
    clearedAt: { type: Date },
    clearedReason: { type: String },
  },
  { timestamps: true }
);

alertSchema.index({ active: 1, createdAt: -1 });
alertSchema.index({ dedupeKey: 1, active: 1 });

alertSchema.methods.textFor = function (lang = "en") {
  const map = this.text;
  if (!map) return { title: "", body: "" };
  const pick = (l) => (map.get ? map.get(l) : map[l]);
  return pick(lang) || pick("en") || { title: "", body: "" };
};

alertSchema.statics.LANGUAGES = LANGUAGES;

const Alert = mongoose.models.Alert || mongoose.model("Alert", alertSchema);

export default Alert;
