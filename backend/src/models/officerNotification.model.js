import mongoose from "mongoose";
import { ALERT_KINDS } from "../utils/i18n.js";
import { ALERT_SEVERITY } from "./alert.model.js";

/**
 * One row per (officer, alert). The officer app has no push channel, so this
 * is the delivery: the alert engine writes a row for every officer whose
 * jurisdiction the alert touches, and the app reads its own inbox.
 *
 * The text is snapshotted at delivery time so the inbox still reads correctly
 * if an alert is later cleared, but the alert reference is kept so the copy can
 * be re-resolved when the officer changes language.
 */
const officerNotificationSchema = new mongoose.Schema(
  {
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FieldOfficer",
      required: true,
      index: true,
    },

    alert: { type: mongoose.Schema.Types.ObjectId, ref: "Alert", index: true },
    alertId: { type: String, required: true, index: true },

    kind: { type: String, enum: ALERT_KINDS, required: true },
    severity: { type: String, enum: ALERT_SEVERITY, default: "WARNING", index: true },

    title: { type: String, required: true },
    body: { type: String, default: "" },
    lang: { type: String, default: "en" },

    segmentId: { type: String },
    segmentName: { type: String },
    districts: [String],
    payload: { type: mongoose.Schema.Types.Mixed },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// The inbox query: this officer's rows, newest first.
officerNotificationSchema.index({ officer: 1, createdAt: -1 });

// One alert can only land in an officer's inbox once, however many times the
// scan runs.
officerNotificationSchema.index({ officer: 1, alertId: 1 }, { unique: true });

const OfficerNotification =
  mongoose.models.OfficerNotification ||
  mongoose.model("OfficerNotification", officerNotificationSchema);

export default OfficerNotification;
