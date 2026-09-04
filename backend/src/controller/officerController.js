import crypto from "crypto";
import jwt from "jsonwebtoken";
import FieldOfficer, {
  DEPARTMENTS,
  OFFICER_LEVELS,
  SUPPORTED_LANGUAGES,
} from "../models/fieldOfficer.model.js";
import Otp from "../models/otp.model.js";
import Incident from "../models/incident.model.js";
import RoadSegment from "../models/roadSegment.model.js";
import Alert from "../models/alert.model.js";
import OfficerNotification from "../models/officerNotification.model.js";
import { activeAlerts } from "../utils/alertEngine.js";
import { upcomingRisk } from "../utils/forecast.js";
import { refreshSegment } from "../utils/accessibility.js";
import { modelInfo, featureImportance } from "../ml/model.js";
import { haversineKm } from "../utils/geo.js";
import { NER_STATES, DISTRICTS } from "../data/nerNetwork.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const isProd = process.env.NODE_ENV === "production";

// Same deliberate demo weakness as the partner app: with no SMS provider wired,
// nobody can sign in to a deployed build unless the code comes back in the
// response. Gated so it is never on by accident.
const allowDevOtp = process.env.ALLOW_DEV_OTP === "true" || !isProd;

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const normPhone = (p) => String(p || "").replace(/[^0-9]/g, "").slice(-10);

const signToken = (officer) =>
  jwt.sign({ id: officer._id, role: "officer" }, process.env.JWT_SECRET, { expiresIn: "60d" });

const publicOfficer = (o) => ({
  _id: o._id,
  name: o.name,
  phone: o.phone,
  email: o.email,
  employeeId: o.employeeId,
  designation: o.designation,
  department: o.department,
  jurisdiction: o.jurisdiction,
  canVerifyIncidents: o.canVerifyIncidents,
  canOverrideSegmentStatus: o.canOverrideSegmentStatus,
  preferredLanguage: o.preferredLanguage,
  watchedCorridors: o.watchedCorridors,
  stats: o.stats,
  lastActiveAt: o.lastActiveAt,
});

async function consumeOtp(phone, code) {
  const otp = await Otp.findOne({ phone, role: "officer" });
  if (!otp) return { ok: false, message: "Please request an OTP first" };
  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return { ok: false, message: "OTP expired, request a new one" };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await otp.deleteOne();
    return { ok: false, message: "Too many attempts, request a new OTP" };
  }
  if (hashCode(code) !== otp.codeHash) {
    otp.attempts += 1;
    await otp.save();
    return { ok: false, message: "Invalid OTP" };
  }
  await otp.deleteOne();
  return { ok: true };
}

// ─── auth ────────────────────────────────────────────────────────────────────

