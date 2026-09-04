import dotenv from "dotenv";
import mongoose from "mongoose";
import { runAlertScan, activeAlerts } from "../src/utils/alertEngine.js";
import { t, LANGUAGES, LANGUAGE_NAMES } from "../src/utils/i18n.js";
dotenv.config();

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

console.log("\nALERT SCAN");
const r = await runAlertScan({ deliverPush: true });
console.log("  scanned segments :", r.scanned);
console.log("  alerts raised    :", r.raised);
console.log("  by kind          :", JSON.stringify(r.byKind));
console.log("  push attempted   :", r.delivered.attempted, "sent:", r.delivered.sent);

console.log("\n  raised now");
for (const a of r.alerts.slice(0, 12)) {
  console.log(`    [${a.severity.padEnd(8)}] ${a.title}`);
  console.log(`               ${a.body}`);
}

console.log("\nRE-RUN (should raise nothing new: dedupe)");
const r2 = await runAlertScan({ deliverPush: false });
console.log("  alerts raised    :", r2.raised, r2.raised === 0 ? "OK" : "DUPLICATES LEAKING");

console.log("\nACTIVE ALERT FEED (en)");
for (const a of (await activeAlerts({ limit: 8, lang: "en" }))) {
  console.log(`  ${a.severity.padEnd(8)} ${a.title} - ${a.body.slice(0,80)}`);
}

console.log("\nSAME ALERT IN EVERY LANGUAGE");
const vars = { road: "Dimapur - Kohima (NH-2)", pct: 76, hours: 48, reason: "" };
for (const l of LANGUAGES) {
  const x = t("FORECAST_RISK", l, vars);
  console.log(`  ${l.padEnd(4)} ${LANGUAGE_NAMES[l].padEnd(12)} ${x.body}`);
}

await mongoose.disconnect();
