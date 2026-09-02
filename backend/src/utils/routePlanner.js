import { fetchRoutePolyline, fetchRouteAlternatives, etaMinutes } from "./routing.js";
import { routeAccessibility, SEVERITY_RANK } from "./accessibility.js";
import { STATUS_SPEED_FACTOR } from "../models/roadSegment.model.js";

export const DELAY_ALERT_MIN = Number(process.env.DELAY_ALERT_MIN) || 20;

function speedOf(segment) {
  if (typeof segment.effectiveSpeedKmph === "function") return segment.effectiveSpeedKmph();
  if (segment.probe?.medianSpeedKmph > 0) return segment.probe.medianSpeedKmph;
  return (segment.baselineSpeedKmph || 30) * (STATUS_SPEED_FACTOR[segment.status] ?? 0.85);
}

export function conditionAdjustedEta(route, segments) {
  const totalKm = route.distanceKm || 0;
  if (totalKm <= 0) {
    return { minutes: route.durationMin || 0, normalMinutes: route.durationMin || 0, impossible: false, detail: [] };
  }

  let coveredKm = 0;
  let coveredMin = 0;
  let normalMin = 0;
  const detail = [];

  for (const s of segments || []) {
    const onRouteKm = s.coveredKm ?? s.lengthKm ?? 0;
    const km = Math.min(onRouteKm, Math.max(0, totalKm - coveredKm));
    if (km <= 0) continue;

    const baseline = s.baselineSpeedKmph || 30;
    const speed = speedOf(s);
    if (!(speed > 0)) {
      return {
        minutes: Infinity,
        normalMinutes: Infinity,
        impossible: true,
        blockedBy: s.segmentId || s.name,
        detail,
      };
    }

    const min = (km / speed) * 60;
    coveredKm += km;
    coveredMin += min;
    normalMin += (km / baseline) * 60;

    detail.push({
      segmentId: s.segmentId,
      name: s.name,
      status: s.status,
      km: +km.toFixed(1),
      speedKmph: +speed.toFixed(1),
      baselineKmph: baseline,
      minutes: Math.round(min),
      delayMinutes: Math.round(min - (km / baseline) * 60),
    });
  }

  const restKm = Math.max(0, totalKm - coveredKm);
  const restMin =
    totalKm > 0 && route.durationMin ? route.durationMin * (restKm / totalKm) : etaMinutes(restKm);

  return {
    minutes: Math.max(1, Math.round(coveredMin + restMin)),
    normalMinutes: Math.max(1, Math.round(normalMin + restMin)),
    impossible: false,
    observedKm: +coveredKm.toFixed(1),
    detail,
  };
}

export async function planRoute(waypoints, { alternatives = 3, accessibilityFn = routeAccessibility } = {}) {
  const primary = await fetchRoutePolyline(waypoints);
  const alts = await fetchRouteAlternatives(waypoints, alternatives);

  const candidates = alts.length
    ? alts
    : [{ index: 0, polyline: primary.polyline, distanceKm: primary.distanceKm, durationMin: primary.durationMin, source: primary.source }];

  const evaluated = [];

  for (const c of candidates) {
    const access = await accessibilityFn(c.polyline);
    const eta = conditionAdjustedEta(c, access.segments);

    evaluated.push({
      ...c,
      passable: access.passable && !eta.impossible,
      worstStatus: access.worstStatus,
      maxRiskScore: access.maxRiskScore,
      blockedSegments: access.blocked.map((s) => ({
        segmentId: s.segmentId,
        name: s.name,
        note: s.statusNote,
      })),
      degradedSegments: access.degraded.map((s) => ({
        segmentId: s.segmentId,
        name: s.name,
        status: s.status,
      })),
      idealMinutes: c.durationMin,
      normalMinutes: eta.impossible ? null : eta.normalMinutes,
      etaMinutes: eta.impossible ? null : eta.minutes,
      delayMinutes: eta.impossible ? null : Math.max(0, eta.minutes - eta.normalMinutes),
      etaBreakdown: eta.detail,
    });
  }

  const passable = evaluated.filter((e) => e.passable);

  const rank = (e) =>
    e.etaMinutes + e.maxRiskScore * 45 + SEVERITY_RANK[e.worstStatus] * 12;

  passable.sort((a, b) => rank(a) - rank(b));

  const chosen = passable[0] || null;
  const rejected = evaluated
    .filter((e) => e !== chosen)
    .map((e) => ({
      distanceKm: e.distanceKm,
      etaMinutes: e.etaMinutes,
      passable: e.passable,
      reason: !e.passable
        ? `blocked: ${e.blockedSegments.map((b) => b.name).join(", ") || "impassable segment"}`
        : `slower or riskier (${e.etaMinutes} min, risk ${e.maxRiskScore.toFixed(2)})`,
    }));

  const baseline = evaluated[0];

  return {
    found: !!chosen,
    chosen,
    rejected,
    isDetour: !!chosen && baseline && chosen.index !== baseline.index,
    delayVsIdeal: chosen ? chosen.delayMinutes : null,
    delayVsBaseline:
      chosen && baseline && baseline.etaMinutes
        ? chosen.etaMinutes - baseline.etaMinutes
        : null,
    shouldAlert: !!chosen && chosen.delayMinutes >= DELAY_ALERT_MIN,
    candidatesEvaluated: evaluated.length,
    allBlocked: evaluated.length > 0 && passable.length === 0,
  };
}
