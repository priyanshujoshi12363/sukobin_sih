import LocationPing from "../models/locationPing.model.js";
import RoadSegment from "../models/roadSegment.model.js";
import { haversineKm } from "./geo.js";

export const PROBE_MATCH_KM = Number(process.env.PROBE_MATCH_KM) || 0.6;
export const PROBE_WINDOW_MIN = Number(process.env.PROBE_WINDOW_MIN) || 45;
export const PROBE_MIN_SAMPLES = Number(process.env.PROBE_MIN_SAMPLES) || 4;
export const PROBE_MIN_VEHICLES = Number(process.env.PROBE_MIN_VEHICLES) || 2;
export const PROBE_STALE_MIN = Number(process.env.PROBE_STALE_MIN) || 180;

const MAX_PLAUSIBLE_KMPH = 120;

export async function matchToSegment(coordinates, maxKm = PROBE_MATCH_KM) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const seg = await RoadSegment.findOne({
    geometry: {
      $near: {
        $geometry: { type: "Point", coordinates },
        $maxDistance: maxKm * 1000,
      },
    },
  }).select("segmentId name corridorCode baselineSpeedKmph districts states status geometry");
  return seg || null;
}

async function deriveSpeed(partnerId, coordinates, at) {
  const prev = await LocationPing.findOne({ partner: partnerId })
    .sort({ at: -1 })
    .select("location at")
    .lean();
  if (!prev?.location?.coordinates) return null;

  const dtHours = (new Date(at) - new Date(prev.at)) / 3600000;
  if (!(dtHours > 0) || dtHours > 0.5) return null;

  const km = haversineKm(prev.location.coordinates, coordinates);
  const kmph = km / dtHours;
  if (!Number.isFinite(kmph) || kmph > MAX_PLAUSIBLE_KMPH) return null;
  return +kmph.toFixed(1);
}

export async function recordPing({
  partner,
  coordinates,
  speedKmph = null,
  headingDeg = null,
  accuracyM = null,
  onTrip = false,
  at = new Date(),
}) {
  const partnerId = partner?._id || partner;
  let speed = Number.isFinite(speedKmph) ? speedKmph : null;
  if (speed === null) speed = await deriveSpeed(partnerId, coordinates, at);

  const seg = await matchToSegment(coordinates);

  const ping = await LocationPing.create({
    partner: partnerId,
    vehicleType: partner?.vehicleType,
    location: { type: "Point", coordinates },
    speedKmph: speed,
    headingDeg,
    accuracyM,
    onTrip,
    at,
    segmentId: seg?.segmentId || null,
    distanceToSegmentKm: seg ? null : null,
  });

  return { ping, segment: seg };
}

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export async function computeProbeStats(segmentId, windowMin = PROBE_WINDOW_MIN) {
  const since = new Date(Date.now() - windowMin * 60000);
  const pings = await LocationPing.find({
    segmentId,
    at: { $gte: since },
    speedKmph: { $ne: null },
  })
    .select("partner speedKmph")
    .lean();

  if (!pings.length) return null;

  const speeds = pings.map((p) => p.speedKmph).filter((s) => Number.isFinite(s) && s >= 0);
  const vehicles = new Set(pings.map((p) => String(p.partner)));

  if (speeds.length < PROBE_MIN_SAMPLES || vehicles.size < PROBE_MIN_VEHICLES) {
    return {
      medianSpeedKmph: median(speeds),
      sampleCount: speeds.length,
      distinctVehicles: vehicles.size,
      windowMinutes: windowMin,
      sufficient: false,
    };
  }

  return {
    medianSpeedKmph: +median(speeds).toFixed(1),
    sampleCount: speeds.length,
    distinctVehicles: vehicles.size,
    windowMinutes: windowMin,
    sufficient: true,
  };
}

export async function refreshSegmentProbe(segment, windowMin = PROBE_WINDOW_MIN) {
  const stats = await computeProbeStats(segment.segmentId, windowMin);

  if (!stats) {
    segment.probe = {
      medianSpeedKmph: null,
      speedRatio: null,
      sampleCount: 0,
      distinctVehicles: 0,
      windowMinutes: windowMin,
      updatedAt: new Date(),
    };
    return { changed: false, stats: null };
  }

  const ratio =
    stats.sufficient && segment.baselineSpeedKmph > 0
      ? +(stats.medianSpeedKmph / segment.baselineSpeedKmph).toFixed(3)
      : null;

  segment.probe = {
    medianSpeedKmph: stats.medianSpeedKmph,
    speedRatio: ratio,
    sampleCount: stats.sampleCount,
    distinctVehicles: stats.distinctVehicles,
    windowMinutes: windowMin,
    updatedAt: new Date(),
  };

  return { changed: true, stats: { ...stats, speedRatio: ratio } };
}

export function probeVerdict(segment) {
  const p = segment?.probe;
  if (!p || p.speedRatio === null || p.speedRatio === undefined) return null;
  if (p.updatedAt && Date.now() - new Date(p.updatedAt) > PROBE_STALE_MIN * 60000) return null;

  const r = p.speedRatio;
  const evidence = `${p.distinctVehicles} vehicles, median ${p.medianSpeedKmph} km/h vs ${segment.baselineSpeedKmph} km/h baseline`;

  if (r <= 0.15) return { status: "BLOCKED", confidence: 0.8, evidence };
  if (r <= 0.35) return { status: "RESTRICTED", confidence: 0.7, evidence };
  if (r <= 0.6) return { status: "SLOW", confidence: 0.6, evidence };
  return { status: "OPEN", confidence: 0.5, evidence };
}
