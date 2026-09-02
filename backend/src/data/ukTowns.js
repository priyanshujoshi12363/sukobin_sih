// Uttarakhand towns/cities across all 13 districts — the searchable network for the
// driver's route type-bar + town-based matching. coordinates are [lng, lat].
// Approximate town-centre coords; easy to refine. Add Himachal / NE lists later.

export const UK_TOWNS = [
  // ── Dehradun ──
  { name: "Dehradun", district: "Dehradun", coordinates: [78.0322, 30.3165] },
  { name: "Mussoorie", district: "Dehradun", coordinates: [78.0801, 30.4598] },
  { name: "Rishikesh", district: "Dehradun", coordinates: [78.2676, 30.0869] },
  { name: "Vikasnagar", district: "Dehradun", coordinates: [77.7739, 30.4690] },
  { name: "Doiwala", district: "Dehradun", coordinates: [78.1167, 30.1833] },
  { name: "Herbertpur", district: "Dehradun", coordinates: [77.7333, 30.4500] },
  { name: "Chakrata", district: "Dehradun", coordinates: [77.8667, 30.7000] },
  { name: "Sahaspur", district: "Dehradun", coordinates: [77.9333, 30.3667] },

  // ── Haridwar ──
  { name: "Haridwar", district: "Haridwar", coordinates: [78.1642, 29.9457] },
  { name: "Roorkee", district: "Haridwar", coordinates: [77.8880, 29.8543] },
  { name: "Laksar", district: "Haridwar", coordinates: [78.0411, 29.7560] },
  { name: "Manglaur", district: "Haridwar", coordinates: [77.8742, 29.7920] },
  { name: "Bhagwanpur", district: "Haridwar", coordinates: [77.7500, 29.9333] },
  { name: "Jwalapur", district: "Haridwar", coordinates: [78.1333, 29.9167] },

  // ── Nainital ──
  { name: "Nainital", district: "Nainital", coordinates: [79.4542, 29.3919] },
  { name: "Haldwani", district: "Nainital", coordinates: [79.5130, 29.2183] },
  { name: "Kathgodam", district: "Nainital", coordinates: [79.5390, 29.2745] },
  { name: "Bhimtal", district: "Nainital", coordinates: [79.5610, 29.3450] },
  { name: "Bhowali", district: "Nainital", coordinates: [79.5050, 29.3895] },
  { name: "Ramnagar", district: "Nainital", coordinates: [79.1300, 29.3940] },
  { name: "Kaladhungi", district: "Nainital", coordinates: [79.3500, 29.2833] },
  { name: "Lalkuan", district: "Nainital", coordinates: [79.5167, 29.0667] },
  { name: "Mukteshwar", district: "Nainital", coordinates: [79.6500, 29.4733] },
  { name: "Kainchi Dham", district: "Nainital", coordinates: [79.5106, 29.4239] },

  // ── Almora ──
  { name: "Almora", district: "Almora", coordinates: [79.6593, 29.5971] },
  { name: "Ranikhet", district: "Almora", coordinates: [79.4322, 29.6434] },
  { name: "Dwarahat", district: "Almora", coordinates: [79.4256, 29.7783] },
  { name: "Kausani", district: "Almora", coordinates: [79.6044, 29.8408] },
  { name: "Someshwar", district: "Almora", coordinates: [79.5667, 29.7333] },
  { name: "Chaukhutia", district: "Almora", coordinates: [79.3500, 29.8833] },
  { name: "Bhikiyasain", district: "Almora", coordinates: [79.3000, 29.7333] },
  { name: "Kosi", district: "Almora", coordinates: [79.6264, 29.6341] },
  { name: "Jageshwar", district: "Almora", coordinates: [79.8533, 29.6383] },

  // ── Bageshwar ──
  { name: "Bageshwar", district: "Bageshwar", coordinates: [79.7714, 29.8370] },
  { name: "Kapkot", district: "Bageshwar", coordinates: [79.9000, 29.9333] },
  { name: "Kanda", district: "Bageshwar", coordinates: [79.7833, 29.8167] },

  // ── Pithoragarh ──
  { name: "Pithoragarh", district: "Pithoragarh", coordinates: [80.2179, 29.5829] },
  { name: "Dharchula", district: "Pithoragarh", coordinates: [80.5500, 29.8500] },
  { name: "Munsiyari", district: "Pithoragarh", coordinates: [80.2389, 30.0686] },
  { name: "Gangolihat", district: "Pithoragarh", coordinates: [80.0167, 29.6500] },
  { name: "Berinag", district: "Pithoragarh", coordinates: [80.0667, 29.7833] },
  { name: "Didihat", district: "Pithoragarh", coordinates: [80.3167, 29.7667] },

  // ── Champawat ──
  { name: "Champawat", district: "Champawat", coordinates: [80.0917, 29.3361] },
  { name: "Tanakpur", district: "Champawat", coordinates: [80.1100, 29.0739] },
  { name: "Lohaghat", district: "Champawat", coordinates: [80.0889, 29.4053] },
  { name: "Banbasa", district: "Champawat", coordinates: [80.0833, 28.9833] },

  // ── Udham Singh Nagar ──
  { name: "Rudrapur", district: "Udham Singh Nagar", coordinates: [79.4083, 28.9810] },
  { name: "Kashipur", district: "Udham Singh Nagar", coordinates: [78.9560, 29.2104] },
  { name: "Jaspur", district: "Udham Singh Nagar", coordinates: [78.8167, 29.2833] },
  { name: "Bazpur", district: "Udham Singh Nagar", coordinates: [79.1167, 29.1530] },
  { name: "Kichha", district: "Udham Singh Nagar", coordinates: [79.5167, 28.9167] },
  { name: "Sitarganj", district: "Udham Singh Nagar", coordinates: [79.7000, 28.9333] },
  { name: "Khatima", district: "Udham Singh Nagar", coordinates: [79.9700, 28.9200] },
  { name: "Gadarpur", district: "Udham Singh Nagar", coordinates: [79.4667, 29.0500] },

  // ── Tehri Garhwal ──
  { name: "New Tehri", district: "Tehri Garhwal", coordinates: [78.4803, 30.3772] },
  { name: "Chamba", district: "Tehri Garhwal", coordinates: [78.3919, 30.3417] },
  { name: "Narendranagar", district: "Tehri Garhwal", coordinates: [78.2833, 30.1667] },
  { name: "Devprayag", district: "Tehri Garhwal", coordinates: [78.5983, 30.1469] },
  { name: "Ghansali", district: "Tehri Garhwal", coordinates: [78.6500, 30.4333] },

  // ── Pauri Garhwal ──
  { name: "Pauri", district: "Pauri Garhwal", coordinates: [78.7800, 30.1500] },
  { name: "Kotdwar", district: "Pauri Garhwal", coordinates: [78.5222, 29.7450] },
  { name: "Srinagar", district: "Pauri Garhwal", coordinates: [78.7833, 30.2225] },
  { name: "Lansdowne", district: "Pauri Garhwal", coordinates: [78.6833, 29.8400] },
  { name: "Dugadda", district: "Pauri Garhwal", coordinates: [78.5333, 29.8000] },

  // ── Rudraprayag ──
  { name: "Rudraprayag", district: "Rudraprayag", coordinates: [78.9811, 30.2844] },
  { name: "Ukhimath", district: "Rudraprayag", coordinates: [79.0833, 30.5167] },
  { name: "Agastyamuni", district: "Rudraprayag", coordinates: [79.0333, 30.3833] },
  { name: "Guptkashi", district: "Rudraprayag", coordinates: [79.0750, 30.5230] },
  { name: "Kedarnath", district: "Rudraprayag", coordinates: [79.0669, 30.7346] },

  // ── Chamoli ──
  { name: "Gopeshwar", district: "Chamoli", coordinates: [79.3167, 30.4000] },
  { name: "Joshimath", district: "Chamoli", coordinates: [79.5667, 30.5550] },
  { name: "Karnaprayag", district: "Chamoli", coordinates: [79.2167, 30.2667] },
  { name: "Gairsain", district: "Chamoli", coordinates: [79.2833, 30.0667] },
  { name: "Badrinath", district: "Chamoli", coordinates: [79.4938, 30.7433] },
  { name: "Tharali", district: "Chamoli", coordinates: [79.5500, 30.0500] },

  // ── Uttarkashi ──
  { name: "Uttarkashi", district: "Uttarkashi", coordinates: [78.4500, 30.7300] },
  { name: "Barkot", district: "Uttarkashi", coordinates: [78.2000, 30.8089] },
  { name: "Chinyalisaur", district: "Uttarkashi", coordinates: [78.3333, 30.5667] },
  { name: "Gangotri", district: "Uttarkashi", coordinates: [78.9417, 30.9947] },
];

