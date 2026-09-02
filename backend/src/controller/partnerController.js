import crypto from "crypto";
import { saveToken } from "../utils/pushTokens.js";
import jwt from "jsonwebtoken";
import Partner from "../models/partner.model.js";
import Otp from "../models/otp.model.js";
import Order from "../models/order.model.js";
import Parcel from "../models/parcel.model.js";
import User from "../models/user.model.js";
import "../models/shop.model.js"; // register Shop model so Order.populate("shop") works
import { lookupVehicle } from "../utils/vahan.js";
import { sendPush } from "../utils/notification.js";
import { bboxPolygon, haversineKm, routeLengthKm } from "../utils/geo.js";
import { jobFromParcel, jobFromOrder } from "../utils/jobs.js";
import { scoreAndRank } from "../utils/matching.js";
import { etaMinutes } from "../utils/routing.js";
import { searchTowns, cityRadiusKm } from "../data/nerNetwork.js";
import { fetchRoutePolyline } from "../utils/routing.js";
import { routeAccessibility } from "../utils/accessibility.js";
import { ingestProbe } from "../utils/probeIngest.js";

const gen4 = () => String(Math.floor(1000 + Math.random() * 9000));
const SHOP_FIELDS = "location address shopName phoneNumber";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const isProd = process.env.NODE_ENV === "production";

// Returning the OTP in the API response is a deliberate weakness, kept behind an
// explicit opt-in so it is never on by accident. It exists because no SMS
// provider is wired yet: without it nobody can sign in to a deployed build.
// Set ALLOW_DEV_OTP=true only for demo environments; leave it unset in real use.
const allowDevOtp = process.env.ALLOW_DEV_OTP === "true" || !isProd;

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const normPhone = (p) => String(p || "").replace(/[^0-9]/g, "").slice(-10);

const signToken = (partner) =>
  jwt.sign({ id: partner._id, role: "partner" }, process.env.JWT_SECRET, { expiresIn: "60d" });

const publicPartner = (p) => ({
  _id: p._id,
  name: p.name,
  phone: p.phone,
  vehicleNumber: p.vehicleNumber,
  vehicle: p.vehicle,
  vehicleType: p.vehicleType,
  capacity: p.capacity,
  rating: p.rating,
  totalTrips: p.totalTrips,
  totalDeliveries: p.totalDeliveries,
  isOnline: p.isOnline,
  isVerified: p.isVerified,
});

// ─── Send OTP ────────────────────────────────────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    if (phone.length !== 10) {
      return res.status(400).json({ success: false, message: "Enter a valid 10-digit phone number" });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await Otp.findOneAndUpdate(
      { phone, role: "partner" },
      { codeHash: hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // TODO: integrate an SMS provider (MSG91/Twilio) here.
    console.log(`📲 Partner OTP for ${phone}: ${code}`);

    res.status(200).json({
      success: true,
      message: "OTP sent",
      ...(allowDevOtp ? { devOtp: code, devOtpNotice: "demo mode - disable ALLOW_DEV_OTP in production" } : {}),
    });
  } catch (error) {
    console.error("sendOtp error:", error);
    res.status(500).json({ success: false, message: "Could not send OTP" });
  }
};

async function consumeOtp(phone, code) {
  const otp = await Otp.findOne({ phone, role: "partner" });
  if (!otp) return { ok: false, message: "Please request an OTP first" };
  if (otp.expiresAt < new Date()) { await otp.deleteOne(); return { ok: false, message: "OTP expired, request a new one" }; }
  if (otp.attempts >= MAX_ATTEMPTS) { await otp.deleteOne(); return { ok: false, message: "Too many attempts, request a new OTP" }; }
  if (hashCode(code) !== otp.codeHash) {
    otp.attempts += 1;
    await otp.save();
    return { ok: false, message: "Invalid OTP" };
  }
  await otp.deleteOne();
  return { ok: true };
}

