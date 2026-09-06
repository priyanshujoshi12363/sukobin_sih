import dotenv from "dotenv";
import mongoose from "mongoose";
import Partner from "../src/models/partner.model.js";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";
import { llmAvailable } from "../src/utils/llm.js";

dotenv.config();

const P = process.env.API_BASE || "http://127.0.0.1:5055/api/partner";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${label}${extra ? "  " + extra : ""}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(P + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

// Real speech, the way it actually comes out of a phone: no punctuation,
// mixed script, half English.
const SPOKEN = [
  {
    lang: "hi",
    text: "bhai yahan pahad se bahut bada malba gir gaya hai poora rasta band hai koi gaadi nahi ja sakti JCB kal subah aayega",
    expectType: "LANDSLIDE",
    expectBlocks: true,
  },
  {
    lang: "hi",
    text: "sadak par paani bhar gaya hai lekin ek lane khula hai car nikal sakti hai dhire dhire",
    expectType: "FLOOD",
    expectBlocks: false,
  },
  {
    lang: "ne",
    text: "yaha ekdam thulo rukh badi ma dhalеko cha bato purai banda cha",
    expectType: "TREE_FALL",
    expectBlocks: true,
  },
  {
    lang: "as",
    text: "ইয়াত এখন ট্ৰাক উলটি পৰিছে আৰু পথ বন্ধ হৈ আছে",
    expectType: "ACCIDENT",
    expectBlocks: true,
  },
  {
    lang: "nag",
    text: "rasta bhal ase ekhon kunu problem nai gari jai ase",
    expectClear: true,
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nSPEAK A REPORT IN YOUR OWN LANGUAGE\n");
  console.log("  model available:", llmAvailable() ? "yes" : "NO - keyword fallback only");

  const phone = "9876500044";
  await Partner.deleteOne({ phone });
  await Partner.create({
    name: "Voice test driver", phone, vehicleNumber: "NL01VOICE",
    vehicleType: "pickup", capacity: 3, isOnline: true, isVerified: true,
  });

  const otp = await call("/send-otp", { method: "POST", body: { phone } });
  const login = await call("/login", { method: "POST", body: { phone, otp: otp.json.devOtp } });
  const token = login.json.token;
  ok("driver signs in", Boolean(token));

  const SEG = "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA";
  const seg = await RoadSegment.findOne({ segmentId: SEG });
  const mid = seg.geometry.coordinates[Math.floor(seg.geometry.coordinates.length / 2)];

  console.log("\nWHAT THE MODEL HEARS");

  let understoodCount = 0;
  for (const s of SPOKEN) {
    const r = await call("/report/understand", {
      method: "POST", token,
      body: { spokenText: s.text, spokenLang: s.lang, segmentId: SEG, photoCount: 1 },
    });

    if (r.status !== 200) {
      ok(`[${s.lang}] understood`, false, r.json?.message);
      continue;
    }

    const u = r.data.understood;
    const c = r.data.confirm;

    console.log(`\n  spoken (${s.lang}): ${s.text.slice(0, 72)}${s.text.length > 72 ? "..." : ""}`);
    console.log(`  english        : ${u.english.slice(0, 78)}`);
    console.log(`  summary        : ${u.summary}`);
    console.log(`  read as        : ${u.type} / ${u.severity} / blocks=${u.blocksTraffic}` +
                `${u.estimatedClearanceHours != null ? ` / ~${u.estimatedClearanceHours}h` : ""}`);
    console.log(`  detected lang  : ${u.detectedLanguage}   by: ${u.source}   confidence: ${u.confidence}`);

    if (s.expectClear) {
      ok(`[${s.lang}] "road is fine" is not filed as a hazard`, u.roadClear === true);
    } else {
      const typeOk = u.type === s.expectType;
      const blockOk = u.blocksTraffic === s.expectBlocks;
      ok(`[${s.lang}] read as ${s.expectType}`, typeOk, typeOk ? "" : `got ${u.type}`);
      ok(`[${s.lang}] blocking judged right`, blockOk,
         blockOk ? "" : `expected blocks=${s.expectBlocks}, got ${u.blocksTraffic}`);
    }

    ok(`[${s.lang}] translated to English`, u.english.length > 0 && u.english !== "");
    ok(`[${s.lang}] app is told whether to double-check`, typeof c.uncertain === "boolean");
    if (u.source === "llm") understoodCount++;
  }

  ok("the model, not the keyword fallback, did the reading",
     understoodCount >= 3, `${understoodCount}/${SPOKEN.length} read by model`);

  console.log("\nFILING IT");

  const clientId = "test-voice-" + Date.now();
  const spoken = SPOKEN[0];

  const sent = await call("/report/voice", {
    method: "POST", token,
    body: {
      clientId,
      segmentId: SEG,
      spokenText: spoken.text,
      spokenLang: spoken.lang,
      coordinates: mid,
      accuracyM: 8,
      capturedAt: new Date().toISOString(),
    },
  });

  ok("report is filed from speech alone", sent.status === 201,
     `${sent.data?.incident?.type} / ${sent.data?.incident?.severity}`);

  const inc = await Incident.findOne({ clientId }).lean();
  ok("the driver's own words are kept", inc?.description?.includes(spoken.text.slice(0, 30)),
     "original preserved alongside the translation");
  ok("English is stored for the officer", (inc?.description || "").length > spoken.text.length);
  ok("it attaches to the road", inc?.segmentId === SEG);
  ok("impact was worked out, not asked for", inc?.impact?.blocksTraffic === true);

  console.log("\n  stored description:");
  console.log("    " + (inc?.description || "").split("\n").join("\n    "));

  const replay = await call("/report/voice", {
    method: "POST", token,
    body: { clientId, spokenText: spoken.text, coordinates: mid },
  });
  ok("a retry does not file it twice", replay.json?.duplicate === true);

  const noSpeech = await call("/report/understand", {
    method: "POST", token, body: { spokenText: "  " },
  });
  ok("empty speech is refused", noSpeech.status === 400, noSpeech.json?.message);

  console.log("\ncleanup");
  await Incident.deleteMany({ clientId: /^test-voice-/ });
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
