import dotenv from "dotenv";
import mongoose from "mongoose";
import Incident from "../src/models/incident.model.js";
import RoadSegment from "../src/models/roadSegment.model.js";
import Alert from "../src/models/alert.model.js";
import { refreshSegment } from "../src/utils/accessibility.js";

dotenv.config();

// Removes only rows the test suites created. Test reports are the ones whose
// clientId starts with "test-", which no real device ever produces.
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  const doomed = await Incident.find({ clientId: /^test-/ }).select("segmentId").lean();
  const touched = [...new Set(doomed.map((d) => d.segmentId).filter(Boolean))];

  const inc = await Incident.deleteMany({ clientId: /^test-/ });
  console.log(`  removed ${inc.deletedCount} test reports`);

  for (const segmentId of touched) {
    await RoadSegment.updateOne(
      { segmentId },
      { $set: { status: "UNKNOWN", statusSource: "SEED", statusNote: "", statusExpiresAt: null } }
    );
    const r = await refreshSegment(segmentId, { withWeather: false });
    console.log(`  ${segmentId} -> ${r?.segment?.status || "UNKNOWN"}`);
  }

  const alerts = await Alert.deleteMany({ segmentId: { $in: touched }, kind: "VERIFY_REQUEST" });
  console.log(`  removed ${alerts.deletedCount} stale verify alerts`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("cleanup failed:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
