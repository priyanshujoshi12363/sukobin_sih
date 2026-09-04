import RoadSegment from "../models/roadSegment.model.js";
import { fetchPredictionWindows, PREDICTION_HORIZONS } from "./weather.js";
import { predict, loadModel, bandFor } from "../ml/model.js";

const midpoint = (segment) => {
  const c = segment.geometry?.coordinates || [];
  return c.length ? c[Math.floor(c.length / 2)] : null;
};

export function forecastAdvisory(segment) {
  const f = segment?.forecast;
  if (!f?.h24) return null;

  const worst = ["h72", "h48", "h24"]
    .map((k) => ({ k, v: f[k] }))
    .filter((x) => x.v)
    .sort((a, b) => b.v.probability - a.v.probability)[0];

  if (!worst || worst.v.probability < 0.35) return null;

  const hours = Number(worst.k.slice(1));
  const top = worst.v.drivers?.[0];

  return {
    level: worst.v.level,
    probability: worst.v.probability,
    horizonH: hours,
    headline: `${Math.round(worst.v.probability * 100)}% chance of disruption on ${segment.name} in the next ${hours} hours`,
    reason: top ? top.factor : "forecast conditions",
    lifeline: segment.lifelineFor?.length ? segment.lifelineFor.join(", ") : "",
  };
}

/**
 * Runs the trained model over every segment using live forecast weather.
 * Writes segment.forecast and returns a summary.
 */
export async function refreshForecasts({ segmentIds = null, concurrency = 5 } = {}) {
  const model = loadModel();
  if (!model) return { ok: false, reason: "no trained model on disk" };

  const query = segmentIds?.length ? { segmentId: { $in: segmentIds } } : {};
  const segments = await RoadSegment.find(query);

  const month = new Date().getMonth() + 1;
  const queue = [...segments];
  const results = [];
  let weatherFailures = 0;

  const worker = async () => {
    while (queue.length) {
      const seg = queue.shift();
      if (!seg) break;

      const mid = midpoint(seg);
      if (!mid) continue;

      const wx = await fetchPredictionWindows(mid);
      if (!wx) {
        weatherFailures++;
        continue;
      }

      const forecast = { computedAt: new Date(), model: model.chosen, source: wx.source };
      for (const h of PREDICTION_HORIZONS) {
        const r = predict(seg, wx.windows[h], h, month);
        if (r) {
          forecast[`h${h}`] = {
            probability: r.probability,
            level: r.level,
            drivers: r.drivers.map((d) => ({ factor: d.factor, contribution: d.contribution })),
          };
        }
      }

      seg.forecast = forecast;
      await seg.save();

      results.push({
        segmentId: seg.segmentId,
        name: seg.name,
        h24: forecast.h24?.probability ?? null,
        h48: forecast.h48?.probability ?? null,
        h72: forecast.h72?.probability ?? null,
        level: forecast.h72?.level ?? forecast.h24?.level ?? "LOW",
      });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));

  results.sort((a, b) => (b.h72 ?? 0) - (a.h72 ?? 0));

  const byLevel = {};
  for (const r of results) byLevel[r.level] = (byLevel[r.level] || 0) + 1;

  return {
    ok: true,
    model: model.chosen,
    trainedAt: model.trainedAt,
    scored: results.length,
    weatherFailures,
    byLevel,
    top: results.slice(0, 12),
  };
}

/**
 * Segments the model expects to deteriorate, highest first.
 * Used by the alert engine, the dashboard and the officer app.
 */
export async function upcomingRisk({ minProbability = 0.35, limit = 25, district = null, state = null } = {}) {
  const q = {
    $or: [
      { "forecast.h24.probability": { $gte: minProbability } },
      { "forecast.h48.probability": { $gte: minProbability } },
      { "forecast.h72.probability": { $gte: minProbability } },
    ],
  };
  if (district) q.districts = district;
  if (state) q.states = state;

  const segments = await RoadSegment.find(q)
    .select("segmentId name corridorCode districts states lifelineFor isChokepoint status forecast risk from to")
    .lean();

  return segments
    .map((s) => {
      const peak = Math.max(
        s.forecast?.h24?.probability ?? 0,
        s.forecast?.h48?.probability ?? 0,
        s.forecast?.h72?.probability ?? 0
      );
      const when =
        (s.forecast?.h24?.probability ?? 0) >= minProbability
          ? 24
          : (s.forecast?.h48?.probability ?? 0) >= minProbability
          ? 48
          : 72;
      return {
        segmentId: s.segmentId,
        name: s.name,
        corridorCode: s.corridorCode,
        districts: s.districts,
        states: s.states,
        status: s.status,
        isChokepoint: s.isChokepoint,
        lifelineFor: s.lifelineFor,
        peakProbability: +peak.toFixed(3),
        level: bandFor(peak),
        firstBreachH: when,
        drivers: s.forecast?.[`h${when}`]?.drivers || [],
        h24: s.forecast?.h24?.probability ?? null,
        h48: s.forecast?.h48?.probability ?? null,
        h72: s.forecast?.h72?.probability ?? null,
      };
    })
    .sort((a, b) => b.peakProbability - a.peakProbability)
    .slice(0, limit);
}
