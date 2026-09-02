import Parcel from "../models/parcel.model.js";
import User from "../models/user.model.js";
import { calculateDistance, calculateParcelCharge } from "../utils/calculation.js";
import { sendPush } from "../utils/notification.js";
import { notifyPartnersOfJob } from "../utils/notifyPartners.js";
import { fetchRoutePolyline } from "../utils/routing.js";
import { geocodeAddress } from "../utils/geocode.js";

const POOL_TTL_MIN = Number(process.env.PARCEL_POOL_TTL_MIN) || 120;

const VALID_TYPES = ["Documents", "Electronics", "Food", "Clothes", "Medicines", "Other"];

const isValidCoords = (c) => Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === "number");

const otp4 = () => String(Math.floor(1000 + Math.random() * 9000));

const addressText = (endpoint) =>
  typeof endpoint?.address === "string" ? endpoint.address : endpoint?.address?.fullAddress;

// Resolve an endpoint to [lng,lat]: prefer explicit coordinates, else geocode the
// typed address, else fall back (used for the sender's own saved pickup location).
async function resolveEndpoint(endpoint, fallbackCoords, label = "location") {
  if (!endpoint) endpoint = {};
  let coordinates = endpoint.coordinates;

  if (!isValidCoords(coordinates) && endpoint.location?.coordinates) {
    coordinates = endpoint.location.coordinates;
  }

  // typed address → coordinates
  if (!isValidCoords(coordinates)) {
    const text = addressText(endpoint);
    if (text && text.trim()) {
      const geo = await geocodeAddress(text);
      if (isValidCoords(geo)) coordinates = geo;
    }
  }

  if (!isValidCoords(coordinates) && isValidCoords(fallbackCoords)) {
    coordinates = fallbackCoords;
  }

  if (!isValidCoords(coordinates)) {
    throw new Error(`Couldn't locate the ${label} — add more detail (e.g. town & district).`);
  }

  return coordinates;
}

function normaliseAddress(addr) {
  if (!addr) return {};
  if (typeof addr === "string") return { fullAddress: addr };
  return {
    houseNumber: addr.houseNumber,
    landmark: addr.landmark,
    village: addr.village,
    town: addr.town,
    district: addr.district,
    state: addr.state,
    pincode: addr.pincode,
    fullAddress: addr.fullAddress,
  };
}

async function buildQuote(req) {
  const user = await User.findById(req.user._id);
  if (!user) throw new Error("User not found");

  const { pickup = {}, drop = {}, weightKg = 1, type = "Other" } = req.body;

  const fallbackPickup = user.location?.coordinates;
  const [pickupCoords, dropCoords] = await Promise.all([
    resolveEndpoint(pickup, fallbackPickup, "pickup address"),
    resolveEndpoint(drop, null, "drop address"),
  ]);

  const distanceKm = calculateDistance(
    pickupCoords[1],
    pickupCoords[0],
    dropCoords[1],
    dropCoords[0]
  );

  const safeType = VALID_TYPES.includes(type) ? type : "Other";
  const weight = Math.max(0, Number(weightKg) || 1);

  const charge = calculateParcelCharge(distanceKm, weight, safeType);

  return {
    user,
    pickupCoords,
    dropCoords,
    distanceKm,
    type: safeType,
    weight,
    ...charge,
  };
}

