import dotenv from "dotenv";
import mongoose from "mongoose";
import FieldOfficer from "../src/models/fieldOfficer.model.js";

dotenv.config();

// Demo accounts covering the three jurisdiction levels, so the verification
// chain (district reports -> state confirms) can actually be demonstrated.
const OFFICERS = [
  {
    name: "Imtinaro Longkumer",
    phone: "9000000001",
    employeeId: "NL-PWD-4471",
    designation: "Assistant Engineer",
    department: "PWD",
    jurisdiction: { level: "DISTRICT", district: "Kohima", state: "NL", districts: ["Kohima", "Dimapur"] },
    preferredLanguage: "nag",
    watchedCorridors: ["NH2-DIMAPUR-IMPHAL", "NH29-DIMAPUR-MOKOKCHUNG"],
  },
  {
    name: "Tenzing Bhutia",
    phone: "9000000002",
    employeeId: "SK-DM-1120",
    designation: "District Disaster Officer",
    department: "DISASTER_MANAGEMENT",
    jurisdiction: { level: "DISTRICT", district: "Gangtok", state: "SK", districts: ["Gangtok", "Pakyong"] },
    preferredLanguage: "ne",
    watchedCorridors: ["NH10-SILIGURI-GANGTOK"],
  },
  {
    name: "Banri Kharkongor",
    phone: "9000000003",
    employeeId: "ML-DA-8802",
    designation: "Deputy Commissioner (Transport)",
    department: "DISTRICT_ADMIN",
    jurisdiction: { level: "DISTRICT", district: "East Khasi Hills", state: "ML", districts: ["East Khasi Hills", "West Jaintia Hills"] },
    preferredLanguage: "kha",
    watchedCorridors: ["NH6-SHILLONG-SILCHAR"],
  },
  {
    name: "Rituraj Saikia",
    phone: "9000000004",
    employeeId: "AS-STATE-0091",
    designation: "State Nodal Officer",
    department: "TRANSPORT",
    jurisdiction: { level: "STATE", state: "AS", district: null, districts: [] },
    preferredLanguage: "as",
    watchedCorridors: [],
  },
  {
    name: "Priyanshu Joshi",
    phone: "9000000005",
    employeeId: "NER-MDONER-0001",
    designation: "Regional Control Room",
    department: "DISASTER_MANAGEMENT",
    jurisdiction: { level: "REGION", state: null, district: null, districts: [] },
    preferredLanguage: "en",
    watchedCorridors: [],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  let created = 0;
  let updated = 0;

  for (const o of OFFICERS) {
    const existing = await FieldOfficer.findOne({ phone: o.phone });
    if (existing) {
      Object.assign(existing, o);
      await existing.save();
      updated++;
    } else {
      await FieldOfficer.create(o);
      created++;
    }
  }

  const all = await FieldOfficer.find({}).lean();
  console.log(`\nofficers: ${created} created, ${updated} updated, ${all.length} total\n`);
  for (const o of all) {
    const j = o.jurisdiction || {};
    const scope = j.level === "REGION" ? "all of NER" : j.level === "STATE" ? j.state : j.district;
    console.log(
      `  ${o.phone}  ${o.name.padEnd(22)} ${String(j.level).padEnd(9)} ${String(scope).padEnd(18)} ` +
        `${o.canVerifyIncidents ? "can confirm" : "reports only"}  lang=${o.preferredLanguage}`
    );
  }
  console.log("");

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("seed failed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
