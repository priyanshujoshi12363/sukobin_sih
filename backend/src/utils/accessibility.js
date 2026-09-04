import RoadSegment from "../models/roadSegment.model.js";
import Incident from "../models/incident.model.js";
import { refreshSegmentProbe, probeVerdict, PROBE_MIN_VEHICLES } from "./probes.js";
import { fetchWeather } from "./weather.js";
import { scoreSegmentRisk } from "./risk.js";
import { distToRouteKm } from "./geo.js";

export const SEVERITY_RANK = { OPEN: 0, UNKNOWN: 1, SLOW: 2, RESTRICTED: 3, BLOCKED: 4 };

const INCIDENT_LOOKBACK_HOURS = Number(process.env.INCIDENT_LOOKBACK_HOURS) || 36;
const WEATHER_ADVISORY_THRESHOLD = Number(process.env.WEATHER_ADVISORY_THRESHOLD) || 0.75;

export async function activeIncidentsFor(segmentId) {
  const since = new Date(Date.now() - INCIDENT_LOOKBACK_HOURS * 3600000);
  return Incident.find({
    segmentId,
    status: { $in: ["REPORTED", "VERIFIED"] },
    capturedAt: { $gte: since },
  })
    .sort({ capturedAt: -1 })
    .limit(20);
}

/**
 * A blocking report older than the lookback window stops counting towards the
 * road's status, but it used to stay open in the incident log for ever. If the
 * road has since been observed flowing normally, close the report and say why,
 * so the log matches what actually happened and the officer who filed it sees
 * the outcome.
 */
export async function autoResolveClearedIncidents(segment) {
  if (!segment?.segmentId) return [];
  if (segment.status !== "OPEN") return [];

  const ratio = segment.probe?.speedRatio;
  const vehicles = segment.probe?.distinctVehicles || 0;
  if (ratio == null || ratio < 0.75 || vehicles < PROBE_MIN_VEHICLES) return [];

  const cutoff = new Date(Date.now() - INCIDENT_LOOKBACK_HOURS * 3600000);

  const stale = await Incident.find({
    segmentId: segment.segmentId,
    status: { $in: ["REPORTED", "VERIFIED"] },
    capturedAt: { $lt: cutoff },
  });

  const closed = [];
  for (const inc of stale) {
    inc.status = "RESOLVED";
    inc.resolvedAt = new Date();
    inc.verificationNote = [
      inc.verificationNote,
      `Closed automatically: ${vehicles} vehicles observed at ` +
        `${Math.round(ratio * 100)}% of normal speed after the report window.`,
    ]
      .filter(Boolean)
      .join(" ");
    await inc.save();
    closed.push(inc.incidentId);
  }

  return closed;
}

export function resolveStatus({ segment, incidents = [], weather = null, risk = null }) {
  const votes = [];

  // A single unverified report should not close a highway on its own, but it must
  // not be ignored either. Trusted reports (human-verified, or independently
  // corroborated by probe vehicles slowing down) carry their full implied status;
  // an untrusted one is capped at RESTRICTED and flagged for verification.
  for (const inc of incidents) {
    if (inc.status === "REJECTED" || inc.status === "RESOLVED") continue;

    const trusted = inc.status === "VERIFIED" || inc.corroboratedByProbe;
    const implied = inc.impliedStatus();
    const status = trusted ? implied : implied === "BLOCKED" ? "RESTRICTED" : implied;

    const base = inc.status === "VERIFIED" ? 0.95 : inc.corroboratedByProbe ? 0.8 : 0.7;
    const severityWeight =
      inc.severity === "CRITICAL" ? 1 : inc.severity === "HIGH" ? 0.95 : 0.85;

    votes.push({
      status,
      source: "FIELD_REPORT",
      confidence: base * severityWeight,
      note: trusted
        ? `${inc.type} reported by ${inc.reporterName || "field officer"}`
        : `${inc.type} reported by ${inc.reporterName || "field officer"} - awaiting verification`,
    });
  }

  const pv = probeVerdict(segment);
  if (pv) {
    votes.push({
      status: pv.status,
      source: "PROBE",
      confidence: pv.confidence,
      note: pv.evidence,
    });
  }

  // A weather forecast predicts trouble; it does not observe it. Letting a
  // forecast set live accessibility would mark a currently-open road closed and
  // misroute real consignments. Risk is surfaced through segment.risk and the
  // alerts feed instead, and only observations (field reports, probe vehicles)
  // move status.

  if (!votes.length) {
    const hasFreshProbe = segment?.probe?.sampleCount > 0;
    return {
      status: hasFreshProbe ? "OPEN" : "UNKNOWN",
      source: hasFreshProbe ? "PROBE" : "SEED",
      confidence: hasFreshProbe ? 0.4 : 0,
      note: hasFreshProbe ? "No anomaly detected" : "No recent observation",
    };
  }

  votes.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return SEVERITY_RANK[b.status] - SEVERITY_RANK[a.status];
  });

  const top = votes[0];
  const corroborating = votes.filter(
    (v) => v !== top && SEVERITY_RANK[v.status] >= SEVERITY_RANK[top.status]
  );

  return {
    ...top,
    corroborated: corroborating.length > 0,
    votes,
  };
}