export const quoteParcel = async (req, res) => {
  try {
    const q = await buildQuote(req);
    res.status(200).json({
      success: true,
      quote: {
        distanceKm: Number(q.distanceKm.toFixed(2)),
        deliveryCharge: q.deliveryCharge,
        platformFee: q.platformFee,
        totalAmount: q.totalAmount,
        breakdown: q.breakdown,
        pickupCoordinates: q.pickupCoords,
        dropCoordinates: q.dropCoords,
        weightKg: q.weight,
        type: q.type,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createParcel = async (req, res) => {
  try {
    const q = await buildQuote(req);
    const { pickup = {}, drop = {}, description, notes, paymentMethod } = req.body;

    const parcelId = `PCL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const isCod = (paymentMethod === "RAZORPAY" ? "RAZORPAY" : "COD") === "COD";

    // fetch the real road route pickup → drop (for the driver's map + ETA)
    const route = await fetchRoutePolyline([q.pickupCoords, q.dropCoords]);

    const parcel = await Parcel.create({
      parcelId,
      sender: q.user._id,
      pickup: {
        contactName: pickup.contactName || q.user.name,
        contactPhone: pickup.contactPhone || q.user.phone,
        address: normaliseAddress(pickup.address || q.user.address),
        location: { type: "Point", coordinates: q.pickupCoords },
      },
      drop: {
        contactName: drop.contactName,
        contactPhone: drop.contactPhone,
        address: normaliseAddress(drop.address),
        location: { type: "Point", coordinates: q.dropCoords },
      },
      package: {
        type: q.type,
        weightKg: q.weight,
        description,
      },
      distanceKm: Number(q.distanceKm.toFixed(2)),
      routePolyline: route.polyline,
      routeDurationMin: route.durationMin,
      deliveryCharge: q.deliveryCharge,
      platformFee: q.platformFee,
      totalAmount: q.totalAmount,
      paymentMethod: isCod ? "COD" : "RAZORPAY",
      paymentStatus: "PENDING",
      // COD parcels enter the matching pool immediately; RAZORPAY ones wait for payment
      status: isCod ? "POOLED" : "REQUESTED",
      poolExpiresAt: isCod ? new Date(Date.now() + POOL_TTL_MIN * 60 * 1000) : undefined,
      pickupOtp: otp4(),
      deliveryOtp: otp4(),
      timeline: [
        { status: "REQUESTED", at: new Date(), note: "Parcel request created" },
        ...(isCod ? [{ status: "POOLED", at: new Date(), note: "Added to delivery pool" }] : []),
      ],
      notes,
    });

    if (q.user.expoPushToken) {
      sendPush(q.user.expoPushToken, {
        title: "Parcel requested",
        body: `Request ${parcel.parcelId} created · ₹${parcel.totalAmount}. We're finding a partner on your route.`,
        data: { type: "PARCEL_CREATED", parcelId: parcel.parcelId, screen: "parcel" },
      });
    }

    // notify online partners whose route this parcel falls on
    if (parcel.status === "POOLED") {
      notifyPartnersOfJob({
        kind: "parcel",
        refId: parcel.parcelId,
        type: parcel.package?.type || "Parcel",
        fee: parcel.deliveryCharge,
        pickup: parcel.pickup.location.coordinates,
        drop: parcel.drop.location.coordinates,
      });
    }

    res.status(201).json({
      success: true,
      message: "Parcel request created",
      data: { parcel },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyParcels = async (req, res) => {
  try {
    const parcels = await Parcel.find({ sender: req.user._id })
      .sort("-createdAt")
      .lean();
    res.status(200).json({ success: true, data: { parcels } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getParcelById = async (req, res) => {
  try {
    const parcel = await Parcel.findOne({ _id: req.params.id, sender: req.user._id });
    if (!parcel) {
      return res.status(404).json({ success: false, message: "Parcel not found" });
    }
    res.status(200).json({ success: true, data: { parcel } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelParcel = async (req, res) => {
  try {
    const parcel = await Parcel.findOne({ _id: req.params.id, sender: req.user._id });
    if (!parcel) {
      return res.status(404).json({ success: false, message: "Parcel not found" });
    }
    if (!["REQUESTED", "POOLED"].includes(parcel.status)) {
      return res.status(400).json({ success: false, message: "This parcel can no longer be cancelled" });
    }
    parcel.status = "CANCELLED";
    parcel.timeline.push({ status: "CANCELLED", at: new Date(), note: "Cancelled by sender" });
    await parcel.save();
    res.status(200).json({ success: true, message: "Parcel cancelled", data: { parcel } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