// ─── Look up vehicle details from the number plate (pre-registration) ─────────────
export const verifyVehicleNumber = async (req, res) => {
  try {
    const { vehicleNumber } = req.body;
    if (!vehicleNumber) {
      return res.status(400).json({ success: false, message: "Vehicle number is required" });
    }
    const reg = String(vehicleNumber).toUpperCase().replace(/\s+/g, "");

    const existing = await Partner.findOne({ vehicleNumber: reg });
    if (existing) {
      return res.status(409).json({ success: false, message: "This vehicle is already registered" });
    }

    const vehicle = await lookupVehicle(reg);
    res.status(200).json({ success: true, data: { vehicleNumber: reg, vehicle } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Could not fetch vehicle details" });
  }
};

// ─── Register (vehicle + name + phone + otp) ──────────────────────────────────────
export const registerPartner = async (req, res) => {
  try {
    const { name, vehicleNumber, otp } = req.body;
    const phone = normPhone(req.body.phone);

    if (!name?.trim() || !vehicleNumber || phone.length !== 10 || !otp) {
      return res.status(400).json({ success: false, message: "Name, vehicle number, phone and OTP are required" });
    }

    const reg = String(vehicleNumber).toUpperCase().replace(/\s+/g, "");

    const [byPhone, byVehicle] = await Promise.all([
      Partner.findOne({ phone }),
      Partner.findOne({ vehicleNumber: reg }),
    ]);
    if (byPhone) return res.status(409).json({ success: false, message: "Phone already registered — please log in" });
    if (byVehicle) return res.status(409).json({ success: false, message: "Vehicle already registered" });

    const verify = await consumeOtp(phone, otp);
    if (!verify.ok) return res.status(400).json({ success: false, message: verify.message });

    const vehicle = await lookupVehicle(reg);

    const partner = await Partner.create({
      name: name.trim(),
      phone,
      vehicleNumber: reg,
      vehicle,
      vehicleType: vehicle.vehicleType,
      capacity: vehicle.capacity,
      isVerified: vehicle.verified, // RC-verified vehicles are auto-verified
    });

    const token = signToken(partner);
    res.status(201).json({ success: true, message: "Registered successfully", token, partner: publicPartner(partner) });
  } catch (error) {
    console.error("registerPartner error:", error);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

// ─── Login (phone + otp) ──────────────────────────────────────────────────────────
export const loginPartner = async (req, res) => {
  try {
    const phone = normPhone(req.body.phone);
    const { otp } = req.body;
    if (phone.length !== 10 || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const partner = await Partner.findOne({ phone });
    if (!partner) return res.status(404).json({ success: false, message: "No partner found — please register" });
    if (partner.isBlocked) return res.status(403).json({ success: false, message: "Your account is blocked" });

    const verify = await consumeOtp(phone, otp);
    if (!verify.ok) return res.status(400).json({ success: false, message: verify.message });

    partner.lastActive = new Date();
    await partner.save();

    const token = signToken(partner);
    res.status(200).json({ success: true, message: "Login successful", token, partner: publicPartner(partner) });
  } catch (error) {
    console.error("loginPartner error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({ success: true, partner: publicPartner(req.partner) });
};

// ─── Toggle online / offline ───────────────────────────────────────────────────────
// Only online partners are allowed to pick a route and pull available parcels.
export const setOnlineStatus = async (req, res) => {
  try {
    const { isOnline, coordinates } = req.body;
    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ success: false, message: "isOnline (true/false) is required" });
    }
    if (req.partner.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account is blocked" });
    }

    req.partner.isOnline = isOnline;
    req.partner.lastActive = new Date();

    // remember last known location when going online (used later for nearby parcel matching)
    if (isOnline && Array.isArray(coordinates) && coordinates.length === 2) {
      req.partner.currentLocation = { type: "Point", coordinates };
    }

    // going offline → stop receiving new-job pushes (clear the watched route)
    if (!isOnline) {
      req.partner.activeRoute = undefined;
    }

    await req.partner.save();

    res.status(200).json({
      success: true,
      message: isOnline ? "You're online" : "You're offline",
      isOnline: req.partner.isOnline,
    });
  } catch (error) {
    console.error("setOnlineStatus error:", error);
    res.status(500).json({ success: false, message: "Could not update status" });
  }
};

export const savePartnerExpoToken = async (req, res) => {
  try {
    const token = req.body?.token || req.body?.expoPushToken;
    const platform = req.body?.platform;

    if (!token) {
      return res.status(400).json({ success: false, message: "Push token is required" });
    }

    const result = await saveToken(Partner, req.partner._id, token, platform);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    res.status(200).json({ success: true, message: "Push token saved", platform: result.kind });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not save token" });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
//  ROUTE-MATCHING ENGINE  (see ROUTE_MATCHING.md)
// ════════════════════════════════════════════════════════════════════════════════

// ─── GET /places?q= — Uttarakhand town/city search for the route type-bar ───────────
export const placeSearch = async (req, res) => {
  try {
    const places = searchTowns(req.query.q || "", 8);
    res.status(200).json({ success: true, places });
  } catch (error) {
    console.error("placeSearch error:", error);
    res.status(200).json({ success: true, places: [] });
  }
};

// Public (pre-claim) job: fee only, no contact details.
const publicJob = (j) => ({
  kind: j.kind,
  refId: j.refId,
  type: j.type,
  fee: j.fee,
  weightKg: j.weightKg,
  pickup: { label: j.pickup.label, coordinates: j.pickup.coordinates },
  drop: { label: j.drop.label, coordinates: j.drop.coordinates },
  offRouteKm: j.offRouteKm,
  etaMin: j.etaMin,
  routeKm: j.routeKm,
  routePolyline: j.routePolyline || null,
  pickupOrder: j.pickupOrder,
});

// Claimed job: now the driver gets contact + the delivery OTP for handoff.
const claimedJob = (j) => ({
  kind: j.kind,
  refId: j.refId,
  type: j.type,
  fee: j.fee,
  pickup: { label: j.pickup.label, coordinates: j.pickup.coordinates, phone: j.pickup.phone },
  drop: { label: j.drop.label, coordinates: j.drop.coordinates, phone: j.drop.phone },
  routeKm: j.routeKm,
  etaMin: j.durationMin,
  routePolyline: j.routePolyline || null,
  otp: j._deliveryOtp || null,
});

// ─── POST /route/match — only-online drivers; mixed pool of orders + parcels ──────
export const matchRoute = async (req, res) => {
  try {
    if (!req.partner.isOnline) {
      return res.status(403).json({ success: false, message: "Go online to see deliveries" });
    }

    const { origin, destination, stops } = req.body;
    if (!origin?.coordinates || !destination?.coordinates) {
      return res.status(400).json({ success: false, message: "origin and destination coordinates are required" });
    }

    // Real road polyline, not a straight line. In the hills a straight
    // Dimapur -> Imphal line crosses ridges; the road wraps via Kohima and
    // Senapati, so the corridor must follow the road for "on my way" to be true.
    const waypoints = [
      origin.coordinates,
      ...((stops || []).map((s) => s.coordinates)),
      destination.coordinates,
    ].filter((c) => Array.isArray(c) && c.length === 2);
    if (waypoints.length < 2) {
      return res.status(400).json({ success: false, message: "Invalid route coordinates" });
    }

    const road = await fetchRoutePolyline(waypoints);
    const polyline = road.polyline?.length >= 2 ? road.polyline : waypoints;
    const distanceKm = road.distanceKm || routeLengthKm(polyline);
    const routeSource = road.source;

    // Do not send a driver down a corridor that is currently cut.
    const access = await routeAccessibility(polyline).catch(() => null);
    if (access && !access.passable) {
      return res.status(200).json({
        success: true,
        blocked: true,
        message: "This route is currently blocked",
        route: {
          stations: [origin.label, ...((stops || []).map((s) => s.label)), destination.label].filter(Boolean),
          distanceKm: +distanceKm.toFixed(1),
          durationMin: etaMinutes(distanceKm),
          source: routeSource,
          polyline,
        },
        blockedSegments: access.blocked.map((s) => ({
          segmentId: s.segmentId,
          name: s.name,
          note: s.statusNote,
        })),
        capacity: req.partner.capacity,
        count: 0,
        jobs: [],
      });
    }

    // a city is an area — a pickup in the origin city / drop in the destination city
    // matches regardless of the corridor (covers the whole of Haldwani, etc.)
    const cityName = (label) => String(label || "").split(",")[0].trim();
    const originRadiusKm = cityRadiusKm(cityName(origin.label));
    const destRadiusKm = cityRadiusKm(cityName(destination.label));

    // remember the watched route so we can push new matching jobs to this driver
    req.partner.activeRoute = {
      polyline,
      stations: [origin.label, ...((stops || []).map((s) => s.label)), destination.label].filter(Boolean),
      origin: origin.coordinates,
      destination: destination.coordinates,
      originRadiusKm,
      destRadiusKm,
      distanceKm: +distanceKm.toFixed(1),
      durationMin: etaMinutes(distanceKm),
      updatedAt: new Date(),
    };
    req.partner.save().catch(() => {});

    // STAGE 1 — coarse filter; pad the bbox by the largest city radius so endpoint-city
    // pickups/drops (up to ~15 km off the line) are still fetched
    const bbox = bboxPolygon(polyline, Math.max(originRadiusKm, destRadiusKm, 10) + 2);
    const within = { $geoWithin: { $geometry: bbox } };

    const [parcels, orders] = await Promise.all([
      Parcel.find({
        status: "POOLED", // COD parcels are pooled on creation; RAZORPAY after payment
        poolExpiresAt: { $gt: new Date() },
        "pickup.location": within,
        "drop.location": within,
      })
        .select("parcelId package deliveryCharge pickup drop distanceKm routePolyline routeDurationMin deliveryOtp createdAt")
        .limit(300)
        .lean(),
      Order.find({
        orderStatus: "READY_FOR_PICKUP",
        paymentStatus: "PAID",
        assignedPartner: null,
        location: within,
      })
        .populate("shop", SHOP_FIELDS)
        .select("orderId deliveryFee location deliveryAddress customerPhone shop routePolyline routeDistanceKm routeDurationMin createdAt")
        .limit(300)
        .lean(),
    ]);

    // normalize both into DeliveryJobs (carry createdAt for ageing)
    const jobs = [
      ...parcels.map((p) => { const j = jobFromParcel(p); if (j) j.createdAt = p.createdAt; return j; }),
      ...orders.map((o) => { const j = jobFromOrder(o); if (j) j.createdAt = o.createdAt; return j; }),
    ].filter(Boolean);

    // STAGE 2 — exact corridor + city-endpoint + direction + score
    const driverLoc = req.partner.currentLocation?.coordinates || origin.coordinates;
    const ranked = scoreAndRank({
      jobs,
      polyline,
      driverLoc,
      origin: origin.coordinates,
      destination: destination.coordinates,
      originRadiusKm,
      destRadiusKm,
    });

    res.status(200).json({
      success: true,
      route: {
        stations: [origin.label, ...((stops || []).map((s) => s.label)), destination.label].filter(Boolean),
        distanceKm: +distanceKm.toFixed(1),
        durationMin: etaMinutes(distanceKm),
        source: routeSource,
        polyline,
        conditions: access
          ? {
              worstStatus: access.worstStatus,
              maxRiskScore: access.maxRiskScore,
              degraded: access.degraded.map((s) => ({ segmentId: s.segmentId, name: s.name, status: s.status })),
              highRisk: access.highRisk.map((s) => ({ segmentId: s.segmentId, name: s.name, riskLevel: s.risk?.level })),
            }
          : null,
      },
      capacity: req.partner.capacity,
      count: ranked.length,
      jobs: ranked.map(publicJob),
    });
  } catch (error) {
    console.error("matchRoute error:", error);
    res.status(500).json({ success: false, message: "Could not load deliveries" });
  }
};

// ─── POST /trip/claim — atomically lock the selected jobs (no double-grab) ─────────
export const claimJobs = async (req, res) => {
  try {
    if (!req.partner.isOnline) {
      return res.status(403).json({ success: false, message: "Go online first" });
    }
    const { jobs } = req.body; // [{ kind, id }]
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ success: false, message: "No jobs selected" });
    }
    if (jobs.length > req.partner.capacity) {
      return res.status(400).json({ success: false, message: `Your vehicle carries up to ${req.partner.capacity}` });
    }

    const claimed = [];
    let skipped = 0;

    for (const { kind, id } of jobs) {
      if (kind === "parcel") {
        const doc = await Parcel.findOneAndUpdate(
          { parcelId: id, status: "POOLED", assignedPartner: null },
          {
            $set: { status: "ASSIGNED", assignedPartner: req.partner._id, deliveryOtp: gen4() },
            $push: { timeline: { status: "ASSIGNED", note: "Claimed by partner" } },
          },
          { new: true }
        ).lean();
        if (doc) claimed.push(claimedJob(jobFromParcel(doc)));
        else skipped++;
      } else if (kind === "order") {
        const doc = await Order.findOneAndUpdate(
          { orderId: id, orderStatus: "READY_FOR_PICKUP", assignedPartner: null },
          { $set: { assignedPartner: req.partner._id, assignedAt: new Date(), deliveryOtp: gen4() } },
          { new: true }
        )
          .populate("shop", SHOP_FIELDS)
          .lean();
        if (doc) claimed.push(claimedJob(jobFromOrder(doc)));
        else skipped++;
      } else {
        skipped++;
      }
    }

    if (claimed.length > 0) {
      req.partner.totalTrips = (req.partner.totalTrips || 0) + 1;
      req.partner.lastActive = new Date();
      await req.partner.save();
    }

    res.status(200).json({ success: true, claimed, skipped });
  } catch (error) {
    console.error("claimJobs error:", error);
    res.status(500).json({ success: false, message: "Could not claim jobs" });
  }
};

// best-effort push to a customer (User) by id
async function pushToUser(userId, title, body, data) {
  try {
    if (!userId) return;
    const u = await User.findById(userId).select("expoPushToken");
    if (u?.expoPushToken) sendPush(u.expoPushToken, { title, body, data });
  } catch (e) {
    console.error("pushToUser error:", e.message);
  }
}

// ─── GET /trip/active — the driver's claimed, not-yet-delivered jobs (survives crashes) ─
export const getActiveTrip = async (req, res) => {
  try {
    const me = req.partner._id;
    const [parcels, orders] = await Promise.all([
      Parcel.find({ assignedPartner: me, status: { $in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } })
        .select("parcelId package deliveryCharge pickup drop distanceKm routePolyline routeDurationMin deliveryOtp status")
        .lean(),
      Order.find({ assignedPartner: me, orderStatus: { $in: ["READY_FOR_PICKUP", "PICKED", "ON_THE_WAY"] } })
        .populate("shop", SHOP_FIELDS)
        .select("orderId deliveryFee location deliveryAddress customerPhone shop routePolyline routeDistanceKm routeDurationMin deliveryOtp orderStatus")
        .lean(),
    ]);

    const jobs = [
      ...parcels.map((p) => ({ ...claimedJob(jobFromParcel(p)), picked: p.status !== "ASSIGNED" })),
      ...orders.map((o) => ({ ...claimedJob(jobFromOrder(o)), picked: o.orderStatus !== "READY_FOR_PICKUP" })),
    ];

    res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("getActiveTrip error:", error);
    res.status(500).json({ success: false, message: "Could not load active trip" });
  }
};

// ─── POST /trip/picked — mark a job collected; tell the customer it's with the driver ─
export const markPickedUp = async (req, res) => {
  try {
    const { kind, id } = req.body;
    if (kind === "parcel") {
      const p = await Parcel.findOneAndUpdate(
        { parcelId: id, assignedPartner: req.partner._id },
        { $set: { status: "PICKED_UP" }, $push: { timeline: { status: "PICKED_UP" } } },
        { new: true }
      ).select("parcelId sender");
      if (p) pushToUser(p.sender, "Parcel picked up 📦", `Your parcel ${p.parcelId} is now with the driver and on the way.`, { type: "WITH_DRIVER", refId: p.parcelId });
    } else if (kind === "order") {
      const o = await Order.findOneAndUpdate(
        { orderId: id, assignedPartner: req.partner._id },
        { $set: { orderStatus: "PICKED", pickedAt: new Date() } },
        { new: true }
      ).select("orderId user");
      if (o) pushToUser(o.user, "Order picked up 📦", `Your order ${o.orderId} is now with the driver and on the way.`, { type: "WITH_DRIVER", refId: o.orderId });
    } else {
      return res.status(400).json({ success: false, message: "Invalid job kind" });
    }
    res.status(200).json({ success: true, message: "Picked up" });
  } catch (error) {
    console.error("markPickedUp error:", error);
    res.status(500).json({ success: false, message: "Could not update" });
  }
};

// ─── PATCH /location — driver live location + "driver is near" customer alerts ───────
const DRIVER_NEAR_KM = Number(process.env.DRIVER_NEAR_KM) || 10;

async function proximityNotify(partnerId, coords) {
  const [orders, parcels] = await Promise.all([
    Order.find({ assignedPartner: partnerId, orderStatus: { $in: ["PICKED", "ON_THE_WAY"] }, driverNearNotified: { $ne: true } })
      .select("orderId location user").lean(),
    Parcel.find({ assignedPartner: partnerId, status: { $in: ["PICKED_UP", "IN_TRANSIT"] }, driverNearNotified: { $ne: true } })
      .select("parcelId drop sender").lean(),
  ]);

  for (const o of orders) {
    const dc = o.location?.coordinates;
    if (dc && haversineKm(coords, dc) <= DRIVER_NEAR_KM) {
      await Order.updateOne({ _id: o._id }, { $set: { driverNearNotified: true } });
      pushToUser(o.user, "Driver is near 🛵", `Your order ${o.orderId} is almost there — please be ready and wait for the driver's call.`, { type: "DRIVER_NEAR", refId: o.orderId });
    }
  }
  for (const p of parcels) {
    const dc = p.drop?.location?.coordinates;
    if (dc && haversineKm(coords, dc) <= DRIVER_NEAR_KM) {
      await Parcel.updateOne({ _id: p._id }, { $set: { driverNearNotified: true } });
      pushToUser(p.sender, "Driver is near 🛵", `Your parcel ${p.parcelId} is almost there — please be ready and wait for the driver's call.`, { type: "DRIVER_NEAR", refId: p.parcelId });
    }
  }
}

export const updateLocation = async (req, res) => {
  try {
    const { coordinates, speedKmph, headingDeg, accuracyM, onTrip } = req.body;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: "coordinates [lng,lat] required" });
    }

    req.partner.currentLocation = { type: "Point", coordinates };
    req.partner.lastActive = new Date();
    await req.partner.save();

    proximityNotify(req.partner._id, coordinates).catch((e) =>
      console.error("proximityNotify:", e.message)
    );

    ingestProbe(req.partner, {
      coordinates,
      speedKmph: Number.isFinite(speedKmph) ? speedKmph : null,
      headingDeg: Number.isFinite(headingDeg) ? headingDeg : null,
      accuracyM: Number.isFinite(accuracyM) ? accuracyM : null,
      onTrip: Boolean(onTrip),
    }).catch((e) => console.error("ingestProbe:", e.message));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("updateLocation error:", error);
    res.status(500).json({ success: false, message: "Could not update location" });
  }
};

