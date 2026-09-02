const OPEN_METEO = process.env.OPEN_METEO_URL || "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS) || 9000;
const CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_MS) || 30 * 60 * 1000;

const cache = new Map();

const keyOf = (lng, lat) => `${lng.toFixed(2)},${lat.toFixed(2)}`;

const sum = (arr, from, to) =>
  (arr || []).slice(Math.max(0, from), Math.max(0, to)).reduce((a, b) => a + (Number(b) || 0), 0);

export const EMPTY_WEATHER = {
  rain24hMm: 0,
  rain72hMm: 0,
  rainForecast24hMm: 0,
  maxHourlyRainMm: 0,
  tempMinC: null,
  snowfallCm: 0,
  source: "none",
  fetchedAt: null,
};

export async function fetchWeather(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return { ...EMPTY_WEATHER };
  const [lng, lat] = coordinates;
  const k = keyOf(lng, lat);

  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "precipitation,snowfall,temperature_2m",
    past_days: "3",
    forecast_days: "2",
    timezone: "Asia/Kolkata",
  });

  try {
    const res = await fetch(`${OPEN_METEO}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = await res.json();

    const precip = data?.hourly?.precipitation || [];
    const snow = data?.hourly?.snowfall || [];
    const temp = data?.hourly?.temperature_2m || [];
    const times = data?.hourly?.time || [];

    const nowIso = new Date().toISOString().slice(0, 13);
    let nowIdx = times.findIndex((t) => String(t).slice(0, 13) >= nowIso);
    if (nowIdx < 0) nowIdx = Math.min(times.length - 1, 72);

    const past24 = precip.slice(Math.max(0, nowIdx - 24), nowIdx);

    const value = {
      rain24hMm: +sum(precip, nowIdx - 24, nowIdx).toFixed(1),
      rain72hMm: +sum(precip, nowIdx - 72, nowIdx).toFixed(1),
      rainForecast24hMm: +sum(precip, nowIdx, nowIdx + 24).toFixed(1),
      maxHourlyRainMm: +Math.max(0, ...past24.map((n) => Number(n) || 0)).toFixed(1),
      tempMinC: temp.length ? Math.min(...temp.slice(nowIdx, nowIdx + 24).map(Number)) : null,
      snowfallCm: +sum(snow, nowIdx - 24, nowIdx + 24).toFixed(1),
      source: "open-meteo",
      fetchedAt: new Date(),
    };

    cache.set(k, { at: Date.now(), value });
    return value;
  } catch {
    if (hit) return hit.value;
    return { ...EMPTY_WEATHER };
  }
}

export async function fetchWeatherBatch(points, concurrency = 6) {
  const out = new Map();
  const queue = [...points];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const p = queue.shift();
      if (!p) break;
      out.set(p.key, await fetchWeather(p.coordinates));
    }
  });
  await Promise.all(workers);
  return out;
}

export const clearWeatherCache = () => cache.clear();