const norm = (s) => String(s || "").trim().toLowerCase();

// A city is an AREA, not a point. Pickups/drops anywhere inside the origin/destination
// city should match (even on the far edge), so each city gets a radius. Big sprawling
// plains cities get a generous radius; smaller hill towns a tighter one.
const BIG_CITY_RADIUS_KM = Number(process.env.BIG_CITY_RADIUS_KM) || 15;
const TOWN_RADIUS_KM = Number(process.env.TOWN_RADIUS_KM) || 7;
const BIG_CITIES = new Set([
  "haldwani", "kathgodam", "dehradun", "haridwar", "roorkee",
  "rishikesh", "rudrapur", "kashipur",
]);

// radius (km) covering the whole city, keyed by town name (e.g. "Haldwani" → 15)
export const cityRadiusKm = (name) =>
  BIG_CITIES.has(norm(name)) ? BIG_CITY_RADIUS_KM : TOWN_RADIUS_KM;

// haversine km between two [lng,lat]
const km = (a, b) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Type-bar search: prefix matches first, then substring on name/district.
export function searchTowns(query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const starts = [], contains = [];
  for (const t of UK_TOWNS) {
    const n = norm(t.name);
    if (n.startsWith(q)) starts.push(t);
    else if (n.includes(q) || norm(t.district).includes(q)) contains.push(t);
  }
  return [...starts, ...contains].slice(0, limit).map((t) => ({
    label: `${t.name}, ${t.district}`,
    coordinates: t.coordinates,
  }));
}

// Find the most specific known town NAMED inside a free-text address.
// "house 12, bithoria, haldwani" → Haldwani ; "kosi, uttarakhand" → Kosi (the right one).
export function townInAddress(address) {
  const a = " " + norm(address).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  if (a.trim().length === 0) return null;
  let best = null;
  for (const t of UK_TOWNS) {
    const n = norm(t.name);
    if (a.includes(" " + n + " ")) {
      if (!best || n.length > norm(best.name).length) best = t; // prefer longest/most specific
    }
  }
  return best;
}

// Nearest town to a coordinate (used to snap a parcel's pickup/drop for display/labels).
export function nearestTown(coords, maxKm = Infinity) {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  let best = null, bestD = Infinity;
  for (const t of UK_TOWNS) {
    const d = km(coords, t.coordinates);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best && bestD <= maxKm ? { ...best, distanceKm: +bestD.toFixed(1) } : null;
}
