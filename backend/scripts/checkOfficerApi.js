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
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = { parseError: true };
  }
  return { status: res.status, json };
}

async function signIn(phone) {
  const otpRes = await call("/otp", { method: "POST", body: { phone } });
  const code = otpRes.json?.devOtp;
  if (!code) throw new Error("no devOtp returned - is ALLOW_DEV_OTP set?");
  const login = await call("/login", { method: "POST", body: { phone, otp: code } });
  return login;
}

async function main() {
  console.log("\nOFFICER API\n");

  console.log("directory");
  const dir = await call("/directory");
  ok("public directory loads", dir.status === 200 && dir.json?.data?.districts?.length > 0,
     `${dir.json?.data?.districts?.length} districts, ${dir.json?.data?.languages?.length} languages`);

  console.log("\nauth");
  const bad = await call("/home");
  ok("home rejects anonymous", bad.status === 401);

  const badOtp = await call("/login", { method: "POST", body: { phone: "9000000001", otp: "000000" } });
  ok("login rejects wrong OTP", badOtp.status === 400, badOtp.json?.message);

  const unknown = await signIn("9111111119").catch(() => null);
  ok("unregistered number is told to register", unknown?.status === 404 && unknown.json?.needsRegistration === true);

  const district = await signIn("9000000001");
  ok("district officer signs in", district.status === 200 && Boolean(district.json?.token), district.json?.officer?.name);
  ok("district officer cannot confirm reports", district.json?.officer?.canVerifyIncidents === false);
  const dToken = district.json.token;

  const region = await signIn("9000000005");
  ok("regional officer signs in", region.status === 200 && Boolean(region.json?.token), region.json?.officer?.name);
  ok("regional officer can confirm reports", region.json?.officer?.canVerifyIncidents === true);
  const rToken = region.json.token;

  const verify = await call("/verify", { method: "POST", token: dToken });
  ok("token verifies and returns profile", verify.status === 200 && verify.json?.officer?.phone === "9000000001");

  console.log("\njurisdiction scoping");
  const dHome = await call("/home", { token: dToken });
  const rHome = await call("/home", { token: rToken });
  ok("district home loads", dHome.status === 200, `${dHome.json?.data?.coverage?.segments} roads, ${dHome.json?.data?.coverage?.lengthKm} km`);
  ok("region home loads", rHome.status === 200, `${rHome.json?.data?.coverage?.segments} roads, ${rHome.json?.data?.coverage?.lengthKm} km`);
  ok("region sees more than a district",
     (rHome.json?.data?.coverage?.segments || 0) > (dHome.json?.data?.coverage?.segments || 0));
  ok("home carries the model card", Boolean(rHome.json?.data?.model?.available),
     `AUC ${rHome.json?.data?.model?.metrics?.auc}`);
  ok("home carries live alerts", Array.isArray(rHome.json?.data?.alerts) && rHome.json.data.alerts.length > 0,
     `${rHome.json?.data?.alerts?.length} alerts`);
  ok("home carries the forecast", Array.isArray(rHome.json?.data?.upcoming),
     `${rHome.json?.data?.upcoming?.length} roads at risk`);

  console.log("\nsegments and forecast");
  const segs = await call("/segments", { token: rToken });
  const withForecast = (segs.json?.data?.segments || []).filter((s) => s.forecast?.h72 !== null);
  ok("segments list loads", segs.status === 200 && segs.json?.data?.segments?.length > 0,
     `${segs.json?.data?.segments?.length} roads`);
  ok("segments carry model forecasts", withForecast.length > 0, `${withForecast.length} scored`);

  const fc = await call("/forecast", { token: rToken });
  ok("forecast endpoint loads", fc.status === 200 && Array.isArray(fc.json?.data?.upcoming));
  ok("forecast explains itself", (fc.json?.data?.importance || []).length > 0,
     fc.json?.data?.importance?.[0]?.label);

  console.log("\nreporting from the field");
  const near = await call("/nearby?lng=93.9063&lat=25.6751", { token: dToken });
  ok("nearby roads found from a GPS fix", near.status === 200 && near.json?.data?.segments?.length > 0,
     near.json?.data?.segments?.[0]?.name);

  // The app shows the officer this list and they tap the road they are on.
  const pickedRoad = near.json.data.segments[0];

  const clientId = "test-" + Date.now();
  const report = await call("/report", {
    method: "POST",
    token: dToken,
    body: {
      clientId,
      segmentId: pickedRoad.segmentId,
      description: "Bhari barish se pahad se malba gir gaya hai, poora rasta band hai. JCB kal aayega.",
      coordinates: [93.9063, 25.6751],
      accuracyM: 8,
      district: "Kohima",
      state: "NL",
      capturedAt: new Date().toISOString(),
      photos: ["https://example.test/slide.jpg"],
    },
  });
  ok("field report accepted", report.status === 201 && Boolean(report.json?.data?.incident?.incidentId),
     `${report.json?.data?.incident?.type} / ${report.json?.data?.incident?.severity}`);
  ok("report was read by the classifier", Boolean(report.json?.data?.classification?.source),
     report.json?.data?.classification?.summary?.slice(0, 60));
  ok("report attached to the road the officer picked",
     report.json?.data?.incident?.segmentId === pickedRoad.segmentId,
     `${report.json?.data?.segment?.name} (${report.json?.data?.incident?.distanceToSegmentKm} km off centreline)`);

  const autoId = clientId + "-auto";
  const auto = await call("/report", {
    method: "POST", token: dToken,
    body: {
      clientId: autoId,
      description: "Sadak ke kinare chhota landslide, ek lane band hai",
      coordinates: [93.8358, 25.7223],
      capturedAt: new Date().toISOString(),
    },
  });
  ok("report with no road picked is matched automatically",
     Boolean(auto.json?.data?.incident?.segmentId),
     `${auto.json?.data?.segment?.name} (${auto.json?.data?.incident?.distanceToSegmentKm} km off)`);

  const orphan = await call("/report", {
    method: "POST", token: dToken,
    body: {
      clientId: clientId + "-orphan",
      description: "Test report far from any modelled highway",
      coordinates: [88.2, 22.6],
      capturedAt: new Date().toISOString(),
    },
  });
  ok("a report far from every road is flagged, not silently dropped",
     orphan.status === 201 && orphan.json?.data?.unmatched === true);

  const replay = await call("/report", {
    method: "POST",
    token: dToken,
    body: { clientId, description: "same report replayed", coordinates: [93.9063, 25.6751] },
  });
  ok("replaying the same report does not duplicate it", replay.json?.duplicate === true);

  const offline = await call("/report/sync", {
    method: "POST",
    token: dToken,
    body: {
      incidents: [
        { clientId: clientId + "-a", description: "Sadak par paani bhar gaya hai", coordinates: [93.7, 25.7], capturedAt: new Date().toISOString() },
        { clientId: clientId + "-b", description: "Bridge crack dikh raha hai", coordinates: [93.75, 25.72], capturedAt: new Date().toISOString() },
        { clientId, description: "already sent", coordinates: [93.9063, 25.6751] },
      ],
    },
  });
  ok("offline batch syncs", offline.status === 200 && offline.json?.data?.accepted === 2,
     `accepted ${offline.json?.data?.accepted}, duplicates ${offline.json?.data?.duplicates}`);

  const mine = await call("/reports", { token: dToken });
  ok("my reports list loads", mine.status === 200 && mine.json?.data?.reports?.length >= 3,
     `${mine.json?.data?.reports?.length} reports`);

  console.log("\nverification chain");
  const dQueue = await call("/verify-queue", { token: dToken });
  ok("district officer is refused the verify queue", dQueue.status === 403, dQueue.json?.message);

  const rQueue = await call("/verify-queue", { token: rToken });
  ok("senior officer sees the verify queue", rQueue.status === 200 && rQueue.json?.data?.pending?.length > 0,
     `${rQueue.json?.data?.total} waiting`);

  const target = rQueue.json.data.pending.find((p) => p.clientId === clientId);
  ok("the new report is in the queue", Boolean(target));

  const confirmed = await call(`/incident/${target.incidentId}/verify`, {
    method: "PATCH",
    token: rToken,
    body: { status: "VERIFIED", note: "Checked with the road crew on site" },
  });
  ok("senior officer confirms the report", confirmed.status === 200 && confirmed.json?.data?.incident?.status === "VERIFIED");
  ok("confirming moved the road status", Boolean(confirmed.json?.data?.segment?.status),
     `${target.segmentId} -> ${confirmed.json?.data?.segment?.status}`);

  const dOverride = await call(`/segment/${target.segmentId}/status`, {
    method: "POST", token: dToken, body: { status: "OPEN", note: "no" },
  });
  ok("district officer cannot override road status", dOverride.status === 403);

  const rOverride = await call(`/segment/${target.segmentId}/status`, {
    method: "POST", token: rToken, body: { status: "RESTRICTED", note: "one lane cleared", hours: 6 },
  });
  ok("senior officer can override road status", rOverride.status === 200 && rOverride.json?.data?.status === "RESTRICTED");

  console.log("\nlanguage");
  const enAlerts = await call("/alerts?lang=en", { token: rToken });
  const hiAlerts = await call("/alerts?lang=hi", { token: rToken });
  ok("alerts load in English", enAlerts.status === 200 && enAlerts.json?.data?.alerts?.length > 0);
  const enTitle = enAlerts.json?.data?.alerts?.[0]?.title;
  const hiTitle = hiAlerts.json?.data?.alerts?.[0]?.title;
  ok("alerts are translated", Boolean(hiTitle) && hiTitle !== enTitle, `"${enTitle}" -> "${hiTitle}"`);

  const langUpdate = await call("/profile", { method: "PATCH", token: dToken, body: { preferredLanguage: "hi" } });
  ok("officer can change language", langUpdate.json?.officer?.preferredLanguage === "hi");
  await call("/profile", { method: "PATCH", token: dToken, body: { preferredLanguage: "nag" } });

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("\nsuite crashed:", e.message);
  process.exit(1);
});
