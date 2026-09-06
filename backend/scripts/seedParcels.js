import dotenv from "dotenv";
import mongoose from "mongoose";
import Parcel from "../src/models/parcel.model.js";
import User from "../src/models/user.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import { townInAddress } from "../src/data/nerNetwork.js";

dotenv.config();

/**
 * Parcels waiting on the real corridors, so a driver who declares a route
 * actually has something to carry.
 *
 * Every pickup and drop is lifted off the road's own OSRM geometry rather than
 * made up, so a parcel really does sit on the road the driver is about to take
 * and the corridor match is doing genuine work, not being handed a straight
 * line that happens to pass through.
 *
 * Pool expiry is the reason this script exists as well as a demo aid: parcels
 * are pooled for PARCEL_POOL_TTL_MIN (2 hours by default) and matchRoute only
 * returns ones that have not expired, so a database seeded last week shows a
 * driver nothing at all. Re-run this and the shelf is stocked again.
 */

const DAYS = Number(process.env.SEED_POOL_DAYS) || 30;
const PREFIX = "SKB-DEMO-";

// pickup fraction, drop fraction, what is in the box
const SHIPMENTS = [
  { seg: "NH2-DIMAPUR-IMPHAL::DIMAPUR-KOHIMA", from: 0.06, to: 0.94, type: "Medicines", kg: 2.5, what: "Insulin and cold-chain medicines for the district hospital" },
  { seg: "NH2-DIMAPUR-IMPHAL::KOHIMA-SENAPATI", from: 0.10, to: 0.88, type: "Documents", kg: 0.4, what: "Land records for the block office" },
  { seg: "NH2-DIMAPUR-IMPHAL::KANGPOKPI-IMPHAL", from: 0.08, to: 0.92, type: "Electronics", kg: 6.0, what: "Two laptops for a school computer lab" },
  { seg: "NH27-GUWAHATI-SILCHAR::GUWAHATI-NAGAON", from: 0.05, to: 0.90, type: "Clothes", kg: 4.0, what: "Winter clothing, relief stock" },
  { seg: "NH27-GUWAHATI-SILCHAR::LUMDING-HAFLONG", from: 0.12, to: 0.86, type: "Food", kg: 12.0, what: "Rice and dal for a ration shop" },
  { seg: "NH27-GUWAHATI-SILCHAR::HAFLONG-SILCHAR", from: 0.09, to: 0.93, type: "Medicines", kg: 1.8, what: "Anti-venom and ORS for the PHC" },
  { seg: "NH37-GUWAHATI-DIBRUGARH::NAGAON-GOLAGHAT", from: 0.07, to: 0.91, type: "Other", kg: 8.0, what: "Tea garden spare parts" },
  { seg: "NH37-GUWAHATI-DIBRUGARH::GOLAGHAT-JORHAT", from: 0.11, to: 0.89, type: "Documents", kg: 0.3, what: "Exam papers for the college" },
  { seg: "NH37-GUWAHATI-DIBRUGARH::SIVASAGAR-DIBRUGARH", from: 0.08, to: 0.92, type: "Electronics", kg: 3.2, what: "Solar inverter for a village clinic" },
  { seg: "NH6-SHILLONG-SILCHAR::SHILLONG-JOWAI", from: 0.06, to: 0.94, type: "Food", kg: 9.0, what: "Vegetables for the Jowai market" },
  { seg: "NH6-SHILLONG-SILCHAR::JOWAI-BADARPUR", from: 0.10, to: 0.90, type: "Medicines", kg: 2.0, what: "Vaccines in a cold box" },
  { seg: "NH10-SILIGURI-GANGTOK::SILIGURI-RANGPO", from: 0.05, to: 0.95, type: "Other", kg: 15.0, what: "Cement and hardware for a rebuild" },
  { seg: "NH10-SILIGURI-GANGTOK::SINGTAM-GANGTOK", from: 0.12, to: 0.88, type: "Electronics", kg: 2.2, what: "Router and modem for a CSC centre" },
  { seg: "NH306-SILCHAR-AIZAWL::SILCHAR-VAIRENGTE", from: 0.07, to: 0.93, type: "Clothes", kg: 5.5, what: "Uniforms for a boarding school" },
  { seg: "NH306-SILCHAR-AIZAWL::KOLASIB-AIZAWL", from: 0.09, to: 0.91, type: "Documents", kg: 0.5, what: "Pension files for the treasury" },
  { seg: "NH13-TEZPUR-TAWANG::TEZPUR-BOMDILA", from: 0.06, to: 0.94, type: "Medicines", kg: 3.0, what: "Oxygen regulators for the CHC" },
  { seg: "NH13-TEZPUR-TAWANG::DIRANG-TAWANG", from: 0.10, to: 0.90, type: "Food", kg: 11.0, what: "Dry rations before the pass closes" },
  { seg: "NH8-DHARMANAGAR-SABROOM::AMBASSA-AGARTALA", from: 0.08, to: 0.92, type: "Electronics", kg: 4.5, what: "Two sewing machines for an SHG" },
  { seg: "NH8-DHARMANAGAR-SABROOM::AGARTALA-UDAIPUR", from: 0.11, to: 0.89, type: "Other", kg: 7.0, what: "Seeds and fertiliser" },
  { seg: "NH127B-GUWAHATI-TURA::GOALPARA-TURA", from: 0.07, to: 0.93, type: "Medicines", kg: 2.6, what: "TB drugs, monthly resupply" },
  { seg: "NH29-DIMAPUR-MOKOKCHUNG::DIMAPUR-WOKHA", from: 0.09, to: 0.91, type: "Clothes", kg: 3.8, what: "Blankets for the winter store" },
  { seg: "NH715-GUWAHATI-LAKHIMPUR::MANGALDOI-TEZPUR", from: 0.06, to: 0.94, type: "Food", kg: 10.0, what: "Milk powder and biscuits, ICDS" },
  { seg: "NH715-GUWAHATI-LAKHIMPUR::BISWANATH_CHARIALI-NORTH_LAKHIMPUR", from: 0.10, to: 0.90, type: "Documents", kg: 0.4, what: "Voter roll revisions" },
  { seg: "NH27-SILIGURI-GUWAHATI::KOKRAJHAR-BONGAIGAON", from: 0.08, to: 0.92, type: "Other", kg: 6.5, what: "Handloom yarn for a weavers' cluster" },
  { seg: "NH27-SILIGURI-GUWAHATI::BARPETA-GUWAHATI", from: 0.05, to: 0.95, type: "Electronics", kg: 5.0, what: "Water testing kit for the PHED lab" },
];

