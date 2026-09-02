import crypto from "crypto";
import Incident from "../models/incident.model.js";
import RoadSegment from "../models/roadSegment.model.js";
import { matchToSegment } from "../utils/probes.js";
import { refreshSegment } from "../utils/accessibility.js";
import { classifyReport, statusFromClassification } from "../utils/incidentAI.js";
import { haversineKm } from "../utils/geo.js";

const newIncidentId = () =>
  `INC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

function reporterFrom(req) {
  if (req.officer) {
    return {
      reportedBy: req.officer._id,
      reporterModel: "FieldOfficer",
      reporterName: req.officer.name,
      reporterPhone: req.officer.phone,
    };
  }
  if (req.partner) {
    return {
      reportedBy: req.partner._id,
      reporterModel: "Partner",
      reporterName: req.partner.name,
      reporterPhone: req.partner.phone,
    };
  }
  if (req.user) {
    return {
      reportedBy: req.user._id,
      reporterModel: "User",
      reporterName: req.user.name,
      reporterPhone: req.user.phone,
    };
  }
  return { reporterModel: "FieldOfficer", reporterName: "Field officer" };
}

export const createIncident = async (req, res) => {
  try {
    const {
      clientId,
      type,
      severity,
      description,
      photos = [],
      coordinates,
      accuracyM,
      address,
      district,
      state,
      capturedAt,
      wasOffline,
      impact,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required (device-generated, makes replay idempotent)",
      });
    }

    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "coordinates must be [lng, lat]",
      });
    }

    const existing = await Incident.findOne({ clientId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Already recorded",
        duplicate: true,
        data: { incident: existing },
      });
    }

    const segment = await matchToSegment(coordinates, 3);

    const classified = await classifyReport({
      text: description,
      segmentName: segment?.name,
      district,
      photoCount: photos.length,
    });

    const resolvedType = type || classified.type;
    const resolvedSeverity = severity || classified.severity;

    const incident = await Incident.create({
      incidentId: newIncidentId(),
      clientId,
      ...reporterFrom(req),
      type: resolvedType,
      severity: resolvedSeverity,
      description,
      photos,
      location: { type: "Point", coordinates },
      accuracyM: accuracyM || 0,
      address,
      district: district || segment?.districts?.[0],
      state: state || segment?.states?.[0],
      segment: segment?._id,
      segmentId: segment?.segmentId,
      distanceToSegmentKm: segment
        ? +haversineKm(coordinates, segment.geometry?.coordinates?.[0] || coordinates).toFixed(2)
        : null,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      syncedAt: new Date(),
      wasOffline: Boolean(wasOffline),
      impact: {
        blocksTraffic: impact?.blocksTraffic ?? classified.blocksTraffic,
        passableBy: impact?.passableBy ?? classified.passableBy,
        estimatedClearanceHours:
          impact?.estimatedClearanceHours ?? classified.estimatedClearanceHours,
        affectedLengthM: impact?.affectedLengthM,
      },
    });

    let segmentUpdate = null;
    if (segment) {
      const derived = statusFromClassification(classified);
      const refreshed = await refreshSegment(segment.segmentId, { withWeather: false });
      segmentUpdate = {
        segmentId: segment.segmentId,
        name: segment.name,
        status: refreshed?.segment?.status,
        impliedByReport: derived.status,
        deferredUntil: derived.applyAt,
      };
    }

    res.status(201).json({
      success: true,
      message: "Incident recorded",
      data: {
        incident,
        classification: {
          source: classified.source,
          confidence: classified.confidence,
          summary: classified.summary,
          roadClear: classified.roadClear,
          guardrail: classified.guardrail || null,
        },
        segment: segmentUpdate,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Incident.findOne({ clientId: req.body?.clientId });
      if (existing) {
        return res.json({
          success: true,
          message: "Already recorded",
          duplicate: true,
          data: { incident: existing },
        });
      }
    }
    console.error("incident/create:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const syncIncidents = async (req, res) => {
  try {
    const reports = Array.isArray(req.body?.incidents) ? req.body.incidents : [];
    if (!reports.length) {
      return res.status(400).json({ success: false, message: "incidents array is required" });
    }

    const accepted = [];
    const duplicates = [];
    const failed = [];

    for (const report of reports) {
      if (!report?.clientId) {
        failed.push({ clientId: null, reason: "missing clientId" });
        continue;
      }

      const existing = await Incident.findOne({ clientId: report.clientId });
      if (existing) {
        duplicates.push(report.clientId);
        continue;
      }

      try {
        const fakeReq = { body: { ...report, wasOffline: true }, ...reporterKeys(req) };
        const created = await createOne(fakeReq);
        accepted.push({ clientId: report.clientId, incidentId: created.incidentId });
      } catch (e) {
        failed.push({ clientId: report.clientId, reason: e.message });
      }
    }

    res.json({
      success: true,
      data: {
        received: reports.length,
        accepted: accepted.length,
        duplicates: duplicates.length,
        failed: failed.length,
        acceptedIds: accepted,
        duplicateIds: duplicates,
        failures: failed,
      },
    });
  } catch (error) {
    console.error("incident/sync:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

function reporterKeys(req) {
  return { officer: req.officer, partner: req.partner, user: req.user };
}

async function createOne(req) {
  const b = req.body;
  const segment = await matchToSegment(b.coordinates, 3);

  const classified = await classifyReport({
    text: b.description,
    segmentName: segment?.name,
    district: b.district,
    photoCount: (b.photos || []).length,
  });

  const incident = await Incident.create({
    incidentId: newIncidentId(),
    clientId: b.clientId,
    ...reporterFrom(req),
    type: b.type || classified.type,
    severity: b.severity || classified.severity,
    description: b.description,
    photos: b.photos || [],
    location: { type: "Point", coordinates: b.coordinates },
    accuracyM: b.accuracyM || 0,
    address: b.address,
    district: b.district || segment?.districts?.[0],
    state: b.state || segment?.states?.[0],
    segment: segment?._id,
    segmentId: segment?.segmentId,
    capturedAt: b.capturedAt ? new Date(b.capturedAt) : new Date(),
    syncedAt: new Date(),
    wasOffline: true,
    impact: {
      blocksTraffic: classified.blocksTraffic,
      passableBy: classified.passableBy,
      estimatedClearanceHours: classified.estimatedClearanceHours,
    },
  });

  if (segment) await refreshSegment(segment.segmentId, { withWeather: false });

  return incident;
}

export const listIncidents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status.toUpperCase();
    if (req.query.district) filter.district = req.query.district;
    if (req.query.state) filter.state = req.query.state.toUpperCase();
    if (req.query.segmentId) filter.segmentId = req.query.segmentId;
    if (req.query.type) filter.type = req.query.type.toUpperCase();

    const days = Number(req.query.days) || 30;
    filter.capturedAt = { $gte: new Date(Date.now() - days * 24 * 3600000) };

    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const incidents = await Incident.find(filter)
      .sort({ capturedAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: {
        incidents,
        total: incidents.length,
        geojson: {
          type: "FeatureCollection",
          features: incidents
            .filter((i) => i.location?.coordinates)
            .map((i) => ({
              type: "Feature",
              id: i.incidentId,
              geometry: i.location,
              properties: {
                incidentId: i.incidentId,
                type: i.type,
                severity: i.severity,
                status: i.status,
                description: i.description,
                district: i.district,
                segmentId: i.segmentId,
                capturedAt: i.capturedAt,
                photos: i.photos,
                reporter: i.reporterName,
                blocksTraffic: i.impact?.blocksTraffic,
              },
            })),
        },
      },
    });
  } catch (error) {
    console.error("incident/list:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyIncident = async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!["VERIFIED", "REJECTED", "RESOLVED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "status must be VERIFIED, REJECTED or RESOLVED",
      });
    }

    const incident = await Incident.findOne({
      $or: [{ incidentId: req.params.id }, { clientId: req.params.id }],
    });

    if (!incident) {
      return res.status(404).json({ success: false, message: "Incident not found" });
    }

    incident.status = status;
    incident.verificationNote = note;
    incident.verifiedAt = new Date();
    if (req.officer) incident.verifiedBy = req.officer._id;
    if (status === "RESOLVED") incident.resolvedAt = new Date();
    await incident.save();

    let segment = null;
    if (incident.segmentId) {
      const refreshed = await refreshSegment(incident.segmentId, { withWeather: false });
      segment = refreshed
        ? { segmentId: incident.segmentId, status: refreshed.segment.status }
        : null;
    }

    res.json({ success: true, data: { incident, segment } });
  } catch (error) {
    console.error("incident/verify:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const incidentStats = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 3600000);

    const [byType, bySeverity, byStatus, offlineCount, total] = await Promise.all([
      Incident.aggregate([
        { $match: { capturedAt: { $gte: since } } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      Incident.aggregate([
        { $match: { capturedAt: { $gte: since } } },
        { $group: { _id: "$severity", n: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { capturedAt: { $gte: since } } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Incident.countDocuments({ capturedAt: { $gte: since }, wasOffline: true }),
      Incident.countDocuments({ capturedAt: { $gte: since } }),
    ]);

    res.json({
      success: true,
      data: {
        windowDays: days,
        total,
        syncedFromOffline: offlineCount,
        byType: Object.fromEntries(byType.map((r) => [r._id, r.n])),
        bySeverity: Object.fromEntries(bySeverity.map((r) => [r._id, r.n])),
        byStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.n])),
      },
    });
  } catch (error) {
    console.error("incident/stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
