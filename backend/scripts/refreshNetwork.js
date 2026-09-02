import "dotenv/config";
import mongoose from "mongoose";
import RoadSegment from "../src/models/roadSegment.model.js";
import { refreshAllSegments } from "../src/utils/accessibility.js";

const bar = (score) => "#".repeat(Math.round(score * 20)).padEnd(20, ".");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const t0 = Date.now();
  const result = await refreshAllSegments({ withWeather: true, concurrency: 5 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(
    `refreshed ${result.total} segments in ${secs}s  (status changes ${result.changed}, blocked ${result.blocked}, errors ${result.errors})\n`
  );

  const byStatus = await RoadSegment.aggregate([
    { $group: { _id: "$status", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  console.log("status distribution");
  for (const s of byStatus) console.log(`  ${String(s._id).padEnd(12)} ${s.n}`);

  const byLevel = await RoadSegment.aggregate([
    { $group: { _id: "$risk.level", n: { $sum: 1 } } },
  ]);
  const order = { SEVERE: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
  byLevel.sort((a, b) => (order[a._id] ?? 9) - (order[b._id] ?? 9));
  console.log("\nrisk level distribution");
  for (const s of byLevel) console.log(`  ${String(s._id).padEnd(12)} ${s.n}`);

  const top = await RoadSegment.find({})
    .sort({ "risk.score": -1 })
    .limit(10)
    .select("name risk status lifelineFor isChokepoint terrain");

  console.log("\nhighest-risk segments right now");
  for (const s of top) {
    const d = s.risk?.drivers?.[0];
    console.log(
      `  ${bar(s.risk?.score || 0)} ${(s.risk?.score || 0).toFixed(3)}  ${String(s.risk?.level).padEnd(9)} ${s.name}`
    );
    console.log(
      `  ${" ".repeat(20)}         ${s.terrain}${s.isChokepoint ? ", chokepoint" : ""}${s.lifelineFor?.length ? `, lifeline for ${s.lifelineFor.join("/")}` : ""}`
    );
    if (d) console.log(`  ${" ".repeat(20)}         driver: ${d.factor} ${d.detail}`);
  }

  const districts = await RoadSegment.aggregate([
    { $unwind: "$districts" },
    {
      $group: {
        _id: "$districts",
        maxRisk: { $max: "$risk.score" },
        blocked: { $sum: { $cond: [{ $eq: ["$status", "BLOCKED"] }, 1, 0] } },
        segments: { $sum: 1 },
        km: { $sum: "$lengthKm" },
      },
    },
    { $sort: { maxRisk: -1 } },
    { $limit: 8 },
  ]);

  console.log("\ndistrict roll-up (what the dashboard colours)");
  for (const d of districts) {
    console.log(
      `  ${String(d._id).padEnd(24)} risk ${d.maxRisk.toFixed(3)}  ${String(d.segments).padStart(2)} segments  ${d.km.toFixed(0).padStart(4)} km  blocked ${d.blocked}`
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