const NAMES = [
  ["Bikash Das", "Rupa Boro"], ["Imliakum Ao", "Neizo Kire"], ["Lalthanmawia", "Zodinpuii"],
  ["Wanphrang Syiem", "Banri Kharbani"], ["Tashi Norbu", "Pema Lhamu"], ["Pranab Saikia", "Anjali Gogoi"],
  ["Ranjit Debbarma", "Sumita Reang"], ["Thangboi Haokip", "Chongthu Kipgen"], ["Karma Bhutia", "Dechen Lepcha"],
  ["Nabam Tayeng", "Yamin Riba"],
];

const phone = (i) => "9" + String(700000000 + i * 137).slice(0, 9);

// A point taken from the road's own geometry, at a fraction along the vertices.
const along = (coords, f) => coords[Math.min(coords.length - 1, Math.max(0, Math.round((coords.length - 1) * f)))];

const haversineKm = (a, b) => {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(a[0] - b[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// distance along the polyline between two vertex indices, not the crow line
const roadKm = (coords, i, j) => {
  let km = 0;
  for (let k = Math.min(i, j); k < Math.max(i, j); k++) km += haversineKm(coords[k], coords[k + 1]);
  return km;
};

const idx = (coords, f) => Math.min(coords.length - 1, Math.max(0, Math.round((coords.length - 1) * f)));

const charge = (km, kg) => Math.round((40 + km * 4.5 + kg * 6) / 5) * 5;

const endpoint = (name, ph, town, point, note) => ({
  contactName: name,
  contactPhone: ph,
  address: {
    village: town,
    town,
    district: town,
    state: "",
    fullAddress: `${note}, ${town}`,
  },
  location: { type: "Point", coordinates: point },
});

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const wipe = process.argv.includes("--wipe");
  const removed = await Parcel.deleteMany({ parcelId: new RegExp("^" + PREFIX) });
  console.log(`\ncleared ${removed.deletedCount} previously seeded parcels`);
  if (wipe) {
    console.log("--wipe given, stopping here\n");
    await mongoose.disconnect();
    return;
  }

  // Someone has to be the sender. Reuse a real user if there is one.
  let sender = await User.findOne({}).select("_id name").lean();
  if (!sender) {
    sender = await User.create({
      name: "Sukobin demo sender",
      phone: "9000000111",
      isVerified: true,
    });
    console.log("no users existed, created a demo sender");
  }

  const expires = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000);
  const docs = [];
  let skipped = 0;

  for (let i = 0; i < SHIPMENTS.length; i++) {
    const s = SHIPMENTS[i];
    const seg = await RoadSegment.findOne({ segmentId: s.seg }).select("name geometry").lean();
    if (!seg?.geometry?.coordinates?.length) {
      console.log(`  skipped ${s.seg} - no geometry, run seedNetwork first`);
      skipped++;
      continue;
    }

    const coords = seg.geometry.coordinates;
    const iFrom = idx(coords, s.from);
    const iTo = idx(coords, s.to);
    const pickup = coords[iFrom];
    const drop = coords[iTo];

    const [a, b] = seg.name.replace(/\s*\(.*\)$/, "").split(" - ");
    const fromTown = townInAddress(a)?.name || a;
    const toTown = townInAddress(b)?.name || b;

    const km = +roadKm(coords, iFrom, iTo).toFixed(1);
    const fee = charge(km, s.kg);
    const [senderName, receiverName] = NAMES[i % NAMES.length];

    docs.push({
      parcelId: `${PREFIX}${String(i + 1).padStart(3, "0")}`,
      sender: sender._id,
      pickup: endpoint(senderName, phone(i), fromTown, pickup, "Near the main stand"),
      drop: endpoint(receiverName, phone(i + 50), toTown, drop, "Town centre"),
      package: { type: s.type, weightKg: s.kg, description: s.what },
      distanceKm: km,
      routePolyline: coords.slice(Math.min(iFrom, iTo), Math.max(iFrom, iTo) + 1),
      routeDurationMin: Math.max(15, Math.round((km / 32) * 60)),
      deliveryCharge: fee,
      platformFee: Math.round(fee * 0.1),
      totalAmount: fee + Math.round(fee * 0.1),
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "POOLED",
      poolExpiresAt: expires,
      deliveryOtp: String(100000 + Math.floor(Math.random() * 899999)),
    });
  }

  if (docs.length) await Parcel.insertMany(docs);

  console.log(`\nseeded ${docs.length} pooled parcels${skipped ? `, ${skipped} skipped` : ""}`);
  console.log(`pooled until ${expires.toDateString()} (${DAYS} days)\n`);

  for (const d of docs.slice(0, 6)) {
    console.log(
      `  ${d.parcelId}  ${d.pickup.address.town} -> ${d.drop.address.town}`.padEnd(52) +
      `${d.distanceKm} km  Rs ${d.deliveryCharge}  ${d.package.type}`
    );
  }
  if (docs.length > 6) console.log(`  ... and ${docs.length - 6} more`);

  console.log("");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("\nseed failed:", e.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
