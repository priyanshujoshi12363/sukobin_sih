import "dotenv/config";
import mongoose from "mongoose";
import { NER_CORRIDORS, townByName } from "../src/data/nerNetwork.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import { fetchRoutePolyline } from "../src/utils/routing.js";

const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";

const TERRAIN_ELEVATION_FALLBACK = {
  plain: 90,
  hill: 450,
  mountain: 1200,
  "high-mountain": 2800,
};

const TERRAIN_FAILURE_PRIOR = {
  plain: 0.08,
  hill: 0.18,
  mountain: 0.32,
  "high-mountain": 0.45,
};

const slug = (s) =>
  String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

async function fetchElevations(points) {
  try {
    const lat = points.map((p) => p[1]).join(",");
    const lng = points.map((p) => p[0]).join(",");
    const res = await fetch(`${ELEVATION_URL}?latitude=${lat}&longitude=${lng}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (Array.isArray(data?.elevation) && data.elevation.length === points.length) {
      return data.elevation;
    }
  } catch {}
  return null;
}

function hazardFor({ corridor, elevationM, slopeDeg, isChokepoint }) {
  const t = corridor.terrain;
  const mountainous = t === "mountain" || t === "high-mountain";
  const base = TERRAIN_FAILURE_PRIOR[t] ?? 0.18;

  return {
    landslideProne: mountainous || /landslide/i.test(corridor.chokepoint || ""),
    floodProne: t === "plain" || /flood|inundat|river|erosion/i.test(corridor.chokepoint || ""),
    snowProne: t === "high-mountain" || elevationM > 2200 || /snow/i.test(corridor.chokepoint || ""),
    historicalFailureRate: Math.min(1, base + (isChokepoint ? 0.25 : 0)),
    avgSlopeDeg: +slopeDeg.toFixed(1),
    elevationM: Math.round(elevationM),
  };
}

async function buildCorridor(corridor) {
  const towns = corridor.via.map((n) => {
    const t = townByName(n);
    if (!t) throw new Error(`unknown town "${n}" in ${corridor.code}`);
    return t;
  });

  const elevations =
    (await fetchElevations(towns.map((t) => t.coordinates))) ||
    towns.map(() => TERRAIN_ELEVATION_FALLBACK[corridor.terrain] ?? 450);

  const built = [];

  for (let i = 0; i < towns.length - 1; i++) {
    const a = towns[i];
    const b = towns[i + 1];
    const segmentId = `${corridor.code}::${slug(a.name)}-${slug(b.name)}`;

    const route = await fetchRoutePolyline([a.coordinates, b.coordinates]);
    const lengthKm = route.distanceKm || 0;

    const chokeText = corridor.chokepoint || "";
    const isChokepoint =
      chokeText.toLowerCase().includes(a.name.toLowerCase()) ||
      chokeText.toLowerCase().includes(b.name.toLowerCase());

    const elevA = elevations[i];
    const elevB = elevations[i + 1];
    const meanElev = (elevA + elevB) / 2;
    const slopeDeg =
      lengthKm > 0 ? (Math.atan(Math.abs(elevB - elevA) / (lengthKm * 1000)) * 180) / Math.PI : 0;

    const districts = [...new Set([a.district, b.district])];
    const states = [...new Set([a.state, b.state])];

    const doc = {
      segmentId,
      corridorCode: corridor.code,
      name: `${a.name} - ${b.name} (${corridor.highway})`,
      geometry: { type: "LineString", coordinates: route.polyline },
      from: { name: a.name, coordinates: a.coordinates },
      to: { name: b.name, coordinates: b.coordinates },
      lengthKm,
      kind: corridor.terrain === "high-mountain" && meanElev > 3500 ? "PASS" : "ROAD",
      terrain: corridor.terrain,
      districts,
      states,
      baselineSpeedKmph: corridor.baselineSpeedKmph,
      hazard: hazardFor({ corridor, elevationM: meanElev, slopeDeg, isChokepoint }),
      lifelineFor: corridor.lifelineFor || [],
      isChokepoint,
      chokepointNote: isChokepoint ? chokeText : undefined,
      status: "UNKNOWN",
      statusSource: "SEED",
    };

    await RoadSegment.findOneAndUpdate(
      { segmentId },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    built.push({ segmentId, lengthKm, source: route.source, isChokepoint });
    process.stdout.write(
      `  ${route.source === "osrm" ? "road" : "line"}  ${lengthKm.toFixed(1).padStart(6)} km  ${segmentId}${isChokepoint ? "  [chokepoint]" : ""}\n`
    );
  }

  return built;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("connected\n");

  let total = 0;
  let osrmCount = 0;
  let chokepoints = 0;

  for (const corridor of NER_CORRIDORS) {
    console.log(`${corridor.code}  (${corridor.name})`);
    try {
      const built = await buildCorridor(corridor);
      total += built.length;
      osrmCount += built.filter((b) => b.source === "osrm").length;
      chokepoints += built.filter((b) => b.isChokepoint).length;
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
    console.log("");
  }

  const inDb = await RoadSegment.countDocuments();
  const totalKm = await RoadSegment.aggregate([
    { $group: { _id: null, km: { $sum: "$lengthKm" } } },
  ]);

  console.log("─".repeat(60));
  console.log(`segments built     ${total}`);
  console.log(`on real road data  ${osrmCount}/${total}`);
  console.log(`chokepoints        ${chokepoints}`);
  console.log(`segments in db     ${inDb}`);
  console.log(`network length     ${(totalKm[0]?.km || 0).toFixed(0)} km`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
