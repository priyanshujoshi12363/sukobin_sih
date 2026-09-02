import "dotenv/config";
import { NER_CORRIDORS, townByName } from "../src/data/nerNetwork.js";
import { fetchWeather } from "../src/utils/weather.js";
import { scoreSegmentRisk, riskAdvisory } from "../src/utils/risk.js";

const TERRAIN_FAILURE_PRIOR = {
  plain: 0.08,
  hill: 0.18,
  mountain: 0.32,
  "high-mountain": 0.45,
};

function fakeSegment(corridor, aName, bName, opts = {}) {
  const a = townByName(aName);
  const b = townByName(bName);
  const mountainous = corridor.terrain === "mountain" || corridor.terrain === "high-mountain";
  return {
    segmentId: `${corridor.code}::${aName}-${bName}`,
    name: `${aName} - ${bName} (${corridor.highway})`,
    terrain: corridor.terrain,
    baselineSpeedKmph: corridor.baselineSpeedKmph,
    lifelineFor: corridor.lifelineFor,
    geometry: { coordinates: [a.coordinates, b.coordinates] },
    from: { name: aName, coordinates: a.coordinates },
    to: { name: bName, coordinates: b.coordinates },
    hazard: {
      landslideProne: mountainous,
      floodProne: corridor.terrain === "plain",
      snowProne: corridor.terrain === "high-mountain",
      historicalFailureRate: (TERRAIN_FAILURE_PRIOR[corridor.terrain] ?? 0.18) + 0.25,
      avgSlopeDeg: mountainous ? 12 : 3,
      elevationM: corridor.terrain === "high-mountain" ? 3200 : 400,
    },
    probe: opts.probe || { speedRatio: null },
  };
}

const bar = (score) => {
  const n = Math.round(score * 24);
  return "#".repeat(n).padEnd(24, ".");
};

const CASES = [
  ["NH10-SILIGURI-GANGTOK", "Rangpo", "Singtam"],
  ["NH2-DIMAPUR-IMPHAL", "Senapati", "Kangpokpi"],
  ["NH6-SHILLONG-SILCHAR", "Jowai", "Badarpur"],
  ["NH13-TEZPUR-TAWANG", "Dirang", "Tawang"],
  ["NH27-SILIGURI-GUWAHATI", "Bongaigaon", "Barpeta"],
  ["NH37-GUWAHATI-DIBRUGARH", "Golaghat", "Jorhat"],
];

async function main() {
  console.log("Live disruption-risk scoring against real Open-Meteo data\n");
  console.log(
    "corridor segment".padEnd(38) +
      "rain72h".padStart(9) +
      "  risk".padStart(8) +
      "  level".padEnd(11) +
      "top driver"
  );
  console.log("-".repeat(112));

  const rows = [];

  for (const [code, a, b] of CASES) {
    const corridor = NER_CORRIDORS.find((c) => c.code === code);
    const seg = fakeSegment(corridor, a, b);
    const mid = seg.geometry.coordinates[0];
    const weather = await fetchWeather(mid);
    const risk = scoreSegmentRisk({ segment: seg, weather, recentIncidentCount: 0 });

    rows.push({ seg, weather, risk });

    console.log(
      `${a} - ${b} (${corridor.highway})`.padEnd(38) +
        `${weather.rain72hMm.toFixed(0)} mm`.padStart(9) +
        `  ${risk.score.toFixed(3)}`.padStart(8) +
        `  ${risk.level}`.padEnd(11) +
        (risk.drivers[0] ? `${risk.drivers[0].factor} ${risk.drivers[0].detail}` : "-")
    );
  }

  console.log("\nrisk profile");
  for (const { seg, risk } of rows) {
    console.log(`  ${bar(risk.score)}  ${risk.score.toFixed(3)}  ${seg.from.name}-${seg.to.name}`);
  }

  console.log("\nsensitivity check - same segment, simulated monsoon burst");
  const corridor = NER_CORRIDORS.find((c) => c.code === "NH2-DIMAPUR-IMPHAL");
  const seg = fakeSegment(corridor, "Senapati", "Kangpokpi");
  for (const rain of [0, 40, 90, 160, 240]) {
    const w = {
      rain24hMm: rain * 0.5,
      rain72hMm: rain,
      rainForecast24hMm: rain * 0.3,
      maxHourlyRainMm: rain / 8,
      tempMinC: 18,
      snowfallCm: 0,
    };
    const r = scoreSegmentRisk({ segment: seg, weather: w });
    console.log(`  ${String(rain).padStart(4)} mm/72h  ${bar(r.score)}  ${r.score.toFixed(3)}  ${r.level}`);
  }

  console.log("\nprobe anomaly effect (dry weather, vehicles slowing)");
  for (const ratio of [1.0, 0.7, 0.45, 0.2, 0.1]) {
    const s = fakeSegment(corridor, "Senapati", "Kangpokpi", { probe: { speedRatio: ratio } });
    const r = scoreSegmentRisk({
      segment: s,
      weather: { rain24hMm: 2, rain72hMm: 8, rainForecast24hMm: 0, maxHourlyRainMm: 1, tempMinC: 20 },
    });
    console.log(
      `  speed ${(ratio * 100).toFixed(0).padStart(3)}% of normal  ${bar(r.score)}  ${r.score.toFixed(3)}  ${r.level}`
    );
  }

  const advisory = riskAdvisory({ ...rows[0].seg, risk: rows[0].risk });
  console.log("\nsample advisory payload");
  console.log(" ", advisory ? JSON.stringify(advisory) : "(no advisory - risk below threshold)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
