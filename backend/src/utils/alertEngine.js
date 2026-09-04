import crypto from "crypto";
import Alert from "../models/alert.model.js";
import RoadSegment from "../models/roadSegment.model.js";
import Incident from "../models/incident.model.js";
import FieldOfficer from "../models/fieldOfficer.model.js";
import Partner from "../models/partner.model.js";
import { tAll, reasonText, LANGUAGES } from "./i18n.js";
import { sendPushMany } from "./notification.js";

const FORECAST_ALERT_P = Number(process.env.ALERT_FORECAST_P) || 0.55;
const FORECAST_REALERT_DELTA = 0.15;
const ALERT_TTL_HOURS = Number(process.env.ALERT_TTL_HOURS) || 12;

const newId = () => "ALR" + crypto.randomBytes(6).toString("hex").toUpperCase();

const INCIDENT_REASON = {
  LANDSLIDE: "LANDSLIDE",
  FLOOD: "FLOOD",
  SNOW_ICE: "SNOW_ICE",
  BRIDGE_DAMAGE: "BRIDGE_DAMAGE",
};

function textsFor(kind, vars, reasonCode) {
  const out = {};
  for (const lang of LANGUAGES) {
    const localVars = { ...vars, reason: reasonCode ? reasonText(reasonCode, lang) : vars.reason || "" };
    const one = tAll(kind, localVars)[lang];
    out[lang] = { title: one.title, body: one.body };
  }
  return out;
}

/**
 * Creates an alert unless an equivalent one is already live.
 * Returns the alert, or null when it was suppressed as a duplicate.
 */
export async function raise({
  kind,
  severity = "WARNING",
  dedupeKey,
  segment,
  incident = null,
  vars = {},
  reasonCode = null,
  audiences = ["OFFICER"],
  payload = {},
  ttlHours = ALERT_TTL_HOURS,
  supersedeIf = null,
}) {
  const existing = await Alert.findOne({ dedupeKey, active: true });
  if (existing) {
    if (!supersedeIf || !supersedeIf(existing)) return null;
    existing.active = false;
    existing.clearedAt = new Date();
    existing.clearedReason = "superseded";
    await existing.save();
  }

  const alert = await Alert.create({
    alertId: newId(),
    kind,
    severity,
    dedupeKey,
    segmentId: segment?.segmentId,
    segmentName: segment?.name,
    corridorCode: segment?.corridorCode,
    districts: segment?.districts || [],
    states: segment?.states || [],
    incident: incident?._id,
    text: textsFor(kind, vars, reasonCode),
    payload,
    audiences,
    expiresAt: new Date(Date.now() + ttlHours * 3600000),
  });

  return alert;
}

// ── who hears about it ──────────────────────────────────────────────────────

async function officerRecipients(alert) {
  const q = { isActive: true, isBlocked: false };
  const geo = [];
  if (alert.districts?.length) geo.push({ "jurisdiction.district": { $in: alert.districts } });
  if (alert.districts?.length) geo.push({ "jurisdiction.districts": { $in: alert.districts } });
  if (alert.states?.length) geo.push({ "jurisdiction.state": { $in: alert.states } });
  geo.push({ "jurisdiction.level": "REGION" });
  if (alert.corridorCode) geo.push({ watchedCorridors: alert.corridorCode });
  if (geo.length) q.$or = geo;

  return FieldOfficer.find(q).select("name fcmToken expoPushToken preferredLanguage").lean();
}

async function partnerRecipients() {
  // Partners carry no jurisdiction, so a road alert goes to whoever is on duty.
  // Narrowing this to drivers whose declared trip crosses the segment is the
  // next step once trips are persisted.
  return Partner.find({ isBlocked: { $ne: true }, isOnline: true })
    .select("name fcmToken expoPushToken preferredLanguage")
    .limit(500)
    .lean();
}

const RECIPIENTS = {
  OFFICER: officerRecipients,
  PARTNER: partnerRecipients,
};

