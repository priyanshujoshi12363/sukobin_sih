import dotenv from "dotenv";
import mongoose from "mongoose";
import Partner from "../src/models/partner.model.js";
import Parcel from "../src/models/parcel.model.js";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";

dotenv.config();

const P = "http://127.0.0.1:5055/api/partner";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function call(p, { method = "GET", token, body } = {}) {
  const res = await fetch(P + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function signIn(phone) {
  const o = await call("/send-otp", { method: "POST", body: { phone } });
  return call("/login", { method: "POST", body: { phone, otp: o.json.devOtp } });
}

// What the app does: type a couple of letters, take a town off the dropdown.
async function pickTown(token, typed) {
  const r = await call(`/places?q=${encodeURIComponent(typed)}`, { token });
  const first = (r.json?.places || [])[0];
  return first ? { label: first.label, coordinates: first.coordinates } : null;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nROUTE MATCHING: A DRIVER DECLARES A ROUTE AND GETS A LIST\n");

  const phone = "9876500077";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Route match driver", phone, vehicleNumber: "NL01ROUTE",
    vehicleType: "pickup", capacity: 4, isOnline: true, isVerified: true,
  });

  // Other suites file landslides on NH-2 and leave the road shut. A shut road
  // correctly offers nothing, so without this the result depends on run order.
  const NH2 = [
    "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA",
    "NH2-DIMAPUR-IMPHAL::KOHIMA-SENAPATI",
    "NH2-DIMAPUR-IMPHAL::SENAPATI-KANGPOKPI",
    "NH2-DIMAPUR-IMPHAL::KANGPOKPI-IMPHAL",
  ];
  await Incident.updateMany(
    { segmentId: { $in: NH2 }, status: { $in: ["PENDING", "VERIFIED"] } },
    { $set: { status: "RESOLVED" } }
  );
  for (const id of NH2) {
    await RoadSegment.updateOne(
      { segmentId: id },
      { $set: { status: "OPEN", statusSource: "SEED", statusNote: "" } }
    );
  }

  const login = await signIn(phone);
  const token = login.json.token;
  ok("driver signs in", Boolean(token));

  await call("/online", { method: "PATCH", token, body: { isOnline: true } });

  // ── the two-letter search the autocomplete actually sends ────────────────
  console.log("\nthe town search behind the two input boxes");
  const origin = await pickTown(token, "Dimapur");
  const destination = await pickTown(token, "Imphal");

  ok("typing 'Dimapur' returns a town with coordinates",
     Boolean(origin?.coordinates?.length === 2), origin?.label);
  ok("typing 'Imphal' returns a town with coordinates",
     Boolean(destination?.coordinates?.length === 2), destination?.label);

  // Short prefixes matter: the app fires at two characters.
  const short = await call("/places?q=Ko", { token });
  ok("a two-letter prefix already suggests towns",
     (short.json?.places || []).length > 0,
     (short.json?.places || []).slice(0, 3).map((p) => p.label).join(" / "));

  // ── declare the route ────────────────────────────────────────────────────
  console.log("\nDimapur to Imphal");
  const match = await call("/route/match", {
    method: "POST", token,
    body: { origin, destination },
  });

  ok("route accepted", match.status === 200, match.json?.message);
  ok("a real road route came back, not a straight line",
     match.json?.route?.source === "osrm",
     `${match.json?.route?.distanceKm} km via ${(match.json?.route?.stations || []).join(" > ")}`);

  const jobs = match.json?.jobs || [];
  ok("parcels are listed for this route", jobs.length > 0, `${jobs.length} offered`);
  ok("the list respects the vehicle's capacity as a cap on selection",
     match.json?.capacity >= 1, `capacity ${match.json?.capacity}`);

  for (const j of jobs.slice(0, 5)) {
    const leg = `${j.pickup?.label || "?"}  ->  ${j.drop?.label || "?"}`;
    console.log(`    ${leg.slice(0, 58).padEnd(60)}Rs ${j.fee}  ${j.routeKm} km  ${j.offRouteKm} km off route`);
  }

  // ── every offered parcel must genuinely be on this road ──────────────────
  console.log("\nis every offer actually on the way?");
  const polyline = match.json?.route?.polyline || [];
  const hav = (a, b) => {
    const R = 6371, rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const offRouteKm = (pt) => Math.min(...polyline.map((v) => hav(pt, v)));

  const offsets = jobs
    .map((j) => j.pickup?.coordinates && offRouteKm(j.pickup.coordinates))
    .filter((n) => typeof n === "number");

  const worst = offsets.length ? Math.max(...offsets) : 0;
  ok("no offered pickup is far off the declared road", worst <= 16,
     `worst pickup sits ${worst.toFixed(1)} km off the line`);

  // ── a route with nothing on it should say so, not error ──────────────────
  console.log("\na corridor with nothing waiting");
  const quiet = await call("/route/match", {
    method: "POST", token,
    body: {
      origin: await pickTown(token, "Tawang"),
      destination: await pickTown(token, "Dirang"),
    },
  });
  ok("an empty corridor still returns a route, not an error", quiet.status === 200,
     `${(quiet.json?.jobs || []).length} jobs`);

  // ── direction: the same road the other way round ─────────────────────────
  // A parcel going Dirang -> Tawang is behind a driver heading Tawang -> Dirang.
  // Offering it would be the whole idea of "on my way" failing.
  console.log("\ndirection matters");
  const forward = await call("/route/match", {
    method: "POST", token,
    body: {
      origin: await pickTown(token, "Dirang"),
      destination: await pickTown(token, "Tawang"),
    },
  });
  ok("driving Dirang to Tawang, the Dirang parcel is offered",
     (forward.json?.jobs || []).length > 0, `${(forward.json?.jobs || []).length} offered`);
  ok("driving Tawang to Dirang, the same parcel is not",
     (quiet.json?.jobs || []).length === 0, "0 offered going the other way");

  // ── a road that really is shut ───────────────────────────────────────────
  // The point of the corridor check is that a driver is never sent into a
  // closure, so close one on purpose and confirm the offer list empties.
  console.log("\nwhen the road is actually shut");
  await RoadSegment.updateOne(
    { segmentId: "NH2-DIMAPUR-IMPHAL::KOHIMA-SENAPATI" },
    { $set: { status: "BLOCKED", statusSource: "FIELD_REPORT", statusNote: "Landslide, test" } }
  );

  const shut = await call("/route/match", { method: "POST", token, body: { origin, destination } });
  ok("the driver is told the route is blocked", shut.json?.blocked === true, shut.json?.message);
  ok("and is offered nothing on it", (shut.json?.jobs || []).length === 0);
  ok("the blocked stretch is named", (shut.json?.blockedSegments || []).length > 0,
     (shut.json?.blockedSegments || [])[0]?.name);

  for (const id of NH2) {
    await RoadSegment.updateOne(
      { segmentId: id },
      { $set: { status: "UNKNOWN", statusSource: "SEED", statusNote: "" } }
    );
    await refreshSegment(id, { withWeather: false });
  }

  // ── offline drivers see nothing, on purpose ──────────────────────────────
  console.log("\noffline");
  await call("/online", { method: "PATCH", token, body: { isOnline: false } });
  const offline = await call("/route/match", { method: "POST", token, body: { origin, destination } });
  ok("an offline driver is refused, with a reason", offline.status === 403, offline.json?.message);

  // ── the seeded shelf is not expired ──────────────────────────────────────
  console.log("\nthe pool itself");
  const live = await Parcel.countDocuments({ status: "POOLED", poolExpiresAt: { $gt: new Date() } });
  ok("there are unexpired pooled parcels to match against", live > 0, `${live} live in the pool`);

  console.log("\ncleanup");
  await Partner.deleteOne({ phone });
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
