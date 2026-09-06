import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import Partner from "../src/models/partner.model.js";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";

dotenv.config();

const P = process.env.API_BASE || "http://127.0.0.1:5055/api/partner";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function json(pathname, { method = "GET", token, body } = {}) {
  const res = await fetch(P + pathname, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// A real 1x1 PNG, so the upload path runs for real rather than being stubbed.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nPHOTO + SPEECH, EXACTLY AS THE APP SENDS IT\n");
  console.log("  multipart/form-data, coordinates as the \"lng,lat\" string\n");

  const phone = "9876500055";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Multipart test driver", phone, vehicleNumber: "NL01MPART",
    vehicleType: "pickup", capacity: 3, isOnline: true, isVerified: true,
  });

  const otp = await json("/send-otp", { method: "POST", body: { phone } });
  const login = await json("/login", { method: "POST", body: { phone, otp: otp.json.devOtp } });
  const token = login.json.token;
  ok("driver signs in", Boolean(token));

  const SEG = "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA";
  const seg = await RoadSegment.findOne({ segmentId: SEG });
  const line = seg.geometry.coordinates;
  const [lng, lat] = line[Math.floor(line.length / 2)];

  console.log(`  phone's GPS fix : ${lng}, ${lat}  (±9 m)`);
  console.log(`  posted as       : "${lng},${lat}"\n`);

  const clientId = "test-mp-" + Date.now();

  // Exactly the field names and shapes SpeakReportActivity posts.
  const form = new FormData();
  form.append("clientId", clientId);
  form.append("segmentId", "");                     // empty: let the server match it
  form.append("spokenText", "yahan pahad se malba gir gaya hai poora rasta band hai");
  form.append("spokenLang", "hi");
  form.append("coordinates", `${lng},${lat}`);      // the "lng,lat" string
  form.append("accuracyM", "9.0");
  form.append("capturedAt", new Date().toISOString());
  form.append("type", "");
  form.append("severity", "");
  form.append("blocksTraffic", "true");
  form.append("photos", new Blob([PNG], { type: "image/png" }), "hazard.png");

  const res = await fetch(P + "/report/voice", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: form,
  });
  const body = await res.json().catch(() => ({}));

  ok("multipart report accepted", res.status === 201, body?.message || "");

  const inc = await Incident.findOne({ clientId }).lean();

  ok("coordinates arrived and parsed", Array.isArray(inc?.location?.coordinates),
     JSON.stringify(inc?.location?.coordinates));

  // The one that actually bites: lng/lat swapped stores a point in the wrong
  // hemisphere and every geo query silently misses.
  const [gotLng, gotLat] = inc?.location?.coordinates || [];
  ok("longitude first, latitude second - not swapped",
     Math.abs(gotLng - lng) < 1e-6 && Math.abs(gotLat - lat) < 1e-6,
     `sent ${lng},${lat} - stored ${gotLng},${gotLat}`);

  ok("accuracy carried through", inc?.accuracyM === 9);

  ok("the road was matched from the coordinates alone",
     inc?.segmentId === SEG, `${inc?.segmentId}`);
  ok("distance off the centreline computed",
     typeof inc?.distanceToSegmentKm === "number", `${inc?.distanceToSegmentKm} km`);
  ok("district resolved from the road", Boolean(inc?.district), inc?.district);

  ok("photo uploaded and stored", (inc?.photos || []).length === 1,
     (inc?.photos || [])[0]?.slice(0, 60));

  ok("speech was read and structured", Boolean(inc?.type) && inc?.type !== "OTHER",
     `${inc?.type} / ${inc?.severity} / blocks=${inc?.impact?.blocksTraffic}`);

  ok("filed as coming from the driver", inc?.reporterModel === "Partner");

  // It must be findable by the geo query the dashboard map uses.
  const near = await Incident.find({
    location: {
      $near: { $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: 500 },
    },
    clientId,
  }).lean();
  ok("findable by the map's geo query", near.length === 1);

  console.log("\ncleanup");
  await Incident.deleteMany({ clientId: /^test-mp-/ });
  await Partner.deleteOne({ phone });
  await RoadSegment.updateOne({ segmentId: SEG },
    { $set: { status: "UNKNOWN", statusSource: "SEED", statusNote: "" } });
  await refreshSegment(SEG, { withWeather: false });
  console.log("  removed");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nsuite crashed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
