import dotenv from "dotenv";
import mongoose from "mongoose";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import Partner from "../src/models/partner.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";

dotenv.config();

const O = "http://127.0.0.1:5055/api/officer";
const P = "http://127.0.0.1:5055/api/partner";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function call(base, p, { method = "GET", token, body } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function signIn(base, phone) {
  const path = base === P ? "/send-otp" : "/otp";
  const o = await call(base, path, { method: "POST", body: { phone } });
  return call(base, "/login", { method: "POST", body: { phone, otp: o.json.devOtp } });
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function postPhotoReport(base, endpoint, token, fields, photoCount) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (let i = 0; i < photoCount; i++) {
    form.append("photos", new Blob([PNG], { type: "image/png" }), `shot${i + 1}.png`);
  }
  const res = await fetch(base + endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nPHOTOS: OFFICER UPLOADS, OFFICER SEES THE DRIVER'S\n");

  const SEG = "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA";
  const seg = await RoadSegment.findOne({ segmentId: SEG });
  const [lng, lat] = seg.geometry.coordinates[Math.floor(seg.geometry.coordinates.length / 2)];

  // ── an officer files a report with photos ────────────────────────────────
  console.log("officer uploads");
  const officer = await signIn(O, "9000000001");
  const oToken = officer.json.token;
  ok("district officer signs in", Boolean(oToken));

  const oClient = "test-photo-of-" + Date.now();
  const oRes = await postPhotoReport(O, "/report/voice", oToken, {
    clientId: oClient,
    segmentId: SEG,
    spokenText: "Yahan pahad se malba gir gaya hai, poora rasta band hai",
    spokenLang: "hi",
    coordinates: `${lng},${lat}`,
    accuracyM: "8",
    capturedAt: new Date().toISOString(),
    type: "LANDSLIDE",
    severity: "CRITICAL",
    blocksTraffic: "true",
  }, 2);

  ok("officer report with photos accepted", oRes.status === 201, oRes.json?.message);

  const oInc = await Incident.findOne({ clientId: oClient }).lean();
  ok("both photos uploaded", (oInc?.photos || []).length === 2,
     `${(oInc?.photos || []).length} stored`);
  ok("they are real hosted URLs",
     (oInc?.photos || []).every((u) => u.startsWith("https://")),
     (oInc?.photos || [])[0]?.slice(0, 52));
  ok("the officer's own choices were kept, not overridden by the model",
     oInc?.type === "LANDSLIDE" && oInc?.severity === "CRITICAL",
     `${oInc?.type} / ${oInc?.severity}`);
  ok("filed as coming from an officer", oInc?.reporterModel === "FieldOfficer",
     oInc?.reporterName);

  // ── a driver files one, and a senior officer must be able to see it ──────
  console.log("\ndriver's photo reaches the officer");
  const phone = "9876500088";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Photo test driver", phone, vehicleNumber: "NL01PHOTO",
    vehicleType: "pickup", isOnline: true, isVerified: true,
  });

  const driver = await signIn(P, phone);
  const dToken = driver.json.token;
  ok("driver signs in", Boolean(dToken));

  const dClient = "test-photo-dr-" + Date.now();
  const dRes = await postPhotoReport(P, "/report/voice", dToken, {
    clientId: dClient,
    segmentId: SEG,
    spokenText: "ek truck ulat gaya hai rasta band hai",
    spokenLang: "hi",
    coordinates: `${lng},${lat}`,
    accuracyM: "10",
    capturedAt: new Date().toISOString(),
    type: "",
    severity: "",
    blocksTraffic: "true",
  }, 1);

  ok("driver report with a photo accepted", dRes.status === 201, dRes.json?.message);

  const region = await signIn(O, "9000000005");
  const rToken = region.json.token;

  const queue = await call(O, "/verify-queue", { token: rToken });
  const seen = (queue.json?.data?.pending || []).find((p) => p.clientId === dClient);

  ok("the driver's report is in the verify queue", Boolean(seen), seen?.type);
  ok("and the photo comes with it", (seen?.photos || []).length === 1,
     (seen?.photos || [])[0]?.slice(0, 52));
  ok("the officer can see who sent it", Boolean(seen?.reporterName), seen?.reporterName);

  console.log("\n  what the officer sees in the queue:");
  console.log(`    ${seen?.type} / ${seen?.severity} from ${seen?.reporterName}`);
  console.log(`    ${(seen?.description || "").split("\n")[0].slice(0, 76)}`);
  console.log(`    photo: ${(seen?.photos || [])[0]}`);

  console.log("\ncleanup");
  await Incident.deleteMany({ clientId: /^test-photo-/ });
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
