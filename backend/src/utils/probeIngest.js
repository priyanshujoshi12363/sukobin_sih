import RoadSegment from "../models/roadSegment.model.js";
import { recordPing, refreshSegmentProbe, PROBE_WINDOW_MIN } from "./probes.js";
import { resolveStatus, activeIncidentsFor } from "./accessibility.js";

const REFRESH_EVERY_MIN = Number(process.env.PROBE_REFRESH_MIN) || 5;
const MAX_ACCURACY_M = Number(process.env.PROBE_MAX_ACCURACY_M) || 120;

const lastRefresh = new Map();

function dueForRefresh(segmentId) {
  const last = lastRefresh.get(segmentId) || 0;
  if (Date.now() - last < REFRESH_EVERY_MIN * 60000) return false;
  lastRefresh.set(segmentId, Date.now());
  return true;
}

export async function ingestProbe(partner, fix) {
  if (!fix?.coordinates) return { skipped: "no coordinates" };

  if (fix.accuracyM != null && fix.accuracyM > MAX_ACCURACY_M) {
    return { skipped: "gps accuracy too poor" };
  }

  const { ping, segment } = await recordPing({
    partner,
    coordinates: fix.coordinates,
    speedKmph: fix.speedKmph,
    headingDeg: fix.headingDeg,
    accuracyM: fix.accuracyM,
    onTrip: fix.onTrip,
  });

  if (!segment) return { matched: false, pingId: ping?._id };

  if (!dueForRefresh(segment.segmentId)) {
    return { matched: true, segmentId: segment.segmentId, refreshed: false };
  }

  const full = await RoadSegment.findOne({ segmentId: segment.segmentId });
  if (!full) return { matched: true, refreshed: false };

  await refreshSegmentProbe(full, PROBE_WINDOW_MIN);

  const incidents = await activeIncidentsFor(full.segmentId);
  const resolved = resolveStatus({ segment: full, incidents });

  const changed = full.applyStatus({
    status: resolved.status,
    source: resolved.source,
    note: resolved.note,
  });

  await full.save();

  return {
    matched: true,
    segmentId: full.segmentId,
    refreshed: true,
    statusChanged: changed,
    status: full.status,
    medianSpeedKmph: full.probe?.medianSpeedKmph ?? null,
    speedRatio: full.probe?.speedRatio ?? null,
    vehicles: full.probe?.distinctVehicles ?? 0,
  };
}

export function clearProbeRefreshCache() {
  lastRefresh.clear();
}