export async function deliver(alert) {
  const byAudience = {};
  let attempted = 0;
  let sent = 0;

  for (const audience of alert.audiences || []) {
    const fetch = RECIPIENTS[audience];
    if (!fetch) continue;

    let people = [];
    try {
      people = await fetch(alert);
    } catch {
      people = [];
    }

    // Group by language so each person gets one push in their own language.
    const byLang = new Map();
    for (const p of people) {
      const token = p.fcmToken || p.expoPushToken;
      if (!token) continue;
      const lang = p.preferredLanguage && alert.textFor(p.preferredLanguage).title ? p.preferredLanguage : "en";
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang).push(token);
    }

    let audienceSent = 0;
    for (const [lang, tokens] of byLang) {
      const text = alert.textFor(lang);
      attempted += tokens.length;
      try {
        const r = await sendPushMany(tokens, {
          title: text.title,
          body: text.body,
          data: {
            type: "ALERT",
            alertId: alert.alertId,
            kind: alert.kind,
            severity: alert.severity,
            segmentId: alert.segmentId || "",
          },
        });
        const n = (r?.results || []).reduce((s, x) => s + (x?.sent || 0), 0);
        audienceSent += n;
        sent += n;
      } catch {
        /* a dead token must not stop the rest of the fan-out */
      }
    }

    byAudience[audience] = { people: people.length, sent: audienceSent };
  }

  alert.delivery = {
    attempted,
    sent,
    failed: Math.max(0, attempted - sent),
    byAudience,
    at: new Date(),
  };
  await alert.save();

  return alert.delivery;
}

// ── the scan ────────────────────────────────────────────────────────────────

/**
 * Looks at current road status, model forecasts and pending reports, and
 * raises whatever is newly worth telling someone about.
 */
