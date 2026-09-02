// The route-matching core. A parcel/order matches the driver's journey if its pickup
// and drop are both "on the way", in the forward direction:
//   • ENDPOINTS  — a pickup anywhere in the ORIGIN city, or a drop anywhere in the
//                  DESTINATION city, matches by CITY RADIUS (a city is an area, not a
//                  point — covers the whole of Haldwani, etc.).
//   • MID-RIDE   — any other pickup/drop must be within the 10 km corridor of the line.

import { distToRouteKm, sAlongKm, haversineKm } from "./geo.js";
import { etaMinutes } from "./routing.js";

const CORRIDOR_KM = Number(process.env.MATCH_CORRIDOR_KM) || 10;      // mid-ride: ≤10 km off the line
const MAX_DETOUR_KM = Number(process.env.MATCH_MAX_DETOUR_KM) || 24;  // cap on total MID detour
const W_FEE = Number(process.env.MATCH_W_FEE) || 1;
const W_DETOUR = Number(process.env.MATCH_W_DETOUR) || 8;
const W_AGE = Number(process.env.MATCH_W_AGE) || 0.15;
const MAX_RESULTS = Number(process.env.MATCH_MAX_RESULTS) || 50;

const ageMinutes = (job) =>
  job.createdAt ? Math.max(0, (Date.now() - new Date(job.createdAt).getTime()) / 60000) : 0;

/**
 * Does a pickup→drop pair ride along the driver's journey?
 * @param pick [lng,lat]  @param drop [lng,lat]
 * @param ctx { polyline, sDriver, origin?, destination?, originRadiusKm?, destRadiusKm? }
 * @returns { offRouteKm, sPick, sDrop } if it matches, else null
 */
export function evaluateJob(pick, drop, ctx) {
  const { polyline } = ctx;
  if (!Array.isArray(pick) || !Array.isArray(drop) || !polyline || polyline.length < 2) return null;

  const dPick = distToRouteKm(pick, polyline);
  const dDrop = distToRouteKm(drop, polyline);

  // endpoint city membership (whole origin / destination city) overrides the corridor
  const pickInCity = ctx.origin ? haversineKm(pick, ctx.origin) <= (ctx.originRadiusKm || CORRIDOR_KM) : false;
  const dropInCity = ctx.destination ? haversineKm(drop, ctx.destination) <= (ctx.destRadiusKm || CORRIDOR_KM) : false;

  const pickOK = pickInCity || dPick <= CORRIDOR_KM;
  const dropOK = dropInCity || dDrop <= CORRIDOR_KM;
  if (!pickOK || !dropOK) return null;

  // only MID-ride deviations are a "detour" — a city pickup/drop is free
  const midDev = (pickInCity ? 0 : dPick) + (dropInCity ? 0 : dDrop);
  if (midDev > MAX_DETOUR_KM) return null;

  // direction: pickup before drop, both ahead of the driver
  const sPick = sAlongKm(polyline, pick);
  const sDrop = sAlongKm(polyline, drop);
  if (!((ctx.sDriver ?? 0) <= sPick + 0.05 && sPick <= sDrop + 0.05)) return null;

  return { offRouteKm: +midDev.toFixed(1), sPick, sDrop };
}

/**
 * @param jobs        normalized DeliveryJob[] (each may carry createdAt + routeKm)
 * @param polyline    [[lng,lat], …] driver's journey line
 * @param driverLoc   [lng,lat] current position (defaults to route start)
 * @param origin/destination  [lng,lat] city centres
 * @param originRadiusKm/destRadiusKm  city radii
 */
export function scoreAndRank({ jobs, polyline, driverLoc, origin, destination, originRadiusKm, destRadiusKm }) {
  if (!polyline || polyline.length < 2) return [];
  const ctx = {
    polyline,
    sDriver: driverLoc ? sAlongKm(polyline, driverLoc) : 0,
    origin, destination, originRadiusKm, destRadiusKm,
  };

  const matched = [];
  for (const job of jobs) {
    const pick = job?.pickup?.coordinates;
    const drop = job?.drop?.coordinates;
    const ev = evaluateJob(pick, drop, ctx);
    if (!ev) continue;
    const score = W_FEE * job.fee - W_DETOUR * ev.offRouteKm - W_AGE * ageMinutes(job);
    matched.push({ ...job, offRouteKm: ev.offRouteKm, etaMin: etaMinutes(job.routeKm), _sPick: ev.sPick, score });
  }

  // suggested pickup order = order along the route (no backtracking)
  const bySeq = [...matched].sort((a, b) => a._sPick - b._sPick);
  bySeq.forEach((j, i) => { j.pickupOrder = i + 1; });

  return matched.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}

export const matchConfig = { CORRIDOR_KM, MAX_DETOUR_KM, MAX_RESULTS };
