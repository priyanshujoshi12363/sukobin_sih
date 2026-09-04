import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FEATURE_NAMES, HUMAN_LABEL, buildRow } from "./features.js";
import { predictLogreg, explainLogreg, applyScaler } from "./logreg.js";
import { predictGbt, explainGbt } from "./gbt.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT = path.join(here, "model.json");

export const RISK_BANDS = [
  { min: 0.6, level: "SEVERE" },
  { min: 0.35, level: "HIGH" },
  { min: 0.15, level: "MODERATE" },
  { min: 0, level: "LOW" },
];

export const bandFor = (p) => RISK_BANDS.find((b) => p >= b.min).level;

let cached = null;
let loadedAt = 0;

export function loadModel({ force = false } = {}) {
  if (cached && !force) return cached;
  if (!fs.existsSync(ARTIFACT)) return null;
  try {
    cached = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
    loadedAt = Date.now();
    return cached;
  } catch {
    return null;
  }
}

export function saveModel(artifact) {
  fs.writeFileSync(ARTIFACT, JSON.stringify(artifact, null, 2));
  cached = artifact;
  loadedAt = Date.now();
}

export function modelInfo() {
  const m = loadModel();
  if (!m) return { available: false };
  return {
    available: true,
    chosen: m.chosen,
    trainedAt: m.trainedAt,
    features: FEATURE_NAMES.length,
    horizons: m.horizons,
    dataset: m.dataset,
    metrics: m.metrics,
    comparison: m.comparison,
    loadedAt: new Date(loadedAt),
  };
}

function rawPredict(m, row) {
  return m.chosen === "gbt" ? predictGbt(m.gbt, row) : predictLogreg(m.logreg, row);
}

function rawExplain(m, row) {
  if (m.chosen === "gbt") return explainGbt(m.gbt, row);
  return explainLogreg(m.logreg, row);
}

/**
 * @param segment  RoadSegment-shaped object
 * @param window   { rainPast24Mm, rainPast72Mm, rainHorizonMm, maxHourlyHorizonMm,
 *                   snowHorizonCm, freezeHours }
 * @param horizonH hours ahead
 */
export function predict(segment, window, horizonH, month = new Date().getMonth() + 1) {
  const m = loadModel();
  if (!m) return null;

  const row = buildRow(segment, window, horizonH, month);
  const p = rawPredict(m, row);
  const contrib = rawExplain(m, row);

  const drivers = FEATURE_NAMES.map((name, j) => ({
    feature: name,
    factor: HUMAN_LABEL[name] || name,
    contribution: +contrib[j].toFixed(4),
    value: +row[j].toFixed(4),
  }))
    .filter((d) => d.contribution > 0.04 && d.value > 0.02)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);

  return {
    probability: +p.toFixed(4),
    level: bandFor(p),
    drivers,
    horizonH,
  };
}

export function predictHorizons(segment, windows, month = new Date().getMonth() + 1) {
  const out = {};
  for (const [horizonH, window] of Object.entries(windows)) {
    const r = predict(segment, window, Number(horizonH), month);
    if (r) out[`h${horizonH}`] = r;
  }
  return out;
}

// Feature importance for the model card. For the linear model this is |w|
// scaled by the feature's spread; for the ensemble it is total leaf movement.
export function featureImportance() {
  const m = loadModel();
  if (!m) return [];

  let scores;
  if (m.chosen === "gbt") {
    scores = new Array(FEATURE_NAMES.length).fill(0);
    for (const t of m.gbt.trees) scores[t.feature] += Math.abs(t.left) + Math.abs(t.right);
  } else {
    scores = m.logreg.weights.map((w) => Math.abs(w));
  }

  const total = scores.reduce((s, v) => s + v, 0) || 1;
  return FEATURE_NAMES.map((name, j) => ({
    feature: name,
    label: HUMAN_LABEL[name] || name,
    weight: +(scores[j] / total).toFixed(4),
  }))
    .sort((a, b) => b.weight - a.weight)
    .filter((d) => d.weight > 0.001);
}

export { FEATURE_NAMES, HUMAN_LABEL, applyScaler };
