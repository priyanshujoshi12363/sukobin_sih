import dotenv from "dotenv";
import mongoose from "mongoose";
import RoadSegment from "../src/models/roadSegment.model.js";
import Partner from "../src/models/partner.model.js";
import LocationPing from "../src/models/locationPing.model.js";
import { refreshSegmentProbe, PROBE_WINDOW_MIN } from "../src/utils/probes.js";
import { resolveStatus, activeIncidentsFor } from "../src/utils/accessibility.js";
import { haversineKm } from "../src/utils/geo.js";

dotenv.config();

/**
 * Drives simulated vehicles along the real road geometry so the accessibility
 * layer has something to sense.
 *
 * This is a demo and load-testing tool, not part of the product. Every vehicle
 * it creates is named SIM-* and every ping it writes is tagged, so
 * `node scripts/simulateTraffic.js --clear` removes all of it. Nothing here
 * runs on the server.
 *
 *   node scripts/simulateTraffic.js                  normal traffic everywhere
 *   node scripts/simulateTraffic.js --slow NH2-...   one stretch grinds to a halt
 *   node scripts/simulateTraffic.js --clear          remove all simulated data
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const VEHICLES_PER_SEGMENT = Number(value("--vehicles")) || 3;
const PINGS_PER_VEHICLE = Number(value("--pings")) || 8;
const SLOW_SEGMENT = value("--slow");
const SLOW_FACTOR = Number(value("--factor")) || 0.12;

const SIM_PREFIX = "SIM";

function interpolate(line, t) {
  if (line.length < 2) return line[0];
  const idx = Math.min(line.length - 2, Math.floor(t * (line.length - 1)));
  const local = t * (line.length - 1) - idx;
  const [x1, y1] = line[idx];
  const [x2, y2] = line[idx + 1];
  return [x1 + (x2 - x1) * local, y1 + (y2 - y1) * local];
}

// A little jitter keeps every vehicle from sitting on the exact centreline,
// which is what real GPS looks like and what the matcher has to cope with.
const jitter = (m) => (Math.random() - 0.5) * (m / 111_000);

async function ensureVehicles(count) {
  const existing = await Partner.find({ vehicleNumber: new RegExp(`^${SIM_PREFIX}`) });
  if (existing.length >= count) return existing.slice(0, count);

  const made = [...existing];
  const types = ["bike", "car", "pickup", "truck"];

  for (let i = existing.length; i < count; i++) {
    const number = `${SIM_PREFIX}${String(i + 1).padStart(4, "0")}`;
    made.push(
      await Partner.create({
        name: `Simulated driver ${i + 1}`,
        phone: `7${String(700000000 + i).slice(0, 9)}`,
        vehicleNumber: number,
        vehicleType: types[i % types.length],
        isOnline: true,
        isVerified: true,
      })
    );
  }
  return made;
}

async function clearAll() {
  const partners = await Partner.find({ vehicleNumber: new RegExp(`^${SIM_PREFIX}`) }).select("_id");
  const ids = partners.map((p) => p._id);

  const pings = await LocationPing.deleteMany({ partner: { $in: ids } });
  const removed = await Partner.deleteMany({ _id: { $in: ids } });

  // Reset anything whose status came only from simulated vehicles.
  const segments = await RoadSegment.find({ statusSource: "PROBE" });
  for (const s of segments) {
    await refreshSegmentProbe(s, PROBE_WINDOW_MIN);
    const incidents = await activeIncidentsFor(s.segmentId);
    const resolved = resolveStatus({ segment: s, incidents });
    s.applyStatus({ status: resolved.status, source: resolved.source, note: resolved.note });
    await s.save();
  }

  console.log(`  removed ${removed.deletedCount} simulated vehicles and ${pings.deletedCount} pings`);
  console.log(`  reset ${segments.length} segments that were probe-derived`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  if (flag("--clear")) {
    console.log("\nclearing simulated traffic\n");
    await clearAll();
    await mongoose.disconnect();
    return;
  }

  const segments = await RoadSegment.find({}).select(
    "segmentId name geometry baselineSpeedKmph lengthKm status"
  );

  console.log(`\nsimulating traffic on ${segments.length} stretches`);
  console.log(`  ${VEHICLES_PER_SEGMENT} vehicles x ${PINGS_PER_VEHICLE} pings each`);
  if (SLOW_SEGMENT) console.log(`  holding ${SLOW_SEGMENT} at ${Math.round(SLOW_FACTOR * 100)}% of normal speed`);

  const fleet = await ensureVehicles(VEHICLES_PER_SEGMENT * 2);
  console.log(`  fleet of ${fleet.length} simulated vehicles\n`);

  const now = Date.now();
  const docs = [];

  for (const seg of segments) {
    const line = seg.geometry?.coordinates || [];
    if (line.length < 2) continue;

    const base = seg.baselineSpeedKmph || 30;
    const slowed = SLOW_SEGMENT && seg.segmentId === SLOW_SEGMENT;

    for (let v = 0; v < VEHICLES_PER_SEGMENT; v++) {
      const partner = fleet[(v + segments.indexOf(seg)) % fleet.length];
      const start = Math.random() * 0.5;

      for (let p = 0; p < PINGS_PER_VEHICLE; p++) {
        const t = Math.min(1, start + (p / PINGS_PER_VEHICLE) * 0.45);
        const [lng, lat] = interpolate(line, t);

        // Real speeds scatter around the baseline; a blocked stretch does not.
        const speed = slowed
          ? base * SLOW_FACTOR * (0.7 + Math.random() * 0.6)
          : base * (0.82 + Math.random() * 0.36);

        docs.push({
          partner: partner._id,
          vehicleType: partner.vehicleType,
          location: { type: "Point", coordinates: [lng + jitter(25), lat + jitter(25)] },
          speedKmph: +speed.toFixed(1),
          accuracyM: 8 + Math.random() * 20,
          onTrip: true,
          at: new Date(now - (PINGS_PER_VEHICLE - p) * 3 * 60000),
          segmentId: seg.segmentId,
        });
      }
    }
  }

  await LocationPing.insertMany(docs, { ordered: false });
  console.log(`  wrote ${docs.length} pings`);

  console.log("\n  recomputing accessibility from what the vehicles saw");
  const changes = [];

  for (const seg of segments) {
    const full = await RoadSegment.findOne({ segmentId: seg.segmentId });
    if (!full) continue;

    const before = full.status;
    await refreshSegmentProbe(full, PROBE_WINDOW_MIN);

    const incidents = await activeIncidentsFor(full.segmentId);
    const resolved = resolveStatus({ segment: full, incidents });
    full.applyStatus({ status: resolved.status, source: resolved.source, note: resolved.note });
    await full.save();

    if (before !== full.status) {
      changes.push({
        name: full.name,
        from: before,
        to: full.status,
        speed: full.probe?.medianSpeedKmph,
        base: full.baselineSpeedKmph,
        vehicles: full.probe?.distinctVehicles,
      });
    }
  }

  const after = await RoadSegment.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  console.log(`\n  status now: ${after.map((r) => `${r._id} ${r.n}`).join(", ")}`);

  console.log(`\n  ${changes.length} stretches changed status`);
  for (const c of changes.slice(0, 12)) {
    console.log(
      `    ${c.from} -> ${String(c.to).padEnd(11)} ${c.name}  (${c.speed} vs ${c.base} km/h, ${c.vehicles} vehicles)`
    );
  }

  console.log("");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("simulation failed:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