export const completeDelivery = async (req, res) => {
  try {
    const { kind, id, otp } = req.body;
    let fee = 0;
    let customerUserId = null;

    if (kind === "parcel") {
      const p = await Parcel.findOne({
        parcelId: id,
        assignedPartner: req.partner._id,
        status: { $in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
      });
      if (!p) return res.status(404).json({ success: false, message: "Parcel not found on your trip" });
      if (p.deliveryOtp && otp && String(otp) !== String(p.deliveryOtp)) {
        return res.status(400).json({ success: false, message: "Incorrect delivery OTP" });
      }
      p.status = "DELIVERED";
      p.deliveredAt = new Date();
      p.timeline.push({ status: "DELIVERED" });
      await p.save();
      fee = p.deliveryCharge || 0;
      customerUserId = p.sender;
    } else if (kind === "order") {
      const o = await Order.findOne({
        orderId: id,
        assignedPartner: req.partner._id,
        orderStatus: { $in: ["READY_FOR_PICKUP", "PICKED", "ON_THE_WAY"] },
      });
      if (!o) return res.status(404).json({ success: false, message: "Order not found on your trip" });
      if (o.deliveryOtp && otp && String(otp) !== String(o.deliveryOtp)) {
        return res.status(400).json({ success: false, message: "Incorrect delivery OTP" });
      }
      o.orderStatus = "DELIVERED";
      o.deliveredAt = new Date();
      await o.save();
      fee = o.deliveryFee || 0;
      customerUserId = o.user;
    } else {
      return res.status(400).json({ success: false, message: "Invalid job kind" });
    }

    // credit the partner
    req.partner.totalDeliveries = (req.partner.totalDeliveries || 0) + 1;
    req.partner.walletBalance = (req.partner.walletBalance || 0) + fee;
    req.partner.lastActive = new Date();
    await req.partner.save();

    // notify the customer (best-effort)
    try {
      if (customerUserId) {
        const u = await User.findById(customerUserId).select("expoPushToken");
        if (u?.expoPushToken) {
          sendPush(u.expoPushToken, {
            title: "Delivered ✅",
            body: `Your ${kind} ${id} has been delivered.`,
            data: { type: "DELIVERY_DONE", refId: id, kind },
          });
        }
      }
    } catch (e) {
      console.error("deliver notify error:", e.message);
    }

    res.status(200).json({ success: true, message: "Delivered", earned: fee });
  } catch (error) {
    console.error("completeDelivery error:", error);
    res.status(500).json({ success: false, message: "Could not complete delivery" });
  }
};

// ─── GET /history — the partner's past deliveries (orders + parcels merged) ─────────
export const getPartnerHistory = async (req, res) => {
  try {
    const me = req.partner._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const need = page * limit; // fetch enough from each side to fill this page after merge

    const [orders, parcels] = await Promise.all([
      Order.find({ assignedPartner: me, orderStatus: "DELIVERED" })
        .select("orderId deliveryFee deliveryAddress deliveredAt")
        .sort("-deliveredAt")
        .limit(need)
        .lean(),
      Parcel.find({ assignedPartner: me, status: "DELIVERED" })
        .select("parcelId package deliveryCharge drop deliveredAt")
        .sort("-deliveredAt")
        .limit(need)
        .lean(),
    ]);

    const items = [
      ...orders.map((o) => ({
        kind: "order",
        refId: o.orderId,
        type: "Order",
        fee: o.deliveryFee || 0,
        dropLabel: o.deliveryAddress?.fullAddress || "Customer",
        deliveredAt: o.deliveredAt,
      })),
      ...parcels.map((p) => ({
        kind: "parcel",
        refId: p.parcelId,
        type: p.package?.type || "Parcel",
        fee: p.deliveryCharge || 0,
        dropLabel: p.drop?.address?.fullAddress || "Drop",
        deliveredAt: p.deliveredAt,
      })),
    ].sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());

    const start = (page - 1) * limit;
    const pageItems = items.slice(start, start + limit);

    res.status(200).json({
      success: true,
      data: {
        items: pageItems,
        page,
        hasMore:
          items.length > start + limit ||
          orders.length === need ||
          parcels.length === need, // a full fetch on either side hints there may be more
      },
    });
  } catch (error) {
    console.error("getPartnerHistory error:", error);
    res.status(500).json({ success: false, message: "Could not load history" });
  }
};

