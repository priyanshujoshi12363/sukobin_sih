import RoadSegment from "../models/roadSegment.model.js";
import { upcomingRisk } from "../utils/forecast.js";
import { modelInfo, featureImportance } from "../ml/model.js";
import { activeAlerts } from "../utils/alertEngine.js";
import { NER_CORRIDORS } from "../data/nerNetwork.js";

/**
 * The problem statement asks for bottlenecks by name. A stretch is a
 * bottleneck when losing it costs more than losing an ordinary road, so this
 * scores exposure rather than just listing what is currently shut:
 *
 *   - how many districts lose their only listed lifeline
 *   - whether the corridor has another stretch that can carry the traffic
 *   - how likely it is to fail in the next three days
 *   - how much freight is riding on it right now
 *
 * The result is a ranked list an officer can act on before anything breaks.
 */
export const bottlenecks = async (req, res) => {
  try {
    const segments = await RoadSegment.find({})
      .select(
        "segmentId name corridorCode status statusNote lengthKm districts states lifelineFor isChokepoint chokepointNote risk forecast terrain hazard baselineSpeedKmph probe"
      )
      .lean();

    // How many stretches each corridor has: a single-stretch corridor has no
    // internal alternative at all.
    const corridorSize = {};
    for (const s of segments) {
      corridorSize[s.corridorCode] = (corridorSize[s.corridorCode] || 0) + 1;
    }

    const corridorMeta = Object.fromEntries(
      (NER_CORRIDORS || []).map((c) => [c.code, c])
    );

    const rows = segments.map((s) => {
      const peak = Math.max(
        s.forecast?.h24?.probability ?? 0,
        s.forecast?.h48?.probability ?? 0,
        s.forecast?.h72?.probability ?? 0
      );

      const lifelineCount = (s.lifelineFor || []).length;
      const soleLink = corridorSize[s.corridorCode] === 1;

      const reasons = [];
      let exposure = 0;

      if (lifelineCount) {
        exposure += 34 * Math.min(1, lifelineCount / 2);
        reasons.push(
          `only listed link for ${s.lifelineFor.join(", ")}`
        );
      }
      if (s.isChokepoint) {
        exposure += 22;
        reasons.push(s.chokepointNote || "no practical way round");
      }
      if (soleLink) {
        exposure += 10;
        reasons.push("the corridor has no second stretch");
      }

      exposure += 24 * peak;
      if (peak >= 0.5) {
        reasons.push(`${Math.round(peak * 100)}% chance of closing within 3 days`);
      }

      if (s.status === "BLOCKED") {
        exposure += 20;
        reasons.push("blocked right now");
      } else if (s.status === "RESTRICTED") {
        exposure += 12;
        reasons.push("passable with difficulty right now");
      } else if (s.status === "UNKNOWN") {
        // Not knowing is itself a risk on a road that matters.
        exposure += lifelineCount || s.isChokepoint ? 6 : 0;
        if (lifelineCount || s.isChokepoint) reasons.push("no live data from this stretch");
      }

      const hazard = s.hazard || {};
      if (hazard.landslideProne && hazard.historicalFailureRate >= 0.4) {
        exposure += 8;
        reasons.push("closes often in the monsoon");
      }

      return {
        segmentId: s.segmentId,
        name: s.name,
        corridor: s.corridorCode,
        corridorName: corridorMeta[s.corridorCode]?.name || s.corridorCode,
        status: s.status,
        statusNote: s.statusNote || "",
        lengthKm: s.lengthKm,
        districts: s.districts || [],
        states: s.states || [],
        lifelineFor: s.lifelineFor || [],
        isChokepoint: Boolean(s.isChokepoint),
        soleLink,
        terrain: s.terrain,
        riskLevel: s.risk?.level || "LOW",
        riskScore: s.risk?.score || 0,
        forecast: {
          h24: s.forecast?.h24?.probability ?? null,
          h48: s.forecast?.h48?.probability ?? null,
          h72: s.forecast?.h72?.probability ?? null,
          peak: +peak.toFixed(3),
        },
        observedSpeedKmph: s.probe?.medianSpeedKmph ?? null,
        baselineSpeedKmph: s.baselineSpeedKmph,
        exposure: Math.round(Math.min(100, exposure)),
        reasons,
      };
    });

    rows.sort((a, b) => b.exposure - a.exposure);

    const limit = Math.min(Number(req.query.limit) || 15, 42);
    const top = rows.filter((r) => r.exposure > 0).slice(0, limit);

    res.json({
      success: true,
      data: {
        bottlenecks: top,
        counted: rows.length,
        criticalNow: rows.filter((r) => r.status === "BLOCKED" && r.exposure >= 40).length,
        atRiskSoon: rows.filter((r) => r.status !== "BLOCKED" && r.forecast.peak >= 0.5).length,
        scoring:
          "Exposure combines how many districts lose their only link, whether a " +
          "way round exists, the model's three-day forecast, and the condition now.",
      },
    });
  } catch (error) {
    console.error("dashboard/bottlenecks:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forecastPanel = async (req, res) => {
  try {
    const [upcoming, info] = await Promise.all([
      upcomingRisk({
        minProbability: Number(req.query.min) || 0.15,
        limit: Math.min(Number(req.query.limit) || 25, 42),
        district: req.query.district || null,
        state: req.query.state || null,
      }),
      Promise.resolve(modelInfo()),
    ]);

    res.json({
      success: true,
      data: {
        upcoming,
        model: info,
        importance: featureImportance().slice(0, 8),
      },
    });
  } catch (error) {
    console.error("dashboard/forecast:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// The alert engine's own feed, already deduplicated and translated. The older
// /alerts endpoint derives alerts from segment state each time it is called;
// this one shows what was actually raised and sent.
export const liveAlerts = async (req, res) => {
  try {
    const rows = await activeAlerts({
      district: req.query.district || null,
      state: req.query.state || null,
      limit: Math.min(Number(req.query.limit) || 40, 100),
      lang: req.query.lang || "en",
    });

    const bySeverity = {};
    for (const a of rows) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    res.json({ success: true, data: { alerts: rows, bySeverity, total: rows.length } });
  } catch (error) {
    console.error("dashboard/live-alerts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * How much of the network we can actually see right now. A dashboard that
 * shows grey for most roads should say why rather than looking broken.
 */
export const coverage = async (_req, res) => {
  try {
    const segments = await RoadSegment.find({})
      .select("segmentId name status probe forecast statusSource statusUpdatedAt lengthKm")
      .lean();

    const now = Date.now();
    const fresh = (d) => d && now - new Date(d).getTime() < 6 * 3600000;

    let withProbe = 0;
    let withForecast = 0;
    let live = 0;
    let kmLive = 0;

    for (const s of segments) {
      const hasProbe = (s.probe?.distinctVehicles || 0) > 0 && fresh(s.probe?.updatedAt);
      const hasForecast = s.forecast?.h24?.probability !== undefined && s.forecast?.h24?.probability !== null;
      if (hasProbe) withProbe++;
      if (hasForecast) withForecast++;
      if (hasProbe || s.status !== "UNKNOWN") {
        live++;
        kmLive += s.lengthKm || 0;
      }
    }

    const total = segments.length || 1;

    res.json({
      success: true,
      data: {
        segments: segments.length,
        withLiveVehicleData: withProbe,
        withForecast,
        statusKnown: live,
        percentStatusKnown: Math.round((live / total) * 100),
        percentWithVehicles: Math.round((withProbe / total) * 100),
        percentWithForecast: Math.round((withForecast / total) * 100),
        kmWithKnownStatus: Math.round(kmLive),
        note:
          "A road shows as not known until a vehicle passes it or an officer " +
          "reports on it. The three-day forecast covers every road regardless.",
      },
    });
  } catch (error) {
    console.error("dashboard/coverage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
