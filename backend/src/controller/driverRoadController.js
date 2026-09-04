import RoadSegment from "../models/roadSegment.model.js";
import { matchToSegment } from "../utils/probes.js";
import { activeAlerts } from "../utils/alertEngine.js";
import { haversineKm, distToRouteKm } from "../utils/geo.js";

const NEARBY_KM = Number(process.env.DRIVER_NEARBY_KM) || 40;

function shape(segment, distanceKm = null) {
  const peak = Math.max(
    segment.forecast?.h24?.probability ?? 0,
    segment.forecast?.h48?.probability ?? 0,
    segment.forecast?.h72?.probability ?? 0
  );

  return {
    segmentId: segment.segmentId,
    name: segment.name,
    status: segment.status,
    statusNote: segment.statusNote || "",
    riskLevel: segment.risk?.level || "LOW",
    rain72hMm: segment.risk?.rain72hMm ?? 0,
    forecastH24: segment.forecast?.h24?.probability ?? null,
    forecastPeak: +peak.toFixed(3),
    forecastDrivers: (segment.forecast?.h24?.drivers || []).map((d) => d.factor).slice(0, 2),
    observedSpeedKmph: segment.probe?.medianSpeedKmph ?? null,
    baselineSpeedKmph: segment.baselineSpeedKmph,
    isChokepoint: Boolean(segment.isChokepoint),
    lengthKm: segment.lengthKm,
    distanceKm,
  };
}

/**
 * What a driver needs to know about the road they are on and the roads around
 * them. Deliberately short: a driver reads this at a halt, not while moving.
 */
export const roadConditions = async (req, res) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);

    const hasFix = Number.isFinite(lng) && Number.isFinite(lat);
    const here = hasFix
      ? [lng, lat]
      : req.partner.currentLocation?.coordinates || null;

    if (!here) {
      return res.json({
        success: true,
        data: { here: null, onRoad: null, ahead: [], warnings: [], message: "No location yet" },
      });
    }

    const nearby = await RoadSegment.find({
      geometry: {
        $near: {
          $geometry: { type: "Point", coordinates: here },
          $maxDistance: NEARBY_KM * 1000,
        },
      },
    })
      .select(
        "segmentId name status statusNote risk forecast probe baselineSpeedKmph isChokepoint lengthKm geometry"
      )
      .limit(12)
      .lean();

    const withDistance = nearby.map((s) => {
      const line = s.geometry?.coordinates || [];
      const d = line.length ? distToRouteKm(here, line) : Infinity;
      return { seg: s, d: Number.isFinite(d) ? +d.toFixed(2) : null };
    });

    const onRoad = withDistance[0] && withDistance[0].d !== null && withDistance[0].d <= 1.5
      ? shape(withDistance[0].seg, withDistance[0].d)
      : null;

    const ahead = withDistance
      .filter((x) => !onRoad || x.seg.segmentId !== onRoad.segmentId)
      .map((x) => shape(x.seg, x.d))
      .sort((a, b) => severity(b) - severity(a) || (a.distanceKm ?? 99) - (b.distanceKm ?? 99))
      .slice(0, 6);

    // Only things worth interrupting a driver for.
    const warnings = [];
    for (const s of [onRoad, ...ahead].filter(Boolean)) {
      if (s.status === "BLOCKED") {
        warnings.push({
          level: "STOP",
          segmentId: s.segmentId,
          title: `${s.name} is blocked`,
          detail: s.statusNote || "Find another route.",
        });
      } else if (s.status === "RESTRICTED" || s.status === "SLOW") {
        warnings.push({
          level: "CAUTION",
          segmentId: s.segmentId,
          title: `${s.name} is slow going`,
          detail: s.statusNote || "Traffic is moving below normal speed.",
        });
      } else if ((s.forecastH24 ?? 0) >= 0.5) {
        warnings.push({
          level: "WATCH",
          segmentId: s.segmentId,
          title: `${s.name} may close today`,
          detail: s.forecastDrivers.length
            ? s.forecastDrivers.join(", ")
            : "Heavy rain expected.",
        });
      }
    }

    const alerts = await activeAlerts({ limit: 6, lang: req.query.lang || "en" });

    res.json({
      success: true,
      data: {
        here,
        onRoad,
        ahead,
        warnings: warnings.slice(0, 5),
        alerts: alerts
          .filter((a) => a.severity !== "INFO")
          .slice(0, 4)
          .map((a) => ({ title: a.title, body: a.body, severity: a.severity })),
      },
    });
  } catch (error) {
    console.error("partner/road-conditions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

function severity(s) {
  if (s.status === "BLOCKED") return 4;
  if (s.status === "RESTRICTED") return 3;
  if (s.status === "SLOW") return 2;
  if ((s.forecastH24 ?? 0) >= 0.5) return 1;
  return 0;
}

/**
 * The road the driver is currently on, resolved from a raw fix. Used by the
 * report screen so a driver taps a road rather than typing one.
 */
export const whereAmI = async (req, res) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ success: false, message: "lng and lat are required" });
    }

    const seg = await matchToSegment([lng, lat], NEARBY_KM);
    if (!seg) {
      return res.json({ success: true, data: { segment: null } });
    }

    const line = seg.geometry?.coordinates || [];
    const d = line.length ? distToRouteKm([lng, lat], line) : null;

    res.json({
      success: true,
      data: {
        segment: {
          segmentId: seg.segmentId,
          name: seg.name,
          status: seg.status,
          districts: seg.districts || [],
          states: seg.states || [],
          distanceKm: Number.isFinite(d) ? +d.toFixed(2) : null,
        },
      },
    });
  } catch (error) {
    console.error("partner/where-am-i:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
