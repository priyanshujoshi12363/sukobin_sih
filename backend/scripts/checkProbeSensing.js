import "dotenv/config";
import mongoose from "mongoose";
import RoadSegment from "../src/models/roadSegment.model.js";
import LocationPing from "../src/models/locationPing.model.js";
import Partner from "../src/models/partner.model.js";
import { ingestProbe, clearProbeRefreshCache } from "../src/utils/probeIngest.js";
import { probeVerdict } from "../src/utils/probes.js";

const SEGMENT_ID = process.env.PROBE_TEST_SEGMENT || "NH27-SILIGURI-GUWAHATI::BONGAIGAON-BARPETA";

function pointOn(segment, t) {
  const c = segment.geometry.coordinates;
  const i = Math.min(c.length - 1, Math.max(0, Math.floor(t * (c.length - 1))));
  return c[i];
}

async function drive(segment, partners, speedKmph, label) {
  clearProbeRefreshCache();
  let last = null;

  for (let step = 0; step < 6; step++) {
    for (const p of partners) {
      last = await ingestProbe(p, {
        coordinates: pointOn(segment, 0.15 + step * 0.12),
        speedKmph,
        accuracyM: 12,
        onTrip: true,
      });
    }
    clearProbeRefreshCache();
  }

  const fresh = await RoadSegment.findOne({ segmentId: segment.segmentId });
  const verdict = probeVerdict(fresh);

  console.log(
    `  ${label.padEnd(26)} median ${String(fresh.probe?.medianSpeedKmph ?? "-").padStart(5)} km/h  ` +
      `ratio ${String(fresh.probe?.speedRatio ?? "-").padStart(5)}  ` +
      `vehicles ${fresh.probe?.distinctVehicles ?? 0}  ` +
      `-> ${fresh.status}${verdict ? `  (${verdict.status} @ ${verdict.confidence})` : ""}`
  );

  return fresh;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const segment = await RoadSegment.findOne({ segmentId: SEGMENT_ID });
  if (!segment) {
    console.error("segment not found:", SEGMENT_ID);
    process.exit(1);
  }

  console.log(`Probe-vehicle sensing on: ${segment.name}`);
  console.log(`baseline ${segment.baselineSpeedKmph} km/h, ${segment.lengthKm} km, status ${segment.status}\n`);

  const fakePartners = [];
  for (let i = 0; i < 4; i++) {
    fakePartners.push({
      _id: new mongoose.Types.ObjectId(),
      vehicleType: ["car", "truck", "pickup", "car"][i],
    });
  }

  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });

  console.log("simulating traffic:");
  await drive(segment, fakePartners, segment.baselineSpeedKmph * 0.95, "normal flow");

  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });
  await drive(segment, fakePartners, segment.baselineSpeedKmph * 0.5, "slowing");

  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });
  await drive(segment, fakePartners, segment.baselineSpeedKmph * 0.25, "heavy congestion");

  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });
  const stopped = await drive(segment, fakePartners, segment.baselineSpeedKmph * 0.08, "traffic stopped");

  console.log("\nsingle-vehicle guard (one driver parked should NOT close a highway):");
  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });
  clearProbeRefreshCache();
  for (let step = 0; step < 6; step++) {
    await ingestProbe(fakePartners[0], {
      coordinates: pointOn(segment, 0.4),
      speedKmph: 1,
      accuracyM: 10,
      onTrip: true,
    });
    clearProbeRefreshCache();
  }
  const one = await RoadSegment.findOne({ segmentId: SEGMENT_ID });
  console.log(
    `  1 vehicle at 1 km/h        vehicles ${one.probe?.distinctVehicles}  ratio ${one.probe?.speedRatio}  -> ${one.status}` +
      `  ${one.probe?.speedRatio === null ? "(insufficient evidence, correctly ignored)" : ""}`
  );

  console.log("\npoor-GPS rejection:");
  const rejected = await ingestProbe(fakePartners[0], {
    coordinates: pointOn(segment, 0.5),
    speedKmph: 3,
    accuracyM: 400,
  });
  console.log("  accuracy 400 m ->", JSON.stringify(rejected));

  await LocationPing.deleteMany({ segmentId: SEGMENT_ID });
  const reset = await RoadSegment.findOne({ segmentId: SEGMENT_ID });
  reset.probe = {
    medianSpeedKmph: null,
    speedRatio: null,
    sampleCount: 0,
    distinctVehicles: 0,
    windowMinutes: 0,
    updatedAt: new Date(),
  };
  reset.applyStatus({ status: "UNKNOWN", source: "SEED", note: "test data cleared" });
  await reset.save();
  console.log("\ntest pings cleared, segment reset to", reset.status);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
