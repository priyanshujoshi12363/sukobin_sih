// Renders the dashboard in headless Chrome and reports what actually painted.
// The dev server binds IPv6 only on this machine, hence [::1].
const { chromium } = require("playwright-core");
const path = require("path");

const URL = process.env.DASH_URL || "http://[::1]:5173/";
const SHOT = path.resolve(__dirname, "../render-check.png");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

  const errors = [];
  const failedRequests = [];

  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));
  page.on("requestfailed", (r) =>
    failedRequests.push(r.url().slice(0, 90) + " -> " + (r.failure()?.errorText || "failed"))
  );

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000);

  const report = await page.evaluate(() => {
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
    const count = (sel) => document.querySelectorAll(sel).length;

    return {
      title: document.title,
      rootChildren: document.getElementById("root")?.children.length ?? 0,
      brand: text(".brand h1"),
      tagline: text(".brand span"),
      statTiles: count(".stat"),
      statValues: [...document.querySelectorAll(".stat")]
        .slice(0, 8)
        .map((s) => (s.querySelector(".v")?.textContent || "") + " " + (s.querySelector(".k")?.textContent || "")),
      distributions: count(".bars"),
      barRows: count(".bar-row"),
      alerts: count(".alert"),
      firstAlert: text(".alert .t"),
      tableRows: count("tbody tr"),
      firstRowCells: [...document.querySelectorAll("tbody tr:first-child td")].map((td) =>
        td.textContent.trim().replace(/\s+/g, " ").slice(0, 40)
      ),
      tabs: [...document.querySelectorAll(".tab")].map((t) => t.textContent.trim()),
      mapCanvas: count(".maplibregl-canvas"),
      mapToggles: [...document.querySelectorAll(".toggle")].map((t) => t.textContent.trim()),
      legendRows: count(".legend-row"),
      pill: text(".pill"),
      bodyTextLength: document.body.innerText.length,
    };
  });

  await page.screenshot({ path: SHOT, fullPage: false });

  console.log("RENDER CHECK\n");
  console.log("  title          :", report.title);
  console.log("  root children  :", report.rootChildren, report.rootChildren > 0 ? "(mounted)" : "(EMPTY - React did not mount)");
  console.log("  brand          :", report.brand, "|", report.tagline);
  console.log("  status pill    :", report.pill);
  console.log("");
  console.log("  stat tiles     :", report.statTiles);
  report.statValues.forEach((s) => console.log("      " + s));
  console.log("");
  console.log("  distributions  :", report.distributions, "with", report.barRows, "bars");
  console.log("  alerts         :", report.alerts, report.firstAlert ? "| first: " + report.firstAlert : "");
  console.log("  district rows  :", report.tableRows);
  if (report.firstRowCells.length) console.log("      " + report.firstRowCells.join("  |  "));
  console.log("  tabs           :", report.tabs.join(", "));
  console.log("");
  console.log("  MAP canvas     :", report.mapCanvas, report.mapCanvas > 0 ? "(rendering)" : "(NOT RENDERING)");
  console.log("  map toggles    :", report.mapToggles.join(", "));
  console.log("  legend rows    :", report.legendRows);
  console.log("  visible text   :", report.bodyTextLength, "chars");

  console.log("\n  console errors :", errors.length);
  errors.slice(0, 8).forEach((e) => console.log("      " + e));
  console.log("  failed requests:", failedRequests.length);
  failedRequests.slice(0, 8).forEach((r) => console.log("      " + r));

  console.log("\n  screenshot     :", SHOT);

  await browser.close();
})().catch((e) => {
  console.error("render check failed:", e.message);
  process.exit(1);
});
