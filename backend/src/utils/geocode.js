// Turn a typed address into [lng, lat] using OpenStreetMap Nominatim (free).
// Cached in-memory. Tries the full address, then progressively drops the most specific
// leading parts ("Mall Road, Almora, UK" → "Almora, UK") so a street that OSM doesn't
// know still resolves to the right town. (For prod scale, self-host Nominatim or use a
// paid geocoder — public Nominatim asks for ≤1 req/sec + a User-Agent.)

import { townInAddress } from "../data/ukTowns.js";

const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON_URL = process.env.PHOTON_URL || "https://photon.komoot.io"; // autocomplete
const UA = process.env.GEOCODE_USER_AGENT || "Sukobin/1.0 (logistics app; contact support@sukobin.app)";
const TIMEOUT_MS = Number(process.env.GEOCODE_TIMEOUT_MS) || 8000;
// default suggestion bias when we don't know the driver's location (Kumaon hills)
const BIAS_LAT = Number(process.env.GEOCODE_BIAS_LAT) || 29.4;
const BIAS_LON = Number(process.env.GEOCODE_BIAS_LON) || 79.5;

const cache = new Map(); // normalized query → [lng,lat] | null
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

async function geocodeOne(query) {
  const key = norm(query);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  try {
    const url = `${NOMINATIM_URL}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) { cache.set(key, null); return null; }
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (hit?.lon && hit?.lat) {
      const coords = [parseFloat(hit.lon), parseFloat(hit.lat)];
      cache.set(key, coords);
      return coords;
    }
    cache.set(key, null);
    return null;
  } catch {
    return null; // don't cache transient failures
  }
}

// short, readable label from a Nominatim display_name
const shortLabel = (name) => {
  const parts = String(name || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(", ");
  return [parts[0], parts[1], parts[parts.length - 2]].filter(Boolean).join(", ");
};

const uniq = (arr) => arr.filter((v, i, a) => v && a.indexOf(v) === i);

/**
 * Autocomplete: search places by free text → suggestions, biased near the driver.
 * Uses Photon (built for type-ahead); falls back to Nominatim.
 * @param query    free text
 * @param opts     { lat, lon } bias center (driver's location)
 * @returns [{ label, fullName, coordinates:[lng,lat] }]
 */
export async function searchPlaces(query, opts = {}) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const lat = typeof opts.lat === "number" ? opts.lat : BIAS_LAT;
  const lon = typeof opts.lon === "number" ? opts.lon : BIAS_LON;

  // ── Photon (autocomplete-friendly, location-biased) ──
  try {
    const url = `${PHOTON_URL}/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) {
      const data = await res.json();
      const feats = Array.isArray(data?.features) ? data.features : [];
      const out = feats
        .filter((f) => f?.geometry?.coordinates?.length === 2)
        .map((f) => {
          const p = f.properties || {};
          const label = uniq([p.name, p.street, p.city || p.county || p.district, p.state]).join(", ");
          return { label: label || p.name || q, fullName: label, coordinates: f.geometry.coordinates };
        });
      if (out.length) return out;
    }
  } catch {
    // fall through to Nominatim
  }

  // ── Nominatim fallback ──
  try {
    const url = `${NOMINATIM_URL}/search?format=json&addressdetails=0&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter((h) => h?.lon && h?.lat)
      .map((h) => ({ label: shortLabel(h.display_name), fullName: h.display_name, coordinates: [parseFloat(h.lon), parseFloat(h.lat)] }));
  } catch {
    return [];
  }
}

/**
 * @param address free-text address
 * @returns [lng, lat] or null
 */
export async function geocodeAddress(address) {
  const full = String(address || "").trim();
  if (!full) return null;

  // 1) prefer a known Uttarakhand town named in the address — accurate, and avoids
  //    OSM picking the wrong same-named place (e.g. the wrong "Kosi").
  const town = townInAddress(full);
  if (town) return town.coordinates;

  // 2) OSM fallback: full → drop leading (most specific) comma parts one at a time
  const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
  const candidates = parts.length > 1 ? parts.map((_, i) => parts.slice(i).join(", ")) : [full];

  for (const q of candidates) {
    const hit = await geocodeOne(q);
    if (hit) return hit;
  }
  return null;
}