export const sendOtp = async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    if (phone.length !== 10) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit phone number" });
    }

    const officer = await FieldOfficer.findOne({ phone });
    const code = String(Math.floor(100000 + Math.random() * 900000));

    await Otp.findOneAndUpdate(
      { phone, role: "officer" },
      { codeHash: hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Officer OTP for ${phone}: ${code}`);

    res.json({
      success: true,
      message: "OTP sent",
      registered: Boolean(officer),
      ...(allowDevOtp ? { devOtp: code, devOtpNotice: "demo mode - disable ALLOW_DEV_OTP in production" } : {}),
    });
  } catch (error) {
    console.error("officer/otp:", error);
    res.status(500).json({ success: false, message: "Could not send OTP" });
  }
};

export const login = async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    const { otp } = req.body;

    if (phone.length !== 10 || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const check = await consumeOtp(phone, otp);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const officer = await FieldOfficer.findOne({ phone });
    if (!officer) {
      return res.status(404).json({
        success: false,
        needsRegistration: true,
        message: "This number is not registered as a field officer",
      });
    }
    if (officer.isBlocked || !officer.isActive) {
      return res.status(403).json({ success: false, message: "Account is not active" });
    }

    officer.lastActiveAt = new Date();
    await officer.save();

    res.json({
      success: true,
      message: "Signed in",
      token: signToken(officer),
      officer: publicOfficer(officer),
    });
  } catch (error) {
    console.error("officer/login:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    const { name, otp, employeeId, designation, department, level, district, state, preferredLanguage } = req.body;

    if (!name?.trim() || phone.length !== 10 || !otp) {
      return res.status(400).json({ success: false, message: "Name, phone and OTP are required" });
    }
    if (!district && !state) {
      return res.status(400).json({ success: false, message: "Pick the district or state you cover" });
    }

    const check = await consumeOtp(phone, otp);
    if (!check.ok) return res.status(400).json({ success: false, message: check.message });

    const existing = await FieldOfficer.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: "This number is already registered" });
    }

    const officer = await FieldOfficer.create({
      name: name.trim(),
      phone,
      employeeId,
      designation,
      department: DEPARTMENTS.includes(department) ? department : "DISTRICT_ADMIN",
      jurisdiction: {
        level: OFFICER_LEVELS.includes(level) ? level : "DISTRICT",
        district,
        state,
        districts: district ? [district] : [],
      },
      preferredLanguage: SUPPORTED_LANGUAGES.some((l) => l.code === preferredLanguage)
        ? preferredLanguage
        : "en",
    });

    res.status(201).json({
      success: true,
      message: "Registered",
      token: signToken(officer),
      officer: publicOfficer(officer),
    });
  } catch (error) {
    console.error("officer/register:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyToken = async (req, res) => {
  res.json({ success: true, officer: publicOfficer(req.officer) });
};

export const updateProfile = async (req, res) => {
  try {
    const o = req.officer;
    const { preferredLanguage, watchedCorridors, designation, email } = req.body;

    if (preferredLanguage && SUPPORTED_LANGUAGES.some((l) => l.code === preferredLanguage)) {
      o.preferredLanguage = preferredLanguage;
    }
    if (Array.isArray(watchedCorridors)) o.watchedCorridors = watchedCorridors.slice(0, 20);
    if (designation !== undefined) o.designation = designation;
    if (email !== undefined) o.email = email;

    await o.save();
    res.json({ success: true, officer: publicOfficer(o) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── what the officer sees ───────────────────────────────────────────────────

function jurisdictionFilter(officer) {
  const j = officer.jurisdiction || {};
  if (j.level === "REGION") return {};
  if (j.level === "STATE" && j.state) return { states: j.state };
  const districts = [...new Set([j.district, ...(j.districts || [])].filter(Boolean))];
  if (districts.length) return { districts: { $in: districts } };
  return {};
}

export const home = async (req, res) => {
  try {
    const officer = req.officer;
    const filter = jurisdictionFilter(officer);
    const lang = req.query.lang || officer.preferredLanguage || "en";

    const segments = await RoadSegment.find(filter)
      .select("segmentId name corridorCode status statusNote statusUpdatedAt risk forecast isChokepoint lifelineFor districts states lengthKm")
      .lean();

    const byStatus = { OPEN: 0, SLOW: 0, RESTRICTED: 0, BLOCKED: 0, UNKNOWN: 0 };
    for (const s of segments) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

    const j = officer.jurisdiction || {};
    const [alerts, upcoming, myPending, toVerify, unread] = await Promise.all([
      activeAlerts({
        district: j.level === "DISTRICT" ? j.district : null,
        state: j.level === "STATE" ? j.state : null,
        limit: 12,
        lang,
      }),
      upcomingRisk({
        minProbability: 0.35,
        limit: 8,
        district: j.level === "DISTRICT" ? j.district : null,
        state: j.level === "STATE" ? j.state : null,
      }),
      Incident.countDocuments({ reportedBy: officer._id, status: "REPORTED" }),
      officer.canVerifyIncidents
        ? Incident.countDocuments({ status: "REPORTED", ...(j.level === "DISTRICT" && j.district ? { district: j.district } : {}) })
        : Promise.resolve(0),
      OfficerNotification.countDocuments({ officer: officer._id, read: false }),
    ]);

    const blocked = segments.filter((s) => s.status === "BLOCKED");
    const cutOff = [...new Set(blocked.flatMap((s) => s.lifelineFor || []))];

    res.json({
      success: true,
      data: {
        officer: publicOfficer(officer),
        coverage: {
          level: j.level,
          district: j.district,
          state: j.state,
          segments: segments.length,
          lengthKm: +segments.reduce((s, x) => s + (x.lengthKm || 0), 0).toFixed(0),
        },
        byStatus,
        blockedCount: byStatus.BLOCKED,
        chokepointsAtRisk: segments.filter(
          (s) => s.isChokepoint && (s.status === "BLOCKED" || (s.forecast?.h72?.probability ?? 0) >= 0.5)
        ).length,
        cutOff,
        alerts,
        upcoming,
        myPendingReports: myPending,
        awaitingMyVerification: toVerify,
        unreadNotifications: unread,
        model: modelInfo(),
      },
    });
  } catch (error) {
    console.error("officer/home:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * The officer app has no push channel, so this is how an alert actually
 * reaches an officer. Rows are written by the alert engine; the app polls.
 */
export const notifications = async (req, res) => {
  try {
    const officer = req.officer;
    const q = { officer: officer._id };
    if (req.query.unreadOnly === "true") q.read = false;

    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const [rows, unread, total] = await Promise.all([
      OfficerNotification.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
      OfficerNotification.countDocuments({ officer: officer._id, read: false }),
      OfficerNotification.countDocuments({ officer: officer._id }),
    ]);

    // If the officer has since changed language, re-resolve the copy from the
    // alert rather than showing the language they used to read.
    const lang = req.query.lang || officer.preferredLanguage || "en";
    const needsRelocalising = rows.filter((r) => r.lang !== lang && r.alert);

    const relocalised = new Map();
    if (needsRelocalising.length) {
      const alerts = await Alert.find({
        _id: { $in: needsRelocalising.map((r) => r.alert) },
      });
      for (const a of alerts) {
        const text = a.textFor(lang);
        if (text?.title) relocalised.set(String(a._id), text);
      }
    }

    res.json({
      success: true,
      data: {
        notifications: rows.map((r) => {
          const swap = relocalised.get(String(r.alert));
          return {
            id: String(r._id),
            alertId: r.alertId,
            kind: r.kind,
            severity: r.severity,
            title: swap?.title || r.title,
            body: swap?.body || r.body,
            segmentId: r.segmentId || null,
            segmentName: r.segmentName || null,
            districts: r.districts || [],
            payload: r.payload || null,
            read: r.read,
            createdAt: r.createdAt,
          };
        }),
        unread,
        total,
        lang,
      },
    });
  } catch (error) {
    console.error("officer/notifications:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationsRead = async (req, res) => {
  try {
    const officer = req.officer;
    const { ids, all } = req.body || {};

    const filter = { officer: officer._id, read: false };
    if (!all) {
      if (!Array.isArray(ids) || !ids.length) {
        return res
          .status(400)
          .json({ success: false, message: "Send ids, or all: true" });
      }
      filter._id = { $in: ids };
    }

    const r = await OfficerNotification.updateMany(filter, {
      $set: { read: true, readAt: new Date() },
    });

    const unread = await OfficerNotification.countDocuments({
      officer: officer._id,
      read: false,
    });

    res.json({ success: true, data: { marked: r.modifiedCount || 0, unread } });
  } catch (error) {
    console.error("officer/notifications/read:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const segments = async (req, res) => {
  try {
    const filter = jurisdictionFilter(req.officer);
    if (req.query.status) filter.status = req.query.status.toUpperCase();

    const rows = await RoadSegment.find(filter)
      .select("segmentId name corridorCode status statusNote statusSource statusUpdatedAt risk forecast probe isChokepoint lifelineFor districts states lengthKm baselineSpeedKmph from to")
      .sort({ status: 1, "forecast.h72.probability": -1 })
      .limit(Math.min(Number(req.query.limit) || 120, 300))
      .lean();

    res.json({
      success: true,
      data: {
        segments: rows.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          corridorCode: s.corridorCode,
          status: s.status,
          statusNote: s.statusNote,
          statusSource: s.statusSource,
          statusUpdatedAt: s.statusUpdatedAt,
          lengthKm: s.lengthKm,
          districts: s.districts,
          states: s.states,
          isChokepoint: s.isChokepoint,
          lifelineFor: s.lifelineFor,
          riskScore: s.risk?.score ?? 0,
          riskLevel: s.risk?.level ?? "LOW",
          rain72hMm: s.risk?.rain72hMm ?? 0,
          observedSpeedKmph: s.probe?.medianSpeedKmph ?? null,
          baselineSpeedKmph: s.baselineSpeedKmph,
          forecast: {
            h24: s.forecast?.h24?.probability ?? null,
            h48: s.forecast?.h48?.probability ?? null,
            h72: s.forecast?.h72?.probability ?? null,
            level: s.forecast?.h72?.level ?? null,
            drivers: (s.forecast?.h72?.drivers || []).map((d) => d.factor),
          },
          from: s.from?.name,
          to: s.to?.name,
        })),
      },
    });
  } catch (error) {
    console.error("officer/segments:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// What road am I standing on? Drives the report screen.
export const nearby = async (req, res) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ success: false, message: "lng and lat are required" });
    }

    const radiusKm = Math.min(Number(req.query.radiusKm) || 25, 100);

    const rows = await RoadSegment.find({
      geometry: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    })
      .select("segmentId name corridorCode status geometry districts states isChokepoint lifelineFor forecast risk")
      .limit(8)
      .lean();

    res.json({
      success: true,
      data: {
        here: [lng, lat],
        segments: rows.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          corridorCode: s.corridorCode,
          status: s.status,
          districts: s.districts,
          states: s.states,
          isChokepoint: s.isChokepoint,
          riskLevel: s.risk?.level ?? "LOW",
          forecastH72: s.forecast?.h72?.probability ?? null,
          distanceKm: +nearestVertexKm([lng, lat], s.geometry?.coordinates || []).toFixed(2),
        })),
      },
    });
  } catch (error) {
    console.error("officer/nearby:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

function nearestVertexKm(point, coords) {
  let best = Infinity;
  for (const c of coords) {
    const d = haversineKm(point, c);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : 0;
}

export const alerts = async (req, res) => {
  try {
    const j = req.officer.jurisdiction || {};
    const lang = req.query.lang || req.officer.preferredLanguage || "en";
    const rows = await activeAlerts({
      district: j.level === "DISTRICT" ? j.district : null,
      state: j.level === "STATE" ? j.state : null,
      limit: Math.min(Number(req.query.limit) || 40, 100),
      lang,
    });
    res.json({ success: true, data: { alerts: rows, lang } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forecast = async (req, res) => {
  try {
    const j = req.officer.jurisdiction || {};
    const rows = await upcomingRisk({
      minProbability: Number(req.query.min) || 0.2,
      limit: Math.min(Number(req.query.limit) || 30, 60),
      district: j.level === "DISTRICT" ? j.district : null,
      state: j.level === "STATE" ? j.state : null,
    });
    res.json({
      success: true,
      data: { upcoming: rows, model: modelInfo(), importance: featureImportance().slice(0, 8) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const myReports = async (req, res) => {
  try {
    const rows = await Incident.find({ reportedBy: req.officer._id })
      .sort({ capturedAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 50, 200))
      .lean();

    res.json({
      success: true,
      data: {
        reports: rows.map(shapeIncident),
        stats: req.officer.stats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyQueue = async (req, res) => {
  try {
    const j = req.officer.jurisdiction || {};
    const q = { status: "REPORTED" };
    if (j.level === "DISTRICT" && j.district) q.district = j.district;
    else if (j.level === "STATE" && j.state) q.state = j.state;

    const rows = await Incident.find(q).sort({ capturedAt: -1 }).limit(60).lean();

    res.json({ success: true, data: { pending: rows.map(shapeIncident), total: rows.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function shapeIncident(i) {
  return {
    incidentId: i.incidentId,
    clientId: i.clientId,
    type: i.type,
    severity: i.severity,
    status: i.status,
    description: i.description,
    photos: i.photos || [],
    coordinates: i.location?.coordinates || null,
    address: i.address,
    district: i.district,
    state: i.state,
    segmentId: i.segmentId,
    capturedAt: i.capturedAt,
    syncedAt: i.syncedAt,
    wasOffline: i.wasOffline,
    reporterName: i.reporterName,
    blocksTraffic: i.impact?.blocksTraffic ?? false,
    estimatedClearanceHours: i.impact?.estimatedClearanceHours ?? null,
    verificationNote: i.verificationNote,
    verifiedAt: i.verifiedAt,
  };
}

// ─── senior actions ──────────────────────────────────────────────────────────

export const overrideSegmentStatus = async (req, res) => {
  try {
    const { status, note, hours } = req.body;
    if (!["OPEN", "SLOW", "RESTRICTED", "BLOCKED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const segment = await RoadSegment.findOne({ segmentId: req.params.segmentId });
    if (!segment) return res.status(404).json({ success: false, message: "Road not found" });

    const changed = segment.applyStatus({
      status,
      source: "MANUAL",
      note: `${req.officer.name}: ${note || "set by officer"}`,
      expiresAt: hours ? new Date(Date.now() + Number(hours) * 3600000) : undefined,
    });
    await segment.save();

    res.json({
      success: true,
      data: {
        segmentId: segment.segmentId,
        name: segment.name,
        status: segment.status,
        changed,
        expiresAt: segment.statusExpiresAt,
      },
    });
  } catch (error) {
    console.error("officer/override:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const directory = async (_req, res) => {
  res.json({
    success: true,
    data: {
      departments: DEPARTMENTS,
      levels: OFFICER_LEVELS,
      languages: SUPPORTED_LANGUAGES,
      states: NER_STATES,
      districts: DISTRICTS,
    },
  });
};