// ─── GET /stats — partner dashboard (earnings = delivery fees only) ────────────────
export const getPartnerStats = async (req, res) => {
  try {
    const me = req.partner._id;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekAgo.setHours(0, 0, 0, 0);

    const oDelivered = { assignedPartner: me, orderStatus: "DELIVERED" };
    const pDelivered = { assignedPartner: me, status: "DELIVERED" };

    const sumFee = (field) => [{ $group: { _id: null, earnings: { $sum: field }, count: { $sum: 1 } } }];
    const byDay = (field) => [
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$deliveredAt" } }, earnings: { $sum: field } } },
    ];

    const [oTot, pTot, oToday, pToday, oWeek, pWeek, activeOrders, activeParcels] = await Promise.all([
      Order.aggregate([{ $match: oDelivered }, ...sumFee("$deliveryFee")]),
      Parcel.aggregate([{ $match: pDelivered }, ...sumFee("$deliveryCharge")]),
      Order.aggregate([{ $match: { ...oDelivered, deliveredAt: { $gte: startToday } } }, ...sumFee("$deliveryFee")]),
      Parcel.aggregate([{ $match: { ...pDelivered, deliveredAt: { $gte: startToday } } }, ...sumFee("$deliveryCharge")]),
      Order.aggregate([{ $match: { ...oDelivered, deliveredAt: { $gte: weekAgo } } }, ...byDay("$deliveryFee")]),
      Parcel.aggregate([{ $match: { ...pDelivered, deliveredAt: { $gte: weekAgo } } }, ...byDay("$deliveryCharge")]),
      Order.countDocuments({ assignedPartner: me, orderStatus: { $in: ["READY_FOR_PICKUP", "PICKED", "ON_THE_WAY"] } }),
      Parcel.countDocuments({ assignedPartner: me, status: { $in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] } }),
    ]);

    const earn = (a) => Math.round(a[0]?.earnings || 0);
    const cnt = (a) => a[0]?.count || 0;

    // 7-day earnings trend (Mon..Sun positions filled with 0)
    const weekMap = {};
    [...oWeek, ...pWeek].forEach((d) => { weekMap[d._id] = (weekMap[d._id] || 0) + d.earnings; });
    const weekTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      weekTrend.push(Math.round(weekMap[dt.toISOString().slice(0, 10)] || 0));
    }

    res.status(200).json({
      success: true,
      data: {
        today: { earnings: earn(oToday) + earn(pToday), deliveries: cnt(oToday) + cnt(pToday) },
        lifetime: {
          earnings: earn(oTot) + earn(pTot),
          deliveries: cnt(oTot) + cnt(pTot),
          trips: req.partner.totalTrips || 0,
          rating: req.partner.rating ?? 5,
          wallet: Math.round(req.partner.walletBalance || 0),
        },
        weekTrend,
        active: activeOrders + activeParcels,
        isOnline: req.partner.isOnline,
      },
    });
  } catch (error) {
    console.error("getPartnerStats error:", error);
    res.status(500).json({ success: false, message: "Could not load stats" });
  }
};
