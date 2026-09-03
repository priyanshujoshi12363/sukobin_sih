import "dotenv/config";
import mongoose from "mongoose";
import Parcel from "../src/models/parcel.model.js";
import Partner from "../src/models/partner.model.js";
import { bboxPolygon, distToRouteKm } from "../src/utils/geo.js";
import { fetchRoutePolyline } from "../src/utils/routing.js";
import { jobFromParcel } from "../src/utils/jobs.js";
import { scoreAndRank } from "../src/utils/matching.js";

const DRIVER_FIX_MAX_AGE_MIN = Number(process.env.DRIVER_FIX_MAX_AGE_MIN) || 120;
const DRIVER_FIX_MAX_OFFSET_KM = Number(process.env.DRIVER_FIX_MAX_OFFSET_KM) || 25;

const GUWAHATI = [91.7362, 26.1445];
const SHILLONG = [91.8933, 25.5788];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const partner = await Partner.findOne({ phone: "9111122233" });

  const parcel = await Parcel.findOne().sort({ createdAt: -1 });
  const previousStatus = parcel.status;
  parcel.status = "POOLED";
  parcel.poolExpiresAt = new Date(Date.now() + 3600000);
  await parcel.save();

  const road = await fetchRoutePolyline([GUWAHATI, SHILLONG]);
  const polyline = road.polyline;

  const within = { $geoWithin: { $geometry: bboxPolygon(polyline, 12) } };
  const pooled = await Parcel.find({
    status: "POOLED",
    poolExpiresAt: { $gt: new Date() },
    "pickup.location": within,
    "drop.location": within,
  }).lean();

  const jobs = pooled.map(jobFromParcel).filter(Boolean);

  const lastFix = partner.currentLocation?.coordinates;
  const fixAgeMin = partner.lastActive
    ? (Date.now() - new Date(partner.lastActive).getTime()) / 60000
    : Infinity;
  const offsetKm = Array.isArray(lastFix) ? distToRouteKm(lastFix, polyline) : Infinity;

  const fixUsable =
    Array.isArray(lastFix) &&
    lastFix.length === 2 &&
    fixAgeMin <= DRIVER_FIX_MAX_AGE_MIN &&
    offsetKm <= DRIVER_FIX_MAX_OFFSET_KM;

  console.log("route            :", road.distanceKm, "km via", road.source);
  console.log("pooled on route  :", jobs.length, "job(s)");
  console.log("");
  console.log("driver last fix  :", JSON.stringify(lastFix));
  console.log("  age            :", fixAgeMin.toFixed(0), "min   (limit", DRIVER_FIX_MAX_AGE_MIN + ")");
  console.log("  off route      :", offsetKm.toFixed(0), "km    (limit", DRIVER_FIX_MAX_OFFSET_KM + ")");
  console.log("  usable         :", fixUsable, fixUsable ? "" : "-> falls back to route origin");
  console.log("");

  for (const [label, loc] of [
    ["with the guard (fixed)", fixUsable ? lastFix : GUWAHATI],
    ["trusting the stale fix (old behaviour)", lastFix],
  ]) {
    const ranked = scoreAndRank({
      jobs,
      polyline,
      driverLoc: loc,
      origin: GUWAHATI,
      destination: SHILLONG,
      originRadiusKm: 15,
      destRadiusKm: 15,
    });
    console.log("  " + label.padEnd(40) + " -> " + ranked.length + " matched");
    for (const j of ranked) {
      console.log("      " + j.refId + "  Rs" + j.fee + "  " + j.offRouteKm + " km off route");
    }
  }

  parcel.status = previousStatus;
  await parcel.save();
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
