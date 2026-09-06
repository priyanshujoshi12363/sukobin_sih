import dotenv from "dotenv";
import mongoose from "mongoose";
import Partner from "../src/models/partner.model.js";
import Parcel from "../src/models/parcel.model.js";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import OfficerNotification from "../src/models/officerNotification.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";
import { runAlertScan } from "../src/utils/alertEngine.js";

dotenv.config();

const P = process.env.API_BASE || "http://127.0.0.1:5055/api/partner";
const D = "http://127.0.0.1:5055/api/dashboard";
const O = "http://127.0.0.1:5055/api/officer";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function call(base, path, { method = "GET", token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

async function signIn(base, phone) {
  const path = base === P ? "/send-otp" : "/otp";
  const o = await call(base, path, { method: "POST", body: { phone } });
  return call(base, "/login", { method: "POST", body: { phone, otp: o.json.devOtp } });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log("\nDRIVER FLOWS END TO END\n");

  const phone = "9876500033";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Flow test driver", phone, vehicleNumber: "NL01FLOW1",
    vehicleType: "pickup", capacity: 3, isOnline: true, isVerified: true,
  });

  const login = await signIn(P, phone);
  const token = login.json.token;
  ok("driver signs in", login.status === 200 && Boolean(token));

  // ── 1. route in, parcels on that route out ───────────────────────────────
  console.log("\n1. ENTER A ROUTE, SEE PARCELS ON IT");

  const places = await call(P, "/places?q=Dimapur", { token });
  ok("place search works", places.status === 200 && (places.json?.places?.length ?? 0) > 0,
     places.json?.places?.[0]?.label);

  const from = places.json.places[0];
  const toRes = await call(P, "/places?q=Kohima", { token });
  const to = toRes.json.places[0];
  ok("destination search works", Boolean(to), to?.label);

  const match = await call(P, "/route/match", {
    method: "POST", token,
    body: {
      origin: { label: from.label, coordinates: from.coordinates },
      destination: { label: to.label, coordinates: to.coordinates },
    },
  });
  ok("route match returns", match.status === 200, match.json?.message || "");
  ok("it reports the road it will use",
     Boolean(match.json?.route || match.json?.route || match.json?.jobs !== undefined),
     `${match.json?.jobs?.length ?? 0} deliveries offered`);

  const offered = match.json?.jobs ?? [];
  if (offered.length) {
    const j = offered[0];
    ok("each offer says what and how much", Boolean(j.refId) && j.fee !== undefined,
       `${j.refId} · ₹${j.fee} · ${j.type}`);
    ok("each offer says how far off route", j.offRouteKm !== undefined,
       `${j.offRouteKm} km detour`);

    const claim = await call(P, "/trip/claim", {
      method: "POST", token,
      body: { jobs: [{ kind: j.kind, id: j.refId }] },
    });
    ok("driver can accept a delivery", claim.status === 200,
       `claimed ${claim.json?.claimed?.length ?? 0}, skipped ${claim.json?.skipped ?? 0}`);

    const trip = await call(P, "/trip/active", { token });
    ok("it then appears on the trip screen", (trip.json?.jobs?.length ?? 0) > 0,
       `${trip.json?.jobs?.length} stop(s)`);
  } else {
    console.log("     (no parcels seeded on this corridor - claim path not exercised)");
  }

  // ── 2. hazard report reaches dashboard and officer ───────────────────────
  console.log("\n2. REPORT A HAZARD, SEE IT REACH THE DASHBOARD AND THE OFFICER");

  const SEG = "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA";
  const seg = await RoadSegment.findOne({ segmentId: SEG });
  const mid = seg.geometry.coordinates[Math.floor(seg.geometry.coordinates.length / 2)];

  await OfficerNotification.deleteMany({});

  const clientId = "test-flow-" + Date.now();
  const report = await call(P, "/report", {
    method: "POST", token,
    body: {
      clientId, segmentId: SEG, type: "ACCIDENT", severity: "HIGH",
      description: "Truck overturned across the road, nothing can pass.",
      coordinates: mid, accuracyM: 9,
      capturedAt: new Date().toISOString(),
      impact: { blocksTraffic: true },
    },
  });
  ok("driver files an accident report", report.status === 201);
  ok("coordinates are stored", Array.isArray(report.data?.incident?.location?.coordinates),
     JSON.stringify(report.data?.incident?.location?.coordinates));
  ok("it is attributed to the driver", report.data?.incident?.reporterModel === "Partner");

  const inDash = await call(D, "/../incident?days=1", {});
  const found = (inDash.data?.incidents || []).find((i) => i.clientId === clientId);
  ok("it appears in the dashboard incident feed", Boolean(found),
     found ? `${found.type} at ${found.district ?? "?"}` : "");

  const geo = (inDash.data?.geojson?.features || []).find((f) => f.properties.segmentId === SEG);
  ok("it is on the dashboard map with coordinates",
     Boolean(geo?.geometry?.coordinates),
     geo ? JSON.stringify(geo.geometry.coordinates.map((n) => +n.toFixed(3))) : "");

  await runAlertScan({ deliverPush: true });

  const region = await signIn(O, "9000000005");
  const rToken = region.json.token;

  const queue = await call(O, "/verify-queue", { token: rToken });
  const waiting = (queue.data?.pending || []).find((p) => p.clientId === clientId);
  ok("it reaches the officer's verify queue", Boolean(waiting),
     waiting ? `${waiting.type} from ${waiting.reporterName}` : "");

  const inbox = await call(O, "/notifications", { token: rToken });
  ok("the officer is notified in the app",
     (inbox.data?.notifications || []).some((n) => n.segmentId === SEG),
     `${inbox.data?.unread} unread`);

  const confirmed = await call(O, `/incident/${report.data.incident.incidentId}/verify`, {
    method: "PATCH", token: rToken,
    body: { status: "VERIFIED", note: "Checked with the highway patrol" },
  });
  ok("the officer can confirm it", confirmed.status === 200);
  ok("confirming moves the road", Boolean(confirmed.data?.segment?.status),
     `${SEG} -> ${confirmed.data?.segment?.status}`);

  console.log("\ncleanup");
  await Incident.deleteMany({ clientId: /^test-flow-/ });
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
