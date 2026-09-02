// Geospatial helpers for the route-matching engine.
// CONVENTION: every coordinate is GeoJSON order → [longitude, latitude].

const R = 6371; // earth radius, km
const toRad = (d) => (d * Math.PI) / 180;

// Great-circle distance between two [lng,lat] points, in km.
export function haversineKm(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(a[0] - b[0]) * -1; // a[0]-b[0] sign-agnostic; kept explicit
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(toRad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Project point P onto segment A→B using a local equirectangular plane
// (accurate for the short, regional distances we deal with in the hills).
// Returns { distKm, t } where t∈[0,1] is the clamped position along the segment.
export function projectOnSeg(p, a, b) {
  const lat0 = toRad(a[1]);
  const X = (pt) => toRad(pt[0]) * Math.cos(lat0) * R; // lng → x km
  const Y = (pt) => toRad(pt[1]) * R; // lat → y km

  const px = X(p), py = Y(p);
  const ax = X(a), ay = Y(a);
  const bx = X(b), by = Y(b);

  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx, cy = ay + t * dy;
  return { distKm: Math.hypot(px - cx, py - cy), t };
}

// Shortest distance (km) from a point to the whole polyline.
// poly = [[lng,lat], …]
export function distToRouteKm(p, poly) {
  if (!poly || poly.length === 0) return Infinity;
  if (poly.length === 1) return haversineKm(p, poly[0]);
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const { distKm } = projectOnSeg(p, poly[i], poly[i + 1]);
    if (distKm < best) best = distKm;
  }
  return best;
}

// "Distance along the route" (km from start) of the point on the polyline
// nearest to P. Used for the direction / no-backtracking test.
export function sAlongKm(poly, p) {
  if (!poly || poly.length < 2) return 0;
  let acc = 0, best = { d: Infinity, s: 0 };
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const segLen = haversineKm(a, b);
    const { distKm, t } = projectOnSeg(p, a, b);
    if (distKm < best.d) best = { d: distKm, s: acc + t * segLen };
    acc += segLen;
  }
  return best.s;
}

// Total driving length of the polyline (km).
export function routeLengthKm(poly) {
  let total = 0;
  for (let i = 0; i < (poly?.length || 0) - 1; i++) total += haversineKm(poly[i], poly[i + 1]);
  return total;
}

// A padded bounding-box Polygon (GeoJSON) around the polyline — a cheap superset of
// the real corridor, used as the index-backed coarse filter in MongoDB ($geoWithin).
export function bboxPolygon(poly, padKm = 6) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of poly) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  const midLat = (minLat + maxLat) / 2;
  const latPad = padKm / 111; // ~111 km per degree latitude
  const lngPad = padKm / (111 * Math.max(0.1, Math.cos(toRad(midLat))));
  const w = minLng - lngPad, e = maxLng + lngPad;
  const s = minLat - latPad, n = maxLat + latPad;
  return {
    type: "Polygon",
    coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
  };
}

// Build the route polyline from ordered stations [[lng,lat], …].
// MVP: straight segments between stations. (Swap for OSRM road geometry later.)
export function buildPolyline(points) {
  return (points || []).filter((c) => Array.isArray(c) && c.length === 2);
}
