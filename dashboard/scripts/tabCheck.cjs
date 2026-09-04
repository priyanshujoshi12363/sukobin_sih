// Clicks through every right-rail tab and reports what each one actually
// painted, plus a screenshot per tab.
const { chromium } = require("playwright-core");
const path = require("path");

const URL = process.env.DASH_URL || "http://[::1]:5173/";
const OUT = path.resolve(__dirname, "..");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text().slice(0, 160));
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000);

  const overflow = await page.evaluate(() => {
    const rails = [...document.querySelectorAll(".rail")];
    const right = rails[rails.length - 1];
    const tabs = right?.querySelector(".tabs");
    if (!tabs) return null;
    return {
      scrollWidth: tabs.scrollWidth,
      clientWidth: tabs.clientWidth,
      overflowing: tabs.scrollWidth > tabs.clientWidth + 1,
      tabCount: tabs.querySelectorAll(".tab").length,
    };
  });

  console.log("RIGHT RAIL TABS");
  console.log("  count       :", overflow?.tabCount);
  console.log("  scrollWidth :", overflow?.scrollWidth, "clientWidth:", overflow?.clientWidth);
  console.log("  OVERFLOWING :", overflow?.overflowing ? "YES - tabs are cut off" : "no");
  console.log("");

  const tabNames = await page.evaluate(() => {
    const rails = [...document.querySelectorAll(".rail")];
    const right = rails[rails.length - 1];
    return [...right.querySelectorAll(".tab")].map((t) => t.textContent.trim());
  });

  for (const name of tabNames) {
    await page.evaluate((n) => {
      const rails = [...document.querySelectorAll(".rail")];
      const right = rails[rails.length - 1];
      const tab = [...right.querySelectorAll(".tab")].find((t) => t.textContent.trim() === n);
      tab?.click();
    }, name);

    await page.waitForTimeout(1400);

    const report = await page.evaluate(() => {
      const rails = [...document.querySelectorAll(".rail")];
      const right = rails[rails.length - 1];
      const body = right.querySelector(".section:last-child") || right;
      return {
        cards: body.querySelectorAll(".alert").length,
        bars: body.querySelectorAll(".bar-row").length,
        rows: body.querySelectorAll(".kv").length,
        empty: body.querySelector(".empty")?.textContent?.trim()?.slice(0, 80) || null,
        text: body.innerText.replace(/\s+/g, " ").trim().slice(0, 190),
      };
    });

    console.log(`TAB: ${name}`);
    console.log(`  cards ${report.cards}  bars ${report.bars}  kv-rows ${report.rows}`);
    if (report.empty) console.log(`  empty state: ${report.empty}`);
    console.log(`  ${report.text}`);
    console.log("");

    await page.screenshot({
      path: path.join(OUT, `tab-${name.replace(/\s+/g, "-")}.png`),
      clip: { x: 1240, y: 0, width: 360, height: 950 },
    });
  }

  console.log("errors:", errors.length);
  errors.slice(0, 6).forEach((e) => console.log("   ", e));

  await browser.close();
})().catch((e) => {
  console.error("tab check failed:", e.message);
  process.exit(1);
});
