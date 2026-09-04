// One definition of the feature vector, shared by training and inference.
// If these two ever drift apart the model silently predicts nonsense, so
// every caller goes through buildRow().

export const FEATURE_NAMES = [
  "rainPast24",
  "rainPast72",
  "rainHorizon",
  "burstHorizon",
  "snowHorizon",
  "freezeHours",
  "slope",
  "elevation",
  "landslideProne",
  "floodProne",
  "snowProne",
  "histFailure",
  "terrainOrd",
  "monsoon",
  "rainXslope",
  "rainXhist",
  "rainXprone",
  "horizonDays",
];

export const TERRAIN_ORD = {
  plain: 0,
  hill: 0.34,
  mountain: 0.67,
  "high-mountain": 1,
};

export const TERRAIN_RAIN_TOLERANCE_MM = {
  plain: 250,
  hill: 200,
  mountain: 150,
  "high-mountain": 120,
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

// Peak monsoon over the NER runs May-September; the shoulder months still
// carry rain but the ground is not already saturated.
export function monsoonWeight(month) {
  const w = { 5: 0.7, 6: 1, 7: 1, 8: 0.95, 9: 0.8, 10: 0.4, 4: 0.35, 3: 0.15 };
  return w[month] ?? 0.05;
}

export function staticFeatures(segment) {
  const h = segment?.hazard || {};
  const terrain = segment?.terrain || "hill";
  return {
    slope: clamp01((h.avgSlopeDeg || 0) / 35),
    elevation: clamp01((h.elevationM || 0) / 4000),
    landslideProne: h.landslideProne ? 1 : 0,
    floodProne: h.floodProne ? 1 : 0,
    snowProne: h.snowProne ? 1 : 0,
    histFailure: clamp01(h.historicalFailureRate || 0),
    terrainOrd: TERRAIN_ORD[terrain] ?? 0.34,
    tolerance: TERRAIN_RAIN_TOLERANCE_MM[terrain] || 200,
  };
}

/**
 * @param segment   RoadSegment (or any object with terrain + hazard)
 * @param w         { rainPast24Mm, rainPast72Mm, rainHorizonMm, maxHourlyHorizonMm,
 *                    snowHorizonCm, freezeHours }
 * @param horizonH  prediction horizon in hours
 * @param month     1-12, the month the prediction is made in
 */
export function buildRow(segment, w, horizonH, month) {
  const s = staticFeatures(segment);
  const tol = s.tolerance;

  const rainPast24 = clamp01((w.rainPast24Mm || 0) / (tol * 0.5));
  const rainPast72 = clamp01((w.rainPast72Mm || 0) / tol);
  const rainHorizon = clamp01((w.rainHorizonMm || 0) / (tol * (horizonH / 72)));
  const burstHorizon = clamp01((w.maxHourlyHorizonMm || 0) / 30);
  const wet = clamp01((rainPast72 + rainHorizon) / 2);

  const row = {
    rainPast24,
    rainPast72,
    rainHorizon,
    burstHorizon,
    snowHorizon: s.snowProne ? clamp01((w.snowHorizonCm || 0) / 15) : 0,
    freezeHours: clamp01((w.freezeHours || 0) / horizonH),
    slope: s.slope,
    elevation: s.elevation,
    landslideProne: s.landslideProne,
    floodProne: s.floodProne,
    snowProne: s.snowProne,
    histFailure: s.histFailure,
    terrainOrd: s.terrainOrd,
    monsoon: monsoonWeight(month),
    rainXslope: wet * s.slope,
    rainXhist: wet * s.histFailure,
    rainXprone: wet * (s.landslideProne * 0.6 + s.floodProne * 0.4),
    horizonDays: horizonH / 72,
  };

  return FEATURE_NAMES.map((n) => row[n]);
}

export const HUMAN_LABEL = {
  rainPast24: "rain in the last 24 hours",
  rainPast72: "rain in the last 3 days",
  rainHorizon: "rain expected in this window",
  burstHorizon: "heaviest expected hour of rain",
  snowHorizon: "snow expected",
  freezeHours: "hours below freezing",
  slope: "steep hillside",
  elevation: "high altitude",
  landslideProne: "landslide-prone stretch",
  floodProne: "flood-prone stretch",
  snowProne: "snow-prone stretch",
  histFailure: "this road has closed before",
  terrainOrd: "mountain terrain",
  monsoon: "monsoon season",
  rainXslope: "rain on a steep slope",
  rainXhist: "rain on a road with a closure history",
  rainXprone: "rain on vulnerable ground",
  horizonDays: "length of the forecast window",
};
