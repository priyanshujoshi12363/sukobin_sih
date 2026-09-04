import dotenv from "dotenv";
import mongoose from "mongoose";
import { refreshForecasts, upcomingRisk } from "../src/utils/forecast.js";
import { modelInfo, featureImportance } from "../src/ml/model.js";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

const info = modelInfo();
console.log("\nMODEL");
console.log("  chosen     :", info.chosen);
console.log("  trained    :", info.trainedAt);
console.log("  AUC        :", info.metrics.auc, " Brier:", info.metrics.brier);
console.log("  rows       :", info.dataset.rows.toLocaleString(), "from", info.dataset.segments, "stretches x", info.dataset.daysPerSegment, "days");

console.log("\nTOP FEATURES");
for (const f of featureImportance().slice(0, 8)) {
  console.log(`  ${String(f.weight.toFixed(3)).padStart(6)}  ${f.label}`);
}

console.log("\nSCORING LIVE FORECAST");
const t0 = Date.now();
const r = await refreshForecasts();
console.log("  ok:", r.ok, "| scored:", r.scored, "| weather failures:", r.weatherFailures, "| took", ((Date.now()-t0)/1000).toFixed(1)+"s");
console.log("  by level:", JSON.stringify(r.byLevel));

console.log("\n  highest 72h risk");
for (const s of r.top.slice(0, 10)) {
  console.log(`    ${String(Math.round((s.h72??0)*100)).padStart(3)}%  ${s.level.padEnd(8)} ${s.name}`);
}

const up = await upcomingRisk({ minProbability: 0.35, limit: 6 });
console.log("\nALERT-WORTHY (p >= 0.35)");
for (const s of up) {
  console.log(`  ${s.name}`);
  console.log(`    peak ${Math.round(s.peakProbability*100)}% within ${s.firstBreachH}h | 24h ${pc(s.h24)} 48h ${pc(s.h48)} 72h ${pc(s.h72)}${s.isChokepoint ? " | CHOKEPOINT" : ""}`);
  if (s.drivers.length) console.log(`    why: ${s.drivers.map(d=>d.factor).join(", ")}`);
}
function pc(v){ return v===null||v===undefined ? "-" : Math.round(v*100)+"%"; }

await mongoose.disconnect();