export async function refreshSegment(segmentOrId, { withWeather = true } = {}) {
  const segment =
    typeof segmentOrId === "string"
      ? await RoadSegment.findOne({ segmentId: segmentOrId })
      : segmentOrId;
  if (!segment) return null;

  await refreshSegmentProbe(segment);

  const incidents = await activeIncidentsFor(segment.segmentId);
  segment.openIncidentCount = incidents.filter((i) => i.status !== "RESOLVED").length;
  if (incidents[0]) segment.lastIncident = incidents[0]._id;

  let weather = null;
  let risk = null;
  if (withWeather) {
    const mid =
      segment.geometry?.coordinates?.[Math.floor(segment.geometry.coordinates.length / 2)] ||
      segment.from?.coordinates;
    weather = await fetchWeather(mid);
    risk = scoreSegmentRisk({
      segment,
      weather,
      recentIncidentCount: incidents.length,
    });
    segment.risk = {
      score: risk.score,
      level: risk.level,
      drivers: risk.drivers,
      rain24hMm: risk.rain24hMm,
      rain72hMm: risk.rain72hMm,
      computedAt: risk.computedAt,
      validUntil: risk.validUntil,
    };
  }

  const resolved = resolveStatus({ segment, incidents, weather, risk });
  const changed = segment.applyStatus({
    status: resolved.status,
    source: resolved.source,
    note: resolved.note,
  });

  await segment.save();

  const autoResolved = await autoResolveClearedIncidents(segment);

  for (const inc of incidents) {
    const pv = probeVerdict(segment);
    if (pv && SEVERITY_RANK[pv.status] >= 2 && !inc.corroboratedByProbe) {
      inc.corroboratedByProbe = true;
      inc.probeSpeedRatioAtReport = segment.probe?.speedRatio ?? null;
      await inc.save();
    }
  }

  return { segment, resolved, risk, weather, changed, autoResolved };
}

export async function refreshAllSegments({ withWeather = true, concurrency = 4 } = {}) {
  const segments = await RoadSegment.find({}).select("segmentId");
  const ids = segments.map((s) => s.segmentId);
  const results = { total: ids.length, changed: 0, blocked: 0, errors: 0 };

  const queue = [...ids];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const r = await refreshSegment(id, { withWeather });
        if (r?.changed) results.changed++;
        if (r?.segment?.status === "BLOCKED") results.blocked++;
      } catch {
        results.errors++;
      }
    }
  });

  await Promise.all(workers);
  return results;
}

export const ROUTE_CORRIDOR_KM = Number(process.env.ROUTE_CORRIDOR_KM) || 2.5;
export const ROUTE_MIN_COVERAGE = Number(process.env.ROUTE_MIN_COVERAGE) || 0.6;
const COVERAGE_SAMPLES = 12;

function sampleAlong(coords, n) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  if (coords.length <= n) return coords;
  const out = [];
  const step = (coords.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

// How much of this segment actually runs along the route. A segment that merely
// touches the route at a shared town (a different highway leaving the same city)
// scores near zero and is excluded - $geoIntersects alone would wrongly include it.
export function routeCoverage(segment, polyline, corridorKm = ROUTE_CORRIDOR_KM) {
  const coords = segment?.geometry?.coordinates || [];
  const samples = sampleAlong(coords, COVERAGE_SAMPLES);
  if (!samples.length) return 0;
  const inside = samples.filter((p) => distToRouteKm(p, polyline) <= corridorKm).length;
  return inside / samples.length;
}

export async function segmentsOnRoute(polyline, corridorKm = ROUTE_CORRIDOR_KM) {
  if (!Array.isArray(polyline) || polyline.length < 2) return [];

  const candidates = await RoadSegment.find({
    geometry: {
      $geoIntersects: {
        $geometry: { type: "LineString", coordinates: polyline },
      },
    },
  });

  const pool = candidates.length
    ? candidates
    : await RoadSegment.find({}).select(
        "segmentId name status statusNote risk geometry baselineSpeedKmph lengthKm lifelineFor corridorCode probe"
      );

  const matched = [];
  for (const s of pool) {
    const coverage = routeCoverage(s, polyline, corridorKm);
    if (coverage < ROUTE_MIN_COVERAGE) continue;
    s.routeCoverage = coverage;
    // only the portion that follows the route counts toward distance and ETA
    s.coveredKm = +((s.lengthKm || 0) * coverage).toFixed(1);
    matched.push(s);
  }

  return matched;
}

export async function routeAccessibility(polyline) {
  const segments = await segmentsOnRoute(polyline);
  const blocked = segments.filter((s) => s.status === "BLOCKED");
  const degraded = segments.filter((s) => s.status === "RESTRICTED" || s.status === "SLOW");
  const highRisk = segments.filter((s) => (s.risk?.score || 0) >= 0.5);

  return {
    passable: blocked.length === 0,
    segments,
    blocked,
    degraded,
    highRisk,
    worstStatus: segments.reduce(
      (worst, s) => (SEVERITY_RANK[s.status] > SEVERITY_RANK[worst] ? s.status : worst),
      "OPEN"
    ),
    maxRiskScore: segments.reduce((m, s) => Math.max(m, s.risk?.score || 0), 0),
  };
}
