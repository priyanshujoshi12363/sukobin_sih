import crypto from "crypto";
import fs from "fs/promises";
import cloudinary from "../utils/cloudinary.js";
import Incident from "../models/incident.model.js";
import RoadSegment from "../models/roadSegment.model.js";
import { matchToSegment } from "../utils/probes.js";
import { refreshSegment } from "../utils/accessibility.js";
import { understandSpokenReport, buildDescription } from "../utils/voiceReport.js";
import { distToRouteKm } from "../utils/geo.js";

const INCIDENT_MATCH_KM = Number(process.env.INCIDENT_MATCH_KM) || 8;

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
  return { reporterModel: "Partner", reporterName: "Driver" };
}

/**
 * Step one: the driver speaks, this says what it understood.
 *
 * Deliberately does not save anything. A report that changes a road's status
 * should not be filed from a guess about rough speech without the person who
 * spoke seeing what was heard first.
 */
export const understand = async (req, res) => {
  try {
    const { spokenText, spokenLang, segmentId, coordinates, photoCount } = req.body;

    if (!String(spokenText || "").trim()) {
      return res.status(400).json({ success: false, message: "Nothing was said" });
    }

    let segment = null;
    if (segmentId) {
      segment = await RoadSegment.findOne({ segmentId }).select("name districts").lean();
    } else if (Array.isArray(coordinates) && coordinates.length === 2) {
      segment = await matchToSegment(coordinates, INCIDENT_MATCH_KM);
    }

    const understood = await understandSpokenReport({
      spokenText,
      spokenLang,
      segmentName: segment?.name,
      district: segment?.districts?.[0],
      photoCount: Number(photoCount) || 0,
    });

    res.json({
      success: true,
      data: {
        understood,
        segment: segment ? { segmentId: segment.segmentId, name: segment.name } : null,
        // What the app should show back to the driver before sending.
        confirm: {
          headline: understood.summary || understood.english,
          type: understood.type,
          severity: understood.severity,
          blocksTraffic: understood.blocksTraffic,
          clearanceHours: understood.estimatedClearanceHours,
          spokenIn: understood.detectedLanguage,
          readBy: understood.source,
          uncertain: understood.needsReview || understood.confidence < 0.5,
        },
      },
    });
  } catch (error) {
    console.error("report/understand:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

async function uploadPhotos(files) {
  const list = files?.photos || files?.photo || [];
  if (!list.length) return [];

  const urls = [];
  for (const file of list.slice(0, 4)) {
    try {
      // multer here writes to disk, so cloudinary takes the path, not a buffer.
      const up = await cloudinary.uploader.upload(file.path, {
        folder: "sukobin/incidents",
        resource_type: "image",
        transformation: [{ width: 1280, height: 1280, crop: "limit", quality: "auto" }],
      });
      urls.push(up.secure_url);
    } catch (e) {
      // A failed photo must not lose the report: the words matter more.
      console.error("incident photo upload:", e.message);
    } finally {
      try {
        if (file.path) await fs.unlink(file.path);
      } catch {
        /* the temp file will be cleared by the OS */
      }
    }
  }
  return urls;
}

/**
 * Step two: file it, with the photo, the driver's own words, and whatever the
 * driver corrected in the confirmation.
 */
export const submit = async (req, res) => {
  try {
    const b = req.body;
    const clientId = String(b.clientId || "").trim();

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "clientId is required so a retry cannot file the same report twice",
      });
    }

    const existing = await Incident.findOne({ clientId });
    if (existing) {
      return res.json({
        success: true,
        duplicate: true,
        message: "Already recorded",
        data: { incident: existing },
      });
    }

    const coordinates = Array.isArray(b.coordinates)
      ? b.coordinates.map(Number)
      : String(b.coordinates || "").split(",").map(Number);

    if (coordinates.length !== 2 || coordinates.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ success: false, message: "coordinates must be [lng, lat]" });
    }

    const photos = await uploadPhotos(req.files);

    let segment = null;
    if (b.segmentId) {
      segment = await RoadSegment.findOne({ segmentId: b.segmentId });
    }
    if (!segment) segment = await matchToSegment(coordinates, INCIDENT_MATCH_KM);

    // Re-read the speech server-side rather than trusting whatever the client
    // posted, then let explicit driver corrections override it.
    const understood = await understandSpokenReport({
      spokenText: b.spokenText,
      spokenLang: b.spokenLang,
      segmentName: segment?.name,
      district: segment?.districts?.[0],
      photoCount: photos.length,
    });

    const type = b.type || understood.type;
    const severity = b.severity || understood.severity;
    const blocksTraffic =
      b.blocksTraffic === undefined
        ? understood.blocksTraffic
        : b.blocksTraffic === true || b.blocksTraffic === "true";

    const clearance =
      b.estimatedClearanceHours !== undefined && b.estimatedClearanceHours !== ""
        ? Number(b.estimatedClearanceHours)
        : understood.estimatedClearanceHours;

    const line = segment?.geometry?.coordinates;
    const offset = Array.isArray(line) && line.length ? distToRouteKm(coordinates, line) : null;

    const incident = await Incident.create({
      incidentId: newIncidentId(),
      clientId,
      ...reporterFrom(req),
      type,
      severity,
      description: buildDescription({
        spokenText: b.spokenText,
        english: understood.english,
        summary: understood.summary,
        detectedLanguage: understood.detectedLanguage,
      }),
      photos,
      location: { type: "Point", coordinates },
      accuracyM: Number(b.accuracyM) || 0,
      address: b.address,
      district: b.district || segment?.districts?.[0],
      state: b.state || segment?.states?.[0],
      segment: segment?._id,
      segmentId: segment?.segmentId,
      distanceToSegmentKm: Number.isFinite(offset) ? +offset.toFixed(2) : null,
      capturedAt: b.capturedAt ? new Date(b.capturedAt) : new Date(),
      syncedAt: new Date(),
      wasOffline: b.wasOffline === true || b.wasOffline === "true",
      impact: {
        blocksTraffic,
        passableBy: understood.passableBy,
        estimatedClearanceHours: Number.isFinite(clearance) ? clearance : undefined,
      },
    });

    let segmentUpdate = null;
    if (segment) {
      const refreshed = await refreshSegment(segment.segmentId, { withWeather: false });
      segmentUpdate = {
        segmentId: segment.segmentId,
        name: segment.name,
        status: refreshed?.segment?.status,
      };
    }

    res.status(201).json({
      success: true,
      message: "Report sent",
      data: {
        incident,
        photos: photos.length,
        understood: {
          spokenIn: understood.detectedLanguage,
          english: understood.english,
          summary: understood.summary,
          readBy: understood.source,
          confidence: understood.confidence,
        },
        segment: segmentUpdate,
        unmatched: !segment,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Incident.findOne({ clientId: req.body?.clientId });
      if (existing) {
        return res.json({ success: true, duplicate: true, data: { incident: existing } });
      }
    }
    console.error("report/voice:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
