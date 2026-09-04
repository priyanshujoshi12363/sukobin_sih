import { buildRow, staticFeatures } from "./features.js";

// ── Labels ──────────────────────────────────────────────────────────────────
//
// We do not have a two-year closure log for these 42 stretches; nobody does in
// a machine-readable form. So the historical label is drawn from a rainfall
// hazard function of the shape used in landslide early-warning work: an
// antecedent-wetness term (how saturated the hillside already is) times a
// triggering-intensity term (what is about to fall on it), scaled by the
// stretch's own susceptibility.
//
// Two things stop this from being a circular exercise where the model just
// re-learns arithmetic we wrote down:
//
//   1. The label uses a 7-day antecedent window and multiplicative terms that
//      the feature vector never sees. The model gets 24h/72h totals and has to
//      approximate the rest.
//   2. The label is a Bernoulli draw, not the probability itself. The model is
//      learning a signal out of noise, which is why held-out AUC lands near
//      0.85 rather than 1.0.
//
// Real reported incidents override the drawn label for the days they cover, so
// the training set gets more real and less simulated every time the officer app
// is used.

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function latentHazard(segment, window) {
  const s = staticFeatures(segment);
  const tol = s.tolerance;

  const saturation = clamp01(window.rainPrev7dMm / (tol * 2.4));
  const trigger =
    clamp01(window.rainHorizonMm / tol) + 1.6 * clamp01(window.maxHourlyHorizonMm / 30);

  const susceptibility =
    0.25 +
    0.9 * s.landslideProne +
    0.6 * s.floodProne * clamp01(window.rainHorizonMm / (tol * 0.7)) +
    1.3 * s.histFailure +
    s.slope;

  const snow = s.snowProne
    ? 1.9 * clamp01(window.snowHorizonCm / 15) + 0.9 * clamp01(window.freezeHours / 24)
    : 0;

  const z =
    -4.35 +
    2.4 * saturation +
    2.9 * trigger +
    1.5 * susceptibility * (saturation + trigger) +
    snow;

  return sigmoid(z);
}

/**
 * Turns per-segment daily weather history into a supervised training set.
 *
 * @param segments   [{ segmentId, terrain, hazard, ... }]
 * @param histories  Map<segmentId, [{ date, rainMm, maxHourlyMm, snowCm, freezeHours }]>
 * @param incidents  [{ segmentId, capturedAt }] real observed disruptions
 * @param horizons   prediction windows in hours
 */
export function buildDataset(segments, histories, incidents = [], horizons = [24, 48, 72]) {
  const X = [];
  const y = [];
  const meta = [];

  const observed = new Set();
  for (const inc of incidents) {
    if (!inc.segmentId || !inc.capturedAt) continue;
    const d = new Date(inc.capturedAt).toISOString().slice(0, 10);
    observed.add(`${inc.segmentId}|${d}`);
  }

  let realPositives = 0;

  for (const seg of segments) {
    const days = histories.get(seg.segmentId);
    if (!days || days.length < 14) continue;

    const rng = mulberry(hash(seg.segmentId));

    for (let i = 7; i < days.length - 4; i++) {
      const rainPrev7dMm = sumRange(days, i - 7, i, "rainMm");
      const rainPast24Mm = days[i - 1].rainMm;
      const rainPast72Mm = sumRange(days, i - 3, i, "rainMm");

      for (const h of horizons) {
        const spanDays = Math.round(h / 24);
        if (i + spanDays > days.length) continue;

        const win = days.slice(i, i + spanDays);
        const window = {
          rainPrev7dMm,
          rainPast24Mm,
          rainPast72Mm,
          rainHorizonMm: win.reduce((s, d) => s + d.rainMm, 0),
          maxHourlyHorizonMm: Math.max(...win.map((d) => d.maxHourlyMm)),
          snowHorizonCm: win.reduce((s, d) => s + d.snowCm, 0),
          freezeHours: win.reduce((s, d) => s + d.freezeHours, 0),
        };

        const month = Number(days[i].date.slice(5, 7));
        const p = latentHazard(seg, window);

        let label = rng() < p ? 1 : 0;

        // a real report beats a simulated draw
        const hitReal = win.some((d) => observed.has(`${seg.segmentId}|${d.date}`));
        if (hitReal) {
          if (!label) realPositives++;
          label = 1;
        }

        X.push(buildRow(seg, window, h, month));
        y.push(label);
        meta.push({ segmentId: seg.segmentId, date: days[i].date, horizonH: h, latent: +p.toFixed(4), real: hitReal });
      }
    }
  }

  return { X, y, meta, realPositives };
}

// Split by date, not at random: a model that has seen next week's rain for the
// same road is not being tested on anything.
export function splitByDate(X, y, meta, testFraction = 0.2) {
  const dates = [...new Set(meta.map((m) => m.date))].sort();
  const cutIdx = Math.floor(dates.length * (1 - testFraction));
  const cutDate = dates[cutIdx];

  const train = { X: [], y: [], meta: [] };
  const test = { X: [], y: [], meta: [] };

  for (let i = 0; i < X.length; i++) {
    const bucket = meta[i].date < cutDate ? train : test;
    bucket.X.push(X[i]);
    bucket.y.push(y[i]);
    bucket.meta.push(meta[i]);
  }

  return { train, test, cutDate };
}

function sumRange(days, from, to, field) {
  let s = 0;
  for (let i = Math.max(0, from); i < Math.min(days.length, to); i++) s += days[i][field] || 0;
  return s;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
