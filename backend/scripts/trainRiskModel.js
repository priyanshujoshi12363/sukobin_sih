import dotenv from "dotenv";
import mongoose from "mongoose";
import RoadSegment from "../src/models/roadSegment.model.js";
import Incident from "../src/models/incident.model.js";
import { fetchDailyHistoryBatch } from "../src/ml/archive.js";
import { buildDataset, splitByDate } from "../src/ml/dataset.js";
import { trainLogreg, predictLogreg } from "../src/ml/logreg.js";
import { trainGbt, predictGbt } from "../src/ml/gbt.js";
import { evaluate, reliability } from "../src/ml/metrics.js";
import { saveModel, FEATURE_NAMES, HUMAN_LABEL } from "../src/ml/model.js";

dotenv.config();

const HORIZONS = [24, 48, 72];
const START = process.env.ML_TRAIN_START || "2024-04-01";
const END = process.env.ML_TRAIN_END || isoDaysAgo(10);

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function midpoint(segment) {
  const c = segment.geometry?.coordinates || [];
  if (!c.length) return null;
  return c[Math.floor(c.length / 2)];
}

const bar = (done, total) => {
  const w = 28;
  const filled = Math.round((done / total) * w);
  return `[${"#".repeat(filled)}${".".repeat(w - filled)}] ${done}/${total}`;
};

async function main() {
  console.log("\nSUKOBIN  risk model training\n");

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const segments = await RoadSegment.find({}).lean();
  console.log(`  segments        : ${segments.length}`);

  const incidents = await Incident.find({ status: { $in: ["VERIFIED", "RESOLVED"] } })
    .select("segmentId capturedAt")
    .lean();
  console.log(`  real incidents  : ${incidents.length}`);
  console.log(`  window          : ${START} -> ${END}`);

  const points = segments
    .map((s) => ({ key: s.segmentId, coordinates: midpoint(s) }))
    .filter((p) => p.coordinates);

  console.log("\n  fetching observed weather from open-meteo archive");
  let lastLine = 0;
  const histories = await fetchDailyHistoryBatch(points, START, END, {
    concurrency: 3,
    onProgress: ({ done, total, error, key }) => {
      if (error) console.log(`\n    ! ${key}: ${error}`);
      if (done - lastLine >= 3 || done === total) {
        process.stdout.write(`\r    ${bar(done, total)}`);
        lastLine = done;
      }
    },
  });
  process.stdout.write("\n");

  const ok = [...histories.values()].filter(Boolean);
  const days = ok.length ? ok[0].length : 0;
  console.log(`    ${ok.length}/${points.length} stretches, ${days} days each`);

  if (!ok.length) {
    console.error("\n  no weather history fetched, aborting");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\n  building dataset");
  const { X, y, meta, realPositives } = buildDataset(segments, histories, incidents, HORIZONS);
  const posRate = y.reduce((s, v) => s + v, 0) / y.length;
  console.log(`    rows            : ${X.length.toLocaleString()}`);
  console.log(`    features        : ${FEATURE_NAMES.length}`);
  console.log(`    disruption rate : ${(posRate * 100).toFixed(2)}%`);
  console.log(`    from real reports: ${realPositives}`);

  const { train, test, cutDate } = splitByDate(X, y, meta, 0.2);
  console.log(`    split at        : ${cutDate}  (train ${train.X.length.toLocaleString()} / test ${test.X.length.toLocaleString()})`);

  console.log("\n  training logistic regression");
  const logreg = trainLogreg(train.X, train.y);
  const logregTest = test.X.map((r) => predictLogreg(logreg, r));
  const logregMetrics = evaluate(test.y, logregTest);
  console.log(`    stopped epoch ${logreg.stoppedAtEpoch}   AUC ${logregMetrics.auc}   Brier ${logregMetrics.brier}`);

  console.log("\n  training gradient-boosted stumps");
  const gbt = trainGbt(train.X, train.y);
  const gbtTest = test.X.map((r) => predictGbt(gbt, r));
  const gbtMetrics = evaluate(test.y, gbtTest);
  console.log(`    ${gbt.trees.length} trees            AUC ${gbtMetrics.auc}   Brier ${gbtMetrics.brier}`);

  const chosen = gbtMetrics.auc > logregMetrics.auc + 0.005 ? "gbt" : "logreg";
  const metrics = chosen === "gbt" ? gbtMetrics : logregMetrics;
  const probs = chosen === "gbt" ? gbtTest : logregTest;

  console.log(`\n  chosen: ${chosen}  (ties go to the linear model, it explains itself better)`);

  console.log("\n  held-out performance");
  console.log(`    rows            : ${metrics.n.toLocaleString()}  (${metrics.positives} disruptions)`);
  console.log(`    AUC             : ${metrics.auc}`);
  console.log(`    Brier           : ${metrics.brier}`);
  console.log(`    log loss        : ${metrics.logLoss}`);
  console.log(`    accuracy        : ${metrics.accuracy}`);
  console.log(`    at p>=0.30      : precision ${metrics.at30.precision}  recall ${metrics.at30.recall}  F1 ${metrics.at30.f1}`);
  console.log(`    at p>=0.50      : precision ${metrics.at50.precision}  recall ${metrics.at50.recall}  F1 ${metrics.at50.f1}`);

  const rel = reliability(test.y, probs);
  console.log("\n  calibration (predicted vs what actually happened)");
  for (const r of rel) {
    console.log(`    ${r.bin}   predicted ${r.predicted.toFixed(3)}   observed ${r.observed.toFixed(3)}   n=${String(r.n).padStart(6)}`);
  }

  const perHorizon = {};
  for (const h of HORIZONS) {
    const idx = test.meta.map((m, i) => (m.horizonH === h ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const e = evaluate(idx.map((i) => test.y[i]), idx.map((i) => probs[i]));
    perHorizon[`h${h}`] = { auc: e.auc, brier: e.brier, n: e.n, positives: e.positives };
  }
  console.log("\n  by forecast horizon");
  for (const [k, v] of Object.entries(perHorizon)) {
    console.log(`    ${k.padEnd(5)} AUC ${v.auc}   Brier ${v.brier}   n=${v.n.toLocaleString()}`);
  }

  const artifact = {
    version: 2,
    chosen,
    trainedAt: new Date().toISOString(),
    horizons: HORIZONS,
    featureNames: FEATURE_NAMES,
    featureLabels: HUMAN_LABEL,
    dataset: {
      source: "open-meteo archive, observed hourly precipitation / snowfall / temperature",
      window: { start: START, end: END },
      segments: ok.length,
      daysPerSegment: days,
      rows: X.length,
      disruptionRate: +posRate.toFixed(4),
      realIncidentPositives: realPositives,
      splitDate: cutDate,
      labelNote:
        "Historical labels are Bernoulli draws from a rainfall-threshold hazard function " +
        "(antecedent wetness x triggering intensity x susceptibility). Verified field " +
        "reports override the drawn label. See src/ml/dataset.js.",
    },
    metrics: { ...metrics, perHorizon, reliability: rel },
    comparison: { logreg: logregMetrics, gbt: gbtMetrics },
    logreg,
    gbt,
  };

  saveModel(artifact);
  console.log(`\n  saved src/ml/model.json  (${(JSON.stringify(artifact).length / 1024).toFixed(0)} KB)\n`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("\ntraining failed:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
