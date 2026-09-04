import dotenv from "dotenv";
import mongoose from "mongoose";
import Partner from "../src/models/partner.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import Incident from "../src/models/incident.model.js";
import LocationPing from "../src/models/locationPing.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";

dotenv.config();

const BASE = process.env.API_BASE || "http://127.0.0.1:5055/api/partner";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`);
  }
};

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

// Walk a real road polyline the way a vehicle would.
function walk(line, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = 0.25 + (i / count) * 0.4;
    const idx = Math.min(line.length - 2, Math.floor(t * (line.length - 1)));
    const local = t * (line.length - 1) - idx;
    const [x1, y1] = line[idx];
    const [x2, y2] = line[idx + 1];
    out.push([x1 + (x2 - x1) * local, y1 + (y2 - y1) * local]);
  }
  return out;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nDRIVER AS SENSOR AND REPORTER\n");

  const SEG = "NH2-DIMAPUR-IMPHAL::KOHIMA-SENAPATI";
  const seg = await RoadSegment.findOne({ segmentId: SEG });
  const line = seg.geometry.coordinates;

  console.log(`setup: ${seg.name}, baseline ${seg.baselineSpeedKmph} km/h`);

  // A real driver account, signed in the way the app does.
  const phone = "9876500011";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Test driver",
    phone,
    vehicleNumber: "NL01TEST9",
    vehicleType: "pickup",
    isOnline: true,
    isVerified: true,
  });

  const otp = await call("/send-otp", { method: "POST", body: { phone } });
  const login = await call("/login", { method: "POST", body: { phone, otp: otp.json.devOtp } });
  ok("driver signs in", login.status === 200 && Boolean(login.json.token));
  const token = login.json.token;

  console.log("\nthe driver as a sensor");
  const anon = await call("/location", { method: "PATCH", body: { coordinates: [93.9, 25.6] } });
  ok("location ping rejects anonymous", anon.status === 401);

  const path = walk(line, 6);
  let matched = null;
  for (const [lng, lat] of path) {
    const r = await call("/location", {
      method: "PATCH",
      token,
      body: {
        coordinates: [lng, lat],
        speedKmph: seg.baselineSpeedKmph * 0.95,
        accuracyM: 12,
        onTrip: true,
      },
    });
    if (r.data?.road) matched = r.data.road;
  }

  ok("pings are accepted", matched !== null);
  ok("the ping answers with the road it matched", matched?.segmentId === SEG,
     `${matched?.name} -> ${matched?.status}`);

  const pings = await LocationPing.countDocuments({ segmentId: SEG });
  ok("pings were stored against the road", pings > 0, `${pings} on this stretch`);

  const noisy = await call("/location", {
    method: "PATCH", token,
    body: { coordinates: path[0], speedKmph: 30, accuracyM: 400 },
  });
  ok("a poor GPS fix is accepted but not sensed", noisy.status === 200);

  console.log("\nwhat the driver is told");
  const cond = await call(`/road-conditions?lng=${path[2][0]}&lat=${path[2][1]}`, { token });
  ok("road conditions load", cond.status === 200 && cond.data.onRoad !== undefined,
     cond.data?.onRoad ? `on ${cond.data.onRoad.name}` : "no road matched");
  ok("it knows which road the driver is on", cond.data?.onRoad?.segmentId === SEG);
  ok("it lists roads around them", Array.isArray(cond.data?.ahead) && cond.data.ahead.length > 0,
     `${cond.data?.ahead?.length} nearby`);
  ok("warnings are a short list, not everything",
     Array.isArray(cond.data?.warnings) && cond.data.warnings.length <= 5,
     `${cond.data?.warnings?.length} warnings`);

  if (cond.data?.warnings?.length) {
    console.log("\n  what the driver would see");
    for (const w of cond.data.warnings.slice(0, 4)) {
      console.log(`    [${w.level.padEnd(7)}] ${w.title}`);
      console.log(`              ${w.detail}`);
    }
  }

  console.log("\nthe driver as a reporter");
  const where = await call(`/where-am-i?lng=${path[2][0]}&lat=${path[2][1]}`, { token });
  ok("the report screen can name the road from GPS",
     where.data?.segment?.segmentId === SEG,
     `${where.data?.segment?.name}, ${where.data?.segment?.distanceKm} km off centreline`);

  const clientId = "test-drv-" + Date.now();
  const report = await call("/report", {
    method: "POST",
    token,
    body: {
      clientId,
      segmentId: SEG,
      type: "LANDSLIDE",
      severity: "HIGH",
      description: "Landslide on the road. Nothing can pass. Reported by a driver on the road.",
      coordinates: path[2],
      accuracyM: 10,
      capturedAt: new Date().toISOString(),
      impact: { blocksTraffic: true },
    },
  });
  ok("driver hazard report accepted", report.status === 201,
     `${report.data?.incident?.type} / ${report.data?.incident?.severity}`);
  ok("it is filed as coming from a driver, not an officer",
     report.data?.incident?.reporterModel === "Partner",
     report.data?.incident?.reporterName);
  ok("it attached to the right road", report.data?.incident?.segmentId === SEG);

  const replay = await call("/report", {
    method: "POST", token,
    body: { clientId, description: "same", coordinates: path[2] },
  });
  ok("a retry does not file it twice", replay.json?.duplicate === true);

  console.log("\ntrust: one driver cannot close a highway");
  const after = await RoadSegment.findOne({ segmentId: SEG }).lean();
  ok("an unconfirmed driver report does not set BLOCKED",
     after.status !== "BLOCKED",
     `road is ${after.status}`);

  const inc = await Incident.findOne({ clientId }).lean();
  ok("the report is held for an officer to confirm", inc.status === "REPORTED");

  console.log("\ncleanup");
  await Incident.deleteMany({ clientId: /^test-drv-/ });
  const p = await Partner.findOne({ phone });
  await LocationPing.deleteMany({ partner: p._id });
  await Partner.deleteOne({ phone });

  // Deleting the report is not enough: the road is still RESTRICTED because of
  // it. Recompute so the suite leaves the network as it found it.
  const reset = await refreshSegment(SEG, { withWeather: false });
  console.log(`  test driver, pings and report removed; ${SEG} -> ${reset?.segment?.status}`);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nsuite crashed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
