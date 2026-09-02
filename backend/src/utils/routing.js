// Road-route fetching. Given ordered [[lng,lat], …] waypoints, return the real driving
// polyline (so a Haldwani→Almora route follows the road via Bhowali, not a straight line).
// Uses an OSRM server (configurable); falls back to straight segments if it's unreachable.

import { routeLengthKm } from "./geo.js";

const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";
const AVG_SPEED_KMH = Number(process.env.AVG_SPEED_KMH) || 28; // hill roads
const TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 8000;

const MAX_POINTS = Number(process.env.ROUTE_MAX_POINTS) || 400;

export const etaMinutes = (distanceKm) =>
  Math.max(1, Math.round(((distanceKm || 0) / AVG_SPEED_KMH) * 60));

// Keep polylines bounded (OSRM can return thousands of points). Even sampling that
// always keeps the first & last point — plenty accurate for a 2 km corridor test.
function downsample(poly, max = MAX_POINTS) {
  if (!Array.isArray(poly) || poly.length <= max) return poly;
  const step = Math.ceil(poly.length / max);
  const out = [];
  for (let i = 0; i < poly.length; i += step) out.push(poly[i]);
  if (out[out.length - 1] !== poly[poly.length - 1]) out.push(poly[poly.length - 1]);
  return out;
}

/**
 * @param coords [[lng,lat], …] (>= 2 waypoints)
 * @returns { polyline:[[lng,lat],…], distanceKm, durationMin, source:'osrm'|'fallback'|'none' }
 */
export async function fetchRoutePolyline(coords) {
  const clean = (coords || []).filter((c) => Array.isArray(c) && c.length === 2);
  if (clean.length < 2) {
    return { polyline: clean, distanceKm: 0, durationMin: 0, source: "none" };
  }

  // ── try the road network (OSRM) ──
  try {
    const path = clean.map((c) => `${c[0]},${c[1]}`).join(";");
    const url = `${OSRM_URL}/route/v1/driving/${path}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const data = await res.json();
      const r = data?.routes?.[0];
      if (r?.geometry?.coordinates?.length >= 2) {
        return {
          polyline: downsample(r.geometry.coordinates), // already [lng,lat], bounded
          distanceKm: +(r.distance / 1000).toFixed(2),
          durationMin: Math.max(1, Math.round(r.duration / 60)),
          source: "osrm",
        };
      }
    }
  } catch {
    // OSRM down / timed out → straight-line fallback below
  }

  // ── fallback: straight segments between the waypoints ──
  const distanceKm = +routeLengthKm(clean).toFixed(2);
  return {
    polyline: clean,
    distanceKm,
    durationMin: etaMinutes(distanceKm),
    source: "fallback",
  };
}

export async function fetchRouteAlternatives(coords, count = 3) {
  const clean = (coords || []).filter((c) => Array.isArray(c) && c.length === 2);
  if (clean.length < 2) return [];

  try {
    const path = clean.map((c) => `${c[0]},${c[1]}`).join(";");
    const url = `${OSRM_URL}/route/v1/driving/${path}?alternatives=${count}&overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.routes || [])
      .filter((r) => r?.geometry?.coordinates?.length >= 2)
      .map((r, i) => ({
        index: i,
        polyline: downsample(r.geometry.coordinates),
        distanceKm: +(r.distance / 1000).toFixed(2),
        durationMin: Math.max(1, Math.round(r.duration / 60)),
        source: "osrm",
      }));
  } catch {
    return [];
  }
}
