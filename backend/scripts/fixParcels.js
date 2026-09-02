// One-off: inspect + re-geocode existing parcels so old ones (created before the
// town-aware geocoder) get correct coordinates. Run from backend/:  node scripts/fixParcels.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Parcel from "../src/models/parcel.model.js";
import { geocodeAddress } from "../src/utils/geocode.js";
import { fetchRoutePolyline } from "../src/utils/routing.js";

dotenv.config();

const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ connected\n");

  // re-check parcels that are still in play (not delivered/cancelled)
  const parcels = await Parcel.find({
    status: { $in: ["REQUESTED", "POOLED", "ASSIGNED"] },
  });
  console.log(`Found ${parcels.length} active parcel(s)\n`);

  for (const p of parcels) {
    const pAddr = p.pickup?.address?.fullAddress || "";
    const dAddr = p.drop?.address?.fullAddress || "";
    const oldPick = p.pickup?.location?.coordinates;
    const oldDrop = p.drop?.location?.coordinates;

    console.log(`── ${p.parcelId} [${p.status}] ──`);
    console.log(`  pickup "${pAddr}"  stored:`, oldPick);
    console.log(`  drop   "${dAddr}"  stored:`, oldDrop);

    const newPick = (await geocodeAddress(pAddr)) || oldPick;
    const newDrop = (await geocodeAddress(dAddr)) || oldDrop;

    let changed = false;
    if (newPick && !same(newPick, oldPick)) { p.pickup.location.coordinates = newPick; changed = true; }
    if (newDrop && !same(newDrop, oldDrop)) { p.drop.location.coordinates = newDrop; changed = true; }

    if (changed) {
      // refresh the stored route polyline too
      try {
        const r = await fetchRoutePolyline([p.pickup.location.coordinates, p.drop.location.coordinates]);
        p.routePolyline = r.polyline;
        p.routeDurationMin = r.durationMin;
        p.distanceKm = r.distanceKm || p.distanceKm;
      } catch {}
      await p.save();
      console.log(`  → FIXED  pickup:`, p.pickup.location.coordinates, ` drop:`, p.drop.location.coordinates);
    } else {
      console.log("  → unchanged");
    }
    console.log("");
  }

  await mongoose.disconnect();
  console.log("done.");
}

run().catch((e) => { console.error(e); process.exit(1); });
