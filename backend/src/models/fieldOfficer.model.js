import mongoose from "mongoose";

export const OFFICER_LEVELS = ["BLOCK", "DISTRICT", "STATE", "REGION"];

export const DEPARTMENTS = [
  "PWD",
  "DISASTER_MANAGEMENT",
  "HEALTH",
  "FOOD_CIVIL_SUPPLIES",
  "TRANSPORT",
  "DISTRICT_ADMIN",
  "BRO",
  "NHIDCL",
  "OTHER",
];

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "as", name: "Assamese" },
  { code: "bn", name: "Bengali" },
  { code: "mni", name: "Manipuri (Meiteilon)" },
  { code: "kha", name: "Khasi" },
  { code: "lus", name: "Mizo" },
  { code: "nag", name: "Nagamese" },
  { code: "ne", name: "Nepali" },
  { code: "kok", name: "Kokborok" },
];

const fieldOfficerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },

    employeeId: { type: String, trim: true, index: true },
    designation: { type: String, trim: true },
    department: { type: String, enum: DEPARTMENTS, default: "DISTRICT_ADMIN" },

    jurisdiction: {
      level: { type: String, enum: OFFICER_LEVELS, default: "DISTRICT" },
      district: { type: String, index: true },
      state: { type: String, index: true },
      districts: [String],
    },

    role: { type: String, default: "field_officer" },

    canVerifyIncidents: { type: Boolean, default: false },
    canOverrideSegmentStatus: { type: Boolean, default: false },

    preferredLanguage: {
      type: String,
      enum: SUPPORTED_LANGUAGES.map((l) => l.code),
      default: "en",
    },

    expoPushToken: { type: String },
    fcmToken: { type: String },
    pushPlatform: { type: String, enum: ["expo", "android", "ios"] },
    watchedCorridors: [String],

    stats: {
      incidentsReported: { type: Number, default: 0 },
      incidentsVerified: { type: Number, default: 0 },
      accuracyRate: { type: Number, default: 1, min: 0, max: 1 },
    },

    lastSyncAt: { type: Date },
    lastActiveAt: { type: Date },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fieldOfficerSchema.index({ "jurisdiction.state": 1, "jurisdiction.district": 1 });

// Who may confirm a report is derived from the jurisdiction, never sent by the
// client. Zero-arity so mongoose runs it as a synchronous hook.
fieldOfficerSchema.pre("save", function () {
  const senior = this.jurisdiction?.level === "STATE" || this.jurisdiction?.level === "REGION";
  this.canVerifyIncidents = senior;
  this.canOverrideSegmentStatus = senior;
});

fieldOfficerSchema.methods.covers = function (district, state) {
  const j = this.jurisdiction || {};
  if (j.level === "REGION") return true;
  if (j.level === "STATE") return j.state === state;
  if (Array.isArray(j.districts) && j.districts.includes(district)) return true;
  return j.district === district;
};

const FieldOfficer =
  mongoose.models.FieldOfficer || mongoose.model("FieldOfficer", fieldOfficerSchema);

export default FieldOfficer;
