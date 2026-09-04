import dotenv from "dotenv";
import mongoose from "mongoose";
import FieldOfficer from "../src/models/fieldOfficer.model.js";
import OfficerNotification from "../src/models/officerNotification.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import Alert from "../src/models/alert.model.js";
import { runAlertScan, backfillInboxes } from "../src/utils/alertEngine.js";

dotenv.config();

const BASE = process.env.API_BASE || "http://127.0.0.1:5055/api/officer";

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

async function signIn(phone) {
  const o = await call("/otp", { method: "POST", body: { phone } });
  return call("/login", { method: "POST", body: { phone, otp: o.json.devOtp } });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  console.log("\nOFFICER NOTIFICATION INBOX\n");

  console.log("setup: stage a blockage so there is something to be told about");
  const seg = await RoadSegment.findOne({ segmentId: "NH10-SILIGURI-GANGTOK::SINGTAM-GANGTOK" });
  seg.applyStatus({ status: "BLOCKED", source: "MANUAL", note: "Inbox test - landslide at Teesta" });
  await seg.save();

  await OfficerNotification.deleteMany({});
  // Retire live alerts too. Without this, a second run of the suite finds the
  // same alert still active, dedupe correctly suppresses the re-raise, and the
  // assertion below fails on behaviour that is actually right.
  await Alert.updateMany(
    { active: true },
    { $set: { active: false, clearedAt: new Date(), clearedReason: "inbox suite reset" } }
  );
  console.log("  inbox and live alerts cleared\n");

  console.log("delivery");
  const scan = await runAlertScan({ deliverPush: true });
  ok("scan raised alerts", scan.raised > 0, `${scan.raised} raised`);
  ok("alerts landed in officer inboxes", scan.delivered.inbox > 0,
     `${scan.delivered.inbox} inbox rows`);
  ok("no push was sent to officers", (scan.delivered.byOfficerPush || 0) === 0,
     `${scan.delivered.sent} pushes, all to partners`);

  const total = await OfficerNotification.countDocuments();
  console.log(`  ${total} rows across all officers`);

  console.log("\njurisdiction");
  const sikkim = await FieldOfficer.findOne({ phone: "9000000002" });
  const nagaland = await FieldOfficer.findOne({ phone: "9000000001" });
  const region = await FieldOfficer.findOne({ phone: "9000000005" });

  const sikkimRows = await OfficerNotification.countDocuments({ officer: sikkim._id });
  const nagalandRows = await OfficerNotification.countDocuments({ officer: nagaland._id });
  const regionRows = await OfficerNotification.countDocuments({ officer: region._id });

  ok("Gangtok officer was told about the Gangtok road", sikkimRows > 0, `${sikkimRows} rows`);
  ok("regional officer sees everything", regionRows >= sikkimRows,
     `region ${regionRows} vs Gangtok ${sikkimRows}`);
  ok("Kohima officer was not told about a Sikkim road",
     nagalandRows < regionRows, `Kohima ${nagalandRows}`);

  console.log("\nno duplicates");
  const again = await backfillInboxes();
  ok("re-delivering the same live alerts writes nothing", again.written === 0,
     `${again.alerts} alerts re-checked, ${again.written} new rows`);

  console.log("\nthe app's view");
  const login = await signIn("9000000002");
  ok("officer signs in", login.status === 200);
  const token = login.json.token;

  const inbox = await call("/notifications", { token });
  ok("inbox loads", inbox.status === 200 && inbox.data.notifications.length > 0,
     `${inbox.data?.notifications?.length} shown, ${inbox.data?.unread} unread`);
  ok("everything starts unread", inbox.data.notifications.every((n) => n.read === false));
  ok("each row carries what it is about",
     inbox.data.notifications.every((n) => n.title && n.kind && n.severity));

  console.log("\n  what the Gangtok officer sees");
  for (const n of inbox.data.notifications.slice(0, 5)) {
    console.log(`    [${n.severity.padEnd(8)}] ${n.title}`);
    console.log(`               ${n.body}`);
  }

  const home = await call("/home", { token });
  ok("home carries the unread badge count",
     home.data.unreadNotifications === inbox.data.unread,
     `${home.data?.unreadNotifications}`);

  console.log("\nlanguage");
  const ne = await call("/notifications?lang=ne", { token });
  const en = await call("/notifications?lang=en", { token });
  ok("inbox re-localises on demand",
     ne.data.notifications[0].title !== en.data.notifications[0].title,
     `"${en.data.notifications[0].title}" -> "${ne.data.notifications[0].title}"`);

  console.log("\nmarking read");
  const first = inbox.data.notifications[0];
  const one = await call("/notifications/read", { method: "POST", token, body: { ids: [first.id] } });
  ok("marking one works", one.data.marked === 1, `unread now ${one.data.unread}`);

  const unreadOnly = await call("/notifications?unreadOnly=true", { token });
  ok("unread filter excludes it",
     !unreadOnly.data.notifications.some((n) => n.id === first.id));

  const all = await call("/notifications/read", { method: "POST", token, body: { all: true } });
  ok("mark all works", all.data.unread === 0, `${all.data.marked} marked`);

  const bad = await call("/notifications/read", { method: "POST", token, body: {} });
  ok("read with no ids is refused", bad.status === 400, bad.json.message);

  const anon = await call("/notifications");
  ok("inbox rejects anonymous", anon.status === 401);

  console.log("\ncleanup");
  seg.applyStatus({ status: "OPEN", source: "PROBE", note: "" });
  await seg.save();
  console.log("  road reopened");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nsuite crashed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