export async function runAlertScan({ deliverPush = true } = {}) {
  const raised = [];
  const now = new Date();

  await Alert.updateMany(
    { active: true, expiresAt: { $lt: now } },
    { $set: { active: false, clearedAt: now, clearedReason: "expired" } }
  );

  const segments = await RoadSegment.find({}).lean();

  for (const seg of segments) {
    // 1. road is shut right now
    if (seg.status === "BLOCKED") {
      const inc = seg.lastIncident
        ? await Incident.findById(seg.lastIncident).select("type").lean()
        : null;
      const reasonCode = INCIDENT_REASON[inc?.type] || null;

      const a = await raise({
        kind: "ROAD_BLOCKED",
        severity: "CRITICAL",
        dedupeKey: `blocked:${seg.segmentId}`,
        segment: seg,
        reasonCode,
        vars: { road: seg.name, reason: seg.statusNote || "" },
        audiences: ["OFFICER", "PARTNER"],
        payload: { status: seg.status, source: seg.statusSource, isChokepoint: seg.isChokepoint },
        ttlHours: 24,
      });
      if (a) raised.push(a);

      // 2. a district whose only listed lifeline is this stretch
      for (const d of seg.lifelineFor || []) {
        const b = await raise({
          kind: "LIFELINE_CUT",
          severity: "CRITICAL",
          dedupeKey: `lifeline:${d}:${seg.segmentId}`,
          segment: seg,
          vars: { road: seg.name, district: d },
          audiences: ["OFFICER"],
          payload: { district: d },
          ttlHours: 24,
        });
        if (b) raised.push(b);
      }
    } else if (seg.status === "RESTRICTED") {
      const a = await raise({
        kind: "ROAD_RESTRICTED",
        severity: "WARNING",
        dedupeKey: `restricted:${seg.segmentId}`,
        segment: seg,
        vars: { road: seg.name, reason: seg.statusNote || "" },
        audiences: ["OFFICER", "PARTNER"],
        ttlHours: 12,
      });
      if (a) raised.push(a);
    } else if (seg.status === "OPEN") {
      // clear anything that said otherwise, and say so once
      const stale = await Alert.find({
        active: true,
        segmentId: seg.segmentId,
        kind: { $in: ["ROAD_BLOCKED", "ROAD_RESTRICTED", "LIFELINE_CUT"] },
      });
      if (stale.length) {
        for (const s of stale) {
          s.active = false;
          s.clearedAt = now;
          s.clearedReason = "road reopened";
          await s.save();
        }
        const a = await raise({
          kind: "ROAD_REOPENED",
          severity: "INFO",
          dedupeKey: `reopened:${seg.segmentId}:${now.toISOString().slice(0, 10)}`,
          segment: seg,
          vars: { road: seg.name },
          audiences: ["OFFICER", "PARTNER"],
          ttlHours: 6,
        });
        if (a) raised.push(a);
      }
    }

    // 3. the model expects it to go
    const peak = Math.max(
      seg.forecast?.h24?.probability ?? 0,
      seg.forecast?.h48?.probability ?? 0,
      seg.forecast?.h72?.probability ?? 0
    );

    if (peak >= FORECAST_ALERT_P && seg.status !== "BLOCKED") {
      const hours =
        (seg.forecast?.h24?.probability ?? 0) >= FORECAST_ALERT_P
          ? 24
          : (seg.forecast?.h48?.probability ?? 0) >= FORECAST_ALERT_P
          ? 48
          : 72;
      const drivers = seg.forecast?.[`h${hours}`]?.drivers || [];

      const a = await raise({
        kind: "FORECAST_RISK",
        severity: peak >= 0.75 ? "CRITICAL" : "WARNING",
        dedupeKey: `forecast:${seg.segmentId}`,
        segment: seg,
        reasonCode: "HEAVY_RAIN",
        vars: { road: seg.name, pct: Math.round(peak * 100), hours },
        audiences: ["OFFICER"],
        payload: {
          probability: +peak.toFixed(3),
          horizonH: hours,
          drivers: drivers.slice(0, 3),
          h24: seg.forecast?.h24?.probability ?? null,
          h48: seg.forecast?.h48?.probability ?? null,
          h72: seg.forecast?.h72?.probability ?? null,
        },
        ttlHours: 8,
        // only shout again if it got materially worse
        supersedeIf: (old) => peak - (old.payload?.probability ?? 0) >= FORECAST_REALERT_DELTA,
      });
      if (a) raised.push(a);
    }
  }

  // 4. reports sitting unverified
  const pending = await Incident.find({ status: "REPORTED" })
    .select("segmentId districts district state type capturedAt")
    .sort({ capturedAt: -1 })
    .limit(50)
    .lean();

  for (const inc of pending) {
    if (!inc.segmentId) continue;
    const seg = segments.find((s) => s.segmentId === inc.segmentId);
    if (!seg) continue;

    const a = await raise({
      kind: "VERIFY_REQUEST",
      severity: "INFO",
      dedupeKey: `verify:${inc._id}`,
      segment: seg,
      incident: inc,
      vars: { road: seg.name },
      audiences: ["OFFICER"],
      payload: { incidentId: String(inc._id), type: inc.type },
      ttlHours: 48,
    });
    if (a) raised.push(a);
  }

  let delivered = { attempted: 0, sent: 0 };
  if (deliverPush) {
    for (const a of raised) {
      const d = await deliver(a);
      delivered.attempted += d.attempted;
      delivered.sent += d.sent;
    }
  }

  const byKind = {};
  for (const a of raised) byKind[a.kind] = (byKind[a.kind] || 0) + 1;

  return {
    scanned: segments.length,
    raised: raised.length,
    byKind,
    delivered,
    alerts: raised.map((a) => ({
      alertId: a.alertId,
      kind: a.kind,
      severity: a.severity,
      segment: a.segmentName,
      title: a.textFor("en").title,
      body: a.textFor("en").body,
    })),
  };
}

export async function activeAlerts({ district = null, state = null, limit = 50, lang = "en" } = {}) {
  const q = { active: true };
  if (district) q.districts = district;
  if (state) q.states = state;

  const rows = await Alert.find(q).sort({ severity: 1, createdAt: -1 }).limit(limit);

  const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return rows
    .map((a) => {
      const text = a.textFor(lang);
      return {
        alertId: a.alertId,
        kind: a.kind,
        severity: a.severity,
        title: text.title,
        body: text.body,
        segmentId: a.segmentId,
        segmentName: a.segmentName,
        districts: a.districts,
        states: a.states,
        payload: a.payload,
        createdAt: a.createdAt,
        expiresAt: a.expiresAt,
      };
    })
    .sort((x, y) => order[x.severity] - order[y.severity] || y.createdAt - x.createdAt);
}
