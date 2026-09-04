const BASE = process.env.API_BASE || "http://127.0.0.1:5055/api/dashboard";

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

async function get(path) {
  const res = await fetch(BASE + path);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

async function post(path) {
  const res = await fetch(BASE + path, { method: "POST" });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, data: json.data };
}

async function main() {
  console.log("\nDASHBOARD API\n");

  console.log("existing endpoints still work");
  for (const p of ["/overview", "/segments", "/districts", "/corridors", "/alerts", "/emergency", "/meta"]) {
    const r = await get(p);
    ok(`GET ${p}`, r.status === 200 && r.json.success === true);
  }

  console.log("\ncoverage");
  const cov = await get("/coverage");
  ok("coverage loads", cov.status === 200 && cov.data.segments > 0,
     `${cov.data?.statusKnown}/${cov.data?.segments} roads have a known status`);
  ok("coverage reports forecast reach", cov.data?.percentWithForecast === 100,
     `${cov.data?.percentWithForecast}% forecast, ${cov.data?.percentWithVehicles}% with live vehicles`);
  ok("coverage explains the gap", Boolean(cov.data?.note));

  console.log("\nforecast");
  const fc = await get("/forecast");
  ok("forecast loads", fc.status === 200 && Array.isArray(fc.data.upcoming),
     `${fc.data?.upcoming?.length} roads at risk`);
  ok("model card present", fc.data?.model?.available === true,
     `${fc.data?.model?.chosen}, AUC ${fc.data?.model?.metrics?.auc}`);
  ok("model reports its training data", (fc.data?.model?.dataset?.rows || 0) > 10000,
     `${fc.data?.model?.dataset?.rows?.toLocaleString()} rows`);
  ok("feature importance present", (fc.data?.importance || []).length >= 5,
     fc.data?.importance?.[0]?.label);
  const top = fc.data?.upcoming?.[0];
  ok("each forecast carries reasons", Array.isArray(top?.drivers) && top.drivers.length > 0,
     top ? `${top.name}: ${top.drivers.map((d) => d.factor).join(", ")}` : "");

  console.log("\nbottlenecks");
  const bn = await get("/bottlenecks");
  ok("bottlenecks load", bn.status === 200 && bn.data.bottlenecks.length > 0,
     `${bn.data?.bottlenecks?.length} ranked of ${bn.data?.counted}`);
  ok("ranked by exposure, highest first",
     bn.data.bottlenecks.every((b, i, a) => i === 0 || a[i - 1].exposure >= b.exposure));
  ok("every bottleneck says why", bn.data.bottlenecks.every((b) => b.reasons.length > 0));
  ok("scoring is explained", Boolean(bn.data?.scoring));

  console.log("\n  top weak points");
  for (const b of bn.data.bottlenecks.slice(0, 6)) {
    console.log(`    ${String(b.exposure).padStart(3)}  ${b.name}`);
    console.log(`         ${b.reasons.join("; ")}`);
  }

  console.log("\nlive alerts");
  const la = await get("/live-alerts");
  ok("live alerts load", la.status === 200 && Array.isArray(la.data.alerts),
     `${la.data?.total} active`);
  const hi = await get("/live-alerts?lang=hi");
  const enTitle = la.data?.alerts?.[0]?.title;
  const hiTitle = hi.data?.alerts?.[0]?.title;
  ok("alerts translate", Boolean(hiTitle) && hiTitle !== enTitle, `"${enTitle}" -> "${hiTitle}"`);

  console.log("\nmap layer carries the forecast");
  const segs = await get("/segments");
  const feats = segs.data?.features || [];
  const scored = feats.filter((f) => f.properties.forecastH72 !== null);
  ok("segments geojson loads", feats.length > 0, `${feats.length} features`);
  ok("features carry a 3-day forecast", scored.length === feats.length,
     `${scored.length}/${feats.length}`);
  ok("features carry forecast reasons",
     feats.some((f) => (f.properties.forecastDrivers || []).length > 0));

  console.log("\nrecompute endpoints");
  const scan = await post("/alerts/scan");
  ok("alert scan runs", scan.status === 200 && typeof scan.data?.raised === "number",
     `raised ${scan.data?.raised}, delivered ${scan.data?.delivered?.sent}`);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\nsuite crashed:", e.message);
  process.exit(1);
});
