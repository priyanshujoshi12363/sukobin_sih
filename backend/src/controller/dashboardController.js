import RoadSegment from "../models/roadSegment.model.js";
import Incident from "../models/incident.model.js";
import Partner from "../models/partner.model.js";
import Order from "../models/order.model.js";
import Parcel from "../models/parcel.model.js";
import { NER_STATES, NER_CORRIDORS, DISTRICTS, STATE_NAME } from "../data/nerNetwork.js";
import { refreshAllSegments, refreshSegment, routeAccessibility } from "../utils/accessibility.js";
import { planRoute } from "../utils/routePlanner.js";
import { riskAdvisory } from "../utils/risk.js";
import { fetchRoutePolyline } from "../utils/routing.js";
import { townByName } from "../data/nerNetwork.js";

const ACTIVE_ORDER_STATUSES = ["READY_FOR_PICKUP", "PICKED", "ON_THE_WAY"];
const ACTIVE_PARCEL_STATUSES = ["POOLED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"];

const ESSENTIAL_TYPES = ["Medicines", "Food", "Documents"];

export const overview = async (req, res) => {
  try {
    const [statusAgg, riskAgg, segTotals, incidentCount, openIncidents, onlinePartners] =
      await Promise.all([
        RoadSegment.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
        RoadSegment.aggregate([{ $group: { _id: "$risk.level", n: { $sum: 1 } } }]),
        RoadSegment.aggregate([
          {
            $group: {
              _id: null,
              segments: { $sum: 1 },
              km: { $sum: "$lengthKm" },
              chokepoints: { $sum: { $cond: ["$isChokepoint", 1, 0] } },
              maxRisk: { $max: "$risk.score" },
              avgRisk: { $avg: "$risk.score" },
            },
          },
        ]),
        Incident.countDocuments({
          capturedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600000) },
        }),
        Incident.countDocuments({ status: { $in: ["REPORTED", "VERIFIED"] } }),
        Partner.countDocuments({ isOnline: true }),
      ]);

    const [activeOrders, activeParcels, essentialParcels] = await Promise.all([
      Order.countDocuments({ status: { $in: ACTIVE_ORDER_STATUSES } }),
      Parcel.countDocuments({ status: { $in: ACTIVE_PARCEL_STATUSES } }),
      Parcel.countDocuments({
        status: { $in: ACTIVE_PARCEL_STATUSES },
        "package.type": { $in: ESSENTIAL_TYPES },
      }),
    ]);

    const byStatus = Object.fromEntries(statusAgg.map((s) => [s._id || "UNKNOWN", s.n]));
    const byRisk = Object.fromEntries(riskAgg.map((s) => [s._id || "LOW", s.n]));
    const totals = segTotals[0] || {};

    const lifelineBlocked = await RoadSegment.find({
      status: "BLOCKED",
      lifelineFor: { $exists: true, $ne: [] },
    }).select("name lifelineFor statusNote districts");

    res.json({
      success: true,
      data: {
        network: {
          segments: totals.segments || 0,
          lengthKm: Math.round(totals.km || 0),
          chokepoints: totals.chokepoints || 0,
          districts: DISTRICTS.length,
          states: NER_STATES.length,
          corridors: NER_CORRIDORS.length,
        },
        accessibility: {
          open: byStatus.OPEN || 0,
          slow: byStatus.SLOW || 0,
          restricted: byStatus.RESTRICTED || 0,
          blocked: byStatus.BLOCKED || 0,
          unknown: byStatus.UNKNOWN || 0,
        },
        risk: {
          low: byRisk.LOW || 0,
          moderate: byRisk.MODERATE || 0,
          high: byRisk.HIGH || 0,
          severe: byRisk.SEVERE || 0,
          maxScore: +(totals.maxRisk || 0).toFixed(3),
          avgScore: +(totals.avgRisk || 0).toFixed(3),
        },
        incidents: {
          last7Days: incidentCount,
          open: openIncidents,
        },
        logistics: {
          vehiclesOnline: onlinePartners,
          activeOrders,
          activeParcels,
          essentialConsignments: essentialParcels,
          inTransit: activeOrders + activeParcels,
        },
        lifelineBlocked: lifelineBlocked.map((s) => ({
          name: s.name,
          lifelineFor: s.lifelineFor,
          note: s.statusNote,
          districts: s.districts,
        })),
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("dashboard/overview:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const segmentsGeoJson = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status.toUpperCase();
    if (req.query.state) filter.states = req.query.state.toUpperCase();
    if (req.query.district) filter.districts = req.query.district;
    if (req.query.corridor) filter.corridorCode = req.query.corridor;
    if (req.query.chokepoints === "true") filter.isChokepoint = true;

    const segments = await RoadSegment.find(filter).select(
      "segmentId name corridorCode status statusNote statusUpdatedAt lengthKm terrain kind districts states lifelineFor isChokepoint chokepointNote risk geometry baselineSpeedKmph probe hazard openIncidentCount"
    );

    res.json({
      success: true,
      data: {
        type: "FeatureCollection",
        features: segments.map((s) => ({
          type: "Feature",
          id: s.segmentId,
          geometry: s.geometry,
          properties: {
            segmentId: s.segmentId,
            name: s.name,
            corridor: s.corridorCode,
            status: s.status,
            statusNote: s.statusNote,
            statusUpdatedAt: s.statusUpdatedAt,
            lengthKm: s.lengthKm,
            terrain: s.terrain,
            kind: s.kind,
            districts: s.districts,
            states: s.states,
            lifelineFor: s.lifelineFor,
            isChokepoint: s.isChokepoint,
            chokepointNote: s.chokepointNote,
            riskScore: s.risk?.score || 0,
            riskLevel: s.risk?.level || "LOW",
            riskDrivers: s.risk?.drivers || [],
            rain24hMm: s.risk?.rain24hMm || 0,
            rain72hMm: s.risk?.rain72hMm || 0,
            baselineSpeedKmph: s.baselineSpeedKmph,
            observedSpeedKmph: s.probe?.medianSpeedKmph ?? null,
            speedRatio: s.probe?.speedRatio ?? null,
            probeVehicles: s.probe?.distinctVehicles || 0,
            landslideProne: s.hazard?.landslideProne || false,
            floodProne: s.hazard?.floodProne || false,
            openIncidents: s.openIncidentCount || 0,
          },
        })),
      },
    });
  } catch (error) {
    console.error("dashboard/segments:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const districts = async (req, res) => {
  try {
    const rows = await RoadSegment.aggregate([
      { $unwind: "$districts" },
      {
        $group: {
          _id: "$districts",
          state: { $first: { $arrayElemAt: ["$states", 0] } },
          segments: { $sum: 1 },
          km: { $sum: "$lengthKm" },
          maxRisk: { $max: "$risk.score" },
          avgRisk: { $avg: "$risk.score" },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "BLOCKED"] }, 1, 0] } },
          restricted: { $sum: { $cond: [{ $eq: ["$status", "RESTRICTED"] }, 1, 0] } },
          slow: { $sum: { $cond: [{ $eq: ["$status", "SLOW"] }, 1, 0] } },
          open: { $sum: { $cond: [{ $eq: ["$status", "OPEN"] }, 1, 0] } },
          chokepoints: { $sum: { $cond: ["$isChokepoint", 1, 0] } },
          lifelines: { $push: "$lifelineFor" },
        },
      },
      { $sort: { maxRisk: -1 } },
    ]);

    const incidentsByDistrict = await Incident.aggregate([
      {
        $match: {
          status: { $in: ["REPORTED", "VERIFIED"] },
          capturedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600000) },
        },
      },
      { $group: { _id: "$district", n: { $sum: 1 } } },
    ]);
    const incidentMap = Object.fromEntries(incidentsByDistrict.map((r) => [r._id, r.n]));

    const data = rows.map((r) => {
      const connectivity =
        r.blocked > 0
          ? "CUT_OFF"
          : r.restricted > 0
            ? "RESTRICTED"
            : r.slow > 0
              ? "DEGRADED"
              : r.open > 0
                ? "NORMAL"
                : "UNKNOWN";

      return {
        district: r._id,
        state: r.state,
        stateName: STATE_NAME[r.state] || r.state,
        segments: r.segments,
        lengthKm: Math.round(r.km),
        connectivity,
        blocked: r.blocked,
        restricted: r.restricted,
        slow: r.slow,
        open: r.open,
        chokepoints: r.chokepoints,
        maxRisk: +(r.maxRisk || 0).toFixed(3),
        avgRisk: +(r.avgRisk || 0).toFixed(3),
        openIncidents: incidentMap[r._id] || 0,
        lifelineFor: [...new Set(r.lifelines.flat())],
      };
    });

    res.json({ success: true, data: { districts: data, total: data.length } });
  } catch (error) {
    console.error("dashboard/districts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const corridors = async (req, res) => {
  try {
    const rows = await RoadSegment.aggregate([
      {
        $group: {
          _id: "$corridorCode",
          segments: { $sum: 1 },
          km: { $sum: "$lengthKm" },
          maxRisk: { $max: "$risk.score" },
          blocked: { $sum: { $cond: [{ $eq: ["$status", "BLOCKED"] }, 1, 0] } },
          degraded: {
            $sum: {
              $cond: [{ $in: ["$status", ["SLOW", "RESTRICTED"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const map = Object.fromEntries(rows.map((r) => [r._id, r]));

    const data = NER_CORRIDORS.map((c) => {
      const r = map[c.code] || {};
      return {
        code: c.code,
        name: c.name,
        highway: c.highway,
        terrain: c.terrain,
        lifelineFor: c.lifelineFor,
        chokepoint: c.chokepoint,
        via: c.via,
        segments: r.segments || 0,
        lengthKm: Math.round(r.km || 0),
        maxRisk: +(r.maxRisk || 0).toFixed(3),
        blocked: r.blocked || 0,
        degraded: r.degraded || 0,
        passable: (r.blocked || 0) === 0,
      };
    }).sort((a, b) => b.maxRisk - a.maxRisk);

    res.json({ success: true, data: { corridors: data } });
  } catch (error) {
    console.error("dashboard/corridors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const alerts = async (req, res) => {
  try {
    const [blocked, highRisk, recentIncidents] = await Promise.all([
      RoadSegment.find({ status: { $in: ["BLOCKED", "RESTRICTED"] } })
        .sort({ statusUpdatedAt: -1 })
        .limit(25)
        .select("segmentId name status statusNote statusSource statusUpdatedAt districts lifelineFor isChokepoint risk"),
      RoadSegment.find({ "risk.score": { $gte: 0.5 } })
        .sort({ "risk.score": -1 })
        .limit(25)
        .select("segmentId name status risk districts lifelineFor isChokepoint"),
      Incident.find({ status: { $in: ["REPORTED", "VERIFIED"] } })
        .sort({ capturedAt: -1 })
        .limit(25)
        .select("incidentId type severity description district state segmentId capturedAt status reporterName corroboratedByProbe"),
    ]);

    const out = [];

    for (const s of blocked) {
      out.push({
        kind: "ACCESSIBILITY",
        severity: s.status === "BLOCKED" ? "CRITICAL" : "HIGH",
        title: `${s.name} is ${s.status.toLowerCase()}`,
        detail: s.statusNote || "",
        source: s.statusSource,
        segmentId: s.segmentId,
        districts: s.districts,
        lifelineFor: s.lifelineFor,
        at: s.statusUpdatedAt,
      });
    }

    for (const s of highRisk) {
      const advisory = riskAdvisory(s);
      if (!advisory) continue;
      out.push({
        kind: "RISK_FORECAST",
        severity: advisory.level === "SEVERE" ? "HIGH" : "MEDIUM",
        title: advisory.headline,
        detail: `${advisory.reason}. ${advisory.lifeline}`.trim(),
        source: "WEATHER",
        segmentId: s.segmentId,
        districts: s.districts,
        lifelineFor: s.lifelineFor,
        riskScore: advisory.score,
        at: new Date(),
      });
    }

    for (const i of recentIncidents) {
      out.push({
        kind: "FIELD_REPORT",
        severity: i.severity,
        title: `${i.type.replace(/_/g, " ")} reported in ${i.district || "the field"}`,
        detail: i.description || "",
        source: i.corroboratedByProbe ? "FIELD_REPORT + PROBE" : "FIELD_REPORT",
        segmentId: i.segmentId,
        districts: i.district ? [i.district] : [],
        reporter: i.reporterName,
        status: i.status,
        at: i.capturedAt,
      });
    }

    const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    out.sort((a, b) => {
      const r = (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
      return r !== 0 ? r : new Date(b.at) - new Date(a.at);
    });

    res.json({ success: true, data: { alerts: out.slice(0, 50), total: out.length } });
  } catch (error) {
    console.error("dashboard/alerts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const vehicles = async (req, res) => {
  try {
    const partners = await Partner.find({
      currentLocation: { $exists: true },
      "currentLocation.coordinates.0": { $exists: true },
    })
      .select("name vehicleNumber vehicleType capacity isOnline currentLocation lastActive activeRoute")
      .limit(500);

    const data = partners.map((p) => ({
      id: p._id,
      name: p.name,
      vehicleNumber: p.vehicleNumber,
      vehicleType: p.vehicleType,
      capacity: p.capacity,
      online: p.isOnline,
      coordinates: p.currentLocation?.coordinates || null,
      lastActive: p.lastActive,
      stale: p.lastActive ? Date.now() - new Date(p.lastActive) > 30 * 60000 : true,
      route: p.activeRoute?.stations || [],
      routePolyline: p.activeRoute?.polyline || null,
    }));

    res.json({
      success: true,
      data: {
        vehicles: data,
        online: data.filter((v) => v.online).length,
        total: data.length,
      },
    });
  } catch (error) {
    console.error("dashboard/vehicles:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const consignments = async (req, res) => {
  try {
    const [orders, parcels] = await Promise.all([
      Order.find({ status: { $in: ACTIVE_ORDER_STATUSES } })
        .populate("shop", "shopName location address")
        .select("orderId status totalAmount deliveryFee location deliveryAddress createdAt assignedPartner")
        .limit(200),
      Parcel.find({ status: { $in: ACTIVE_PARCEL_STATUSES } })
        .select("parcelId status package pickup drop distanceKm deliveryCharge createdAt assignedPartner routeDurationMin")
        .limit(200),
    ]);

    const items = [
      ...orders.map((o) => ({
        kind: "order",
        ref: o.orderId || String(o._id),
        commodity: "Retail order",
        essential: false,
        status: o.status,
        from: o.shop?.shopName || "Shop",
        to: o.deliveryAddress?.town || o.deliveryAddress?.district || "Customer",
        fromCoords: o.shop?.location?.coordinates || null,
        toCoords: o.location?.coordinates || null,
        assigned: Boolean(o.assignedPartner),
        createdAt: o.createdAt,
      })),
      ...parcels.map((p) => ({
        kind: "parcel",
        ref: p.parcelId || String(p._id),
        commodity: p.package?.type || "Other",
        essential: ESSENTIAL_TYPES.includes(p.package?.type),
        weightKg: p.package?.weightKg,
        status: p.status,
        from: p.pickup?.address?.town || p.pickup?.address?.district || "Pickup",
        to: p.drop?.address?.town || p.drop?.address?.district || "Drop",
        fromCoords: p.pickup?.location?.coordinates || null,
        toCoords: p.drop?.location?.coordinates || null,
        distanceKm: p.distanceKm,
        etaMin: p.routeDurationMin,
        assigned: Boolean(p.assignedPartner),
        createdAt: p.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        consignments: items,
        total: items.length,
        essential: items.filter((i) => i.essential).length,
        unassigned: items.filter((i) => !i.assigned).length,
      },
    });
  } catch (error) {
    console.error("dashboard/consignments:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const planRouteApi = async (req, res) => {
  try {
    const { from, to, fromCoords, toCoords } = req.body;

    const a = fromCoords || townByName(from)?.coordinates;
    const b = toCoords || townByName(to)?.coordinates;

    if (!a || !b) {
      return res.status(400).json({
        success: false,
        message: "Provide known town names (from/to) or explicit fromCoords/toCoords",
      });
    }

    const plan = await planRoute([a, b]);

    res.json({
      success: true,
      data: {
        from: from || a,
        to: to || b,
        ...plan,
      },
    });
  } catch (error) {
    console.error("dashboard/plan-route:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const emergencyRoutes = async (req, res) => {
  try {
    const { district } = req.query;

    const filter = district ? { districts: district } : {};
    const segments = await RoadSegment.find(filter).select(
      "segmentId name status risk lifelineFor isChokepoint districts from to lengthKm"
    );

    const cutOff = segments.filter((s) => s.status === "BLOCKED");
    const atRisk = segments.filter(
      (s) => s.status !== "BLOCKED" && (s.risk?.score || 0) >= 0.5
    );

    const lifelines = segments.filter((s) => s.lifelineFor?.length);

    res.json({
      success: true,
      data: {
        district: district || "all",
        totalSegments: segments.length,
        cutOff: cutOff.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          lifelineFor: s.lifelineFor,
          districts: s.districts,
        })),
        atRisk: atRisk.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          riskScore: s.risk?.score,
          riskLevel: s.risk?.level,
          districts: s.districts,
        })),
        lifelineStatus: lifelines.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          status: s.status,
          serves: s.lifelineFor,
          riskScore: s.risk?.score || 0,
        })),
        isolatedRegions: [
          ...new Set(cutOff.flatMap((s) => s.lifelineFor || [])),
        ],
      },
    });
  } catch (error) {
    console.error("dashboard/emergency:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const withWeather = req.query.weather !== "false";
    const segmentId = req.query.segmentId;

    if (segmentId) {
      const result = await refreshSegment(segmentId, { withWeather });
      if (!result) {
        return res.status(404).json({ success: false, message: "Segment not found" });
      }
      return res.json({
        success: true,
        data: {
          segmentId,
          status: result.segment.status,
          risk: result.segment.risk,
          changed: result.changed,
        },
      });
    }

    const result = await refreshAllSegments({ withWeather, concurrency: 5 });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("dashboard/refresh:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const segmentDetail = async (req, res) => {
  try {
    const segment = await RoadSegment.findOne({ segmentId: req.params.segmentId });
    if (!segment) {
      return res.status(404).json({ success: false, message: "Segment not found" });
    }

    const incidents = await Incident.find({ segmentId: segment.segmentId })
      .sort({ capturedAt: -1 })
      .limit(20)
      .select("incidentId type severity description photos status capturedAt reporterName location");

    res.json({ success: true, data: { segment, incidents } });
  } catch (error) {
    console.error("dashboard/segment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const meta = async (req, res) => {
  res.json({
    success: true,
    data: {
      states: NER_STATES,
      corridors: NER_CORRIDORS.map((c) => ({
        code: c.code,
        name: c.name,
        highway: c.highway,
        lifelineFor: c.lifelineFor,
      })),
      districts: DISTRICTS,
    },
  });
};
