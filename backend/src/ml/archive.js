import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ARCHIVE_URL = process.env.OPEN_METEO_ARCHIVE_URL || "https://archive-api.open-meteo.com/v1/archive";
const TIMEOUT_MS = Number(process.env.ARCHIVE_TIMEOUT_MS) || 60000;

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(here, "../../.cache/archive");

const key = (lat, lng, start, end) =>
  `${lat.toFixed(3)}_${lng.toFixed(3)}_${start}_${end}`.replace(/[^\w.-]/g, "");

function readCache(k) {
  const f = path.join(CACHE_DIR, k + ".json");
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(k, value) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, k + ".json"), JSON.stringify(value));
}

/**
 * Real observed hourly weather for one point, collapsed to daily buckets.
 * Returns [{ date, rainMm, maxHourlyMm, snowCm, tMinC, freezeHours }] in order.
 */
export async function fetchDailyHistory(coordinates, startDate, endDate) {
  const [lng, lat] = coordinates;
  const k = key(lat, lng, startDate, endDate);

  const cached = readCache(k);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: startDate,
    end_date: endDate,
    hourly: "precipitation,snowfall,temperature_2m",
    timezone: "Asia/Kolkata",
  });

  // The archive endpoint answers 429 well before its documented daily quota, so
  // back off and retry rather than dropping the stretch from the training set.
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(`${ARCHIVE_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) break;
    if (res.status !== 429 && res.status < 500) break;
    await sleep(Math.min(60000, 4000 * 2 ** attempt));
  }
  if (!res.ok) throw new Error(`open-meteo archive ${res.status} for ${lat},${lng}`);

  const data = await res.json();
  const times = data?.hourly?.time || [];
  const precip = data?.hourly?.precipitation || [];
  const snow = data?.hourly?.snowfall || [];
  const temp = data?.hourly?.temperature_2m || [];

  const byDay = new Map();
  for (let i = 0; i < times.length; i++) {
    const day = String(times[i]).slice(0, 10);
    if (!byDay.has(day)) {
      byDay.set(day, { date: day, rainMm: 0, maxHourlyMm: 0, snowCm: 0, tMinC: null, freezeHours: 0 });
    }
    const b = byDay.get(day);
    const p = Number(precip[i]) || 0;
    const s = Number(snow[i]) || 0;
    const t = temp[i] === null || temp[i] === undefined ? null : Number(temp[i]);

    b.rainMm += p;
    if (p > b.maxHourlyMm) b.maxHourlyMm = p;
    b.snowCm += s;
    if (t !== null) {
      b.tMinC = b.tMinC === null ? t : Math.min(b.tMinC, t);
      if (t <= 0) b.freezeHours++;
    }
  }

  const out = [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: b.date,
      rainMm: +b.rainMm.toFixed(2),
      maxHourlyMm: +b.maxHourlyMm.toFixed(2),
      snowCm: +b.snowCm.toFixed(2),
      tMinC: b.tMinC === null ? null : +b.tMinC.toFixed(1),
      freezeHours: b.freezeHours,
    }));

  writeCache(k, out);
  return out;
}

// Open-Meteo rate-limits hard on bursts, so keep the fan-out small.
export async function fetchDailyHistoryBatch(points, startDate, endDate, { concurrency = 2, onProgress } = {}) {
  const out = new Map();
  const queue = [...points];
  let done = 0;

  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      if (!p) break;
      try {
        out.set(p.key, await fetchDailyHistory(p.coordinates, startDate, endDate));
      } catch (e) {
        out.set(p.key, null);
        onProgress?.({ key: p.key, error: e.message, done: ++done, total: points.length });
        continue;
      }
      onProgress?.({ key: p.key, done: ++done, total: points.length });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
