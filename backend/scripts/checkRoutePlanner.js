import "dotenv/config";
import { townByName } from "../src/data/nerNetwork.js";
import { planRoute } from "../src/utils/routePlanner.js";
import { distToRouteKm } from "../src/utils/geo.js";
import { SEVERITY_RANK } from "../src/utils/accessibility.js";

const NETWORK = [
  {
    segmentId: "NH2::DIMAPUR-KOHIMA",
    name: "Dimapur - Kohima (NH-2)",
    mid: [93.92, 25.79],
    lengthKm: 74,
    baselineSpeedKmph: 24,
    status: "OPEN",
    risk: { score: 0.2 },
  },
  {
    segmentId: "NH2::KOHIMA-SENAPATI",
    name: "Kohima - Senapati (NH-2)",
    mid: [94.07, 25.47],
    lengthKm: 62,
    baselineSpeedKmph: 24,
    status: "OPEN",
    risk: { score: 0.3 },
  },
  {
    segmentId: "NH2::SENAPATI-KANGPOKPI",
    name: "Senapati - Kangpokpi (NH-2)",
    mid: [93.99, 25.21],
    lengthKm: 41,
    baselineSpeedKmph: 24,
    status: "OPEN",
    risk: { score: 0.34 },
  },
  {
    segmentId: "NH2::KANGPOKPI-IMPHAL",
    name: "Kangpokpi - Imphal (NH-2)",
    mid: [93.94, 24.98],
    lengthKm: 45,
    baselineSpeedKmph: 26,
    status: "OPEN",
    risk: { score: 0.2 },
  },
];

function makeAccessibilityFn(overrides = {}) {
  return async (polyline) => {
    const segments = NETWORK.filter((s) => distToRouteKm(s.mid, polyline) <= 4).map((s) => ({
      ...s,
      status: overrides[s.segmentId]?.status || s.status,
      probe: overrides[s.segmentId]?.probe,
      statusNote: overrides[s.segmentId]?.note,
    }));

    const blocked = segments.filter((s) => s.status === "BLOCKED");
    const degraded = segments.filter((s) => s.status === "RESTRICTED" || s.status === "SLOW");

    return {
      passable: blocked.length === 0,
      segments,
      blocked,
      degraded,
      highRisk: segments.filter((s) => (s.risk?.score || 0) >= 0.5),
      worstStatus: segments.reduce(
        (w, s) => (SEVERITY_RANK[s.status] > SEVERITY_RANK[w] ? s.status : w),
        "OPEN"
      ),
      maxRiskScore: segments.reduce((m, s) => Math.max(m, s.risk?.score || 0), 0),
    };
  };
}

const WAYPOINTS = [townByName("Dimapur").coordinates, townByName("Imphal").coordinates];

async function scenario(title, overrides) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));

  const plan = await planRoute(WAYPOINTS, { accessibilityFn: makeAccessibilityFn(overrides) });

  if (!plan.found) {
    console.log(`  NO PASSABLE ROUTE  (evaluated ${plan.candidatesEvaluated} alternatives)`);
    for (const r of plan.rejected) console.log(`    rejected: ${r.reason}`);
    return plan;
  }

  const c = plan.chosen;
  console.log(`  distance        ${c.distanceKm} km`);
  console.log(`  ideal ETA       ${c.idealMinutes} min  (OSRM, flat-road optimistic)`);
  console.log(`  normal ETA      ${c.normalMinutes} min  (hill baseline, no disruption)`);
  console.log(`  condition ETA   ${c.etaMinutes} min  (delay +${c.delayMinutes} min vs normal)`);
  console.log(`  worst status    ${c.worstStatus}`);
  console.log(`  alert driver?   ${plan.shouldAlert ? "YES" : "no"}`);
  console.log(`  candidates      ${plan.candidatesEvaluated}`);
  if (c.blockedSegments.length) console.log(`  blocked         ${c.blockedSegments.map((b) => b.name).join(", ")}`);
  if (c.degradedSegments.length)
    console.log(`  degraded        ${c.degradedSegments.map((d) => `${d.name} [${d.status}]`).join(", ")}`);
  console.log("  per-segment breakdown:");
  for (const d of c.etaBreakdown) {
    console.log(`    ${d.name.padEnd(30)} ${String(d.km).padStart(6)} km  ${String(d.speedKmph).padStart(5)} km/h  ${String(d.minutes).padStart(4)} min  +${String(d.delayMinutes).padStart(3)}  [${d.status}]`);
  }
  for (const r of plan.rejected) console.log(`  rejected: ${r.reason}`);
  return plan;
}

async function main() {
  console.log("Disruption-aware route planning: Dimapur -> Imphal (NH-2, Manipur lifeline)");

  await scenario("A. Normal conditions", {});

  await scenario("B. Heavy rain, traffic crawling on the Senapati ghat", {
    "NH2::SENAPATI-KANGPOKPI": {
      status: "SLOW",
      probe: { medianSpeedKmph: 9 },
      note: "probe: 6 vehicles, median 9 km/h vs 24 km/h baseline",
    },
  });

  await scenario("C. Verified landslide blocks Senapati - Kangpokpi", {
    "NH2::SENAPATI-KANGPOKPI": {
      status: "BLOCKED",
      note: "LANDSLIDE reported by BDO Senapati, corroborated by probe",
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
