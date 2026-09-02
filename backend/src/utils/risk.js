import { RISK_LEVEL } from "../models/roadSegment.model.js";

const TERRAIN_RAIN_TOLERANCE_MM = {
  plain: 250,
  hill: 200,
  mountain: 150,
  "high-mountain": 120,
};

const TERRAIN_BASE = {
  plain: 0.05,
  hill: 0.15,
  mountain: 0.25,
  "high-mountain": 0.4,
};

export const RISK_WEIGHTS = {
  rain72h: Number(process.env.RISK_W_RAIN72) || 1.3,
  rain24h: Number(process.env.RISK_W_RAIN24) || 0.9,
  rainBurst: Number(process.env.RISK_W_BURST) || 0.8,
  rainForecast: Number(process.env.RISK_W_FORECAST) || 0.6,
  snow: Number(process.env.RISK_W_SNOW) || 2.5,
  probeAnomaly: Number(process.env.RISK_W_PROBE) || 3.0,
  recentIncidents: Number(process.env.RISK_W_INCIDENTS) || 1.8,
  bias: Number(process.env.RISK_BIAS) || -3.4,
};

export const HAZARD_GAIN = {
  landslide: Number(process.env.RISK_G_LANDSLIDE) || 0.4,
  flood: Number(process.env.RISK_G_FLOOD) || 0.3,
  history: Number(process.env.RISK_G_HISTORY) || 0.6,
  slope: Number(process.env.RISK_G_SLOPE) || 0.4,
};

const WET_FEATURES = ["rain72h", "rain24h", "rainBurst", "rainForecast"];

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function levelFor(score) {
  if (score >= 0.75) return RISK_LEVEL[3];
  if (score >= 0.5) return RISK_LEVEL[2];
  if (score >= 0.25) return RISK_LEVEL[1];
  return RISK_LEVEL[0];
}

export function buildFeatures({ segment, weather, recentIncidentCount = 0 }) {
  const terrain = segment?.terrain || "hill";
  const hazard = segment?.hazard || {};
  const tolerance = TERRAIN_RAIN_TOLERANCE_MM[terrain] || 200;
  const w = weather || {};

  const snowRelevant = terrain === "high-mountain" || hazard.snowProne;
  const coldSnap = w.tempMinC !== null && w.tempMinC !== undefined && w.tempMinC <= 2;

  return {
    rain72h: clamp01((w.rain72hMm || 0) / tolerance),
    rain24h: clamp01((w.rain24hMm || 0) / (tolerance * 0.5)),
    rainBurst: clamp01((w.maxHourlyRainMm || 0) / 25),
    rainForecast: clamp01((w.rainForecast24hMm || 0) / (tolerance * 0.6)),
    snow: snowRelevant ? clamp01((w.snowfallCm || 0) / 12 + (coldSnap ? 0.35 : 0)) : 0,
    probeAnomaly:
      segment?.probe?.speedRatio !== null && segment?.probe?.speedRatio !== undefined
        ? clamp01(1 - segment.probe.speedRatio)
        : 0,
    recentIncidents: clamp01(recentIncidentCount / 4),
  };
}

export function hazardGain(segment) {
  const h = segment?.hazard || {};
  const slope = clamp01((h.avgSlopeDeg || 0) / 35);
  const history = clamp01(h.historicalFailureRate || 0);

  const parts = [];
  let gain = 1;

  if (h.landslideProne) {
    gain += HAZARD_GAIN.landslide;
    parts.push({ factor: "landslide-prone terrain", amount: HAZARD_GAIN.landslide });
  }
  if (h.floodProne) {
    gain += HAZARD_GAIN.flood;
    parts.push({ factor: "flood-prone stretch", amount: HAZARD_GAIN.flood });
  }
  if (history > 0.02) {
    const a = HAZARD_GAIN.history * history;
    gain += a;
    parts.push({ factor: "historical failure rate", amount: a });
  }
  if (slope > 0.02) {
    const a = HAZARD_GAIN.slope * slope;
    gain += a;
    parts.push({ factor: "steep gradient", amount: a });
  }

  return { gain: +gain.toFixed(3), parts };
}

const DRIVER_LABEL = {
  rain72h: "3-day rainfall",
  rain24h: "24-hour rainfall",
  rainBurst: "peak rainfall intensity",
  rainForecast: "forecast rainfall",
  snow: "snow / freezing conditions",
  probeAnomaly: "vehicles slowing on this stretch",
  recentIncidents: "recent field reports",
};

const DRIVER_DETAIL = {
  rain72h: (w) => `${(w.rain72hMm || 0).toFixed(0)} mm in 72h`,
  rain24h: (w) => `${(w.rain24hMm || 0).toFixed(0)} mm in 24h`,
  rainBurst: (w) => `${(w.maxHourlyRainMm || 0).toFixed(0)} mm peak hour`,
  rainForecast: (w) => `${(w.rainForecast24hMm || 0).toFixed(0)} mm forecast`,
  snow: (w) => `${(w.snowfallCm || 0).toFixed(0)} cm snow, min ${w.tempMinC ?? "?"}C`,
};

export function scoreSegmentRisk({ segment, weather, recentIncidentCount = 0 }) {
  const features = buildFeatures({ segment, weather, recentIncidentCount });
  const { gain, parts } = hazardGain(segment);
  const terrainBase = TERRAIN_BASE[segment?.terrain || "hill"] ?? 0.15;

  let z = RISK_WEIGHTS.bias + terrainBase;
  const drivers = [];

  for (const [name, value] of Object.entries(features)) {
    const weight = RISK_WEIGHTS[name] || 0;
    const amplified = WET_FEATURES.includes(name) ? gain : 1;
    const contribution = weight * value * amplified;
    z += contribution;
    if (value > 0.05) {
      drivers.push({
        factor: DRIVER_LABEL[name] || name,
        contribution: +contribution.toFixed(3),
        detail: DRIVER_DETAIL[name] ? DRIVER_DETAIL[name](weather || {}) : "",
      });
    }
  }

  const score = +sigmoid(z).toFixed(3);
  drivers.sort((a, b) => b.contribution - a.contribution);

  const wetLoad = WET_FEATURES.reduce((s, f) => s + features[f], 0);
  if (gain > 1.15 && wetLoad > 0.1) {
    drivers.push({
      factor: "terrain vulnerability",
      contribution: +((gain - 1) * wetLoad).toFixed(3),
      detail: `${parts.map((p) => p.factor).join(", ")} (x${gain.toFixed(2)} on rainfall)`,
    });
  }

  return {
    score,
    level: levelFor(score),
    drivers: drivers.slice(0, 5),
    features,
    hazardGain: gain,
    rain24hMm: weather?.rain24hMm || 0,
    rain72hMm: weather?.rain72hMm || 0,
    computedAt: new Date(),
    validUntil: new Date(Date.now() + (Number(process.env.RISK_VALID_MINUTES) || 180) * 60000),
  };
}

export function riskAdvisory(segment) {
  const r = segment?.risk;
  if (!r || r.score < 0.5) return null;
  const top = r.drivers?.[0];
  const lifeline = segment.lifelineFor?.length
    ? `Lifeline route for ${segment.lifelineFor.join(", ")}.`
    : "";
  return {
    level: r.level,
    score: r.score,
    headline: `${r.level} disruption risk on ${segment.name}`,
    reason: top ? `${top.factor}${top.detail ? ` (${top.detail})` : ""}` : "elevated risk",
    lifeline,
  };
}
